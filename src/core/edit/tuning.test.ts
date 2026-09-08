import { describe, expect, it } from "vitest";

import { graphvizAdapter } from "../engines/graphviz";
import { isGraph } from "../model/scene";
import { detectMermaidType } from "../locate/mermaid";
import { dotEditor } from "./dot";
import { mermaidEditor } from "./mermaid";

const tuner = dotEditor.tuning!;

const GRAPH = `digraph d {
  rankdir=LR;
  node [shape=box];

  a [shape=circle];
  a -> b;
}`;

describe("reading Graphviz's layout parameters", () => {
  it("finds what the source says", () => {
    expect(tuner.read(GRAPH)).toEqual({ rankdir: "LR" });
  });


  it("does not mistake a node attribute for a graph one", () => {
    expect(tuner.read("digraph d { a [rankdir=LR]; }")).toEqual({});
  });

  it("does not mistake a subgraph's attribute for the graph's", () => {
    const nested = `digraph d {
  subgraph cluster_a {
    rankdir=LR;
    x;
  }
}`;
    expect(tuner.read(nested)).toEqual({});
  });

  it("says nothing where the source says nothing, rather than guessing", () => {
    expect(tuner.read("digraph d { a -> b; }")).toEqual({});
  });

  it("unquotes a value someone wrote in quotes", () => {
    expect(tuner.read('digraph d { splines="ortho"; }').splines).toBe("ortho");
  });
});

describe("writing them", () => {
  it("changes a value in place, leaving the rest of the file alone", () => {
    const edit = tuner.set(GRAPH, "rankdir", "BT")!;

    expect(edit.source).toContain("rankdir=BT;");
    expect(edit.source).toContain("node [shape=box];");
    expect(edit.source).toContain("a [shape=circle];");
  });

  it("adds one that was not there, at the top where a reader looks", () => {
    const edit = tuner.set("digraph d {\n  a -> b;\n}", "rankdir", "LR")!;

    expect(edit.source).toBe("digraph d {\n  rankdir=LR;\n  a -> b;\n}");
  });


  it("takes the line out when the value goes back to the default", () => {

    const back = tuner.set(GRAPH, "rankdir", "TB")!;

    expect(back.source).not.toContain("rankdir");
    expect(back.source).toContain("node [shape=box];");
  });

  it("leaves a file that already says nothing exactly as it was", () => {
    const source = "digraph d { a -> b; }";
    expect(tuner.set(source, "rankdir", "TB")!.source).toBe(source);
  });


  it("takes the semicolon and the blank line with it", () => {
    const edit = tuner.set("digraph d {\n  ranksep=1.5;\n  a -> b;\n}", "ranksep", "0.5")!;
    expect(edit.source).toBe("digraph d {\n  a -> b;\n}");
  });

  it("keeps a neighbour on the same line", () => {
    const source = "digraph d {\n  nodesep=1; ranksep=2;\n  a -> b;\n}";
    const edit = tuner.set(source, "nodesep", "0.25")!;

    expect(edit.source).toContain("ranksep=2;");
    expect(edit.source).not.toContain("nodesep");
  });

  it("quotes a value that needs it", () => {
    const edit = tuner.set("digraph d { a; }", "splines", "ortho")!;
    expect(tuner.read(edit.source).splines).toBe("ortho");
  });

  it("refuses a knob it does not have", () => {
    expect(tuner.set(GRAPH, "nonsense", "1")).toBeNull();
  });

  it("names the change for the undo timeline", () => {
    expect(tuner.set(GRAPH, "rankdir", "BT")!.label).toBe("Set rankdir to BT");
  });
});


