import { describe, expect, it } from "vitest";

import { graphvizAdapter } from "../engines/graphviz";
import { rectCenter } from "../model/geometry";
import { isGraph, type GraphScene } from "../model/scene";
import type { Layout } from "../sidecar/types";
import { applyPins, migratePin, pinFor, pinnedIds, withoutPin, withPin } from ".";

async function layout(source: string): Promise<GraphScene> {
  const result = await graphvizAdapter.layout(source);
  if (!isGraph(result.scene)) throw new Error("expected a graph scene");
  return result.scene;
}

const empty: Layout = {};

describe("applyPins", () => {
  it("leaves an unpinned diagram exactly as the engine laid it out", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, empty);

    expect(applied.scene).toBe(scene);
    expect(applied.ghosts.size).toBe(0);
    expect(applied.orphans).toEqual([]);
  });

  it("moves a pinned node to its pinned centre", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, { pins: { a: { x: 500, y: 400 } } });

    const a = applied.scene.nodes.find((n) => n.id === "a")!;
    expect(rectCenter(a.rect)).toEqual({ x: 500, y: 400 });
  });

  it("keeps the node's size when pinning", async () => {
    const scene = await layout('digraph { a [label="a fairly long label"]; }');
    const before = scene.nodes[0]!.rect;
    const applied = applyPins(scene, { pins: { a: { x: 0, y: 0 } } });

    expect(applied.scene.nodes[0]!.rect.w).toBe(before.w);
    expect(applied.scene.nodes[0]!.rect.h).toBe(before.h);
  });

  it("does not move nodes that are not pinned", async () => {
    const scene = await layout("digraph { a -> b; }");
    const before = scene.nodes.find((n) => n.id === "b")!.rect;
    const applied = applyPins(scene, { pins: { a: { x: 900, y: 900 } } });

    expect(applied.scene.nodes.find((n) => n.id === "b")!.rect).toEqual(before);
  });

  it("remembers where auto-layout wanted the node, for the ghost", async () => {
    const scene = await layout("digraph { a -> b; }");
    const auto = scene.nodes.find((n) => n.id === "a")!.rect;
    const applied = applyPins(scene, { pins: { a: { x: 500, y: 400 } } });

    expect(applied.ghosts.get("a")).toEqual(auto);
  });

  it("re-routes edges incident to a moved node", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, { pins: { a: { x: 800, y: 600 } } });
    const edge = applied.scene.edges[0]!;

    expect(edge.rerouted).toBe(true);

    const b = applied.scene.nodes.find((n) => n.id === "b")!;
    const tip = edge.arrowEnd!;
    expect(tip.x).toBeGreaterThanOrEqual(b.rect.x - 1);
    expect(tip.x).toBeLessThanOrEqual(b.rect.x + b.rect.w + 1);
  });

  it("leaves untouched edges with the engine's own spline", async () => {
    const scene = await layout("digraph { a -> b; c -> d; }");
    const before = scene.edges.find((e) => e.id === "c->d")!;
    const applied = applyPins(scene, { pins: { a: { x: 900, y: 900 } } });


    expect(applied.scene.edges.find((e) => e.id === "c->d")).toBe(before);
  });

  it("starts a re-routed edge on the pinned node's boundary, not its centre", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, { pins: { a: { x: 40, y: 500 } } });
    const a = applied.scene.nodes.find((n) => n.id === "a")!;
    const start = applied.scene.edges[0]!.route.points[0]!;

    const center = rectCenter(a.rect);
    expect(Math.hypot(start.x - center.x, start.y - center.y)).toBeGreaterThan(1);
  });

  it("grows the bounds to include a node pinned outside them", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, { pins: { a: { x: 2000, y: 1500 } } });

    expect(applied.scene.bounds.x + applied.scene.bounds.w).toBeGreaterThan(2000);
  });

  it("reports a pin whose node is gone rather than dropping it", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, { pins: { ghost: { x: 1, y: 2 } } });

    expect(applied.orphans.map((o) => o.id)).toEqual(["ghost"]);
    expect(applied.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("offers a rename migration when a fingerprint matches exactly one node", async () => {
    const before = await layout('digraph { old [label="Gateway"]; old -> b; }');
    const fingerprint = before.nodes.find((n) => n.id === "old")!.fingerprint;

    const after = await layout('digraph { renamed [label="Gateway"]; renamed -> b; }');
    const applied = applyPins(after, { pins: { old: { x: 1, y: 2, fingerprint } } });

    expect(applied.orphans[0]!.migrateTo).toBe("renamed");
  });

  it("refuses to guess when two nodes share a fingerprint", async () => {
    const scene = await layout('digraph { p [label="Step"]; q [label="Step"]; }');


    const applied = applyPins(scene, {
      pins: { gone: { x: 1, y: 2, fingerprint: "not-a-real-fingerprint" } },
    });

    expect(applied.orphans[0]!.migrateTo).toBeUndefined();
  });

  it("flags a pin the layout has since moved a long way from", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, {

      pins: { a: { x: 5000, y: 5000, auto: [5000, 5000] } },
    });

    expect(applied.diagnostics.some((d) => d.message.includes("a long way"))).toBe(true);
  });

  it("says nothing about a drag, however far it went", async () => {
    const scene = await layout("digraph { a -> b; }");
    const node = scene.nodes.find((n) => n.id === "a")!;


    const applied = applyPins(scene, { pins: { a: pinFor(node, { x: 5000, y: 5000 }) } });

    expect(applied.diagnostics).toEqual([]);
  });

  it("reports no drift for a pin written before drift was recorded", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, { pins: { a: { x: 5000, y: 5000 } } });

    expect(applied.diagnostics).toEqual([]);
  });

  it("stays quiet about a small nudge", async () => {
    const scene = await layout("digraph { a -> b; }");
    const auto = rectCenter(scene.nodes.find((n) => n.id === "a")!.rect);
    const applied = applyPins(scene, { pins: { a: { x: auto.x + 12, y: auto.y } } });

    expect(applied.diagnostics).toEqual([]);
  });

  it("applies edge waypoints even with no node pinned", async () => {
    const scene = await layout("digraph { a -> b; }");
    const applied = applyPins(scene, {
      edges: { "a->b": { waypoints: [[400, 400]] } },
    });

    const points = applied.scene.edges[0]!.route.points;
    expect(points).toContainEqual({ x: 400, y: 400 });
  });

  it("applies a label offset without re-routing", async () => {
    const scene = await layout('digraph { a -> b [label="x"]; }');
    const applied = applyPins(scene, {
      edges: { "a->b": { label_offset: [10, -20] } },
    });

    expect(applied.scene.edges[0]!.label!.offset).toEqual({ x: 10, y: -20 });
  });

  it("gives a self-loop a visible arc rather than a zero-length line", async () => {
    const scene = await layout("digraph { a -> a; }");
    const applied = applyPins(scene, { pins: { a: { x: 300, y: 300 } } });
    const route = applied.scene.edges[0]!.route;

    const first = route.points[0]!;
    const last = route.points[route.points.length - 1]!;
    expect(Math.hypot(last.x - first.x, last.y - first.y)).toBeGreaterThan(5);
  });
});

