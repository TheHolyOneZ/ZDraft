import type { Point, Rect } from "../model/geometry";
import { unionRects } from "../model/geometry";
import { d2Editor } from "../edit/d2";
import { locateD2 } from "../locate/d2";
import type { LocateIndex } from "../locate/types";
import { lineColumnAt } from "../locate/types";
import {
  edgeId,
  type ArrowKind,
  type Cluster,
  type Compartment,
  type Diagnostic,
  type Direction,
  type Family,
  type GraphEdge,
  type GraphNode,
  type GraphScene,
  type LayoutResult,
  type NodeBody,
  type NodeShape,
  type SourceRange,
} from "../model/scene";
import { personRect } from "../render/shapes";
import { DEFAULT_FONT_SIZE } from "../theme";
import { makeFingerprinter, type EngineAdapter, type LayoutOpts } from "./types";


interface D2Point {
  x: number;
  y: number;
}

interface D2Text {
  label: string;
}

interface D2ClassField {
  name: string;
  type: string;
  visibility: string;
}

interface D2ClassMethod {
  name: string;
  return: string;
  visibility: string;
}

interface D2Column {
  name: D2Text;
  type: D2Text;
  constraint: string[] | null;
}

interface D2Shape {
  id: string;
  type: string;
  label: string;
  pos: D2Point;
  width: number;
  height: number;

  level: number;
  fill?: string;
  stroke?: string;
  strokeDash?: number;
  strokeWidth?: number;
  fields?: D2ClassField[] | null;
  methods?: D2ClassMethod[] | null;
  columns?: D2Column[] | null;
  classes?: string[] | null;
  labelWidth?: number;
  labelHeight?: number;
}

interface D2Connection {
  id: string;
  src: string;
  dst: string;
  label: string;
  srcArrow: string;
  dstArrow: string;
  route: D2Point[];
  isCurve?: boolean;
  stroke?: string;
  strokeDash?: number;
  strokeWidth?: number;
  labelPercentage?: number;
  labelWidth?: number;
  labelHeight?: number;
}

interface D2Diagram {
  name: string;
  shapes: D2Shape[];
  connections: D2Connection[];
}

interface D2Compiled {
  diagram: D2Diagram;
}

interface D2Instance {
  compile(source: string, options?: Record<string, unknown>): Promise<D2Compiled>;
}


let instance: Promise<D2Instance> | null = null;


async function loadD2(): Promise<D2Instance> {
  if (!instance) {
    instance = import("@terrastruct/d2").then((m) => new m.D2() as unknown as D2Instance);
  }
  return instance;
}


export function resetD2(): void {
  instance = null;
}


const SHAPE_MAP: Record<string, NodeShape> = {
  rectangle: "rect",
  square: "rect",
  page: "page",
  parallelogram: "parallelogram",
  document: "doc",
  cylinder: "cylinder",
  queue: "queue",
  package: "package",
  step: "step",
  callout: "callout",
  stored_data: "stored",
  person: "person",
  diamond: "diamond",
  oval: "ellipse",
  circle: "circle",
  hexagon: "hexagon",
  cloud: "cloud",
  text: "text",
  code: "rect",
  class: "rect",
  sql_table: "rect",
  image: "rect",
  sequence_diagram: "rect",
};


const ARROW_MAP: Record<string, ArrowKind> = {
  none: "none",
  arrow: "arrow",
  triangle: "arrow",
  "unfilled-triangle": "open",
  diamond: "odiamond",
  "filled-diamond": "diamond",
  circle: "odot",
  "filled-circle": "dot",
  box: "odot",
  "filled-box": "dot",
  line: "open",


  "cf-one": "open",
  "cf-many": "open",
  "cf-one-required": "open",
  "cf-many-required": "open",
};

function mapArrow(name: string | undefined): ArrowKind {
  return ARROW_MAP[name ?? "none"] ?? "arrow";
}


function visibilityMark(visibility: string): string {
  switch (visibility) {
    case "private":
      return "-";
    case "protected":
      return "#";
    default:
      return "+";
  }
}

function bodyFor(shape: D2Shape): NodeBody {
  const label = shape.label || shape.id.slice(shape.id.lastIndexOf(".") + 1);

  if (shape.type === "class") {
    const sections: Compartment[] = [];
    const fields = (shape.fields ?? []).map(
      (f) => `${visibilityMark(f.visibility)}${f.name}${f.type ? `: ${f.type}` : ""}`,
    );
    const methods = (shape.methods ?? []).map(
      (m) => `${visibilityMark(m.visibility)}${m.name}${m.return ? `: ${m.return}` : ""}`,
    );
    if (fields.length > 0) sections.push({ items: fields });
    if (methods.length > 0) sections.push({ items: methods });

    return { kind: "compartments", title: label, sections };
  }

  if (shape.type === "sql_table") {
    const items = (shape.columns ?? []).map((c) => {
      const marks = (c.constraint ?? [])
        .map((k) => (k === "primary_key" ? "PK" : k === "foreign_key" ? "FK" : k.toUpperCase()))
        .join(" ");
      const type = c.type?.label ? `: ${c.type.label}` : "";
      return `${marks ? `${marks} ` : ""}${c.name?.label ?? ""}${type}`;
    });

    return {
      kind: "compartments",
      title: label,
      stereotype: "table",
      sections: items.length > 0 ? [{ items }] : [],
    };
  }

  return { kind: "label", text: label };
}


