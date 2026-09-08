/**
 * @vitest-environment node
 *
 * A directive, not a comment: D2's WASM wants a real worker and
 * `URL.createObjectURL`, and jsdom has neither. Do not let a tidy pass
 * take this out.
 */
import { describe, expect, it } from "vitest";

import { rectCenter } from "../model/geometry";
import { isGraph, nodeText, type GraphScene } from "../model/scene";
import { applyPins, pinFor } from "../pins";
import { d2Adapter, diagnosticsFromD2Error } from "./d2";

async function layout(source: string): Promise<GraphScene> {
  const result = await d2Adapter.layout(source);
  if (!isGraph(result.scene)) throw new Error("expected a graph scene");
  return result.scene;
}

describe("d2Adapter", () => {
  it("lays out a two-shape diagram", async () => {
    const scene = await layout("a -> b\n");

    expect(scene.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
    expect(scene.edges).toHaveLength(1);
    expect(scene.edges[0]!.from).toBe("a");
    expect(scene.edges[0]!.to).toBe("b");
  }, 30000);

  it("gives every node a real size", async () => {
    const scene = await layout("a: Alpha\nb: Beta\na -> b\n");
    for (const node of scene.nodes) {
      expect(node.rect.w, node.id).toBeGreaterThan(0);
      expect(node.rect.h, node.id).toBeGreaterThan(0);
    }
  }, 30000);

  it("uses the label from the source, not the id", async () => {
    const scene = await layout("srv: The Server\n");
    expect(nodeText(scene.nodes[0]!.body)).toBe("The Server");
  }, 30000);

  it("falls back to the id when a shape has no label", async () => {
    const scene = await layout("standalone\n");
    expect(nodeText(scene.nodes[0]!.body)).toBe("standalone");
  }, 30000);

  it("maps D2 shape names onto ZDraft outlines", async () => {
    const scene = await layout(
      "a: A {shape: cylinder}\nb: B {shape: hexagon}\nc: C {shape: person}\nd: D {shape: cloud}\ne: E {shape: queue}\n",
    );
    const shapeOf = (id: string) => scene.nodes.find((n) => n.id === id)!.shape;

    expect(shapeOf("a")).toBe("cylinder");
    expect(shapeOf("b")).toBe("hexagon");
    expect(shapeOf("c")).toBe("person");
    expect(shapeOf("d")).toBe("cloud");
    expect(shapeOf("e")).toBe("queue");
  }, 30000);


  it("reads a container as a cluster, not a node", async () => {
    const scene = await layout("core: {\n  api: API\n  worker: Worker\n}\n");

    expect(scene.clusters.map((c) => c.id)).toEqual(["core"]);
    expect(scene.nodes.map((n) => n.id).sort()).toEqual(["core.api", "core.worker"]);
  }, 30000);

  it("gives a container's members their parent", async () => {
    const scene = await layout("core: {\n  api: API\n}\n");
    expect(scene.nodes[0]!.parent).toBe("core");
  }, 30000);

  it("records nesting between containers", async () => {
    const scene = await layout("outer: {\n  inner: {\n    leaf: Leaf\n  }\n}\n");

    const inner = scene.clusters.find((c) => c.id === "outer.inner")!;
    expect(inner.parent).toBe("outer");
    expect(scene.nodes[0]!.parent).toBe("outer.inner");
  }, 30000);

  it("sizes a container around its contents", async () => {
    const scene = await layout("core: {\n  api: API\n  worker: Worker\n}\n");
    const cluster = scene.clusters[0]!;

    for (const node of scene.nodes) {
      expect(node.rect.x).toBeGreaterThanOrEqual(cluster.rect.x);
      expect(node.rect.x + node.rect.w).toBeLessThanOrEqual(cluster.rect.x + cluster.rect.w);
    }
  }, 30000);

  it("turns a class shape into compartments", async () => {
    const scene = await layout(
      "C: {\n  shape: class\n  name: string\n  -secret: int\n  +go(): bool\n}\n",
    );
    const body = scene.nodes[0]!.body;

    expect(body.kind).toBe("compartments");
    if (body.kind !== "compartments") return;
    expect(body.title).toBe("C");
    expect(body.sections.flatMap((s) => s.items).join(" ")).toContain("name");
    expect(body.sections.flatMap((s) => s.items).join(" ")).toContain("-secret");
  }, 30000);

  it("turns a sql_table into compartments with its constraints marked", async () => {
    const scene = await layout(
      "t: {\n  shape: sql_table\n  id: int {constraint: primary_key}\n  name: string\n}\n",
    );
    const body = scene.nodes[0]!.body;

    expect(body.kind).toBe("compartments");
    if (body.kind !== "compartments") return;
    const items = body.sections.flatMap((s) => s.items);
    expect(items.some((i) => i.startsWith("PK "))).toBe(true);
  }, 30000);

  it("maps arrowheads, including the ones it cannot draw exactly", async () => {
    const scene = await layout("a -> b\nc <-> d\ne -- f\n");
    const byPair = new Map(scene.edges.map((e) => [`${e.from}${e.to}`, e]));

    expect(byPair.get("ab")!.endArrow).toBe("arrow");
    expect(byPair.get("ab")!.startArrow).toBe("none");
    expect(byPair.get("cd")!.startArrow).toBe("arrow");
    expect(byPair.get("ef")!.endArrow).toBe("none");
  }, 30000);

  it("carries an edge label and places it on the route", async () => {
    const scene = await layout("a -> b: talks to\n");
    const edge = scene.edges[0]!;

    expect(edge.label?.text).toBe("talks to");
    const xs = edge.route.points.map((p) => p.x);
    expect(edge.label!.at.x).toBeGreaterThanOrEqual(Math.min(...xs) - 1);
    expect(edge.label!.at.x).toBeLessThanOrEqual(Math.max(...xs) + 1);
  }, 30000);

  it("gives parallel edges distinct ids", async () => {
    const scene = await layout("a -> b: one\na -> b: two\n");
    expect(new Set(scene.edges.map((e) => e.id)).size).toBe(scene.edges.length);
  }, 30000);


  it("discards D2's theme keys but keeps a colour the source set", async () => {
    const scene = await layout("plain: Plain\npainted: P {style.fill: \"#ff0000\"}\n");

    const plain = scene.nodes.find((n) => n.id === "plain")!;
    const painted = scene.nodes.find((n) => n.id === "painted")!;

    expect(plain.style?.fill).toBeUndefined();
    expect(painted.style?.fill).toBe("#ff0000");
  }, 30000);

  it("drops the lifeline scaffolding of a sequence diagram", async () => {
    const scene = await layout("shape: sequence_diagram\nalice -> bob: hi\n");

    expect(scene.nodes.map((n) => n.id).sort()).toEqual(["alice", "bob"]);
    for (const edge of scene.edges) {
      expect(edge.to).not.toMatch(/lifeline-end/);
    }
  }, 30000);

  it("reads the declared direction", async () => {
    expect((await layout("direction: right\na -> b\n")).direction).toBe("LR");
    expect((await layout("direction: up\na -> b\n")).direction).toBe("BT");
    expect((await layout("a -> b\n")).direction).toBe("TB");
  }, 30000);

  it("gives every node a source range that contains its own name", async () => {
    const source = "edge: {\n  cdn: CDN\n}\ndb: Postgres\nedge.cdn -> db\n";
    const scene = await layout(source);

    for (const node of scene.nodes) {
      expect(node.sourceRange, node.id).toBeDefined();
      const text = source.slice(node.sourceRange!.from, node.sourceRange!.to);
      expect(text, node.id).toContain(node.id.slice(node.id.lastIndexOf(".") + 1));
    }
  }, 30000);

  it("reports a parse error instead of throwing", async () => {
    const result = await d2Adapter.layout("a -> \n");

    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect(result.scene.family).toBe("graph");
  }, 30000);

  it("says so when there is nothing to draw", async () => {
    const result = await d2Adapter.layout("# just a comment\n");
    expect(result.diagnostics.some((d) => d.severity === "info")).toBe(true);
  }, 30000);


  it("keeps a pin when an unrelated part of the source changes", async () => {
    const before = await layout("a -> b\n");
    const node = before.nodes.find((n) => n.id === "a")!;
    const pins = { a: pinFor(node, { x: 400, y: 120 }) };

    const after = await layout("a -> b\nx -> y -> z\n");
    const applied = applyPins(after, { pins });

    expect(rectCenter(applied.scene.nodes.find((n) => n.id === "a")!.rect)).toEqual({
      x: 400,
      y: 120,
    });
    expect(applied.orphans).toEqual([]);
  }, 30000);
});

describe("diagnosticsFromD2Error", () => {
  const source = "a: A\nb -> \n";

  it("pulls the message and position out of D2's JSON payload", () => {
    const err = new Error(
      '[{"range":"index,1:0:5-1:5:10","errmsg":"index:2:1: connection missing destination"}]',
    );
    const [d] = diagnosticsFromD2Error(err, source);

    expect(d!.severity).toBe("error");
    expect(d!.message).toBe("connection missing destination");

    expect(d!.line).toBe(2);
    expect(source.slice(d!.range!.from, d!.range!.to)).toBe("b -> ");
  });

  it("reports every error, not just the first", () => {
    const err = new Error(
      '[{"range":"index,0:0:0-0:1:1","errmsg":"one"},{"range":"index,1:0:5-1:1:6","errmsg":"two"}]',
    );
    expect(diagnosticsFromD2Error(err, source)).toHaveLength(2);
  });

  it("falls back to the raw message when there is no payload to read", () => {
    const [d] = diagnosticsFromD2Error(new Error("the worker died"), source);
    expect(d!.message).toBe("the worker died");
    expect(d!.range).toBeUndefined();
  });


  it("counts characters, not bytes", () => {
    const accented = "café: Café\nx -> \n";
    const err = new Error('[{"range":"index,1:0:12-1:5:17","errmsg":"boom"}]');
    const [d] = diagnosticsFromD2Error(err, accented);

    expect(accented.slice(d!.range!.from, d!.range!.to)).toBe("x -> ");
  });
});