describe("pin editing", () => {
  it("round-trips add and remove", async () => {
    const scene = await layout("digraph { a; }");
    const node = scene.nodes[0]!;

    const withOne = withPin(empty, "a", pinFor(node, { x: 10, y: 20 }));
    expect(pinnedIds(withOne)).toEqual(new Set(["a"]));

    expect(pinnedIds(withoutPin(withOne, "a"))).toEqual(new Set());
  });

  it("records the fingerprint when pinning, so a rename can be recovered", async () => {
    const scene = await layout('digraph { a [label="Gateway"]; }');
    const node = scene.nodes[0]!;
    const pin = pinFor(node, { x: 1, y: 2 });

    expect(pin.fingerprint).toBe(node.fingerprint);
  });

  it("migrates a pin to a new id, keeping its coordinates", () => {
    const start: Layout = { pins: { old: { x: 42, y: 7, fingerprint: "f" } } };
    const moved = migratePin(start, "old", "renamed");

    expect(moved.pins).toEqual({ renamed: { x: 42, y: 7, fingerprint: "f" } });
  });

  it("does not mutate the layout it was given", () => {
    const start: Layout = { pins: { a: { x: 1, y: 1 } } };
    withPin(start, "b", { x: 2, y: 2 });
    withoutPin(start, "a");

    expect(Object.keys(start.pins!)).toEqual(["a"]);
  });
});

