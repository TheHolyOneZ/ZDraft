import { describe, expect, it } from "vitest";

import { dotEditor, idOccurrences } from "./dot";
import { mermaidEditor } from "./mermaid";
import { spliceAll } from "./types";


const SRC = `digraph arch {
  rankdir=LR;
  node [shape=box];

  // the edge tier
  cdn [label="CDN"];
  gateway [shape=hexagon, label="API Gateway"];
  bare;

  cdn -> gateway [label="miss"];
  gateway -> cdn;
}
`;

describe("idOccurrences", () => {
  it("finds a declaration and every reference", () => {
    const found = idOccurrences(SRC, "cdn");

    expect(found).toHaveLength(3);
    for (const range of found) expect(SRC.slice(range.from, range.to)).toBe("cdn");
  });

  it("ignores the same word inside a label", () => {
    const src = 'digraph { a [label="b"]; b; }';
    expect(idOccurrences(src, "b")).toHaveLength(1);
  });

  it("ignores the same word in a comment", () => {
    const src = "digraph {\n  // talk to gateway\n  gateway;\n}";
    expect(idOccurrences(src, "gateway")).toHaveLength(1);
  });

  it("ignores an attribute name that happens to match", () => {
    const src = "digraph { shape [shape=box]; }";

    expect(idOccurrences(src, "shape")).toHaveLength(1);
  });

  it("follows an attribute whose value really is a node id", () => {
    const src = "digraph { a; b; a -> b [lhead=b]; }";
    expect(idOccurrences(src, "b")).toHaveLength(3);
  });
});

describe("dotEditor.rename", () => {
  it("changes the declaration and every edge reference together", () => {
    const out = dotEditor.rename(SRC, "cdn", "edge_cache")!;

    expect(out.source).toContain("edge_cache [label=\"CDN\"]");
    expect(out.source).toContain("edge_cache -> gateway");
    expect(out.source).toContain("gateway -> edge_cache");
    expect(out.source).not.toMatch(/\bcdn\b/);
  });

  it("leaves everything else byte-identical", () => {
    const out = dotEditor.rename(SRC, "cdn", "x")!;


    expect(out.source).toContain("  // the edge tier");
    expect(out.source).toContain("gateway [shape=hexagon, label=\"API Gateway\"];");
    expect(out.source.split("\n")).toHaveLength(SRC.split("\n").length);
  });

  it("reports where the change landed, in the new text", () => {
    const out = dotEditor.rename(SRC, "cdn", "edge_cache")!;
    for (const range of out.changed) {
      expect(out.source.slice(range.from, range.to)).toBe("edge_cache");
    }
  });

  it("quotes a name that needs it", () => {
    const out = dotEditor.rename(SRC, "cdn", "my node")!;
    expect(out.source).toContain('"my node"');
  });

  it("refuses a no-op or an id that is not there", () => {
    expect(dotEditor.rename(SRC, "cdn", "cdn")).toBeNull();
    expect(dotEditor.rename(SRC, "nope", "x")).toBeNull();
    expect(dotEditor.rename(SRC, "cdn", "  ")).toBeNull();
  });

  it("names itself for the undo timeline", () => {
    expect(dotEditor.rename(SRC, "cdn", "x")!.label).toBe("Rename cdn to x");
  });
});

describe("dotEditor.setLabel", () => {
  it("replaces an existing label in place", () => {
    const out = dotEditor.setLabel(SRC, "cdn", "Edge cache")!;

    expect(out.source).toContain('cdn [label="Edge cache"]');
    expect(out.source).toContain("  // the edge tier");
  });

  it("keeps the other attributes and their order", () => {
    const out = dotEditor.setLabel(SRC, "gateway", "Gateway")!;
    expect(out.source).toContain('gateway [shape=hexagon, label="Gateway"]');
  });

  it("adds an attribute list to a node that has none", () => {
    const out = dotEditor.setLabel(SRC, "bare", "Bare")!;
    expect(out.source).toContain('bare [label="Bare"];');
  });

  it("escapes a quote rather than breaking the file", () => {
    const out = dotEditor.setLabel(SRC, "cdn", 'the "edge"')!;
    expect(out.source).toContain('label="the \\"edge\\""');
  });

  it("refuses an id that is not declared", () => {
    expect(dotEditor.setLabel(SRC, "nope", "x")).toBeNull();
  });
});

