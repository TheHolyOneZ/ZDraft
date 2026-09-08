import { describe, expect, it } from "vitest";

import { segmentIntersectsRect, simplifyPolyline, type Rect } from "../model/geometry";
import type { GraphNode } from "../model/scene";
import { rerouteEdges } from ".";
import { buildGrid, hasLineOfSight, routeOrthogonal, setRectBlocked } from "./orthogonal";

function node(id: string, rect: Rect): GraphNode {
  return {
    id,
    body: { kind: "label", text: id },
    shape: "rect",
    rect,
    fingerprint: `test:${id}:0`,
  };
}


function pathHits(path: readonly { x: number; y: number }[], rect: Rect): boolean {
  for (let i = 1; i < path.length; i++) {
    if (segmentIntersectsRect(path[i - 1]!, path[i]!, rect)) return true;
  }
  return false;
}

describe("segmentIntersectsRect", () => {
  const box: Rect = { x: 10, y: 10, w: 10, h: 10 };

  it("detects a crossing", () => {
    expect(segmentIntersectsRect({ x: 0, y: 15 }, { x: 30, y: 15 }, box)).toBe(true);
  });

  it("ignores a segment that passes clear of the box", () => {
    expect(segmentIntersectsRect({ x: 0, y: 0 }, { x: 30, y: 0 }, box)).toBe(false);
    expect(segmentIntersectsRect({ x: 0, y: 30 }, { x: 30, y: 30 }, box)).toBe(false);
  });

  it("ignores a segment that stops short", () => {
    expect(segmentIntersectsRect({ x: 0, y: 15 }, { x: 5, y: 15 }, box)).toBe(false);
  });

  it("counts a segment that starts inside", () => {
    expect(segmentIntersectsRect({ x: 15, y: 15 }, { x: 100, y: 15 }, box)).toBe(true);
  });

  it("does not count merely grazing an edge", () => {


    expect(segmentIntersectsRect({ x: 0, y: 10 }, { x: 30, y: 10 }, box)).toBe(false);
  });
});

describe("simplifyPolyline", () => {
  it("drops points on a straight run", () => {
    expect(
      simplifyPolyline([
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 10, y: 0 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
    ]);
  });

  it("keeps corners", () => {
    const path = simplifyPolyline([
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
    ]);
    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 8 },
    ]);
  });

  it("leaves a two-point line alone", () => {
    const line = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(simplifyPolyline(line)).toEqual(line);
  });
});

describe("routeOrthogonal", () => {
  const bounds: Rect = { x: 0, y: 0, w: 400, h: 200 };

  it("goes straight when nothing is in the way", () => {
    const grid = buildGrid(bounds, []);
    const path = routeOrthogonal(grid, { x: 20, y: 100 }, { x: 380, y: 100 });

    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
  });

  it("routes around an obstacle instead of through it", () => {
    const wall: Rect = { x: 180, y: 60, w: 40, h: 80 };
    const grid = buildGrid(bounds, [wall]);
    const path = routeOrthogonal(grid, { x: 20, y: 100 }, { x: 380, y: 100 })!;

    expect(path).not.toBeNull();
    expect(pathHits(path, wall)).toBe(false);

    expect(path.length).toBeGreaterThan(2);
  });

  it("meets both endpoints exactly, so an arrowhead lands on the box", () => {
    const grid = buildGrid(bounds, [{ x: 180, y: 60, w: 40, h: 80 }]);
    const from = { x: 20, y: 100 };
    const to = { x: 380, y: 100 };
    const path = routeOrthogonal(grid, from, to)!;

    expect(path[0]).toEqual(from);
    expect(path[path.length - 1]).toEqual(to);
  });

  it("prefers few long runs over a staircase", () => {
    const grid = buildGrid(bounds, [{ x: 180, y: 60, w: 40, h: 80 }]);
    const path = routeOrthogonal(grid, { x: 20, y: 100 }, { x: 380, y: 100 })!;


    expect(path.length).toBeLessThanOrEqual(6);
  });

  it("reports failure rather than a path through a wall", () => {


    const grid = buildGrid({ x: 0, y: 0, w: 100, h: 100 }, [
      { x: 0, y: 40, w: 200, h: 20 },
    ]);
    expect(routeOrthogonal(grid, { x: 50, y: 10 }, { x: 50, y: 90 })).toBeNull();
  });

  it("gives up on an unreasonable search rather than hanging", () => {
    const grid = buildGrid({ x: 0, y: 0, w: 4000, h: 4000 }, []);
    expect(routeOrthogonal(grid, { x: 0, y: 0 }, { x: 3990, y: 3990 }, 50)).toBeNull();
  });
});

describe("setRectBlocked", () => {
  it("round-trips a rectangle in and out of the grid", () => {
    const rect: Rect = { x: 40, y: 40, w: 40, h: 40 };
    const grid = buildGrid({ x: 0, y: 0, w: 200, h: 200 }, [rect]);
    const before = [...grid.blocked];

    setRectBlocked(grid, rect, 0);
    expect(grid.blocked.some((v) => v === 1)).toBe(false);

    setRectBlocked(grid, rect, 1);
    expect([...grid.blocked]).toEqual(before);
  });
});

