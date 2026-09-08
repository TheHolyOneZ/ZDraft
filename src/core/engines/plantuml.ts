import type { Rect } from "../model/geometry";
import { unionRects } from "../model/geometry";
import { pumlEditor } from "../edit/puml";
import { locatePlantUml, parsePlantUml, type PumlModel } from "../locate/puml";
import type { LocateIndex } from "../locate/types";
import {
  edgeId,
  type ArrowKind,
  type Cluster,
  type Diagnostic,
  type Family,
  type GraphEdge,
  type GraphNode,
  type GraphScene,
  type LayoutResult,
  type NodeBody,
  type PassthroughScene,
  type Scene,
} from "../model/scene";
import {
  isGraphDiagramType,
  readPlantUmlGeometry,
  type ReadPumlGeometry,
} from "./plantumlReadback";
import { personRect } from "../render/shapes";
import { DEFAULT_FONT_SIZE } from "../theme";
import type { DiagramTheme } from "../theme";
import { makeFingerprinter, type EngineAdapter, type LayoutOpts } from "./types";


export interface PlantUmlStatus {

  ready: boolean;

  reason: string;

  remedy: string;
}


export interface PlantUmlRunner {

  render(source: string, skinparams: readonly string[]): Promise<string>;
  status(): Promise<PlantUmlStatus>;
  parse(svg: string): Element | null;
}

let runner: PlantUmlRunner | null = null;


export function setPlantUmlRunner(next: PlantUmlRunner | null): void {
  runner = next;
}

export function plantUmlRunner(): PlantUmlRunner | null {
  return runner;
}


function hex(colour: string): string | null {
  const match = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec(colour.trim());
  return match ? match[1]! : null;
}


export function skinparamsFor(theme: DiagramTheme | undefined): string[] {
  if (!theme) return [];

  const params: string[] = [];
  const add = (name: string, colour: string | undefined) => {
    const value = colour ? hex(colour) : null;
    if (value) params.push(`${name}=#${value}`);
  };


  params.push("backgroundColor=transparent");
  params.push("shadowing=false");
  params.push("defaultFontName=Inter");

  add("defaultFontColor", theme.nodeText);
  add("arrowColor", theme.edge);
  add("arrowFontColor", theme.edgeText);
  add("noteBackgroundColor", theme.nodeFill);
  add("noteBorderColor", theme.nodeStroke);
  add("noteFontColor", theme.nodeText);


  for (const kind of [
    "participant",
    "actor",
    "boundary",
    "control",
    "entity",
    "database",
    "collections",
    "queue",
  ]) {
    add(`${kind}BackgroundColor`, theme.nodeFill);
    add(`${kind}BorderColor`, theme.nodeStroke);
    add(`${kind}FontColor`, theme.nodeText);
  }

  add("sequenceLifeLineBorderColor", theme.edge);
  add("sequenceGroupBodyBackgroundColor", theme.background);
  add("sequenceBoxBorderColor", theme.clusterStroke);
  add("activityBackgroundColor", theme.nodeFill);
  add("activityBorderColor", theme.nodeStroke);
  add("activityFontColor", theme.nodeText);
  add("activityDiamondBackgroundColor", theme.nodeFill);
  add("activityDiamondBorderColor", theme.nodeStroke);
  add("activityDiamondFontColor", theme.nodeText);
  add("titleFontColor", theme.nodeText);

  return params;
}


function mapHead(head: string): ArrowKind {
  switch (head) {
    case "arrow":
      return "arrow";
    case "generalisation":
      return "open";
    case "composition":
      return "diamond";
    case "aggregation":
      return "odiamond";
    default:
      return "none";
  }
}

function bodyFor(label: string, model: PumlModel, id: string): NodeBody {
  const entity = model.entities.get(id);
  const sections = (entity?.sections ?? []).filter((s) => s.items.length > 0);

  if (sections.length === 0 && !entity?.stereotype) {
    return { kind: "label", text: label };
  }

  return {
    kind: "compartments",
    title: label,
    stereotype: entity?.stereotype,
    sections,
  };
}


