import type { Layout, Pin } from "../sidecar/types";
import {
  rectAtCenter,
  rectCenter,
  unionRects,
  type Point,
  type Rect,
} from "../model/geometry";
import type { Cluster, Diagnostic, GraphEdge, GraphNode, GraphScene } from "../model/scene";
import { rerouteEdges } from "../route";


export interface OrphanPin {
  id: string;
  pin: Pin;


  migrateTo?: string;
}

export interface AppliedLayout {
  scene: GraphScene;


  ghosts: ReadonlyMap<string, Rect>;
  orphans: OrphanPin[];
  diagnostics: Diagnostic[];
}


const DRIFT_FACTOR = 3;

export function applyPins(scene: GraphScene, layout: Layout | null | undefined): AppliedLayout {
  const pins = layout?.pins ?? {};
  const pinIds = Object.keys(pins);

  if (pinIds.length === 0 && !layout?.edges) {
    return { scene, ghosts: new Map(), orphans: [], diagnostics: [] };
  }

  const ghosts = new Map<string, Rect>();
  const moved = new Set<string>();
  const diagnostics: Diagnostic[] = [];
  const byId = new Map(scene.nodes.map((n) => [n.id, n]));

  const nodes: GraphNode[] = scene.nodes.map((node) => {
    const pin = pins[node.id];
    if (!pin) return node;

    const auto = node.rect;
    const target: Point = { x: pin.x, y: pin.y };
    const rect = rectAtCenter(auto, target);

    ghosts.set(node.id, auto);
    moved.add(node.id);


    const when = pin.auto;
    if (when) {
      const now = rectCenter(auto);
      const gap = Math.hypot(now.x - when[0], now.y - when[1]);
      const diagonal = Math.hypot(auto.w, auto.h);
      if (gap > diagonal * DRIFT_FACTOR) {
        diagnostics.push({
          severity: "info",
          message: `Auto-layout has moved “${node.id}” a long way since it was pinned. The pin still holds, but it may be fighting the new layout.`,
          nodes: [node.id],
          range: node.sourceRange,
          fix: { kind: "release-pins", nodes: [node.id] },
        });
      }
    }

    return { ...node, rect };
  });


  const orphans: OrphanPin[] = [];
  const unpinnedByFingerprint = new Map<string, string[]>();
  for (const node of scene.nodes) {
    if (pins[node.id]) continue;
    const list = unpinnedByFingerprint.get(node.fingerprint) ?? [];
    list.push(node.id);
    unpinnedByFingerprint.set(node.fingerprint, list);
  }

  for (const id of pinIds) {
    if (byId.has(id)) continue;

    const pin = pins[id]!;


    const candidates = pin.fingerprint ? unpinnedByFingerprint.get(pin.fingerprint) : undefined;
    const migrateTo = candidates?.length === 1 ? candidates[0] : undefined;

    orphans.push({ id, pin, migrateTo });
  }

  if (orphans.length > 0) {
    const renamed = orphans.filter((o) => o.migrateTo);
    diagnostics.push({
      severity: "warning",
      message:
        renamed.length > 0
          ? `${orphans.length} pinned node${orphans.length === 1 ? "" : "s"} no longer exist; ${renamed.length} look${renamed.length === 1 ? "s" : ""} renamed.`
          : `${orphans.length} pinned node${orphans.length === 1 ? " no longer exists" : "s no longer exist"} in this diagram.`,
    });
  }


  const waypoints = new Map<string, Point[]>();
  for (const [id, hint] of Object.entries(layout?.edges ?? {})) {
    if (hint.waypoints?.length) {
      waypoints.set(
        id,
        hint.waypoints.map(([x, y]) => ({ x: x!, y: y! })),
      );
    }
  }


  const clusters = refitClusters(scene, nodes, moved);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let edges: GraphEdge[] = rerouteEdges(scene.edges, {
    nodes: nodeMap,
    moved,
    waypoints,


    bounds: scene.bounds,
  });


  edges = edges.map((edge) => {
    const offset = layout?.edges?.[edge.id]?.label_offset;
    if (!offset || !edge.label) return edge;
    return { ...edge, label: { ...edge.label, offset: { x: offset[0]!, y: offset[1]! } } };
  });

  return {
    scene: { ...scene, nodes, clusters, edges, bounds: boundsOf(nodes, clusters, scene, edges) },
    ghosts,
    orphans,
    diagnostics,
  };
}


