import { mermaidEditor } from "../edit/mermaid";
import { locateMermaid, parseMermaid, type MermaidModel } from "../locate/mermaid";
import { locateSequence, parseSequence } from "../locate/sequence";
import { layoutSequence } from "../sequence/layout";
import type { LocateIndex } from "../locate/types";
import { lineColumnAt, offsetOfLine } from "../locate/types";
import type { Point, Rect } from "../model/geometry";
import type {
  ArrowKind,
  Cluster,
  Diagnostic,
  Direction,
  Family,
  GraphEdge,
  GraphNode,
  GraphScene,
  LayoutResult,
  PassthroughScene,
  Scene,
} from "../model/scene";
import { edgeId } from "../model/scene";
import { themeByName, type DiagramTheme } from "../theme";
import { MERMAID_CONFIG, mermaidThemeVariables } from "./mermaidConfig";
import {
  nearestNode,
  readMermaidGeometry,
  type ReadEdge,
  type ReadGeometry,
} from "./mermaidReadback";
import { makeFingerprinter, type EngineAdapter, type LayoutOpts } from "./types";


type MermaidModule = typeof import("mermaid")["default"];

let mermaidPromise: Promise<MermaidModule> | null = null;


async function loadMermaid(): Promise<MermaidModule> {
  mermaidPromise ??= import("mermaid").then((m) => m.default);
  return mermaidPromise;
}


let configuredTheme: string | null = null;

function configure(mermaid: MermaidModule, theme: DiagramTheme | undefined): void {
  const key = theme?.id ?? "default";
  if (configuredTheme === key) return;

  mermaid.initialize({
    ...MERMAID_CONFIG,
    ...(theme ? { themeVariables: mermaidThemeVariables(theme) } : {}),
  } as Parameters<MermaidModule["initialize"]>[0]);
  configuredTheme = key;
}


let renderCounter = 0;


const MODELLED: ReadonlySet<Family> = new Set<Family>(["graph", "sequence"]);


interface Rendered {
  svg: Element;
  renderId: string;
  raw: string;
}

async function renderToDom(source: string, theme?: DiagramTheme): Promise<Rendered> {
  const mermaid = await loadMermaid();
  configure(mermaid, theme);

  const renderId = `zdraft-${++renderCounter}`;
  const { svg: raw } = await mermaid.render(renderId, source);

  const doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  const parseError = doc.querySelector("parsererror");
  if (parseError) throw new Error("Mermaid produced markup that could not be parsed.");

  return { svg: doc.documentElement, renderId, raw };
}


export function diagnosticFromMermaidError(err: unknown, source: string): Diagnostic {
  const message = err instanceof Error ? err.message : String(err);
  const line = Number(/line[:\s]+(\d+)/i.exec(message)?.[1]);
  const headline = message.split("\n")[0]!.trim();

  const range =
    Number.isFinite(line) && line > 0
      ? { from: offsetOfLine(source, line), to: offsetOfLine(source, line + 1) }
      : undefined;

  return {
    severity: "error",
    message: headline || "Mermaid could not render this diagram.",
    line: Number.isFinite(line) && line > 0 ? line : undefined,
    column: range ? lineColumnAt(source, range.from).column : undefined,
    range,
    fix: range ? { kind: "goto", range } : undefined,
  };
}


function arrowFor(model: { arrowEnd: boolean }): ArrowKind {
  return model.arrowEnd ? "arrow" : "none";
}


export function buildGraphScene(
  model: MermaidModel,
  geo: ReadGeometry,
  source: string,
): GraphScene {
  const locate = locateMermaid(source);
  const fp = makeFingerprinter();
  const byId = new Map(geo.nodes.map((n) => [n.id, n]));

  const nodes: GraphNode[] = [];

  for (const read of geo.nodes) {
    const parsed = model.nodes.get(read.id);
    const label = parsed?.label ?? read.text ?? read.id;

    nodes.push({
      id: read.id,


      body: parsed?.sections?.length
        ? {
            kind: "compartments",
            title: label,
            stereotype: parsed.stereotype,
            sections: parsed.sections,
          }
        : { kind: "label", text: label },
      shape: parsed?.shape ?? "rect",
      rect: read.rect,
      fingerprint: fp(model.type, label),
      sourceRange: locate.nodes.get(read.id),
    });
  }

  const subById = new Map(model.subgraphs.map((s) => [s.id, s]));

  const clusters: Cluster[] = geo.clusters.map((read) => {
    const sub = subById.get(read.id);
    return {
      id: read.id,
      label: sub?.title ?? read.label,


      parent: sub?.parent && geo.clusters.some((c) => c.id === sub.parent) ? sub.parent : undefined,
      rect: read.rect,
      sourceRange: locate.nodes.get(read.id),
    };
  });


  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const depthOf = (id: string): number => {
    let depth = 0;
    let parent = subById.get(id)?.parent;
    while (parent && depth <= model.subgraphs.length) {
      depth += 1;
      parent = subById.get(parent)?.parent;
    }
    return depth;
  };

  const claimedAt = new Map<string, number>();
  for (const sub of model.subgraphs) {
    const depth = depthOf(sub.id);
    for (const member of sub.members) {
      const node = nodeById.get(member);
      if (!node) continue;
      if (node.parent !== undefined && (claimedAt.get(node.id) ?? -1) >= depth) continue;
      node.parent = sub.id;
      claimedAt.set(node.id, depth);
    }
  }

  const edges = buildEdges(model, geo, byId, locate);

  return {
    family: "graph",
    engine: "mermaid",
    diagramType: model.type,
    direction: model.direction as Direction,
    nodes,
    edges,
    clusters,
    bounds: geo.bounds,
  };
}