describe("dotEditor.setShape", () => {
  it("replaces an existing shape", () => {
    const out = dotEditor.setShape(SRC, "gateway", "cylinder")!;
    expect(out.source).toContain("gateway [shape=cylinder, label=\"API Gateway\"]");
  });

  it("adds one where there was none", () => {
    const out = dotEditor.setShape(SRC, "cdn", "diamond")!;
    expect(out.source).toContain('cdn [label="CDN", shape=diamond]');
  });


  it("writes DOT's own word for the shape", () => {
    expect(dotEditor.setShape(SRC, "bare", "doc")!.source).toContain("shape=note");
    expect(dotEditor.setShape(SRC, "bare", "subroutine")!.source).toContain("shape=component");
  });

  it("refuses a shape DOT has no word for", () => {
    expect(dotEditor.setShape(SRC, "cdn", "queue")).toBeNull();
    expect(dotEditor.setShape(SRC, "cdn", "cloud")).toBeNull();
  });

  it("offers only shapes it can actually write", () => {
    for (const shape of dotEditor.shapes) {
      expect(dotEditor.setShape(SRC, "bare", shape), shape).not.toBeNull();
    }
  });
});

describe("dotEditor.idProblem", () => {
  it("accepts an ordinary id", () => {
    expect(dotEditor.idProblem("api_v2")).toBeNull();
  });

  it("rejects a keyword, punctuation and a leading digit", () => {
    expect(dotEditor.idProblem("subgraph")).not.toBeNull();
    expect(dotEditor.idProblem("a;b")).not.toBeNull();
    expect(dotEditor.idProblem("2fast")).not.toBeNull();
    expect(dotEditor.idProblem("")).not.toBeNull();
  });
});

describe("spliceAll", () => {
  it("keeps later offsets valid while applying earlier ones", () => {
    const out = spliceAll("aaa bbb ccc", [
      { range: { from: 0, to: 3 }, text: "LONGER" },
      { range: { from: 8, to: 11 }, text: "z" },
    ]);

    expect(out.source).toBe("LONGER bbb z");
    expect(out.source.slice(out.changed[0]!.from, out.changed[0]!.to)).toBe("LONGER");
    expect(out.source.slice(out.changed[1]!.from, out.changed[1]!.to)).toBe("z");
  });

  it("does not care what order it is handed the edits in", () => {
    const forwards = spliceAll("aaa bbb", [
      { range: { from: 0, to: 3 }, text: "x" },
      { range: { from: 4, to: 7 }, text: "y" },
    ]);
    const backwards = spliceAll("aaa bbb", [
      { range: { from: 4, to: 7 }, text: "y" },
      { range: { from: 0, to: 3 }, text: "x" },
    ]);

    expect(forwards.source).toBe(backwards.source);
  });
});


const MMD = `flowchart TD
  %% cdn is the edge tier
  cdn[CDN] --> gateway{{API Gateway}}
  gateway --> api
  api[(Database)]
  bare
  labelled["a cdn reference"] --> cdn
`;

describe("mermaidEditor.rename", () => {
  it("changes the declaration and every reference", () => {
    const out = mermaidEditor.rename(MMD, "gateway", "edge_gw")!;

    expect(out.source).toContain("edge_gw{{API Gateway}}");
    expect(out.source).toContain("edge_gw --> api");
    expect(out.source).not.toMatch(/\bgateway\b/);
  });

  it("leaves a comment mentioning the same word alone", () => {
    const out = mermaidEditor.rename(MMD, "cdn", "edge")!;
    expect(out.source).toContain("%% cdn is the edge tier");
  });

  it("leaves the same word inside a label alone", () => {
    const out = mermaidEditor.rename(MMD, "cdn", "edge")!;
    expect(out.source).toContain('labelled["a cdn reference"]');
    expect(out.source).toContain("--> edge\n");
  });

  it("leaves everything else byte-identical", () => {
    const out = mermaidEditor.rename(MMD, "api", "store")!;
    expect(out.source.split("\n")).toHaveLength(MMD.split("\n").length);
    expect(out.source).toContain("  cdn[CDN] --> gateway{{API Gateway}}");
  });

  it("refuses a no-op or an unknown id", () => {
    expect(mermaidEditor.rename(MMD, "cdn", "cdn")).toBeNull();
    expect(mermaidEditor.rename(MMD, "nope", "x")).toBeNull();
  });
});

