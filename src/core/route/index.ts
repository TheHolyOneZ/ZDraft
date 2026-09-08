import {
  boundaryPoint,
  distance,
  segmentIntersectsRect,
  type Point,
  type Rect,
} from "../model/geometry";
import type { EdgeRoute, GraphEdge, GraphNode } from "../model/scene";
import { boundaryFor } from "../render/shapes";
import { buildGrid, routeOrthogonal, setRectBlocked, type RouteGrid } from "./orthogonal";


export interface RouteContext {

  nodes: ReadonlyMap<string, GraphNode>;

  moved: ReadonlySet<string>;

  waypoints?: ReadonlyMap<string, Point[]>;


  bounds?: Rect;
}


const SELF_LOOP_RADIUS = 34;


export function directRoute(
  from: Rect,
  fromShape: Parameters<typeof boundaryPoint>[2],
  to: Rect,
  toShape: Parameters<typeof boundaryPoint>[2],
  waypoints: readonly Point[] = [],
): { route: EdgeRoute; arrowEnd: Point; arrowStart: Point } {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };


  const firstTarget = waypoints[0] ?? toCenter;
  const lastTarget = waypoints[waypoints.length - 1] ?? fromCenter;

  const start = boundaryPoint(from, firstTarget, fromShape);
  const end = boundaryPoint(to, lastTarget, toShape);

  const points = [start, ...waypoints, end];

  return { route: { kind: "poly", points }, arrowEnd: end, arrowStart: start };
}


export function selfLoopRoute(rect: Rect): { route: EdgeRoute; arrowEnd: Point; arrowStart: Point } {
  const r = SELF_LOOP_RADIUS;
  const start = { x: rect.x + rect.w * 0.68, y: rect.y };
  const end = { x: rect.x + rect.w, y: rect.y + rect.h * 0.32 };

  return {
    route: {
      kind: "spline",
      points: [
        start,
        { x: start.x, y: start.y - r },
        { x: end.x + r, y: end.y - r },
        end,
      ],
    },
    arrowStart: start,
    arrowEnd: end,
  };
}


export function rerouteEdges(edges: readonly GraphEdge[], ctx: RouteContext): GraphEdge[] {
  const obstacles = [...ctx.nodes.values()].map((n) => n.rect);


  const movedRects = [...ctx.moved]
    .map((id) => ctx.nodes.get(id)?.rect)
    .filter((r): r is Rect => r !== undefined);


  let grid: RouteGrid | null = null;
  const gridFor = (): RouteGrid | null => {
    if (!ctx.bounds) return null;
    grid ??= buildGrid(ctx.bounds, obstacles);
    return grid;
  };

  return edges.map((edge) => {
    const manual = ctx.waypoints?.get(edge.id);
    const touched =
      ctx.moved.has(edge.from) ||
      ctx.moved.has(edge.to) ||
      manual !== undefined ||


      crossesAny(edge, movedRects, ctx.moved);
    if (!touched) return edge;

    const from = ctx.nodes.get(edge.from);
    const to = ctx.nodes.get(edge.to);


    if (!from || !to) return edge;

    let routed =
      edge.from === edge.to
        ? selfLoopRoute(from.rect)
        : directRoute(
            from.rect,
            boundaryFor(from.shape),
            to.rect,
            boundaryFor(to.shape),
            manual ?? [],
          );


    if (edge.from !== edge.to && !manual?.length) {
      const blockers = [...ctx.nodes.values()].filter(
        (n) => n.id !== edge.from && n.id !== edge.to,
      );
      const start = routed.arrowStart;
      const end = routed.arrowEnd;

      if (blockers.some((n) => segmentIntersectsRect(start, end, n.rect))) {
        const g = gridFor();
        if (g) {


          setRectBlocked(g, from.rect, 0);
          setRectBlocked(g, to.rect, 0);
          const path = routeOrthogonal(g, start, end);
          setRectBlocked(g, from.rect, 1);
          setRectBlocked(g, to.rect, 1);

          if (path && path.length >= 2) {
            routed = {
              route: { kind: "poly", points: path },
              arrowStart: path[0]!,
              arrowEnd: path[path.length - 1]!,
            };
          }
        }
      }
    }

    return {
      ...edge,
      route: routed.route,
      arrowStart: routed.arrowStart,
      arrowEnd: routed.arrowEnd,
      rerouted: true,
      label: edge.label ? { ...edge.label, at: labelAnchor(routed.route) } : undefined,
    };
  });
}


export function labelAnchor(route: EdgeRoute): Point {
  const pts = route.points;
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;

  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distance(pts[i - 1]!, pts[i]!);

  let remaining = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const seg = distance(a, b);
    if (remaining <= seg || i === pts.length - 1) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        x: a.x + (b.x - a.x) * t,

        y: a.y + (b.y - a.y) * t - 8,
      };
    }
    remaining -= seg;
  }

  return pts[pts.length - 1]!;
}


function crossesAny(
  edge: GraphEdge,
  rects: readonly Rect[],
  moved: ReadonlySet<string>,
): boolean {
  if (rects.length === 0) return false;

  if (moved.has(edge.from) || moved.has(edge.to)) return false;

  const points = edge.route.points;
  for (let i = 1; i < points.length; i++) {
    for (const rect of rects) {
      if (segmentIntersectsRect(points[i - 1]!, points[i]!, rect)) return true;
    }
  }
  return false;
}
