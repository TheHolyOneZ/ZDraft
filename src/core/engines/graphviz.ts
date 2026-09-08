import { Graphviz } from "@hpcc-js/wasm-graphviz";

import { dotEditor } from "../edit/dot";
import { locateDot, tokenizeDot } from "../locate/dot";
import type { LocateIndex } from "../locate/types";
import { lineColumnAt } from "../locate/types";
import { rectFromCenter, type Point, type Rect } from "../model/geometry";
import type {
  ArrowKind,
  Cluster,
  Diagnostic,
  Direction,
  EdgeRoute,
  Family,
  GraphEdge,
  GraphNode,
  GraphScene,
  LayoutResult,
  NodeBody,
  NodeShape,
  SourceRange,
} from "../model/scene";
import { edgeId } from "../model/scene";
import { makeFingerprinter, type EngineAdapter, type LayoutOpts } from "./types";


let graphvizPromise: Promise<Graphviz> | null = null;


export function loadGraphviz(): Promise<Graphviz> {
  graphvizPromise ??= Graphviz.load();
  return graphvizPromise;
}


interface GvObject {
  _gvid: number;
  name: string;
  pos?: string;
  width?: string;
  height?: string;
  shape?: string;
  label?: string;
  bb?: string;
  lp?: string;
  nodes?: number[];

  subgraphs?: number[];
  style?: string;
  fillcolor?: string;
  color?: string;
  fontcolor?: string;
  penwidth?: string;
  class?: string;
}

interface GvEdge {
  _gvid: number;
  tail: number;
  head: number;
  pos?: string;
  label?: string;
  lp?: string;
  style?: string;
  color?: string;
  fontcolor?: string;
  penwidth?: string;
  dir?: string;
  arrowhead?: string;
  arrowtail?: string;
  class?: string;
}

interface GvGraph {
  name?: string;
  directed?: boolean;
  bb?: string;
  rankdir?: string;
  objects?: GvObject[];
  edges?: GvEdge[];
}


const POINTS_PER_INCH = 72;

function parseNumbers(s: string | undefined): number[] {
  if (!s) return [];
  return s
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v));
}


function makeFlip(bb: number[]): (y: number) => number {
  const [, y0 = 0, , y1 = 0] = bb;
  const sum = y0 + y1;
  return (y) => sum - y;
}

function parsePoint(token: string, flip: (y: number) => number): Point | null {
  const [x, y] = token.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: x as number, y: flip(y as number) };
}


function parseEdgePos(
  pos: string | undefined,
  flip: (y: number) => number,
): { route: EdgeRoute; arrowStart?: Point; arrowEnd?: Point } {
  const points: Point[] = [];
  let arrowStart: Point | undefined;
  let arrowEnd: Point | undefined;

  for (const token of (pos ?? "").trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("e,")) {
      arrowEnd = parsePoint(token.slice(2), flip) ?? undefined;
    } else if (token.startsWith("s,")) {
      arrowStart = parsePoint(token.slice(2), flip) ?? undefined;
    } else {
      const p = parsePoint(token, flip);
      if (p) points.push(p);
    }
  }


  const kind: EdgeRoute["kind"] = points.length >= 4 && (points.length - 1) % 3 === 0 ? "spline" : "poly";

  return { route: { kind, points }, arrowStart, arrowEnd };
}


