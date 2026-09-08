import { describe, expect, it } from "vitest";

import { locateDot, tokenizeDot } from "./dot";
import { idAt } from "./types";


function textOf(source: string, range: { from: number; to: number } | undefined): string {
  return range ? source.slice(range.from, range.to) : "";
}

describe("tokenizeDot", () => {
  it("keeps edge operators out of quoted strings", () => {
    const tokens = tokenizeDot('a [label="x -> y"]; a -> b;');
    expect(tokens.filter((t) => t.kind === "edgeop")).toHaveLength(1);
  });

  it("skips all three comment forms", () => {
    const tokens = tokenizeDot(`
      // a -> b
      # c -> d
      /* e -> f */
      g -> h;
    `);
    expect(tokens.filter((t) => t.kind === "edgeop")).toHaveLength(1);
    expect(tokens.filter((t) => t.value === "g")).toHaveLength(1);
  });

  it("treats an HTML label as one token", () => {
    const tokens = tokenizeDot("a [label=<<b>bold</b>>];");
    expect(tokens.some((t) => t.value.startsWith("<<b>"))).toBe(true);
  });
});

describe("locateDot", () => {
  it("points at the declaration of every node", () => {
    const src = "digraph G {\n  gateway [shape=hexagon];\n  db;\n  gateway -> db;\n}";
    const index = locateDot(src);

    expect(textOf(src, index.nodes.get("gateway"))).toBe("gateway [shape=hexagon]");
    expect(textOf(src, index.nodes.get("db"))).toBe("db");
  });

  it("records the first declaration, not later mentions", () => {
    const src = "digraph { a; b; a -> b; a -> b; }";
    const index = locateDot(src);

    expect(index.nodes.get("a")!.from).toBe(src.indexOf("a;"));
  });

  it("covers the whole statement for an edge, attributes included", () => {
    const src = 'digraph {\n  gateway -> api [label="HTTP"];\n}';
    const index = locateDot(src);

    expect(textOf(src, index.edges.get("gateway->api"))).toBe('gateway -> api [label="HTTP"]');
  });

  it("gives parallel edges distinct ranges in source order", () => {
    const src = 'digraph {\n  a -> b [label="first"];\n  a -> b [label="second"];\n}';
    const index = locateDot(src);

    expect(textOf(src, index.edges.get("a->b"))).toContain("first");
    expect(textOf(src, index.edges.get("a->b#1"))).toContain("second");
  });

  it("declares every node in a chain and both edges", () => {
    const index = locateDot("digraph { a -> b -> c; }");

    expect([...index.nodes.keys()].sort()).toEqual(["a", "b", "c"]);
    expect([...index.edges.keys()].sort()).toEqual(["a->b", "b->c"]);
  });

  it("fans out `a -> { b c }` to one edge each", () => {
    const index = locateDot("digraph { a -> { b c }; }");

    expect([...index.edges.keys()].sort()).toEqual(["a->b", "a->c"]);
    expect(index.nodes.has("c")).toBe(true);
  });

  it("does not invent nodes from attribute names or values", () => {
    const index = locateDot('digraph { rankdir=LR; node [shape=box color=red]; a -> b; }');

    expect([...index.nodes.keys()].sort()).toEqual(["a", "b"]);
  });

  it("ignores the graph keyword and its name", () => {
    const index = locateDot("digraph MyGraph { a; }");

    expect(index.nodes.has("MyGraph")).toBe(false);
    expect(index.nodes.has("a")).toBe(true);
  });

  it("locates a cluster by its subgraph name", () => {
    const src = "digraph {\n  subgraph cluster_svc {\n    label=\"services\";\n    api;\n  }\n}";
    const index = locateDot(src);

    expect(textOf(src, index.nodes.get("cluster_svc"))).toBe("cluster_svc");
    expect(index.nodes.has("api")).toBe(true);
    expect(index.nodes.has("services")).toBe(false);
  });

  it("treats ports as part of the node reference, not as nodes", () => {
    const index = locateDot("digraph { a:f0 -> b:f1; }");

    expect([...index.nodes.keys()].sort()).toEqual(["a", "b"]);
    expect([...index.edges.keys()]).toEqual(["a->b"]);
  });

  it("handles quoted ids containing spaces and arrows", () => {
    const index = locateDot('digraph { "API Gateway" -> "db -> cache"; }');

    expect([...index.nodes.keys()].sort()).toEqual(["API Gateway", "db -> cache"]);
    expect([...index.edges.keys()]).toEqual(["API Gateway->db -> cache"]);
  });

  it("supports undirected graphs", () => {
    const index = locateDot("graph { a -- b; }");

    expect([...index.edges.keys()]).toEqual(["a->b"]);
  });

  it("survives an unterminated string without hanging", () => {
    const index = locateDot('digraph { a [label="never closed');
    expect(index.nodes.has("a")).toBe(true);
  });

  it("resolves the id under a cursor offset, tightest range first", () => {
    const src = "digraph {\n  gateway -> api;\n}";
    const index = locateDot(src);

    expect(idAt(index, src.indexOf("api") + 1)).toBe("api");
    expect(idAt(index, src.indexOf("gateway") + 1)).toBe("gateway");
  });
});
