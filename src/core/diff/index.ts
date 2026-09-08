import { rectCenter, type Point, type Rect } from "../model/geometry";
import { isGraph, nodeText, type GraphScene, type Scene } from "../model/scene";


export type NodeChange = "added" | "removed" | "moved" | "relabelled" | "reshaped";

export interface DiffNode {
  id: string;
  change: NodeChange;

  rect?: Rect;

  was?: Rect;

  label?: string;
  wasLabel?: string;
}

export interface DiffEdge {
  id: string;
  change: "added" | "removed";
  points: Point[];
}

export interface SceneDiff {
  nodes: DiffNode[];
  edges: DiffEdge[];

  identical: boolean;

  summary: string;
}


const MOVE_EPSILON = 0.5;

export interface DiffOptions {


  pinnedBefore?: ReadonlySet<string>;
  pinnedAfter?: ReadonlySet<string>;
}

export const EMPTY_DIFF: SceneDiff = {
  nodes: [],
  edges: [],
  identical: true,
  summary: "No changes",
};


export function diffScenes(
  before: Scene | null,
  after: Scene | null,
  options: DiffOptions = {},
): SceneDiff {
  if (!before || !after || !isGraph(before) || !isGraph(after)) return EMPTY_DIFF;

  const nodes = diffNodes(before, after, options);
  const edges = diffEdges(before, after);

  return {
    nodes,
    edges,
    identical: nodes.length === 0 && edges.length === 0,
    summary: summarise(nodes, edges),
  };
}

function diffNodes(
  before: GraphScene,
  after: GraphScene,
  options: DiffOptions,
): DiffNode[] {
  const was = new Map(before.nodes.map((n) => [n.id, n]));
  const now = new Map(after.nodes.map((n) => [n.id, n]));
  const out: DiffNode[] = [];

  for (const node of after.nodes) {
    const previous = was.get(node.id);

    if (!previous) {
      out.push({ id: node.id, change: "added", rect: node.rect, label: nodeText(node.body) });
      continue;
    }


    const label = nodeText(node.body);
    const wasLabel = nodeText(previous.body);
    if (label !== wasLabel) {
      out.push({
        id: node.id,
        change: "relabelled",
        rect: node.rect,
        was: previous.rect,
        label,
        wasLabel,
      });
      continue;
    }

    if (node.shape !== previous.shape) {
      out.push({ id: node.id, change: "reshaped", rect: node.rect, was: previous.rect, label });
      continue;
    }

    if (!worthReporting(node.id, options)) continue;

    const from = rectCenter(previous.rect);
    const to = rectCenter(node.rect);
    if (Math.hypot(to.x - from.x, to.y - from.y) > MOVE_EPSILON) {
      out.push({ id: node.id, change: "moved", rect: node.rect, was: previous.rect, label });
    }
  }

  for (const node of before.nodes) {
    if (now.has(node.id)) continue;
    out.push({ id: node.id, change: "removed", was: node.rect, label: nodeText(node.body) });
  }

  return out;
}


function worthReporting(id: string, options: DiffOptions): boolean {
  const { pinnedBefore, pinnedAfter } = options;
  if (!pinnedBefore && !pinnedAfter) return true;
  return Boolean(pinnedBefore?.has(id) || pinnedAfter?.has(id));
}


function diffEdges(before: GraphScene, after: GraphScene): DiffEdge[] {
  const was = new Set(before.edges.map((e) => e.id));
  const now = new Set(after.edges.map((e) => e.id));
  const out: DiffEdge[] = [];

  for (const edge of after.edges) {
    if (!was.has(edge.id)) out.push({ id: edge.id, change: "added", points: edge.route.points });
  }
  for (const edge of before.edges) {
    if (!now.has(edge.id)) out.push({ id: edge.id, change: "removed", points: edge.route.points });
  }

  return out;
}

function summarise(nodes: readonly DiffNode[], edges: readonly DiffEdge[]): string {
  const counts = new Map<string, number>();
  const bump = (what: string) => counts.set(what, (counts.get(what) ?? 0) + 1);

  for (const node of nodes) bump(node.change);
  for (const edge of edges) bump(edge.change === "added" ? "edge-added" : "edge-removed");

  const parts: string[] = [];
  const say = (key: string, one: string, many: string) => {
    const n = counts.get(key);
    if (n) parts.push(`${n} ${n === 1 ? one : many}`);
  };

  say("added", "node added", "nodes added");
  say("removed", "node removed", "nodes removed");
  say("relabelled", "relabelled", "relabelled");
  say("reshaped", "reshaped", "reshaped");
  say("moved", "moved", "moved");
  say("edge-added", "edge added", "edges added");
  say("edge-removed", "edge removed", "edges removed");

  return parts.length === 0 ? "No changes" : parts.join(", ");
}


export function isLayoutOnly(change: NodeChange): boolean {
  return change === "moved";
}
