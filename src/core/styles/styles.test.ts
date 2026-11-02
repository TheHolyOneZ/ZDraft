import { describe, expect, it } from "vitest";

import type { GraphScene } from "../model/scene";
import { renderCluster, nodeTextColors } from "../render/node";
import { themeByName } from "../theme";
import { applyStyles, contrastRatio, readableOn, retargetStyles, toHex, withStyle } from ".";

const theme = themeByName("blueprint");

const scene: GraphScene = {
  family: "graph",
  engine: "mermaid",
  diagramType: "flowchart",
  direction: "LR",
  nodes: [
    { id: "a", body: { kind: "label", text: "A" }, shape: "rect", rect: { x: 0, y: 0, w: 40, h: 20 }, fingerprint: "a", parent: "inner" },
    { id: "b", body: { kind: "label", text: "B" }, shape: "rect", rect: { x: 60, y: 0, w: 40, h: 20 }, fingerprint: "b", parent: "outer" },
    { id: "c", body: { kind: "label", text: "C" }, shape: "rect", rect: { x: 120, y: 0, w: 40, h: 20 }, fingerprint: "c", style: { fill: "#00ff00", dashed: true } },
  ],
  edges: [],
  clusters: [
    { id: "outer", label: "Outer", rect: { x: -20, y: -40, w: 200, h: 100 } },
    { id: "inner", label: "Inner", parent: "outer", rect: { x: -10, y: -20, w: 60, h: 50 } },
  ],
  bounds: { x: -20, y: -40, w: 200, h: 100 },
};

const node = (s: GraphScene, id: string) => s.nodes.find((n) => n.id === id)!;
const cluster = (s: GraphScene, id: string) => s.clusters.find((c) => c.id === id)!;

describe("applyStyles", () => {
  it("leaves the scene alone when nothing is styled", () => {
    expect(applyStyles(scene, undefined)).toBe(scene);
    expect(applyStyles(scene, {})).toBe(scene);
  });

  it("paints a node with its own fill and outline", () => {
    const out = applyStyles(scene, { b: { fill: "#112233", outline: "#ff0000" } });
    expect(node(out, "b").style).toMatchObject({ fill: "#112233", stroke: "#ff0000" });
    expect(node(out, "a").style).toBeUndefined();
  });

  it("lets members inherit from their container, the nearest one first", () => {
    const out = applyStyles(scene, {
      outer: { fill: "#111111", outline: "#222222" },
      inner: { fill: "#333333" },
    });

    expect(node(out, "a").style).toMatchObject({ fill: "#333333", stroke: "#222222" });
    expect(node(out, "b").style).toMatchObject({ fill: "#111111", stroke: "#222222" });
    expect(cluster(out, "inner").style).toMatchObject({ fill: "#333333", stroke: "#222222" });
  });

  it("prefers a node's own colour over its container's", () => {
    const out = applyStyles(scene, { outer: { fill: "#111111" }, b: { fill: "#abcdef" } });
    expect(node(out, "b").style?.fill).toBe("#abcdef");
  });

  it("overrides what the source set but keeps the rest of its style", () => {
    const out = applyStyles(scene, { c: { outline: "#0000ff" } });
    expect(node(out, "c").style).toEqual({ fill: "#00ff00", stroke: "#0000ff", dashed: true });
  });
});

describe("withStyle", () => {
  it("adds, changes and clears one colour at a time", () => {
    let styles = withStyle(undefined, "a", { fill: "#111111" });
    styles = withStyle(styles, "a", { outline: "#222222" });
    expect(styles).toEqual({ a: { fill: "#111111", outline: "#222222" } });

    styles = withStyle(styles, "a", { fill: null });
    expect(styles).toEqual({ a: { outline: "#222222" } });
  });

  it("drops the entry once no colour is left", () => {
    const styles = withStyle({ a: { fill: "#111111" } }, "a", { fill: null });
    expect(styles).toEqual({});
  });
});

describe("retargetStyles", () => {
  it("moves the colours along with a rename", () => {
    expect(retargetStyles({ a: { fill: "#111111" } }, "a", "z")).toEqual({ z: { fill: "#111111" } });
  });

  it("returns the same object when the node had no colours", () => {
    const styles = { a: { fill: "#111111" } };
    expect(retargetStyles(styles, "b", "z")).toBe(styles);
  });
});

describe("readable text on a custom fill", () => {
  it("keeps the theme's text where it already reads", () => {
    expect(readableOn("#0b1d33", "#ffffff")).toBe("#ffffff");
  });

  it("switches to dark text on a light fill", () => {
    const text = readableOn("#fde68a", "#e8f1ff");
    expect(contrastRatio("#fde68a", text)!).toBeGreaterThan(4.5);
  });

  it("does not judge a fill that is mostly see-through", () => {
    expect(readableOn("rgba(255, 255, 255, 0.06)", "#e8f1ff")).toBe("#e8f1ff");
  });

  it("leaves a colour it cannot read alone", () => {
    expect(readableOn("rebeccapurple", "#ffffff")).toBe("#ffffff");
  });

  it("is what the renderer uses for nodes and container titles", () => {
    const out = applyStyles(scene, { b: { fill: "#fffbe6" }, outer: { fill: "#fffbe6" } });
    expect(contrastRatio("#fffbe6", nodeTextColors(node(out, "b"), theme).text)!).toBeGreaterThan(4.5);
    expect(contrastRatio("#fffbe6", renderCluster(cluster(out, "outer"), theme).text)!).toBeGreaterThan(4.5);
  });
});

describe("toHex", () => {
  it("normalises the forms a colour input can take", () => {
    expect(toHex("#ABC")).toBe("#aabbcc");
    expect(toHex("#12314F")).toBe("#12314f");
    expect(toHex("rgba(103, 232, 249, 0.06)")).toBe("#67e8f9");
    expect(toHex("rgb(0,0,0)")).toBe("#000000");
    expect(toHex("rebeccapurple")).toBeNull();
  });
});