export function buildPlantUmlScene(
  geometry: ReadPumlGeometry,
  source: string,
  model: PumlModel = parsePlantUml(source),
): GraphScene {
  const locate = locatePlantUml(source);
  const fp = makeFingerprinter();

  const nameByRef = new Map<string, string>();
  for (const entity of [...geometry.entities, ...geometry.clusters]) {
    nameByRef.set(entity.ref, entity.id);
  }

  const clusterIds = new Set(geometry.clusters.map((c) => c.id));

  const nodes: GraphNode[] = geometry.entities.map((read) => {
    const parsed = model.entities.get(read.id);


    const marker = read.marker !== undefined;
    const label = marker ? "" : (parsed?.label ?? read.text ?? read.id);
    const shape = marker ? "circle" : (parsed?.shape ?? "rect");

    return {
      id: read.id,
      body: marker ? { kind: "label", text: "" } : bodyFor(label, model, read.id),
      shape,


      rect: shape === "person" ? personRect(read.rect, label, DEFAULT_FONT_SIZE) : read.rect,
      fingerprint: fp(marker ? `state-${read.marker}` : shape, label),
      parent: parentOf(read.id, clusterIds),
      sourceRange: locate.nodes.get(read.id),
    };
  });

  const clusters: Cluster[] = geometry.clusters.map((read) => {
    const parsed = model.packages.get(read.id);
    return {
      id: read.id,
      label: parsed?.label ?? read.text,
      rect: read.rect,
      parent: parentOf(read.id, clusterIds),
      sourceRange: locate.nodes.get(read.id),
    };
  });

  const edges: GraphEdge[] = [];
  const pairSeen = new Map<string, number>();

  for (const link of geometry.links) {
    const from = nameByRef.get(link.fromRef);
    const to = nameByRef.get(link.toRef);
    if (!from || !to) continue;

    const pair = `${from}->${to}`;
    const ordinal = pairSeen.get(pair) ?? 0;
    pairSeen.set(pair, ordinal + 1);
    const id = edgeId(from, to, ordinal);


    const declared = model.links.find(
      (l) => l.from === from && l.to === to && (l.label ?? "") === (link.label ?? ""),
    );

    edges.push({
      id,
      from,
      to,
      route: { kind: "poly", points: link.points },
      arrowStart: link.points[0],
      arrowEnd: link.points[link.points.length - 1],
      startArrow: mapHead(declared?.tail ?? "none"),
      endArrow: mapHead(declared?.head ?? (link.arrowEnd ? "arrow" : "none")),
      label:
        link.label && link.labelAt ? { text: link.label, at: link.labelAt } : undefined,
      style: declared?.dashed ? { dashed: true } : undefined,
      sourceRange: locate.edges.get(id),
    });
  }

  return {
    family: "graph",
    engine: "plantuml",
    diagramType: geometry.diagramType.toLowerCase() || "uml",


    direction: "TB",
    nodes,
    edges,
    clusters,
    bounds: boundsOf(nodes, clusters, edges, geometry.bounds),
  };
}


function parentOf(id: string, clusters: ReadonlySet<string>): string | undefined {
  let cut = id.lastIndexOf(".");
  while (cut > 0) {
    const candidate = id.slice(0, cut);
    if (clusters.has(candidate)) return candidate;
    cut = candidate.lastIndexOf(".");
  }
  return undefined;
}

