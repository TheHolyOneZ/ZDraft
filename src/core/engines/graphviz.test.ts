import { describe, expect, it } from "vitest";

import { rectCenter } from "../model/geometry";
import { isGraph, type GraphScene } from "../model/scene";
import { contentAfterFirstGraph, graphvizAdapter, parseRecordLabel } from "./graphviz";

async function layout(source: string): Promise<GraphScene> {
  const result = await graphvizAdapter.layout(source);
  if (!isGraph(result.scene)) throw new Error("expected a graph scene");
  return result.scene;
}

describe("graphviz adapter", () => {
  it("lays out nodes with real geometry", async () => {
    const scene = await layout("digraph { a -> b; }");

    expect(scene.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    for (const node of scene.nodes) {
      expect(node.rect.w).toBeGreaterThan(0);
      expect(node.rect.h).toBeGreaterThan(0);
    }
    expect(scene.bounds.w).toBeGreaterThan(0);
  });

  it("flips Graphviz's bottom-up axis so `a` is drawn above `b`", async () => {


    const scene = await layout("digraph { rankdir=TB; a -> b; }");

    const a = scene.nodes.find((n) => n.id === "a")!;
    const b = scene.nodes.find((n) => n.id === "b")!;
    expect(rectCenter(a.rect).y).toBeLessThan(rectCenter(b.rect).y);
  });

  it("keeps every node inside the reported bounds", async () => {
    const scene = await layout("digraph { a -> b -> c; a -> c; }");

    for (const n of scene.nodes) {
      expect(n.rect.y).toBeGreaterThanOrEqual(-1);
      expect(n.rect.y + n.rect.h).toBeLessThanOrEqual(scene.bounds.h + 1);
      expect(n.rect.x + n.rect.w).toBeLessThanOrEqual(scene.bounds.w + 1);
    }
  });

  it("reads rankdir as the scene direction", async () => {
    expect((await layout("digraph { rankdir=LR; a; }")).direction).toBe("LR");
    expect((await layout("digraph { a; }")).direction).toBe("TB");
  });

  it("resolves the default label `\\N` to the node name", async () => {
    const scene = await layout("digraph { gateway; }");
    const node = scene.nodes[0]!;

    expect(node.body).toEqual({ kind: "label", text: "gateway" });
  });

  it("keeps an explicit label", async () => {
    const scene = await layout('digraph { gw [label="API Gateway"]; }');

    expect(scene.nodes[0]!.body).toEqual({ kind: "label", text: "API Gateway" });
  });

  it("defaults to an ellipse, as Graphviz does", async () => {
    const scene = await layout("digraph { a; b [shape=box]; c [shape=cylinder]; }");
    const shape = (id: string) => scene.nodes.find((n) => n.id === id)!.shape;

    expect(shape("a")).toBe("ellipse");
    expect(shape("b")).toBe("rect");
    expect(shape("c")).toBe("cylinder");
  });

  it("gives an edge a drawable route and an arrow tip", async () => {
    const scene = await layout("digraph { a -> b; }");
    const edge = scene.edges[0]!;

    expect(edge.from).toBe("a");
    expect(edge.to).toBe("b");
    expect(edge.route.points.length).toBeGreaterThanOrEqual(2);
    expect(edge.arrowEnd).toBeDefined();
    expect(edge.endArrow).toBe("arrow");

    if (edge.route.kind === "spline") {
      expect((edge.route.points.length - 1) % 3).toBe(0);
    }
  });

  it("carries an edge label and its position", async () => {
    const scene = await layout('digraph { a -> b [label="HTTP"]; }');
    const label = scene.edges[0]!.label!;

    expect(label.text).toBe("HTTP");
    expect(Number.isFinite(label.at.x)).toBe(true);
    expect(Number.isFinite(label.at.y)).toBe(true);
  });

  it("numbers parallel edges in source order", async () => {
    const scene = await layout(
      'digraph { a -> b [label="first"]; a -> b [label="second"]; }',
    );

    expect(scene.edges.map((e) => e.id)).toEqual(["a->b", "a->b#1"]);
    expect(scene.edges[0]!.label!.text).toBe("first");
    expect(scene.edges[1]!.label!.text).toBe("second");
  });

  it("reads clusters and their membership", async () => {
    const scene = await layout(
      'digraph { subgraph cluster_svc { label="services"; api; cache; } db; api -> db; }',
    );

    expect(scene.clusters).toHaveLength(1);
    expect(scene.clusters[0]!.label).toBe("services");
    expect(scene.clusters[0]!.rect.w).toBeGreaterThan(0);

    const api = scene.nodes.find((n) => n.id === "api")!;
    const db = scene.nodes.find((n) => n.id === "db")!;
    expect(api.parent).toBe("cluster_svc");
    expect(db.parent).toBeUndefined();
  });

  it("links nodes back to their source ranges", async () => {
    const source = "digraph {\n  gateway [shape=hexagon];\n  gateway -> db;\n}";
    const scene = await layout(source);
    const gateway = scene.nodes.find((n) => n.id === "gateway")!;

    expect(source.slice(gateway.sourceRange!.from, gateway.sourceRange!.to)).toBe(
      "gateway [shape=hexagon]",
    );
    expect(scene.edges[0]!.sourceRange).toBeDefined();
  });

  it("gives repeated labels distinct fingerprints", async () => {
    const scene = await layout('digraph { a [label="Step"]; b [label="Step"]; }');
    const prints = scene.nodes.map((n) => n.fingerprint);

    expect(new Set(prints).size).toBe(2);
  });

  it("reports a syntax error with its line instead of throwing", async () => {
    const result = await graphvizAdapter.layout("digraph { a -> ; }");

    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(result.scene.family).toBe("graph");


    expect(isGraph(result.scene) && result.scene.nodes).toEqual([]);
  });

  it("treats an undirected graph as one", async () => {
    const scene = await layout("graph { a -- b; }");

    expect(scene.diagramType).toBe("graph");
    expect(scene.edges[0]!.endArrow).toBe("arrow");
  });
});

describe("parseRecordLabel", () => {
  it("splits a record into title and compartments", () => {
    const body = parseRecordLabel("{Order|+id: int\\l+total: money\\l|place()\\l}");

    expect(body).toEqual({
      kind: "compartments",
      title: "Order",
      sections: [{ items: ["+id: int", "+total: money"] }, { items: ["place()"] }],
    });
  });

  it("handles a record with no compartments", () => {
    expect(parseRecordLabel("{Just a box}")).toEqual({
      kind: "compartments",
      title: "Just a box",
      sections: [],
    });
  });

  it("strips port names, which are not content", () => {
    const body = parseRecordLabel("{<f0> Order|<f1> total}");

    expect(body).toEqual({
      kind: "compartments",
      title: "Order",
      sections: [{ items: ["total"] }],
    });
  });

  it("flattens a nested record rather than drawing a lie", () => {
    const body = parseRecordLabel("{A|{B|C}}");

    expect(body.kind).toBe("compartments");
    if (body.kind === "compartments") {
      expect(body.title).toBe("A");
      expect(body.sections[0]!.items).toEqual(["B|C"]);
    }
  });

  it("renders a record node through the adapter as compartments", async () => {
    const scene = await layout('digraph { r [shape=record, label="{Order|+id\\l}"]; }');

    expect(scene.nodes[0]!.body.kind).toBe("compartments");
  });
});

describe("contentAfterFirstGraph", () => {


  it("finds a second graph nobody will ever see rendered", () => {
    const src = "digraph a { x; }\ndigraph b { y; }\n";
    const stray = contentAfterFirstGraph(src)!;

    expect(stray).not.toBeNull();
    expect(src.slice(stray.from, stray.to)).toContain("digraph b");
  });

  it("finds the wreckage of a half-paste", () => {
    const src = 'digraph a {\n  x;\n}\n\ny -> \nz [label=\n';
    const stray = contentAfterFirstGraph(src)!;
    expect(src.slice(stray.from, stray.to).trim().startsWith("y")).toBe(true);
  });

  it("says nothing about a clean file", () => {
    expect(contentAfterFirstGraph("digraph a {\n  x -> y;\n}\n")).toBeNull();
  });


  it("says nothing about a trailing comment", () => {
    expect(contentAfterFirstGraph("digraph a { x; }\n// a note\n/* and another */\n")).toBeNull();
  });

  it("is not confused by nested subgraphs", () => {
    const src = "digraph a {\n  subgraph cluster_b { x; }\n  subgraph cluster_c { y; }\n}\n";
    expect(contentAfterFirstGraph(src)).toBeNull();
  });

  it("says nothing when the graph never closes", () => {

    expect(contentAfterFirstGraph("digraph a {\n  x;\n")).toBeNull();
  });

  it("warns rather than blanking the diagram", async () => {
    const result = await graphvizAdapter.layout("digraph a {\n  x;\n}\ny -> \n");

    expect(result.diagnostics.some((d) => d.severity === "warning")).toBe(true);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(false);
    if (result.scene.family !== "graph") throw new Error("expected a graph");
    expect(result.scene.nodes).toHaveLength(1);
  });
});
