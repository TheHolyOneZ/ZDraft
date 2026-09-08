import { describe, expect, it } from "vitest";

import { locateD2 } from "./d2";
import { idAt } from "./types";


function at(source: string, id: string): string | undefined {
  const range = locateD2(source).nodes.get(id);
  return range ? source.slice(range.from, range.to) : undefined;
}

describe("locateD2", () => {
  it("finds a plain declaration", () => {
    const src = "server: Server\n";
    expect(at(src, "server")).toBe("server");
  });

  it("finds both ends of a connection", () => {
    const src = "a -> b: talks\n";
    expect(at(src, "a")).toBe("a");
    expect(at(src, "b")).toBe("b");
  });

  it("keeps the first mention rather than a later one", () => {

    const src = "a -> b\nb: Bee\n";
    const range = locateD2(src).nodes.get("b")!;
    expect(range.from).toBeLessThan(src.indexOf("b: Bee"));
  });

  it("scopes keys declared inside a block", () => {
    const src = "core: {\n  api: API\n}\n";
    expect(at(src, "core")).toBe("core");
    expect(at(src, "core.api")).toBe("api");
  });

  it("nests scopes to any depth", () => {
    const src = "a: {\n  b: {\n    c: C\n  }\n}\n";
    expect(at(src, "a.b.c")).toBe("c");
  });

  it("leaves the scope when the block closes", () => {
    const src = "a: {\n  b: B\n}\nc: C\n";
    expect(at(src, "a.b")).toBe("b");
    expect(at(src, "c")).toBe("c");
    expect(locateD2(src).nodes.has("a.c")).toBe(false);
  });

  it("does not mistake a reserved key for a child shape", () => {
    const src = "db: {\n  shape: cylinder\n  label: Postgres\n}\n";
    const ids = [...locateD2(src).nodes.keys()];
    expect(ids).toContain("db");
    expect(ids).not.toContain("db.shape");
    expect(ids).not.toContain("db.label");
  });

  it("reads a dotted key as the path it is", () => {
    const src = "core.api: API\n";
    expect(at(src, "core.api")).toBe("core.api");
  });

  it("records an edge against the statement that declares it", () => {
    const src = "a -> b: hi\n";
    const range = locateD2(src).edges.get("a->b")!;
    expect(src.slice(range.from, range.to).trim()).toBe("a -> b: hi");
  });

  it("names each hop of a chain separately", () => {
    const index = locateD2("a -> b -> c\n");
    expect(index.edges.has("a->b")).toBe(true);
    expect(index.edges.has("b->c")).toBe(true);
  });

  it("gives parallel edges stable ordinals", () => {
    const index = locateD2("a -> b\na -> b\n");
    expect(index.edges.has("a->b")).toBe(true);
    expect(index.edges.has("a->b#1")).toBe(true);
  });

  it("reverses a backwards arrow so the edge id matches the graph", () => {
    const index = locateD2("a <- b\n");
    expect(index.edges.has("b->a")).toBe(true);
  });

  it("scopes a connection declared inside a block", () => {
    const index = locateD2("net: {\n  a -> b\n}\n");
    expect(index.edges.has("net.a->net.b")).toBe(true);
    expect(index.nodes.has("net.a")).toBe(true);
  });


  it("ignores a hash comment", () => {
    const index = locateD2("# a -> b\nc: C\n");
    expect(index.nodes.has("a")).toBe(false);
    expect(index.nodes.has("c")).toBe(true);
  });

  it("ignores a slash comment", () => {
    const index = locateD2("// a -> b\nc: C\n");
    expect(index.nodes.has("a")).toBe(false);
  });

  it("does not read an arrow inside a label", () => {
    const index = locateD2('a: "x -> y"\n');
    expect([...index.nodes.keys()]).toEqual(["a"]);
    expect(index.edges.size).toBe(0);
  });

  it("skips over a block string", () => {
    const src = "note: |md\n  # heading\n  a -> b\n|\nreal: Real\n";
    const index = locateD2(src);
    expect(index.nodes.has("real")).toBe(true);
    expect(index.nodes.has("a")).toBe(false);
  });

  it("takes a quoted key without its quotes", () => {
    const src = '"my server": Server\n';
    expect(locateD2(src).nodes.has("my server")).toBe(true);
  });

  it("keeps an unquoted key with a space in it whole", () => {
    const src = "my server: Server\n";
    expect(locateD2(src).nodes.has("my server")).toBe(true);
  });

  it("separates statements on one line by semicolons", () => {
    const index = locateD2("a: A; b: B\n");
    expect(index.nodes.has("a")).toBe(true);
    expect(index.nodes.has("b")).toBe(true);
  });

  it("resolves a root-relative key", () => {
    const src = "outer: {\n  inner: {\n    _.sibling -> x\n  }\n}\n";
    expect(locateD2(src).nodes.has("outer.sibling")).toBe(true);
  });

  it("survives a file that does not compile", () => {

    const index = locateD2("a -> \nb: {\n  c: C\n");
    expect(index.nodes.has("a")).toBe(true);
    expect(index.nodes.has("b.c")).toBe(true);
  });

  it("answers which id sits under a cursor", () => {
    const src = "alpha -> beta\n";
    const index = locateD2(src);
    expect(idAt(index, src.indexOf("beta") + 1)).toBe("beta");
    expect(idAt(index, 1)).toBe("alpha");
  });


  it("points every range at text containing its own id", () => {
    const src = `direction: right
edge: {
  cdn: CDN
  gateway: API Gateway
}
core: {
  api: API
}
edge.cdn -> edge.gateway: miss
edge.gateway -> core.api
`;
    const index = locateD2(src);
    for (const [id, range] of index.nodes) {
      const text = src.slice(range.from, range.to);
      const last = id.slice(id.lastIndexOf(".") + 1);
      expect(text, id).toContain(last);
    }
  });


  it("does not swallow a block that follows an inline label", () => {
    const index = locateD2(`db: Ledger {shape: cylinder}

services: {
  orders: Orders
}
`);

    expect([...index.nodes.keys()].sort()).toEqual(["db", "services", "services.orders"]);
  });

  it("keeps its scope through several inline blocks in a row", () => {
    const index = locateD2(`a: A {shape: circle}
b: B {shape: cylinder}
group: {
  c: C
}
`);

    expect(index.nodes.has("group.c")).toBe(true);
    expect(index.nodes.has("c")).toBe(false);
  });
});