describe("what the engine does with them", () => {
  async function layout(source: string) {
    const result = await graphvizAdapter.layout(source);
    if (!isGraph(result.scene)) throw new Error("expected a graph scene");
    return result;
  }

  it("turns a tall graph on its side", async () => {
    const chain = "digraph d { a -> b; b -> c; c -> d; }";
    const tall = await layout(chain);
    const wide = await layout(tuner.set(chain, "rankdir", "LR")!.source);

    expect(tall.scene.bounds.h).toBeGreaterThan(tall.scene.bounds.w);
    expect(wide.scene.bounds.w).toBeGreaterThan(wide.scene.bounds.h);
  });

  it("pushes the ranks apart", async () => {
    const chain = "digraph d { a -> b; }";
    const near = await layout(chain);
    const far = await layout(tuner.set(chain, "ranksep", "2")!.source);

    expect(far.scene.bounds.h).toBeGreaterThan(near.scene.bounds.h);
  });

  it("leaves every knob's output parsing cleanly", async () => {
    for (const knob of tuner.knobs) {
      for (const choice of knob.choices ?? [{ value: knob.fallback }]) {
        const edit = tuner.set("digraph d { a -> b; }", knob.id, choice.value);
        if (!edit) continue;

        const result = await layout(edit.source);
        expect(
          result.diagnostics.filter((d) => d.severity === "error"),
          `${knob.id}=${choice.value}`,
        ).toEqual([]);
      }
    }
  }, 30000);
});


describe("Mermaid's layout parameters", () => {
  const tuner = mermaidEditor.tuning!;
  const FLOW = "flowchart TD\n  a --> b\n";

  it("reads the direction off the diagram's own keyword", () => {
    expect(tuner.read(FLOW).direction).toBe("TD");
    expect(tuner.read("flowchart LR\n  a --> b\n").direction).toBe("LR");
  });


  it("reads the older keyword and spelling too", () => {
    expect(tuner.read("graph TB\n  a --> b\n").direction).toBe("TD");
  });

  it("changes the direction in place", () => {
    expect(tuner.set(FLOW, "direction", "LR")!.source).toBe("flowchart LR\n  a --> b\n");
  });


  it("writes the default direction rather than leaving the keyword bare", () => {
    const back = tuner.set("flowchart LR\n  a --> b\n", "direction", "TD")!;
    expect(back.source).toBe("flowchart TD\n  a --> b\n");
  });

  it("puts spacing in an init directive above the diagram", () => {
    const edit = tuner.set(FLOW, "nodeSpacing", "80")!;

    expect(edit.source.startsWith("%%{init:")).toBe(true);
    expect(edit.source).toContain('"nodeSpacing":80');
    expect(edit.source).toContain("flowchart TD");
  });

  it("reads its own directive back", () => {
    const edit = tuner.set(tuner.set(FLOW, "nodeSpacing", "80")!.source, "curve", "linear")!;
    const read = tuner.read(edit.source);

    expect(read.nodeSpacing).toBe("80");
    expect(read.curve).toBe("linear");
  });

  it("takes the whole directive out once nothing is left in it", () => {
    const on = tuner.set(FLOW, "nodeSpacing", "80")!.source;
    const off = tuner.set(on, "nodeSpacing", "50")!;

    expect(off.source).toBe(FLOW);
  });

  it("keeps someone else's config when it edits its own", () => {
    const themed = "%%{init: {'theme': 'forest'}}%%\nflowchart TD\n  a --> b\n";
    const edit = tuner.set(themed, "curve", "linear")!;

    expect(edit.source).toContain('"theme":"forest"');
    expect(edit.source).toContain('"curve":"linear"');
  });


  it("refuses to touch a directive it cannot read", () => {
    const weird = "%%{init: {this is not json}}%%\nflowchart TD\n  a --> b\n";
    expect(tuner.set(weird, "curve", "linear")).toBeNull();
  });

  it("leaves the diagram still a flowchart afterwards", () => {
    for (const knob of tuner.knobs) {
      for (const choice of knob.choices ?? [{ value: knob.fallback }]) {
        const edit = tuner.set(FLOW, knob.id, choice.value);
        if (!edit) continue;
        expect(detectMermaidType(edit.source), `${knob.id}=${choice.value}`).toBe("flowchart");
      }
    }
  });
});