function buildEdges(
  model: MermaidModel,
  geo: ReadGeometry,
  byId: ReadonlyMap<string, { rect: Rect }>,
  locate: LocateIndex,
): GraphEdge[] {
  const known = new Set(byId.keys());
  const pairSeen = new Map<string, number>();


  const unclaimed = [...model.edges];

  return geo.edges.flatMap((read): GraphEdge[] => {
    const resolved = resolveEndpoints(read, geo, known);
    if (!resolved) return [];

    const { from, to } = resolved;


    const matchIndex = unclaimed.findIndex((e) => e.from === from && e.to === to);
    const parsed = matchIndex >= 0 ? unclaimed.splice(matchIndex, 1)[0]! : undefined;

    const key = `${from}->${to}`;
    const ordinal = pairSeen.get(key) ?? 0;
    pairSeen.set(key, ordinal + 1);
    const id = edgeId(from, to, ordinal);

    const labelText = parsed?.label ?? read.labelText;
    const labelAt = read.labelAt ?? midpoint(read.points);

    return [
      {
        id,
        from,
        to,
        route: { kind: "poly", points: read.points },
        arrowEnd: read.points[read.points.length - 1],
        startArrow: parsed?.arrowStart ? "arrow" : "none",
        endArrow: parsed ? arrowFor(parsed) : "arrow",
        label: labelText ? { text: labelText, at: labelAt } : undefined,
        style:
          parsed && (parsed.dashed || parsed.thick)
            ? { dashed: parsed.dashed, strokeWidth: parsed.thick ? 3 : undefined }
            : undefined,
        sourceRange: locate.edges.get(id) ?? parsed?.range,
      },
    ];
  });
}


function resolveEndpoints(
  read: ReadEdge,
  geo: ReadGeometry,
  known: ReadonlySet<string>,
): { from: string; to: string } | null {
  if (read.from && read.to) return { from: read.from, to: read.to };

  const first = read.points[0];
  const last = read.points[read.points.length - 1];
  if (!first || !last) return null;

  const from = nearestNode(first, geo.nodes);
  const to = nearestNode(last, geo.nodes);
  if (!from || !to || !known.has(from) || !known.has(to)) return null;

  return { from, to };
}

function midpoint(points: readonly Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  return points[Math.floor(points.length / 2)]!;
}

function passthrough(
  type: string,
  raw: string,
  bounds: Rect,
  reason: string,
): PassthroughScene {
  return { family: "passthrough", engine: "mermaid", diagramType: type, svg: raw, bounds, reason };
}

function emptyScene(type: string): GraphScene {
  return {
    family: "graph",
    engine: "mermaid",
    diagramType: type,
    direction: "TB",
    nodes: [],
    edges: [],
    clusters: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 },
  };
}


function viewBoxOf(svg: Element): Rect {
  const parts = (svg.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) {
    return { x: parts[0]!, y: parts[1]!, w: parts[2]!, h: parts[3]! };
  }
  return { x: 0, y: 0, w: Number(svg.getAttribute("width")) || 0, h: Number(svg.getAttribute("height")) || 0 };
}


export const mermaidAdapter: EngineAdapter = {
  id: "mermaid",
  label: "Mermaid",
  extensions: [".mmd", ".mermaid"],

  detectFamily(source: string): Family {
    const model = parseMermaid(source);

    return MODELLED.has(model.family) ? model.family : "passthrough";
  },

  async layout(source: string, opts: LayoutOpts = {}): Promise<LayoutResult> {
    const model = parseMermaid(source);
    const diagnostics: Diagnostic[] = [];

    if (model.family === "sequence") {


      const parsed = parseSequence(source);
      const scene = layoutSequence(parsed, {
        theme: opts.theme ?? themeByName(null),
        hints: opts.sequenceHints,
      });

      if (parsed.participants.length === 0) {
        diagnostics.push({ severity: "info", message: "No participants yet." });
      }
      return { scene, diagnostics };
    }

    let rendered: Rendered;
    try {
      rendered = await renderToDom(source, opts.theme);
    } catch (err) {
      return { scene: emptyScene(model.type), diagnostics: [diagnosticFromMermaidError(err, source)] };
    }

    if (!MODELLED.has(model.family)) {


      const reason = `ZDraft does not model ${model.type} diagrams, so this renders read-only. The source is untouched and still yours.`;

      return {
        scene: passthrough(model.type, rendered.raw, viewBoxOf(rendered.svg), reason),
        diagnostics,
      };
    }

    const geo = readMermaidGeometry(rendered.svg, rendered.renderId);
    const scene: Scene = buildGraphScene(model, geo, source);

    if (geo.nodes.length === 0) {
      diagnostics.push({ severity: "info", message: "This diagram has no nodes yet." });
    }


    const drawn = new Set(geo.nodes.map((n) => n.id));
    const missing = [...model.nodes.keys()].filter((id) => !drawn.has(id));
    if (missing.length > 0 && geo.nodes.length > 0) {
      diagnostics.push({
        severity: "warning",
        message: `${missing.length} declared node${missing.length === 1 ? "" : "s"} did not render: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? "…" : ""}`,
      });
    }

    return { scene, diagnostics };
  },

  edit: mermaidEditor,

  locate(source: string): LocateIndex {

    return parseMermaid(source).family === "sequence"
      ? locateSequence(source)
      : locateMermaid(source);
  },
};
