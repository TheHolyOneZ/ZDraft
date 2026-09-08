import { describe, expect, it } from "vitest";

import { d2Editor } from "./edit/d2";
import { dotEditor } from "./edit/dot";
import { mermaidEditor } from "./edit/mermaid";
import { pumlEditor } from "./edit/puml";
import { locateD2 } from "./locate/d2";
import { locateDot } from "./locate/dot";
import { locateMermaid } from "./locate/mermaid";
import { locatePlantUml } from "./locate/puml";
import { locateSequence, parseSequence } from "./locate/sequence";
import { parseMarkdownBlocks, withBlockSource, withMarker } from "./markdown";


const crlf = (source: string) => source.replace(/\n/g, "\r\n");

const DOT = `digraph g {
  a [label="A"];
  b [label="B"];
  a -> b;
}
`;

const MMD = `flowchart TD
  a["A"]
  b["B"]
  subgraph edge["Edge"]
    c["C"]
  end
  a --> b
  b --> c
`;

const D2 = `direction: right
a: Alpha
b: Beta
services: {
  orders: Orders
}
a -> b
`;

const PUML = `@startuml
' a comment
component "Web" as web
component api
package edge {
  component cdn
}
web --> api
@enduml
`;

const MD = `# Architecture

<!-- zdraft: auth -->
\`\`\`mermaid
flowchart LR
  browser --> api
\`\`\`

Some prose between them.

\`\`\`dot
digraph { x -> y; }
\`\`\`
`;


const FAMILIES = {
  "mermaid class": `classDiagram
  class Order {
    +String id
    +total() float
  }
  class Customer
  Customer "1" --> "*" Order : places
`,
  "mermaid state": `stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start
  Running --> [*]
`,
  "mermaid er": `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER {
    string id
    int total
  }
`,
} as const;


const MMD_SEQUENCE = `sequenceDiagram
  participant browser as Browser
  actor Ops
  browser->>api: GET /orders
  api-->>browser: 200
  note right of api: cached
`;

const PUML_SEQUENCE = `@startuml
actor User
participant "Web App" as web
User -> web : opens
web --> User : renders
@enduml
`;

describe("a source with Windows line endings", () => {
  it("reads every diagram family the same way", () => {
    for (const [name, source] of Object.entries(FAMILIES)) {
      const lf = [...locateMermaid(source).nodes.keys()].sort();
      const cr = [...locateMermaid(crlf(source)).nodes.keys()].sort();

      expect(cr, name).toEqual(lf);
      expect(cr.length, `${name} found nothing at all`).toBeGreaterThan(0);
    }

    expect([...locatePlantUml(crlf(PUML_SEQUENCE)).nodes.keys()].sort()).toEqual(
      [...locatePlantUml(PUML_SEQUENCE).nodes.keys()].sort(),
    );
  });


  it("reads a sequence diagram down to its messages", () => {
    const source = MMD_SEQUENCE;
    const lf = parseSequence(source);
    const cr = parseSequence(crlf(source));

    expect(cr.participants.map((p) => p.id)).toEqual(lf.participants.map((p) => p.id));
    expect(cr.events.map((e) => e.kind)).toEqual(lf.events.map((e) => e.kind));
    expect([...locateSequence(crlf(source)).edges.keys()]).toEqual([
      ...locateSequence(source).edges.keys(),
    ]);
    expect(cr.events.length).toBeGreaterThan(1);
  });


  it("locates the same nodes in every engine", () => {
    const cases = [
      ["dot", locateDot, DOT],
      ["mermaid", locateMermaid, MMD],
      ["d2", locateD2, D2],
      ["plantuml", locatePlantUml, PUML],
    ] as const;

    for (const [name, locate, source] of cases) {
      const lf = [...locate(source).nodes.keys()].sort();
      const cr = [...locate(crlf(source)).nodes.keys()].sort();

      expect(cr, name).toEqual(lf);
      expect(cr.length, `${name} found nothing at all`).toBeGreaterThan(0);
    }
  });

  it("renames through every editor, and leaves the endings alone", () => {
    const cases = [
      ["dot", dotEditor, DOT, "a", "alpha"],
      ["mermaid", mermaidEditor, MMD, "a", "alpha"],
      ["d2", d2Editor, D2, "a", "alpha"],
      ["plantuml", pumlEditor, PUML, "web", "site"],
    ] as const;

    for (const [name, editor, source, from, to] of cases) {
      const before = crlf(source);
      const edit = editor.rename(before, from, to);

      expect(edit, name).not.toBeNull();
      expect(edit!.source, name).toContain(to);
      expect(edit!.source.match(/\r\n/g)?.length, `${name} changed the line endings`).toBe(
        before.match(/\r\n/g)!.length,
      );

      expect(edit!.source.replace(/\r\n/g, ""), `${name} spliced in a bare newline`).not.toContain(
        "\n",
      );
    }
  });

  it("finds the diagrams in a markdown document", () => {
    const lf = parseMarkdownBlocks(MD);
    const cr = parseMarkdownBlocks(crlf(MD));

    expect(cr.map((b) => [b.id, b.engine])).toEqual(lf.map((b) => [b.id, b.engine]));
    expect(cr).toHaveLength(2);


    expect(cr[0]!.marked).toBe(true);
  });

  it("rewrites a markdown block without disturbing the document around it", () => {
    const source = crlf(MD);
    const blocks = parseMarkdownBlocks(source);

    const out = withBlockSource(source, blocks[0]!, "flowchart LR\r\n  browser --> cdn");
    expect(out).toContain("browser --> cdn");
    expect(out).toContain("Some prose between them.");
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");

    expect(parseMarkdownBlocks(out)).toHaveLength(2);
  });

  it("adds a block marker on its own CRLF line", () => {
    const source = crlf(MD);
    const second = parseMarkdownBlocks(source)[1]!;

    const edit = withMarker(source, second, "topology");
    expect(edit).not.toBeNull();

    const out = edit!.source;
    expect(out).toContain("<!-- zdraft: topology -->");
    expect(out.replace(/\r\n/g, "")).not.toContain("\n");

    const after = parseMarkdownBlocks(out);
    expect(after).toHaveLength(2);
    expect(after[1]!.id).toBe("topology");
  });
});
