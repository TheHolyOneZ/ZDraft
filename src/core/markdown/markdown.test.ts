import { describe, expect, it } from "vitest";

import {
  blockAt,
  isMarkdown,
  parseMarkdownBlocks,
  withBlockSource,
  withMarker,
} from ".";

const DOC = `# Architecture

Some prose about the system.

<!-- zdraft: auth-flow -->
\`\`\`mermaid
flowchart TD
  login --> session
\`\`\`

More prose.

\`\`\`dot
digraph { a -> b; }
\`\`\`

\`\`\`bash
echo "not a diagram"
\`\`\`

\`\`\`mermaid
flowchart LR
  x --> y
\`\`\`
`;

describe("isMarkdown", () => {
  it("recognises the extensions a document uses", () => {
    expect(isMarkdown("README.md")).toBe(true);
    expect(isMarkdown("notes.MARKDOWN")).toBe(true);
    expect(isMarkdown("page.mdx")).toBe(true);
    expect(isMarkdown("arch.dot")).toBe(false);
  });
});

describe("parseMarkdownBlocks", () => {
  it("finds every diagram fence and nothing else", () => {
    const blocks = parseMarkdownBlocks(DOC);

    expect(blocks.map((b) => b.engine)).toEqual(["mermaid", "graphviz", "mermaid"]);
  });

  it("takes an id from the marker above the fence", () => {
    const [first] = parseMarkdownBlocks(DOC);
    expect(first!.id).toBe("auth-flow");
    expect(first!.marked).toBe(true);
  });


  it("falls back to engine and ordinal when there is no marker", () => {
    const blocks = parseMarkdownBlocks(DOC);

    expect(blocks[1]!.id).toBe("graphviz:0");
    expect(blocks[1]!.marked).toBe(false);

    expect(blocks[2]!.id).toBe("mermaid:1");
  });

  it("gives the body without the fence lines", () => {
    const [first] = parseMarkdownBlocks(DOC);
    expect(first!.source).toBe("flowchart TD\n  login --> session");
  });

  it("reports offsets that actually contain the block", () => {
    for (const block of parseMarkdownBlocks(DOC)) {
      expect(DOC.slice(block.body.from, block.body.to)).toContain(block.source);
      expect(DOC.slice(block.whole.from, block.whole.to).startsWith("```")).toBe(true);
      expect(DOC.slice(block.whole.from, block.whole.to).endsWith("```")).toBe(true);
    }
  });

  it("ignores a fence whose language is not a diagram", () => {
    const blocks = parseMarkdownBlocks(DOC);
    expect(blocks.some((b) => b.source.includes("echo"))).toBe(false);
  });


  it("does not read a fence inside another fence", () => {
    const src = "```bash\ncat <<EOF\n```mermaid\nflowchart TD\nEOF\n```\n";
    expect(parseMarkdownBlocks(src)).toHaveLength(0);
  });

  it("accepts tilde fences", () => {
    const src = "~~~mermaid\nflowchart TD\n  a --> b\n~~~\n";
    expect(parseMarkdownBlocks(src)).toHaveLength(1);
  });

  it("accepts every spelling of a language ZDraft can read", () => {
    for (const info of ["mermaid", "mmd", "dot", "graphviz", "gv", "d2", "plantuml", "puml"]) {
      const src = "```" + info + "\nx\n```\n";
      expect(parseMarkdownBlocks(src), info).toHaveLength(1);
    }
  });

  it("keeps an info string with extra words", () => {
    const blocks = parseMarkdownBlocks("```mermaid title=Auth\nflowchart TD\n```\n");
    expect(blocks[0]!.engine).toBe("mermaid");
    expect(blocks[0]!.info).toBe("mermaid title=Auth");
  });


  it("treats an unclosed fence as running to the end", () => {
    const blocks = parseMarkdownBlocks("```mermaid\nflowchart TD\n  a --> b\n");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.source).toContain("a --> b");
  });

  it("finds nothing in a document with no diagrams", () => {
    expect(parseMarkdownBlocks("# Title\n\nJust prose.\n")).toEqual([]);
  });

  it("does not read a marker that is not directly above the fence", () => {
    const src = "<!-- zdraft: far -->\n\n```mermaid\nx\n```\n";
    expect(parseMarkdownBlocks(src)[0]!.marked).toBe(false);
  });
});

