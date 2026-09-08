import { describe, expect, it } from "vitest";

import { detectMermaidType, familyForMermaidType, locateMermaid, parseMermaid } from "./mermaid";

const text = (source: string, range?: { from: number; to: number }) =>
  range ? source.slice(range.from, range.to) : "";

describe("detectMermaidType", () => {
  it("reads the leading keyword", () => {
    expect(detectMermaidType("flowchart LR\n a-->b")).toBe("flowchart");
    expect(detectMermaidType("graph TD\n a-->b")).toBe("flowchart");
    expect(detectMermaidType("stateDiagram-v2\n [*] --> A")).toBe("state");
    expect(detectMermaidType("classDiagram\n class A")).toBe("class");
    expect(detectMermaidType("erDiagram\n A ||--o{ B : x")).toBe("er");
    expect(detectMermaidType("sequenceDiagram\n A->>B: hi")).toBe("sequence");
    expect(detectMermaidType("pie title X")).toBe("pie");
  });

  it("skips comments and blank lines", () => {
    expect(detectMermaidType("\n%% a note\n\nflowchart LR\n a-->b")).toBe("flowchart");
  });

  it("skips YAML front matter", () => {
    expect(detectMermaidType("---\ntitle: X\n---\nflowchart LR\n a-->b")).toBe("flowchart");
  });
});

describe("familyForMermaidType", () => {
  it("puts class and ER in the graph family, not renderers of their own", () => {

    expect(familyForMermaidType("flowchart")).toBe("graph");
    expect(familyForMermaidType("state")).toBe("graph");
    expect(familyForMermaidType("class")).toBe("graph");
    expect(familyForMermaidType("er")).toBe("graph");
    expect(familyForMermaidType("C4Container")).toBe("graph");
  });

  it("routes sequence to its own family", () => {
    expect(familyForMermaidType("sequence")).toBe("sequence");
  });

  it("lets anything unmodelled fall through to passthrough rather than erroring", () => {
    expect(familyForMermaidType("gantt")).toBe("passthrough");
    expect(familyForMermaidType("pie")).toBe("passthrough");
    expect(familyForMermaidType("mindmap")).toBe("passthrough");
    expect(familyForMermaidType("something-new-in-mermaid-12")).toBe("passthrough");
  });
});

describe("parseMermaid — nodes", () => {
  it("reads every bracket shape", () => {
    const model = parseMermaid(`flowchart LR
  a[Rect]
  b(Round)
  c([Stadium])
  d[[Subroutine]]
  e[(Cylinder)]
  f((Circle))
  g{Diamond}
  h{{Hexagon}}
  i[/Parallelogram/]
  j[/Trapezoid\\]
  k>Note]`);

    const shape = (id: string) => model.nodes.get(id)!.shape;
    expect(shape("a")).toBe("rect");
    expect(shape("b")).toBe("round");
    expect(shape("c")).toBe("stadium");
    expect(shape("d")).toBe("subroutine");
    expect(shape("e")).toBe("cylinder");
    expect(shape("f")).toBe("circle");
    expect(shape("g")).toBe("diamond");
    expect(shape("h")).toBe("hexagon");
    expect(shape("i")).toBe("parallelogram");
    expect(shape("j")).toBe("trapezoid");
    expect(shape("k")).toBe("note");
  });

  it("prefers the longer bracket form", () => {

    const model = parseMermaid("flowchart LR\n  db[(Postgres)]");
    expect(model.nodes.get("db")).toMatchObject({ shape: "cylinder", label: "Postgres" });
  });

  it("falls back to the id when a node has no label", () => {
    const model = parseMermaid("flowchart LR\n  alpha --> beta");
    expect(model.nodes.get("alpha")!.label).toBe("alpha");
    expect(model.nodes.get("beta")!.shape).toBe("rect");
  });

  it("strips quotes and converts <br> to a line break", () => {
    const model = parseMermaid('flowchart LR\n  a["Two<br/>lines"]');
    expect(model.nodes.get("a")!.label).toBe("Two\nlines");
  });

  it("keeps the labelled declaration when a bare reference comes first", () => {
    const model = parseMermaid("flowchart LR\n  a --> b\n  a[Alpha]");
    expect(model.nodes.get("a")!.label).toBe("Alpha");
  });

  it("points at the declaration, brackets included", () => {
    const source = "flowchart LR\n  gateway{{API Gateway}}\n  gateway --> api";
    const index = locateMermaid(source);
    expect(text(source, index.nodes.get("gateway"))).toBe("gateway{{API Gateway}}");
  });
});