function explicitColor(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^(N|B|AA|AB)\d+$/.test(value)) return undefined;
  return value;
}

function styleOf(shape: D2Shape | D2Connection): GraphNode["style"] {
  const fill = "fill" in shape ? explicitColor(shape.fill) : undefined;
  const stroke = explicitColor(shape.stroke);
  const dashed = (shape.strokeDash ?? 0) > 0;
  const className = "classes" in shape ? shape.classes?.[0] : undefined;

  if (!fill && !stroke && !dashed && !className) return undefined;
  return { fill, stroke, dashed: dashed || undefined, className };
}


function rectOf(shape: D2Shape, label: string): Rect {
  const base = { x: shape.pos.x, y: shape.pos.y, w: shape.width, h: shape.height };
  return shape.type === "person" ? personRect(base, label, DEFAULT_FONT_SIZE) : base;
}


function containerIds(shapes: readonly D2Shape[]): Set<string> {
  const ids = new Set(shapes.map((s) => s.id));
  const containers = new Set<string>();

  for (const shape of shapes) {
    const cut = shape.id.lastIndexOf(".");
    if (cut < 0) continue;
    const parent = shape.id.slice(0, cut);
    if (ids.has(parent)) containers.add(parent);
  }

  return containers;
}

function parentOf(id: string, containers: ReadonlySet<string>): string | undefined {
  const cut = id.lastIndexOf(".");
  if (cut < 0) return undefined;
  const parent = id.slice(0, cut);
  return containers.has(parent) ? parent : undefined;
}


export function sceneFromD2(diagram: D2Diagram, source: string): GraphScene {
  const locate = locateD2(source);
  const fp = makeFingerprinter();

  const shapes = diagram.shapes ?? [];
  const containers = containerIds(shapes);

  const nodes: GraphNode[] = [];
  const clusters: Cluster[] = [];

  for (const shape of shapes) {


    if (/-lifeline-end-\d+$/.test(shape.id)) continue;

    const parent = parentOf(shape.id, containers);
    const label = shape.label || shape.id.slice(shape.id.lastIndexOf(".") + 1);

    if (containers.has(shape.id)) {
      clusters.push({
        id: shape.id,
        label: label || undefined,
        rect: rectOf(shape, label),
        parent,
        style: styleOf(shape),
        sourceRange: locate.nodes.get(shape.id),
      });
      continue;
    }

    nodes.push({
      id: shape.id,
      body: bodyFor(shape),
      shape: SHAPE_MAP[shape.type] ?? "rect",
      rect: rectOf(shape, label),
      fingerprint: fp(shape.type || "shape", label),
      parent,
      style: styleOf(shape),
      sourceRange: locate.nodes.get(shape.id),
    });
  }

  const edges: GraphEdge[] = [];
  const pairSeen = new Map<string, number>();

  for (const connection of diagram.connections ?? []) {
    if (/-lifeline-end-\d+$/.test(connection.dst)) continue;

    const points: Point[] = (connection.route ?? []).map((p) => ({ x: p.x, y: p.y }));
    if (points.length < 2) continue;

    const pair = `${connection.src}->${connection.dst}`;
    const ordinal = pairSeen.get(pair) ?? 0;
    pairSeen.set(pair, ordinal + 1);
    const id = edgeId(connection.src, connection.dst, ordinal);


    const spline = connection.isCurve !== false && points.length >= 4 && points.length % 3 === 1;

    edges.push({
      id,
      from: connection.src,
      to: connection.dst,
      route: spline ? { kind: "spline", points } : { kind: "poly", points },
      arrowStart: points[0],
      arrowEnd: points[points.length - 1],
      startArrow: mapArrow(connection.srcArrow),
      endArrow: mapArrow(connection.dstArrow),
      label: connection.label
        ? { text: connection.label, at: labelPoint(points, connection.labelPercentage) }
        : undefined,
      style: styleOf(connection),
      sourceRange: locate.edges.get(id),
    });
  }

  return {
    family: "graph",
    engine: "d2",
    diagramType: "d2",
    direction: detectDirection(source),
    nodes,
    edges,
    clusters,
    bounds: boundsOf(nodes, clusters, edges),
  };
}


