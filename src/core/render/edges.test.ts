import { describe, expect, it } from "vitest";

import type { EdgeRoute } from "../model/scene";
import { arrowGeometry, edgePathD, headArrow, pointAlong, tailArrow } from "./edges";

const poly = (...points: Array<[number, number]>): EdgeRoute => ({
  kind: "poly",
  points: points.map(([x, y]) => ({ x, y })),
});

describe("edgePathD", () => {
  it("emits a polyline", () => {
    expect(edgePathD(poly([0, 0], [10, 0], [10, 10]))).toBe("M0,0 L10,0 L10,10");
  });

  it("emits cubics for a well-formed spline", () => {
    const spline: EdgeRoute = {
      kind: "spline",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 0 },
      ],
    };
    expect(edgePathD(spline)).toBe("M0,0 C1,1 2,1 3,0");
  });

  it("falls back to a polyline when the point count is not 3n+1", () => {
    const broken: EdgeRoute = {
      kind: "spline",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ],
    };

    expect(edgePathD(broken)).toBe("M0,0 L1,1 L2,2");
  });
});

describe("arrowheads", () => {
  it("draws a head when the tip lies beyond the route, as Graphviz reports it", () => {
    const route = poly([0, 0], [90, 0]);
    expect(headArrow(route, { x: 100, y: 0 }, "arrow", 10)).not.toBeNull();
  });

  it("draws a head when the tip *is* the route's last point", () => {


    const route = poly([0, 0], [100, 0]);
    const head = headArrow(route, { x: 100, y: 0 }, "arrow", 10);

    expect(head).not.toBeNull();
    expect(head!.path).toContain("M100,0");
  });

  it("points the head along the last meaningful segment", () => {
    const route = poly([0, 0], [0, 100]);
    const head = headArrow(route, { x: 0, y: 100 }, "arrow", 10)!;


    const ys = [...head.path.matchAll(/,(-?[\d.]+)/g)].map((m) => Number(m[1]));
    expect(Math.max(...ys)).toBeCloseTo(100, 3);
    expect(Math.min(...ys)).toBeLessThan(100);
  });

  it("ignores duplicated points at the end", () => {
    const route = poly([0, 0], [50, 0], [50, 0]);
    expect(headArrow(route, { x: 50, y: 0 }, "arrow", 10)).not.toBeNull();
  });

  it("draws a tail arrow at the other end", () => {
    const route = poly([0, 0], [100, 0]);
    const tail = tailArrow(route, { x: 0, y: 0 }, "arrow", 10);

    expect(tail).not.toBeNull();
    expect(tail!.path).toContain("M0,0");
  });

  it("draws nothing for a zero-length route", () => {
    const route = poly([5, 5], [5, 5]);
    expect(headArrow(route, { x: 5, y: 5 }, "arrow", 10)).toBeNull();
  });

  it("draws nothing when the edge has no arrow", () => {
    expect(headArrow(poly([0, 0], [10, 0]), undefined, "none", 10)).toBeNull();
  });

  it("fills solid heads and outlines open ones", () => {
    const at = { x: 10, y: 0 };
    const from = { x: 0, y: 0 };
    expect(arrowGeometry("arrow", at, from, 8)!.filled).toBe(true);
    expect(arrowGeometry("open", at, from, 8)!.filled).toBe(false);
    expect(arrowGeometry("odot", at, from, 8)!.filled).toBe(false);
  });
});

describe("pointAlong", () => {
  it("finds the midpoint of a straight run", () => {
    expect(pointAlong(poly([0, 0], [100, 0]), 0.5)).toEqual({ x: 50, y: 0 });
  });

  it("clamps out-of-range parameters", () => {
    const route = poly([0, 0], [100, 0]);
    expect(pointAlong(route, -1)).toEqual({ x: 0, y: 0 });
    expect(pointAlong(route, 2)).toEqual({ x: 100, y: 0 });
  });

  it("measures by arc length, not by point count", () => {


    const at = pointAlong(poly([0, 0], [100, 0], [110, 0]), 0.5);
    expect(at.x).toBeCloseTo(55, 3);
  });
});