describe("withMarker", () => {
  it("inserts a marker above an unmarked block", () => {
    const blocks = parseMarkdownBlocks(DOC);
    const out = withMarker(DOC, blocks[1]!, "data-model")!;

    expect(out.id).toBe("data-model");
    expect(out.source).toContain("<!-- zdraft: data-model -->\n```dot");
  });

  it("leaves the rest of the document byte-identical", () => {
    const blocks = parseMarkdownBlocks(DOC);
    const out = withMarker(DOC, blocks[1]!, "data-model")!;

    expect(out.source).toContain("Some prose about the system.");
    expect(out.source).toContain('echo "not a diagram"');
    expect(out.source.split("\n")).toHaveLength(DOC.split("\n").length + 1);
  });

  it("renames an existing marker rather than stacking a second one", () => {
    const blocks = parseMarkdownBlocks(DOC);
    const out = withMarker(DOC, blocks[0]!, "login-flow")!;

    expect(out.source).toContain("<!-- zdraft: login-flow -->");
    expect(out.source).not.toContain("auth-flow");
    expect(out.source.split("<!-- zdraft:")).toHaveLength(2);
  });


  it("refuses a name another block already claims", () => {
    const blocks = parseMarkdownBlocks(DOC);
    expect(withMarker(DOC, blocks[1]!, "auth-flow")).toBeNull();
  });

  it("refuses a name that would not survive the comment syntax", () => {
    const blocks = parseMarkdownBlocks(DOC);
    expect(withMarker(DOC, blocks[1]!, "")).toBeNull();
    expect(withMarker(DOC, blocks[1]!, "a>b")).toBeNull();
    expect(withMarker(DOC, blocks[1]!, "-leading")).toBeNull();
  });

  it("round-trips: a marker it writes is a marker it reads back", () => {
    const blocks = parseMarkdownBlocks(DOC);
    const out = withMarker(DOC, blocks[1]!, "data-model")!;

    const again = parseMarkdownBlocks(out.source);
    expect(again[1]!.id).toBe("data-model");
    expect(again[1]!.marked).toBe(true);

    expect(again[0]!.id).toBe("auth-flow");
  });
});

describe("withBlockSource", () => {
  it("replaces one block and touches nothing else", () => {
    const blocks = parseMarkdownBlocks(DOC);
    const out = withBlockSource(DOC, blocks[0]!, "flowchart TD\n  a --> b");

    expect(out).toContain("flowchart TD\n  a --> b\n```");
    expect(out).toContain("digraph { a -> b; }");
    expect(out).toContain("# Architecture");
  });

  it("keeps the closing fence on its own line whatever it is handed", () => {
    const blocks = parseMarkdownBlocks(DOC);

    expect(withBlockSource(DOC, blocks[0]!, "x")).toContain("x\n```");
    expect(withBlockSource(DOC, blocks[0]!, "x\n")).toContain("x\n```");
  });

  it("round-trips a block through itself unchanged", () => {
    const blocks = parseMarkdownBlocks(DOC);
    expect(withBlockSource(DOC, blocks[0]!, blocks[0]!.source)).toBe(DOC);
  });
});

describe("blockAt", () => {
  it("finds the block the caret is inside", () => {
    const blocks = parseMarkdownBlocks(DOC);
    const inside = DOC.indexOf("login --> session");

    expect(blockAt(blocks, inside)?.id).toBe("auth-flow");
  });

  it("finds nothing when the caret is in prose", () => {
    const blocks = parseMarkdownBlocks(DOC);
    expect(blockAt(blocks, DOC.indexOf("More prose"))).toBeNull();
  });
});
