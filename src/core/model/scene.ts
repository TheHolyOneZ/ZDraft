import type { Point, Rect } from "./geometry";


export interface SourceRange {
  from: number;
  to: number;
}

export type EngineId = "graphviz" | "mermaid" | "d2" | "plantuml";


export type Family = "graph" | "sequence" | "passthrough";


export interface Compartment {

  label?: string;
  items: string[];
}


export type NodeBody =
  | { kind: "label"; text: string }
  | {
      kind: "compartments";
      title: string;

      stereotype?: string;
      sections: Compartment[];
    };


export type NodeShape =
  | "rect"
  | "round"
  | "stadium"
  | "circle"
  | "ellipse"
  | "diamond"
  | "hexagon"
  | "parallelogram"
  | "trapezoid"
  | "cylinder"
  | "note"
  | "folder"
  | "doc"
  | "subroutine"
  | "person"
  | "cloud"
  | "step"
  | "page"
  | "package"
  | "callout"
  | "queue"
  | "stored"
  | "triangle"
  | "text";

export interface NodeStyle {
  fill?: string;
  stroke?: string;
  text?: string;
  strokeWidth?: number;
  dashed?: boolean;

  className?: string;
}

export interface GraphNode {
  id: string;
  body: NodeBody;
  shape: NodeShape;

  rect: Rect;


  fingerprint: string;

  parent?: string;
  style?: NodeStyle;
  sourceRange?: SourceRange;
}

export interface Cluster {
  id: string;
  label?: string;
  rect: Rect;
  parent?: string;
  style?: NodeStyle;
  sourceRange?: SourceRange;
}


export type ArrowKind = "none" | "arrow" | "open" | "dot" | "odot" | "diamond" | "odiamond" | "cross";


export type EdgeRoute =
  | { kind: "spline"; points: Point[] }
  | { kind: "poly"; points: Point[] };

export interface EdgeLabel {
  text: string;

  at: Point;

  offset?: Point;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  route: EdgeRoute;


  arrowStart?: Point;
  arrowEnd?: Point;
  startArrow: ArrowKind;
  endArrow: ArrowKind;
  label?: EdgeLabel;
  style?: NodeStyle;
  sourceRange?: SourceRange;

  rerouted?: boolean;
}


export type Direction = "TB" | "BT" | "LR" | "RL";

export interface GraphScene {
  family: "graph";
  engine: EngineId;

  diagramType: string;
  direction: Direction;
  nodes: GraphNode[];
  edges: GraphEdge[];
  clusters: Cluster[];
  bounds: Rect;
}


export interface Lifeline {
  id: string;
  label: string;

  head: Rect;

  x: number;

  bottom: number;

  actor: boolean;
  sourceRange?: SourceRange;
}

export type MessageKind = "sync" | "async" | "reply" | "create" | "destroy" | "self";

export interface Message {
  id: string;
  from: string;
  to: string;
  label: string;

  y: number;
  kind: MessageKind;

  order: number;
  sourceRange?: SourceRange;
}

export interface Activation {
  lifeline: string;
  top: number;
  bottom: number;

  depth: number;
}

export interface Fragment {
  id: string;
  kind: "alt" | "opt" | "loop" | "par" | "critical" | "break" | "rect";
  label: string;
  rect: Rect;

  dividers: number[];
  sectionLabels: string[];
}

export interface SequenceNote {
  id: string;
  text: string;
  rect: Rect;
  over: string[];
}

export interface SequenceScene {
  family: "sequence";
  engine: EngineId;
  diagramType: string;
  lifelines: Lifeline[];
  messages: Message[];
  activations: Activation[];
  fragments: Fragment[];
  notes: SequenceNote[];
  bounds: Rect;
}


export interface PassthroughScene {
  family: "passthrough";
  engine: EngineId;
  diagramType: string;

  svg: string;
  bounds: Rect;

  reason: string;
}

export type Scene = GraphScene | SequenceScene | PassthroughScene;


export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  message: string;

  line?: number;
  column?: number;
  range?: SourceRange;

  nodes?: string[];


  fix?: DiagnosticFix;
}

export type DiagnosticFix =
  | { kind: "separate-nodes"; nodes: string[] }
  | { kind: "release-pins"; nodes: string[] }
  | { kind: "goto"; range: SourceRange };

export interface LayoutResult {
  scene: Scene;
  diagnostics: Diagnostic[];
}


export function isGraph(scene: Scene): scene is GraphScene {
  return scene.family === "graph";
}

export function isSequence(scene: Scene): scene is SequenceScene {
  return scene.family === "sequence";
}

export function isPassthrough(scene: Scene): scene is PassthroughScene {
  return scene.family === "passthrough";
}


export function isPinnable(scene: Scene): boolean {
  return scene.family !== "passthrough";
}


export function nodesIn(scene: GraphScene, selection: ReadonlySet<string>): GraphNode[] {
  if (selection.size === 0) return [];

  const clusters = new Set<string>();
  for (const cluster of scene.clusters) {
    if (selection.has(cluster.id)) clusters.add(cluster.id);
  }


  if (clusters.size > 0) {
    for (let pass = 0; pass < scene.clusters.length; pass += 1) {
      let grew = false;
      for (const cluster of scene.clusters) {
        if (cluster.parent && clusters.has(cluster.parent) && !clusters.has(cluster.id)) {
          clusters.add(cluster.id);
          grew = true;
        }
      }
      if (!grew) break;
    }
  }

  return scene.nodes.filter(
    (n) => selection.has(n.id) || (n.parent !== undefined && clusters.has(n.parent)),
  );
}

export function nodeText(body: NodeBody): string {
  return body.kind === "label" ? body.text : body.title;
}


export function routeEnd(route: EdgeRoute): Point | undefined {
  return route.points[route.points.length - 1];
}

export function routeStart(route: EdgeRoute): Point | undefined {
  return route.points[0];
}


export function edgeId(from: string, to: string, ordinal = 0): string {
  return ordinal === 0 ? `${from}->${to}` : `${from}->${to}#${ordinal}`;
}