function labelPoint(points: readonly Point[], percentage: number | undefined): Point {
  const t = percentage && percentage > 0 && percentage <= 1 ? percentage : 0.5;

  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  if (total === 0) return points[0] ?? { x: 0, y: 0 };

  let walked = 0;
  const want = total * t;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + length >= want) {
      const along = length === 0 ? 0 : (want - walked) / length;
      return { x: a.x + (b.x - a.x) * along, y: a.y + (b.y - a.y) * along };
    }
    walked += length;
  }

  return points[points.length - 1]!;
}

function boundsOf(
  nodes: readonly GraphNode[],
  clusters: readonly Cluster[],
  edges: readonly GraphEdge[],
): Rect {
  const rects: Rect[] = [...nodes.map((n) => n.rect), ...clusters.map((c) => c.rect)];
  for (const edge of edges) {
    for (const p of edge.route.points) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };

  const box = unionRects(rects);
  const pad = 12;
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}


function detectDirection(source: string): Direction {
  const match = /^\s*direction\s*:\s*(right|left|down|up)\b/m.exec(source);
  switch (match?.[1]) {
    case "right":
      return "LR";
    case "left":
      return "RL";
    case "up":
      return "BT";
    default:
      return "TB";
  }
}


export function diagnosticsFromD2Error(err: unknown, source: string): Diagnostic[] {
  const raw = err instanceof Error ? err.message : String(err);

  const parsed = parseD2Errors(raw);
  if (parsed.length === 0) {
    return [{ severity: "error", message: cleanMessage(raw) }];
  }

  const starts = lineStarts(source);

  return parsed.map(({ message, at }) => {
    const range = at ? toRange(starts, source.length, at) : undefined;
    const where = range ? lineColumnAt(source, range.from) : undefined;

    return {
      severity: "error" as const,
      message: cleanMessage(message),
      range,
      line: where?.line,
      column: where?.column,
    };
  });
}


function lineStarts(source: string): number[] {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function toRange(
  starts: readonly number[],
  length: number,
  at: { fromLine: number; fromCol: number; toLine: number; toCol: number },
): SourceRange {
  const offset = (line: number, column: number) =>
    Math.min(length, (starts[Math.min(line, starts.length - 1)] ?? 0) + column);

  const from = offset(at.fromLine, at.fromCol);
  return { from, to: Math.max(from, offset(at.toLine, at.toCol)) };
}

interface D2Error {
  range?: string;
  errmsg?: string;
}

interface D2Position {
  fromLine: number;
  fromCol: number;
  toLine: number;
  toCol: number;
}

function parseD2Errors(raw: string): Array<{ message: string; at?: D2Position }> {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];

  let list: D2Error[];
  try {
    list = JSON.parse(raw.slice(start, end + 1)) as D2Error[];
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];

  return list
    .filter((e) => typeof e?.errmsg === "string")
    .map((e) => ({ message: e.errmsg!, at: parsePosition(e.range) }));
}


function parsePosition(range: string | undefined): D2Position | undefined {
  if (!range) return undefined;
  const match = /(\d+):(\d+):\d+-(\d+):(\d+):\d+$/.exec(range);
  if (!match) return undefined;

  return {
    fromLine: Number(match[1]),
    fromCol: Number(match[2]),
    toLine: Number(match[3]),
    toCol: Number(match[4]),
  };
}


function cleanMessage(message: string): string {
  return message.replace(/^[^:]*:\d+:\d+:\s*/, "").trim() || message.trim();
}


function emptyScene(): GraphScene {
  return {
    family: "graph",
    engine: "d2",
    diagramType: "d2",
    direction: "TB",
    nodes: [],
    edges: [],
    clusters: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 },
  };
}

export const d2Adapter: EngineAdapter = {
  id: "d2",
  label: "D2",
  extensions: [".d2"],


  detectFamily(): Family {
    return "graph";
  },

  async layout(source: string, opts: LayoutOpts = {}): Promise<LayoutResult> {
    const d2 = await loadD2();

    let compiled: D2Compiled;
    try {
      compiled = await d2.compile(source, {


        layout: opts.layoutProgram === "elk" ? "elk" : "dagre",
        pad: 0,
      });
    } catch (err) {
      return { scene: emptyScene(), diagnostics: diagnosticsFromD2Error(err, source) };
    }

    const scene = sceneFromD2(compiled.diagram, source);
    const diagnostics: Diagnostic[] = [];

    if (scene.nodes.length === 0 && scene.clusters.length === 0) {
      diagnostics.push({ severity: "info", message: "This diagram has no shapes yet." });
    }

    return { scene, diagnostics };
  },

  locate(source: string): LocateIndex {
    return locateD2(source);
  },

  edit: d2Editor,
};