describe("rerouteEdges with obstacle avoidance", () => {
  const from = node("a", { x: 0, y: 90, w: 40, h: 20 });
  const to = node("b", { x: 360, y: 90, w: 40, h: 20 });
  const blocker = node("wall", { x: 180, y: 50, w: 40, h: 100 });

  const nodes = new Map([from, to, blocker].map((n) => [n.id, n]));
  const edge = {
    id: "a->b",
    from: "a",
    to: "b",
    route: { kind: "poly" as const, points: [] },
    startArrow: "none" as const,
    endArrow: "arrow" as const,
  };

  it("routes around a node standing between the endpoints", () => {
    const [routed] = rerouteEdges([edge], {
      nodes,
      moved: new Set(["a"]),
      bounds: { x: 0, y: 0, w: 400, h: 200 },
    });

    expect(routed!.route.points.length).toBeGreaterThan(2);
    expect(pathHits(routed!.route.points, blocker.rect)).toBe(false);
  });

  it("stays a straight line when nothing blocks it", () => {
    const clear = new Map([from, to].map((n) => [n.id, n]));
    const [routed] = rerouteEdges([edge], {
      nodes: clear,
      moved: new Set(["a"]),
      bounds: { x: 0, y: 0, w: 400, h: 200 },
    });

    expect(routed!.route.points).toHaveLength(2);
  });

  it("leaves routing off entirely when no bounds are given", () => {
    const [routed] = rerouteEdges([edge], { nodes, moved: new Set(["a"]) });
    expect(routed!.route.points).toHaveLength(2);
  });

  it("never overrides a manual waypoint", () => {


    const [routed] = rerouteEdges([edge], {
      nodes,
      moved: new Set(["a"]),
      bounds: { x: 0, y: 0, w: 400, h: 200 },
      waypoints: new Map([["a->b", [{ x: 200, y: 190 }]]]),
    });

    expect(routed!.route.points).toContainEqual({ x: 200, y: 190 });
  });

  it("does not disturb an edge whose endpoints both stayed put", () => {
    const untouched = { ...edge, id: "c->d", from: "wall", to: "wall" };
    const [routed] = rerouteEdges([untouched], {
      nodes,
      moved: new Set(["a"]),
      bounds: { x: 0, y: 0, w: 400, h: 200 },
    });

    expect(routed).toBe(untouched);
  });
});

describe("line-of-sight smoothing", () => {
  it("collapses a clear path to a straight line", () => {
    const grid = buildGrid({ x: 0, y: 0, w: 400, h: 200 }, []);
    expect(routeOrthogonal(grid, { x: 23, y: 101 }, { x: 377, y: 99 })).toEqual([
      { x: 23, y: 101 },
      { x: 377, y: 99 },
    ]);
  });

  it("reports what a segment can and cannot see past", () => {
    const grid = buildGrid({ x: 0, y: 0, w: 400, h: 200 }, [{ x: 180, y: 60, w: 40, h: 80 }]);

    expect(hasLineOfSight(grid, { x: 20, y: 100 }, { x: 380, y: 100 })).toBe(false);
    expect(hasLineOfSight(grid, { x: 20, y: 20 }, { x: 380, y: 20 })).toBe(true);
  });

  it("keeps a smoothed detour clear of the obstacle", () => {
    const wall: Rect = { x: 180, y: 60, w: 40, h: 80 };
    const grid = buildGrid({ x: 0, y: 0, w: 400, h: 200 }, [wall]);
    const path = routeOrthogonal(grid, { x: 20, y: 100 }, { x: 380, y: 100 })!;

    expect(pathHits(path, wall)).toBe(false);
  });
});

describe("a node dragged onto an edge", () => {
  const a = node("a", { x: 0, y: 90, w: 40, h: 20 });
  const b = node("b", { x: 360, y: 90, w: 40, h: 20 });
  const bounds: Rect = { x: 0, y: 0, w: 400, h: 200 };

  const straight = {
    id: "a->b",
    from: "a",
    to: "b",
    route: {
      kind: "poly" as const,
      points: [
        { x: 40, y: 100 },
        { x: 360, y: 100 },
      ],
    },
    startArrow: "none" as const,
    endArrow: "arrow" as const,
  };

  it("re-routes an edge a moved node has landed on", () => {


    const wall = node("wall", { x: 180, y: 60, w: 40, h: 100 });
    const nodes = new Map([a, b, wall].map((n) => [n.id, n]));

    const [routed] = rerouteEdges([straight], { nodes, moved: new Set(["wall"]), bounds });

    expect(routed).not.toBe(straight);
    expect(pathHits(routed!.route.points, wall.rect)).toBe(false);
  });

  it("leaves an edge alone when the moved node lands clear of it", () => {
    const away = node("away", { x: 180, y: 0, w: 40, h: 20 });
    const nodes = new Map([a, b, away].map((n) => [n.id, n]));

    const [routed] = rerouteEdges([straight], { nodes, moved: new Set(["away"]), bounds });
    expect(routed).toBe(straight);
  });

  it("does not treat an edge's own endpoints as a collision", () => {


    const nodes = new Map([a, b].map((n) => [n.id, n]));
    const [routed] = rerouteEdges([{ ...straight, id: "c->d", from: "x", to: "y" }], {
      nodes,
      moved: new Set(["a"]),
      bounds,
    });


    expect(routed!.route.points).toHaveLength(2);
  });
});
