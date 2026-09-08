import { describe, expect, it } from "vitest";

import { graphvizAdapter } from "../engines/graphviz";
import { isGraph, type GraphScene } from "../model/scene";
import { applyPins, pinFor } from "../pins";
import { diffScenes, isLayoutOnly } from ".";

async function scene(source: string): Promise<GraphScene> {
  const result = await graphvizAdapter.layout(source);
  if (!isGraph(result.scene)) throw new Error("expected a graph scene");
  return result.scene;
}

const BASE = 'digraph d { a [label="A"]; b [label="B"]; a -> b; }';

describe("diffScenes", () => {
  it("says nothing changed when nothing changed", async () => {
    const before = await scene(BASE);
    const after = await scene(BASE);

    const diff = diffScenes(before, after);
    expect(diff.identical).toBe(true);
    expect(diff.summary).toBe("No changes");
  });

  it("finds a node that was added", async () => {
    const diff = diffScenes(
      await scene(BASE),
      await scene('digraph d { a [label="A"]; b [label="B"]; c [label="C"]; a -> b; }'),
    );

    expect(diff.nodes.filter((n) => n.change === "added").map((n) => n.id)).toEqual(["c"]);
    expect(diff.summary).toContain("1 node added");
  });

  it("finds a node that was removed, and where it used to be", async () => {
    const diff = diffScenes(
      await scene(BASE),
      await scene('digraph d { a [label="A"]; }'),
    );

    const removed = diff.nodes.find((n) => n.change === "removed")!;
    expect(removed.id).toBe("b");
    expect(removed.was).toBeDefined();
    expect(removed.rect).toBeUndefined();
  });


  it("does not confuse a rename with an add and a remove", async () => {
    const diff = diffScenes(
      await scene(BASE),
      await scene('digraph d { a [label="Alpha"]; b [label="B"]; a -> b; }'),

      { pinnedBefore: new Set(), pinnedAfter: new Set() },
    );

    expect(diff.nodes).toHaveLength(1);
    const [changed] = diff.nodes;
    expect(changed!.change).toBe("relabelled");
    expect(changed!.wasLabel).toBe("A");
    expect(changed!.label).toBe("Alpha");
  });


  it("ignores a neighbour that auto-layout reflowed", async () => {
    const wider = 'digraph d { a [label="A much longer label"]; b [label="B"]; a -> b; }';

    const noisy = diffScenes(await scene(BASE), await scene(wider));
    expect(noisy.nodes.some((n) => n.id === "b" && n.change === "moved")).toBe(true);

    const quiet = diffScenes(await scene(BASE), await scene(wider), {
      pinnedBefore: new Set(),
      pinnedAfter: new Set(),
    });
    expect(quiet.nodes.some((n) => n.id === "b")).toBe(false);
  });

  it("still reports a move of a node someone pinned", async () => {
    const before = await scene(BASE);
    const node = before.nodes.find((n) => n.id === "a")!;
    const after = applyPins(before, { pins: { a: pinFor(node, { x: 900, y: 500 }) } }).scene;

    const diff = diffScenes(before, after, {
      pinnedBefore: new Set(),
      pinnedAfter: new Set(["a"]),
    });
    expect(diff.nodes.find((n) => n.id === "a")?.change).toBe("moved");
  });


  it("reports a node whose pin was released", async () => {
    const before = await scene(BASE);
    const node = before.nodes.find((n) => n.id === "a")!;
    const pinned = applyPins(before, { pins: { a: pinFor(node, { x: 900, y: 500 }) } }).scene;

    const diff = diffScenes(pinned, before, {
      pinnedBefore: new Set(["a"]),
      pinnedAfter: new Set(),
    });
    expect(diff.nodes.find((n) => n.id === "a")?.change).toBe("moved");
  });

  it("finds a shape change", async () => {
    const diff = diffScenes(
      await scene(BASE),
      await scene('digraph d { a [label="A", shape=cylinder]; b [label="B"]; a -> b; }'),
    );

    expect(diff.nodes.find((n) => n.id === "a")?.change).toBe("reshaped");
  });


  it("finds a node moved only by a pin", async () => {
    const before = await scene(BASE);
    const node = before.nodes.find((n) => n.id === "a")!;
    const after = applyPins(before, { pins: { a: pinFor(node, { x: 900, y: 500 }) } }).scene;

    const diff = diffScenes(before, after);
    const moved = diff.nodes.find((n) => n.change === "moved")!;

    expect(moved.id).toBe("a");
    expect(moved.was).toBeDefined();
    expect(moved.rect).toBeDefined();
    expect(diff.summary).toContain("1 moved");
  });

  it("ignores a sub-pixel difference, which nobody did on purpose", async () => {
    const before = await scene(BASE);
    const after: GraphScene = {
      ...before,
      nodes: before.nodes.map((n) => ({ ...n, rect: { ...n.rect, x: n.rect.x + 0.2 } })),
    };

    expect(diffScenes(before, after).identical).toBe(true);
  });

  it("reports a relabel rather than a move when a node did both", async () => {
    const before = await scene(BASE);
    const after = await scene('digraph d { a [label="Alpha renamed"]; b [label="B"]; a -> b; }');


    expect(diffScenes(before, after).nodes.find((n) => n.id === "a")?.change).toBe("relabelled");
  });

  it("finds an edge that was added or removed", async () => {
    const added = diffScenes(
      await scene(BASE),
      await scene('digraph d { a [label="A"]; b [label="B"]; a -> b; b -> a; }'),
    );
    expect(added.edges.filter((e) => e.change === "added")).toHaveLength(1);

    const removed = diffScenes(
      await scene(BASE),
      await scene('digraph d { a [label="A"]; b [label="B"]; }'),
    );
    expect(removed.edges.filter((e) => e.change === "removed")).toHaveLength(1);
  });


  it("does not report an edge that only rerouted", async () => {
    const before = await scene(BASE);
    const node = before.nodes.find((n) => n.id === "a")!;
    const after = applyPins(before, { pins: { a: pinFor(node, { x: 900, y: 500 }) } }).scene;

    expect(diffScenes(before, after).edges).toEqual([]);
  });

  it("has nothing to say without something to compare against", () => {
    expect(diffScenes(null, null).identical).toBe(true);
    expect(diffScenes(null, null).summary).toBe("No changes");
  });

  it("counts several kinds of change in one summary", async () => {
    const diff = diffScenes(
      await scene(BASE),
      await scene('digraph d { a [label="Alpha"]; c [label="C"]; a -> c; }'),
    );

    expect(diff.summary).toContain("added");
    expect(diff.summary).toContain("removed");
    expect(diff.summary).toContain("relabelled");
  });
});

describe("isLayoutOnly", () => {


  it("knows a move is the sidecar and everything else is the source", () => {
    expect(isLayoutOnly("moved")).toBe(true);
    expect(isLayoutOnly("added")).toBe(false);
    expect(isLayoutOnly("relabelled")).toBe(false);
    expect(isLayoutOnly("reshaped")).toBe(false);
    expect(isLayoutOnly("removed")).toBe(false);
  });
});