function refitClusters(
  scene: GraphScene,
  nodes: readonly GraphNode[],
  moved: ReadonlySet<string>,
): Cluster[] {
  if (scene.clusters.length === 0 || moved.size === 0) return [...scene.clusters];

  const autoNodes = new Map(scene.nodes.map((n) => [n.id, n]));
  const pinnedNodes = new Map(nodes.map((n) => [n.id, n]));

  const membersOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  for (const node of scene.nodes) {
    if (!node.parent) continue;
    push(membersOf, node.parent, node.id);
  }
  for (const cluster of scene.clusters) {
    if (!cluster.parent) continue;
    push(childrenOf, cluster.parent, cluster.id);
  }


  const byId = new Map(scene.clusters.map((c) => [c.id, c]));
  const ordered = [...scene.clusters].sort((a, b) => depthOf(b, byId) - depthOf(a, byId));

  const result = new Map(scene.clusters.map((c) => [c.id, c]));

  for (const cluster of ordered) {
    const members = membersOf.get(cluster.id) ?? [];
    const children = childrenOf.get(cluster.id) ?? [];

    const auto: Rect[] = [];
    const next: Rect[] = [];
    let touched = false;

    for (const id of members) {
      const a = autoNodes.get(id);
      const n = pinnedNodes.get(id);
      if (!a || !n) continue;
      auto.push(a.rect);
      next.push(n.rect);
      if (moved.has(id)) touched = true;
    }
    for (const id of children) {
      const a = byId.get(id);
      const n = result.get(id);
      if (!a || !n) continue;
      auto.push(a.rect);
      next.push(n.rect);
      if (a.rect !== n.rect) touched = true;
    }


    if (!touched || next.length === 0) continue;

    const before = unionRects(auto);
    const after = unionRects(next);

    result.set(cluster.id, {
      ...cluster,
      rect: {
        x: after.x - (before.x - cluster.rect.x),
        y: after.y - (before.y - cluster.rect.y),
        w: after.w + (cluster.rect.w - before.w),
        h: after.h + (cluster.rect.h - before.h),
      },
    });
  }

  return scene.clusters.map((c) => result.get(c.id) ?? c);
}

function push(map: Map<string, string[]>, key: string, value: string): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function depthOf(cluster: Cluster, byId: ReadonlyMap<string, Cluster>): number {
  let depth = 0;
  let parent = cluster.parent;


  while (parent && depth <= byId.size) {
    depth += 1;
    parent = byId.get(parent)?.parent;
  }
  return depth;
}


function boundsOf(
  nodes: readonly GraphNode[],
  clusters: readonly Cluster[],
  scene: GraphScene,
  edges: readonly GraphEdge[],
): Rect {
  const rects: Rect[] = [...nodes.map((n) => n.rect), ...clusters.map((c) => c.rect)];

  for (const edge of edges) {
    for (const p of edge.route.points) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
    if (edge.arrowEnd) rects.push({ x: edge.arrowEnd.x, y: edge.arrowEnd.y, w: 0, h: 0 });
  }

  if (rects.length === 0) return scene.bounds;


  const box = unionRects(rects);
  const pad = 12;
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}


export function pinFor(node: GraphNode, center: Point): Pin {
  const auto = rectCenter(node.rect);
  return {
    x: center.x,
    y: center.y,
    fingerprint: node.fingerprint,
    auto: [Math.round(auto.x), Math.round(auto.y)],
  };
}

export function withPin(layout: Layout, id: string, pin: Pin): Layout {
  return { ...layout, pins: { ...layout.pins, [id]: pin } };
}

export function withoutPin(layout: Layout, id: string): Layout {
  const pins = { ...layout.pins };
  delete pins[id];
  return { ...layout, pins };
}

export function withoutPins(layout: Layout, ids: readonly string[]): Layout {
  const pins = { ...layout.pins };
  for (const id of ids) delete pins[id];
  return { ...layout, pins };
}


export function migratePin(layout: Layout, from: string, to: string): Layout {
  const pin = layout.pins?.[from];
  if (!pin) return layout;

  const pins = { ...layout.pins };
  delete pins[from];
  pins[to] = pin;
  return { ...layout, pins };
}

export function isPinned(layout: Layout | null | undefined, id: string): boolean {
  return Boolean(layout?.pins?.[id]);
}

export function pinnedIds(layout: Layout | null | undefined): Set<string> {
  return new Set(Object.keys(layout?.pins ?? {}));
}