describe("the round-trip, as a property", () => {
  it("reproduces pinned positions exactly after a reload", async () => {


    const source = "digraph { rankdir=LR; a -> b -> c; a -> c; d -> b; }";
    const scene = await layout(source);

    let saved: Layout = {};
    const targets = new Map<string, { x: number; y: number }>();

    scene.nodes.forEach((node, i) => {
      const center = { x: 100 + i * 137, y: 80 + ((i * 91) % 300) };
      targets.set(node.id, center);
      saved = withPin(saved, node.id, pinFor(node, center));
    });


    const reloaded = await layout(source);
    const applied = applyPins(reloaded, saved);

    for (const node of applied.scene.nodes) {
      expect(rectCenter(node.rect)).toEqual(targets.get(node.id));
    }
  });

  it("keeps pins stable when an unrelated part of the source changes", async () => {
    const before = await layout("digraph { a -> b; }");
    const pinned = withPin({}, "a", pinFor(before.nodes.find((n) => n.id === "a")!, { x: 250, y: 60 }));


    const after = await layout("digraph { a -> b; x -> y -> z; }");
    const applied = applyPins(after, pinned);

    expect(rectCenter(applied.scene.nodes.find((n) => n.id === "a")!.rect)).toEqual({
      x: 250,
      y: 60,
    });
    expect(applied.orphans).toEqual([]);
  });
});

describe("subgraph boxes", () => {
  const nested = `digraph {
    subgraph cluster_outer {
      label="outer";
      subgraph cluster_inner {
        label="inner";
        a; b;
      }
      c;
    }
    d;
  }`;

  it("leaves a subgraph exactly where the engine put it when nothing inside moved", async () => {
    const scene = await layout(nested);
    const before = scene.clusters.map((c) => c.rect);
    const applied = applyPins(scene, { pins: { d: { x: 900, y: 900 } } });

    expect(applied.scene.clusters.map((c) => c.rect)).toEqual(before);
  });

  it("carries the box along when every node inside is moved together", async () => {
    const scene = await layout(nested);
    const inner = scene.clusters.find((c) => c.label === "inner")!;
    const members = scene.nodes.filter((n) => n.parent === inner.id);
    expect(members.length).toBe(2);

    const dx = 140;
    const dy = -60;
    const pins = Object.fromEntries(
      members.map((n) => {
        const c = rectCenter(n.rect);
        return [n.id, { x: c.x + dx, y: c.y + dy }];
      }),
    );

    const applied = applyPins(scene, { pins });
    const moved = applied.scene.clusters.find((c) => c.id === inner.id)!;

    expect(moved.rect.x).toBeCloseTo(inner.rect.x + dx, 6);
    expect(moved.rect.y).toBeCloseTo(inner.rect.y + dy, 6);

    expect(moved.rect.w).toBeCloseTo(inner.rect.w, 6);
    expect(moved.rect.h).toBeCloseTo(inner.rect.h, 6);
  });

  it("grows the box, keeping its label gutter, when one node inside is pulled away", async () => {
    const scene = await layout(nested);
    const inner = scene.clusters.find((c) => c.label === "inner")!;
    const a = scene.nodes.find((n) => n.id === "a")!;
    const c = rectCenter(a.rect);

    const applied = applyPins(scene, { pins: { a: { x: c.x - 300, y: c.y } } });
    const grown = applied.scene.clusters.find((cl) => cl.id === inner.id)!;
    const movedA = applied.scene.nodes.find((n) => n.id === "a")!;

    expect(grown.rect.w).toBeGreaterThan(inner.rect.w);

    expect(grown.rect.x).toBeLessThanOrEqual(movedA.rect.x);

    expect(grown.rect.x - movedA.rect.x).toBeCloseTo(inner.rect.x - a.rect.x, 6);
  });

  it("moves an enclosing subgraph when a nested one moves", async () => {
    const scene = await layout(nested);
    const outer = scene.clusters.find((c) => c.label === "outer")!;
    const inner = scene.clusters.find((c) => c.label === "inner")!;

    const pins = Object.fromEntries(
      scene.nodes
        .filter((n) => n.parent === inner.id)
        .map((n) => {
          const c = rectCenter(n.rect);
          return [n.id, { x: c.x, y: c.y - 400 }];
        }),
    );

    const applied = applyPins(scene, { pins });
    const grownOuter = applied.scene.clusters.find((c) => c.id === outer.id)!;

    expect(grownOuter.rect.y).toBeLessThan(outer.rect.y);
    expect(grownOuter.rect.h).toBeGreaterThan(outer.rect.h);
  });

  it("widens the scene bounds to include a subgraph a pin pushed outward", async () => {
    const scene = await layout(nested);
    const inner = scene.clusters.find((c) => c.label === "inner")!;
    const pins = Object.fromEntries(
      scene.nodes
        .filter((n) => n.parent === inner.id)
        .map((n) => {
          const c = rectCenter(n.rect);
          return [n.id, { x: c.x + 800, y: c.y }];
        }),
    );

    const applied = applyPins(scene, { pins });
    const moved = applied.scene.clusters.find((c) => c.id === inner.id)!;
    const bounds = applied.scene.bounds;

    expect(bounds.x + bounds.w).toBeGreaterThanOrEqual(moved.rect.x + moved.rect.w);
  });
});