function resolveLabel(raw: string | undefined, name: string): string {
  if (raw === undefined) return name;
  return raw
    .replace(/\\N/g, name)
    .replace(/\\G/g, "")
    .replace(/\\[lrn]/g, "\n")
    .replace(/\\"/g, '"')
    .trim();
}

const SHAPE_MAP: Record<string, NodeShape> = {
  box: "rect",
  rect: "rect",
  rectangle: "rect",
  square: "rect",
  polygon: "rect",
  ellipse: "ellipse",
  oval: "ellipse",
  circle: "circle",
  doublecircle: "circle",
  point: "circle",
  egg: "ellipse",
  triangle: "diamond",
  diamond: "diamond",
  mdiamond: "diamond",
  msquare: "rect",
  hexagon: "hexagon",
  octagon: "hexagon",
  parallelogram: "parallelogram",
  trapezium: "trapezoid",
  invtrapezium: "trapezoid",
  house: "hexagon",
  cylinder: "cylinder",
  note: "note",
  folder: "folder",
  tab: "folder",
  component: "subroutine",
  box3d: "subroutine",
  plaintext: "rect",
  plain: "rect",
  none: "rect",
  record: "rect",
  mrecord: "round",
};

function mapShape(shape: string | undefined): NodeShape {

  if (!shape) return "ellipse";
  return SHAPE_MAP[shape.toLowerCase()] ?? "rect";
}


export function parseRecordLabel(raw: string): NodeBody {
  let body = raw.trim();
  if (body.startsWith("{") && body.endsWith("}")) {
    body = body.slice(1, -1);
  }

  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\") {
      current += ch + (body[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (ch === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);

  const clean = (s: string) =>
    s
      .replace(/[{}]/g, "")
      .split(/\\[lrn]/)
      .map((line) => line.replace(/<[^>]*>/g, "").trim())
      .filter(Boolean);

  const [first, ...rest] = parts;
  const titleLines = clean(first ?? "");

  return {
    kind: "compartments",
    title: titleLines.join(" ") || "",
    sections: rest.map((p) => ({ items: clean(p) })).filter((s) => s.items.length > 0),
  };
}

function mapArrow(name: string | undefined, fallback: ArrowKind): ArrowKind {
  if (!name) return fallback;
  switch (name.toLowerCase()) {
    case "none":
      return "none";
    case "normal":
    case "vee":
      return "arrow";
    case "open":
    case "halfopen":
      return "open";
    case "dot":
      return "dot";
    case "odot":
      return "odot";
    case "diamond":
      return "diamond";
    case "odiamond":
      return "odiamond";
    case "tee":
    case "crow":
      return "cross";
    default:
      return fallback;
  }
}

function styleOf(o: {
  style?: string;
  fillcolor?: string;
  color?: string;
  fontcolor?: string;
  penwidth?: string;
  class?: string;
}) {
  const styles = (o.style ?? "").split(",").map((s) => s.trim().toLowerCase());
  const style = {
    fill: o.fillcolor,
    stroke: o.color,
    text: o.fontcolor,
    strokeWidth: o.penwidth ? Number(o.penwidth) : undefined,
    dashed: styles.includes("dashed") || styles.includes("dotted"),
    className: o.class,
  };


  return Object.values(style).some((v) => v !== undefined && v !== false) ? style : undefined;
}


export function diagnosticFromError(err: unknown, source: string): Diagnostic {
  const message = err instanceof Error ? err.message : String(err);
  const lineMatch = /line\s+(\d+)/i.exec(message);
  const line = lineMatch ? Number(lineMatch[1]) : undefined;

  return {
    severity: "error",
    message: message.replace(/^Error:\s*/, "").trim() || "Graphviz could not lay out this diagram.",
    line: line && line > 0 ? line : undefined,
    column: line ? lineColumnAt(source, 0).column : undefined,
  };
}


function directionOf(rankdir: string | undefined): Direction {
  switch ((rankdir ?? "TB").toUpperCase()) {
    case "LR":
      return "LR";
    case "RL":
      return "RL";
    case "BT":
      return "BT";
    default:
      return "TB";
  }
}


export function sceneFromGraphvizJson(raw: GvGraph, source: string): GraphScene {
  const bb = parseNumbers(raw.bb);
  const [x0 = 0, , x1 = 0] = bb;
  const flip = makeFlip(bb);
  const bounds: Rect = {
    x: x0,
    y: 0,
    w: Math.max(x1 - x0, 0),
    h: Math.max((bb[3] ?? 0) - (bb[1] ?? 0), 0),
  };

  const objects = raw.objects ?? [];
  const byGvid = new Map<number, GvObject>();
  for (const o of objects) byGvid.set(o._gvid, o);

  const fp = makeFingerprinter();
  const nodes: GraphNode[] = [];
  const clusters: Cluster[] = [];
  const locate = locateDot(source);

  for (const o of objects) {

    if (o.bb !== undefined && o.pos === undefined) {
      const cb = parseNumbers(o.bb);
      const [cx0 = 0, cy0 = 0, cx1 = 0, cy1 = 0] = cb;
      clusters.push({
        id: o.name,
        label: o.label ? resolveLabel(o.label, o.name) : undefined,
        rect: { x: cx0, y: flip(cy1), w: cx1 - cx0, h: cy1 - cy0 },
        style: styleOf(o),
        sourceRange: locate.nodes.get(o.name),
      });
      continue;
    }

    if (o.pos === undefined) continue;

    const [cx = 0, cy = 0] = parseNumbers(o.pos);
    const w = Number(o.width ?? 0) * POINTS_PER_INCH;
    const h = Number(o.height ?? 0) * POINTS_PER_INCH;
    const shapeName = (o.shape ?? "").toLowerCase();
    const label = resolveLabel(o.label, o.name);

    const body: NodeBody =
      shapeName === "record" || shapeName === "mrecord"
        ? parseRecordLabel(o.label ?? o.name)
        : { kind: "label", text: label };

    nodes.push({
      id: o.name,
      body,
      shape: mapShape(o.shape),
      rect: rectFromCenter(cx, flip(cy), w, h),
      fingerprint: fp(shapeName || "node", label),
      style: styleOf(o),
      sourceRange: locate.nodes.get(o.name),
    });
  }


  const clusterByName = new Map(clusters.map((c) => [c.id, c]));
  for (const o of objects) {
    if (!o.subgraphs) continue;
    for (const gvid of o.subgraphs) {
      const child = byGvid.get(gvid);
      const cluster = child && clusterByName.get(child.name);
      if (cluster) cluster.parent = o.name;
    }
  }


  const depths = new Map<string, number>();
  for (const cluster of clusters) {
    let depth = 0;
    let parent = cluster.parent;
    while (parent && depth <= clusters.length) {
      depth += 1;
      parent = clusterByName.get(parent)?.parent;
    }
    depths.set(cluster.id, depth);
  }

  const nodeByName = new Map(nodes.map((n) => [n.id, n]));
  const claimedAt = new Map<string, number>();
  for (const o of objects) {
    if (!o.nodes || !clusterByName.has(o.name)) continue;
    const depth = depths.get(o.name) ?? 0;

    for (const gvid of o.nodes) {
      const member = byGvid.get(gvid);
      const node = member && nodeByName.get(member.name);
      if (!node) continue;
      if (node.parent !== undefined && (claimedAt.get(node.id) ?? -1) >= depth) continue;
      node.parent = o.name;
      claimedAt.set(node.id, depth);
    }
  }

  const edges: GraphEdge[] = [];
  const pairSeen = new Map<string, number>();


  const sortedEdges = [...(raw.edges ?? [])].sort((a, b) => a._gvid - b._gvid);

  for (const e of sortedEdges) {
    const tail = byGvid.get(e.tail);
    const head = byGvid.get(e.head);
    if (!tail || !head) continue;

    const pairKey = `${tail.name}->${head.name}`;
    const ordinal = pairSeen.get(pairKey) ?? 0;
    pairSeen.set(pairKey, ordinal + 1);

    const { route, arrowStart, arrowEnd } = parseEdgePos(e.pos, flip);
    const id = edgeId(tail.name, head.name, ordinal);
    const labelText = e.label ? resolveLabel(e.label, "") : "";
    const [lx, ly] = parseNumbers(e.lp);

    const bidirectional = e.dir === "both";
    edges.push({
      id,
      from: tail.name,
      to: head.name,
      route,
      arrowStart,
      arrowEnd,
      startArrow: mapArrow(e.arrowtail, bidirectional ? "arrow" : "none"),
      endArrow: mapArrow(e.arrowhead, e.dir === "none" ? "none" : "arrow"),
      label:
        labelText && lx !== undefined && ly !== undefined
          ? { text: labelText, at: { x: lx, y: flip(ly) } }
          : undefined,
      style: styleOf(e),
      sourceRange: locate.edges.get(id),
    });
  }

  return {
    family: "graph",
    engine: "graphviz",
    diagramType: raw.directed === false ? "graph" : "digraph",
    direction: directionOf(raw.rankdir),
    nodes,
    edges,
    clusters,
    bounds,
  };
}

export const graphvizAdapter: EngineAdapter = {
  id: "graphviz",
  label: "Graphviz",
  extensions: [".dot", ".gv"],


  detectFamily(): Family {
    return "graph";
  },

  async layout(source: string, opts: LayoutOpts = {}): Promise<LayoutResult> {
    const graphviz = await loadGraphviz();
    const program = (opts.layoutProgram ?? "dot") as Parameters<Graphviz["layout"]>[2];

    let raw: GvGraph;
    try {
      raw = JSON.parse(graphviz.layout(source, "json", program)) as GvGraph;
    } catch (err) {
      return {
        scene: emptyScene(),
        diagnostics: [diagnosticFromError(err, source)],
      };
    }

    const scene = sceneFromGraphvizJson(raw, source);
    const diagnostics: Diagnostic[] = [];

    const stray = contentAfterFirstGraph(source);
    if (stray) {
      diagnostics.push({
        severity: "warning",
        message:
          "Graphviz reads only the first graph in a file, so everything from here down is ignored. " +
          "`dot` on the command line rejects a file like this outright.",
        range: stray,
        line: lineColumnAt(source, stray.from).line,
        fix: { kind: "goto", range: stray },
      });
    }

    if (scene.nodes.length === 0) {
      diagnostics.push({
        severity: "info",
        message: "This graph has no nodes yet.",
      });
    }

    return { scene, diagnostics };
  },

  locate(source: string): LocateIndex {
    return locateDot(source);
  },

  edit: dotEditor,
};


export function contentAfterFirstGraph(source: string): SourceRange | null {
  const tokens = tokenizeDot(source);

  let depth = 0;
  let opened = false;

  for (let i = 0; i < tokens.length; i += 1) {
    const value = tokens[i]!.value;
    if (value === "{") {
      depth += 1;
      opened = true;
    } else if (value === "}") {
      depth -= 1;
      if (opened && depth === 0) {
        const next = tokens[i + 1];
        if (!next) return null;

        return { from: next.from, to: source.length };
      }
    }
  }

  return null;
}

function emptyScene(): GraphScene {
  return {
    family: "graph",
    engine: "graphviz",
    diagramType: "digraph",
    direction: "TB",
    nodes: [],
    edges: [],
    clusters: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 },
  };
}