function boundsOf(
  nodes: readonly GraphNode[],
  clusters: readonly Cluster[],
  edges: readonly GraphEdge[],
  fallback: Rect,
): Rect {
  const rects: Rect[] = [...nodes.map((n) => n.rect), ...clusters.map((c) => c.rect)];
  for (const edge of edges) {
    for (const p of edge.route.points) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  if (rects.length === 0) return fallback;

  const box = unionRects(rects);
  const pad = 12;
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}


function passthrough(svg: string, geometry: ReadPumlGeometry, kind: string): PassthroughScene {
  return {
    family: "passthrough",
    engine: "plantuml",
    diagramType: kind,
    svg: stripOuterSvg(svg),
    bounds: geometry.bounds,
    reason: `ZDraft shows PlantUML ${kind} diagrams as PlantUML draws them. They have no positions to override, so nothing here can be dragged.`,
  };
}


function stripOuterSvg(svg: string): string {
  const open = svg.indexOf(">", svg.indexOf("<svg"));
  const close = svg.lastIndexOf("</svg>");
  if (open < 0 || close < 0) return svg;
  return svg.slice(open + 1, close);
}


function emptyScene(): GraphScene {
  return {
    family: "graph",
    engine: "plantuml",
    diagramType: "uml",
    direction: "TB",
    nodes: [],
    edges: [],
    clusters: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 },
  };
}

export const plantumlAdapter: EngineAdapter = {
  id: "plantuml",
  label: "PlantUML",
  extensions: [".puml", ".plantuml", ".pu", ".iuml", ".wsd"],


  detectFamily(): Family {
    return "graph";
  },

  async available() {
    if (!runner) {
      return {
        ok: false as const,
        reason: "PlantUML needs the desktop app.",
        remedy: "Open this file in ZDraft rather than the browser preview.",
      };
    }

    const status = await runner.status();
    return status.ready
      ? { ok: true as const }
      : { ok: false as const, reason: status.reason, remedy: status.remedy };
  },

  async layout(source: string, opts: LayoutOpts = {}): Promise<LayoutResult> {
    if (!runner) {
      return {
        scene: emptyScene(),
        diagnostics: [
          {
            severity: "error",
            message: "PlantUML needs the desktop app; the browser preview cannot run it.",
          },
        ],
      };
    }

    let svg: string;
    try {
      svg = await runner.render(source, skinparamsFor(opts.theme));
    } catch (err) {
      return { scene: emptyScene(), diagnostics: [diagnosticFrom(err, source)] };
    }

    const root = runner.parse(svg);
    if (!root) {
      return {
        scene: emptyScene(),
        diagnostics: [
          {
            severity: "error",
            message: "PlantUML returned something that is not an SVG.",
          },
        ],
      };
    }

    const geometry = readPlantUmlGeometry(root);
    const model = parsePlantUml(source);

    if (!isGraphDiagramType(geometry.diagramType)) {
      const kind = geometry.diagramType.toLowerCase() || model.kind;
      return {
        scene: passthrough(svg, geometry, kind) as Scene,
        diagnostics: [
          {
            severity: "info",
            message: `Shown as PlantUML drew it. ZDraft does not model ${kind} diagrams, so nothing here can be dragged.`,
          },
        ],
      };
    }

    const scene = buildPlantUmlScene(geometry, source, model);
    const diagnostics: Diagnostic[] = [];

    if (scene.nodes.length === 0) {
      diagnostics.push({ severity: "info", message: "This diagram has no elements yet." });
    }

    return { scene, diagnostics };
  },

  edit: pumlEditor,

  locate(source: string): LocateIndex {
    return locatePlantUml(source);
  },
};


function diagnosticFrom(err: unknown, source: string): Diagnostic {
  const shaped = err as { message?: string; remedy?: string } | undefined;
  const message = shaped?.message ?? String(err);
  const remedy = shaped?.remedy;

  const at = /\bline (\d+)\b/i.exec(message);
  const line = at ? Number(at[1]) : undefined;

  return {
    severity: "error",
    message: remedy ? `${message} — ${remedy}` : message,
    line,
    range: line ? lineRange(source, line) : undefined,
  };
}

function lineRange(source: string, line: number): { from: number; to: number } | undefined {
  const lines = source.split("\n");
  if (line < 1 || line > lines.length) return undefined;

  let from = 0;
  for (let i = 0; i < line - 1; i += 1) from += lines[i]!.length + 1;
  return { from, to: from + lines[line - 1]!.length };
}