describe("parseMermaid — edges", () => {
  it("reads a chain as separate edges", () => {
    const model = parseMermaid("flowchart LR\n  a --> b --> c");
    expect(model.edges.map((e) => `${e.from}->${e.to}`)).toEqual(["a->b", "b->c"]);
  });

  it("reads a pipe label", () => {
    const model = parseMermaid("flowchart LR\n  a -->|miss| b");
    expect(model.edges[0]).toMatchObject({ from: "a", to: "b", label: "miss" });
  });

  it("reads an inline label", () => {
    const model = parseMermaid("flowchart LR\n  a -- retry --> b");
    expect(model.edges[0]).toMatchObject({ from: "a", to: "b", label: "retry" });
  });

  it("distinguishes dotted, thick and plain links", () => {
    const model = parseMermaid(`flowchart LR
  a -.-> b
  c ==> d
  e --- f`);

    expect(model.edges[0]).toMatchObject({ dashed: true, arrowEnd: true });
    expect(model.edges[1]).toMatchObject({ thick: true, arrowEnd: true });
    expect(model.edges[2]).toMatchObject({ dashed: false, thick: false, arrowEnd: false });
  });

  it("fans out an ampersand list", () => {
    const model = parseMermaid("flowchart LR\n  a & b --> c");
    expect(model.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual(["a->c", "b->c"]);
  });

  it("does not invent an edge from a bare declaration", () => {
    const model = parseMermaid("flowchart LR\n  a[Alpha]\n  b[Beta]");
    expect(model.edges).toEqual([]);
  });

  it("covers the whole statement for locate", () => {
    const source = "flowchart LR\n  cdn -->|miss| gateway";
    const index = locateMermaid(source);
    expect(text(source, index.edges.get("cdn->gateway"))).toBe("cdn -->|miss| gateway");
  });

  it("numbers parallel edges", () => {
    const source = "flowchart LR\n  a -->|one| b\n  a -->|two| b";
    const index = locateMermaid(source);
    expect(text(source, index.edges.get("a->b"))).toContain("one");
    expect(text(source, index.edges.get("a->b#1"))).toContain("two");
  });
});

describe("parseMermaid — structure", () => {
  it("reads direction from the header and from a `direction` line", () => {
    expect(parseMermaid("flowchart LR\n a-->b").direction).toBe("LR");
    expect(parseMermaid("graph TD\n a-->b").direction).toBe("TB");
    expect(parseMermaid("flowchart\n direction RL\n a-->b").direction).toBe("RL");
  });

  it("reads subgraphs and their members", () => {
    const model = parseMermaid(`flowchart LR
  subgraph edge["the edge"]
    cdn[CDN]
    gateway[GW]
  end
  db[(DB)]
  gateway --> db`);

    expect(model.subgraphs).toHaveLength(1);
    expect(model.subgraphs[0]!.id).toBe("edge");
    expect(model.subgraphs[0]!.title).toBe("the edge");
    expect(model.subgraphs[0]!.members.sort()).toEqual(["cdn", "gateway"]);
    expect(model.nodes.has("db")).toBe(true);
  });

  it("ignores comments, including a `-->` inside one", () => {
    const model = parseMermaid("flowchart LR\n  %% a --> b\n  c --> d");
    expect(model.edges.map((e) => `${e.from}->${e.to}`)).toEqual(["c->d"]);
  });

  it("does not treat a `%%` inside a quoted label as a comment", () => {
    const model = parseMermaid('flowchart LR\n  a["100%% done"] --> b');
    expect(model.nodes.get("a")!.label).toContain("100");
    expect(model.edges).toHaveLength(1);
  });

  it("ignores styling statements", () => {
    const model = parseMermaid(`flowchart LR
  a --> b
  classDef big fill:#f00
  class a big
  style b stroke:#0f0
  linkStyle 0 stroke:#00f
  click a "https://example.com"`);

    expect([...model.nodes.keys()].sort()).toEqual(["a", "b"]);
    expect(model.edges).toHaveLength(1);
  });

  it("returns an empty model for a family it does not parse", () => {
    const model = parseMermaid("sequenceDiagram\n  A->>B: hi");
    expect(model.family).toBe("sequence");
    expect(model.nodes.size).toBe(0);
  });

  it("survives a half-typed line without throwing", () => {
    for (const partial of ["flowchart LR\n  a[", "flowchart LR\n  a -->", "flowchart LR\n  a[(x"]) {
      expect(() => parseMermaid(partial)).not.toThrow();
    }
  });
});

describe("parseMermaid — class diagrams", () => {
  const source = `classDiagram
  class Order {
    <<entity>>
    +int id
    +Money total
    +place() bool
    +cancel() void
  }
  class Customer {
    +string name
  }
  Customer "1" --> "*" Order : places
  Order "1" *-- "*" LineItem`;

  const model = parseMermaid(source);

  it("does not read members as node declarations", () => {


    expect([...model.nodes.keys()].sort()).toEqual(["Customer", "LineItem", "Order"]);
  });

  it("splits members into attribute and method compartments", () => {
    expect(model.nodes.get("Order")!.sections).toEqual([
      { items: ["+int id", "+Money total"] },
      { items: ["+place() bool", "+cancel() void"] },
    ]);
  });

  it("reads a stereotype", () => {
    expect(model.nodes.get("Order")!.stereotype).toBe("entity");
  });

  it("reads relations, dropping cardinalities", () => {
    expect(model.edges.map((e) => `${e.from}->${e.to}`)).toEqual([
      "Customer->Order",
      "Order->LineItem",
    ]);
    expect(model.edges[0]!.label).toBe("places");
  });

  it("gives composition no arrowhead, since the engine draws the diamond", () => {
    expect(model.edges[1]!.arrowEnd).toBe(false);
    expect(model.edges[0]!.arrowEnd).toBe(true);
  });

  it("supports the one-line member form", () => {
    const one = parseMermaid("classDiagram\n  Order : +int id\n  Order : +place() bool");
    expect(one.nodes.get("Order")!.sections![0]!.items).toEqual(["+int id", "+place() bool"]);
  });
});

describe("parseMermaid — ER diagrams", () => {
  const model = parseMermaid(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  CUSTOMER {
    string name
    string email PK "the login"
  }`);

  it("reads entities and their attributes", () => {
    expect([...model.nodes.keys()].sort()).toEqual(["CUSTOMER", "LINE_ITEM", "ORDER"]);
    expect(model.nodes.get("CUSTOMER")!.sections).toEqual([
      { items: ["string name", "string email PK"] },
    ]);
  });

  it("reads crow's-foot relations and their labels", () => {
    expect(model.edges.map((e) => `${e.from}->${e.to}`)).toEqual([
      "CUSTOMER->ORDER",
      "ORDER->LINE_ITEM",
    ]);
    expect(model.edges[0]!.label).toBe("places");
  });

  it("draws no arrowhead, because the crow's foot is the notation", () => {
    expect(model.edges.every((e) => !e.arrowEnd)).toBe(true);
  });
});

describe("parseMermaid — state diagrams", () => {
  const source = `stateDiagram-v2
  [*] --> Idle
  Idle --> Running: start
  Running --> Done: finish
  Done --> [*]
  state "Long name" as Idle`;

  const model = parseMermaid(source);

  it("does not turn a transition label into a node", () => {


    expect([...model.nodes.keys()].sort()).toEqual(["Done", "Idle", "Running"]);
  });

  it("reads colon-form transition labels", () => {
    expect(model.edges.find((e) => e.to === "Running")!.label).toBe("start");
  });

  it("skips the [*] terminal, which the source never names", () => {
    expect(model.nodes.has("[*]")).toBe(false);
    expect(model.edges.every((e) => e.from !== "[*]" && e.to !== "[*]")).toBe(true);
  });

  it("applies a `state \"…\" as id` rename", () => {
    expect(model.nodes.get("Idle")!.label).toBe("Long name");
  });

  it("reads a composite state as a subgraph", () => {
    const composite = parseMermaid("stateDiagram-v2\n  state Outer {\n    A --> B\n  }");
    expect(composite.subgraphs.map((s) => s.id)).toEqual(["Outer"]);
    expect(composite.subgraphs[0]!.members.sort()).toEqual(["A", "B"]);
  });
});

describe("nested subgraphs", () => {
  const nested = `flowchart TB
  subgraph outer[Outer]
    subgraph inner[Inner]
      a --> b
    end
    c
  end
  d`;

  it("records which subgraph a nested one sits in", () => {
    const model = parseMermaid(nested);
    const inner = model.subgraphs.find((s) => s.id === "inner")!;
    const outer = model.subgraphs.find((s) => s.id === "outer")!;

    expect(inner.parent).toBe("outer");
    expect(outer.parent).toBeUndefined();
  });

  it("lists nested members on the enclosing subgraph too", () => {
    const model = parseMermaid(nested);
    const outer = model.subgraphs.find((s) => s.id === "outer")!;

    expect(outer.members).toContain("a");
    expect(outer.members).toContain("c");
  });

  it("records nesting for a composite state as well", () => {
    const model = parseMermaid(`stateDiagram-v2
  state Outer {
    state Inner {
      A --> B
    }
  }`);

    expect(model.subgraphs.find((s) => s.id === "Inner")?.parent).toBe("Outer");
  });
});