describe("mermaidEditor.setLabel", () => {
  it("replaces the text between the delimiters, keeping the shape", () => {
    const out = mermaidEditor.setLabel(MMD, "gateway", "Gateway")!;
    expect(out.source).toContain("gateway{{Gateway}}");
  });

  it("gives a bare node delimiters, which is the shape it already drew as", () => {
    const out = mermaidEditor.setLabel(MMD, "bare", "Bare")!;
    expect(out.source).toContain("bare[Bare]");
  });


  it("quotes a label holding something the delimiters would eat", () => {
    const out = mermaidEditor.setLabel(MMD, "cdn", "CDN [edge]")!;
    expect(out.source).toContain('cdn["CDN [edge]"]');
  });

  it("refuses an unknown id", () => {
    expect(mermaidEditor.setLabel(MMD, "nope", "x")).toBeNull();
  });
});

describe("mermaidEditor.setShape", () => {
  it("swaps the delimiters and keeps the label", () => {
    const out = mermaidEditor.setShape(MMD, "cdn", "cylinder")!;
    expect(out.source).toContain("cdn[(CDN)]");
    expect(out.source).toContain("--> gateway{{API Gateway}}");
  });

  it("gives a bare node delimiters with its own id as the label", () => {
    const out = mermaidEditor.setShape(MMD, "bare", "diamond")!;
    expect(out.source).toContain("bare{bare}");
  });

  it("offers only shapes it can actually write", () => {
    for (const shape of mermaidEditor.shapes) {
      expect(mermaidEditor.setShape(MMD, "cdn", shape), shape).not.toBeNull();
    }
  });

  it("refuses a shape Mermaid has no delimiters for", () => {
    expect(mermaidEditor.setShape(MMD, "cdn", "cloud")).toBeNull();
    expect(mermaidEditor.setShape(MMD, "cdn", "person")).toBeNull();
  });
});

describe("mermaidEditor.idProblem", () => {
  it("accepts an ordinary id and rejects the rest", () => {
    expect(mermaidEditor.idProblem("api_2")).toBeNull();
    expect(mermaidEditor.idProblem("a b")).not.toBeNull();
    expect(mermaidEditor.idProblem("a[b]")).not.toBeNull();
    expect(mermaidEditor.idProblem("end")).not.toBeNull();
    expect(mermaidEditor.idProblem("")).not.toBeNull();
  });
});


describe("group", () => {
  it("adds a DOT cluster that claims the nodes by name", () => {
    const out = dotEditor.group!(SRC, ["cdn", "gateway"], "Edge tier")!;

    expect(out.source).toContain("subgraph cluster_edge_tier {");
    expect(out.source).toContain('label="Edge tier";');
    expect(out.source).toContain("cdn;");
    expect(out.source).toContain("gateway;");
  });


  it("leaves the original declarations exactly where they were", () => {
    const out = dotEditor.group!(SRC, ["cdn"], "Edge")!;

    expect(out.source).toContain('cdn [label="CDN"];');
    expect(out.source).toContain("  // the edge tier");
    expect(out.source.indexOf("cdn [label")).toBeLessThan(out.source.indexOf("subgraph cluster_edge"));
  });

  it("does not reuse a cluster name already in the file", () => {
    const src = "digraph { subgraph cluster_edge { a; } b; }";
    const out = dotEditor.group!(src, ["b"], "edge")!;

    expect(out.source).toContain("cluster_edge_2");
  });

  it("matches the file's own indentation", () => {
    const out = dotEditor.group!(SRC, ["cdn"], "Edge")!;
    expect(out.source).toContain("\n  subgraph cluster_edge {");
  });

  it("adds a Mermaid subgraph naming its members", () => {
    const out = mermaidEditor.group!(MMD, ["cdn", "gateway"], "Edge tier")!;

    expect(out.source).toContain("subgraph edge_tier[Edge tier]");
    expect(out.source).toContain("    cdn\n    gateway\n  end");
    expect(out.source).toContain("cdn[CDN] --> gateway{{API Gateway}}");
  });

  it("does not add a blank line to a file that already ends in a newline", () => {
    const out = mermaidEditor.group!(MMD, ["cdn"], "Edge")!;
    expect(out.source).not.toContain("\n\n  subgraph");
  });

  it("refuses an empty selection", () => {
    expect(dotEditor.group!(SRC, [], "x")).toBeNull();
    expect(mermaidEditor.group!(MMD, [], "x")).toBeNull();
  });
});
