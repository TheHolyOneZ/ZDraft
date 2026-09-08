import { describe, expect, it } from "vitest";

import { parseSequence, type ParsedMessage } from "./sequence";

const messages = (source: string): ParsedMessage[] =>
  parseSequence(source).events.filter((e): e is ParsedMessage => e.kind === "message");

describe("parseSequence — participants", () => {
  it("reads declarations and aliases", () => {
    const model = parseSequence(`sequenceDiagram
  participant U as User
  actor A
  U->>A: hi`);

    expect(model.participants.map((p) => p.id)).toEqual(["U", "A"]);
    expect(model.participants[0]!.label).toBe("User");
    expect(model.participants[1]!.actor).toBe(true);
  });

  it("infers a participant first seen in a message", () => {
    const model = parseSequence("sequenceDiagram\n  A->>B: hi");

    expect(model.participants.map((p) => p.id)).toEqual(["A", "B"]);
    expect(model.participants.every((p) => p.implicit)).toBe(true);
  });

  it("orders columns by first appearance, which is what makes a stored order an override", () => {
    const model = parseSequence(`sequenceDiagram
  C->>A: first
  participant B`);

    expect(model.participants.map((p) => p.id)).toEqual(["C", "A", "B"]);
  });

  it("does not duplicate a participant declared after it was used", () => {
    const model = parseSequence("sequenceDiagram\n  A->>B: hi\n  participant A as Alpha");

    expect(model.participants).toHaveLength(2);
    expect(model.participants[0]!.label).toBe("Alpha");
    expect(model.participants[0]!.implicit).toBe(false);
  });
});

describe("parseSequence — messages", () => {
  it("reads every arrow form", () => {
    const model = messages(`sequenceDiagram
  A->B: solid no head
  A-->B: dotted no head
  A->>B: solid head
  A-->>B: dotted head
  A-)B: async
  A--)B: async dotted
  A-xB: destroy
  A--xB: destroy dotted`);

    expect(model.map((m) => `${m.arrow}${m.dashed ? "-dashed" : ""}`)).toEqual([
      "sync",
      "reply-dashed",
      "sync",
      "reply-dashed",
      "async",
      "async-dashed",
      "destroy",
      "destroy-dashed",
    ]);
  });

  it("prefers the longer arrow form", () => {

    const [m] = messages("sequenceDiagram\n  A-->>B: reply");
    expect(m).toMatchObject({ from: "A", to: "B", arrow: "reply", dashed: true });
  });

  it("reads the message text", () => {
    const [m] = messages("sequenceDiagram\n  U->>A: POST /orders");
    expect(m!.text).toBe("POST /orders");
  });

  it("reads the activation shorthands", () => {
    const model = messages("sequenceDiagram\n  A->>+B: call\n  B-->>-A: reply");

    expect(model[0]).toMatchObject({ to: "B", activates: true });
    expect(model[1]).toMatchObject({ to: "A", deactivates: true });
  });

  it("marks a self-message, which is drawn as a bracket not a line", () => {
    const [m] = messages("sequenceDiagram\n  A->>A: retry");
    expect(m!.arrow).toBe("self");
  });

  it("ignores a line with no colon", () => {
    expect(messages("sequenceDiagram\n  A->>B")).toEqual([]);
  });
});

describe("parseSequence — structure", () => {
  it("reads activate and deactivate", () => {
    const model = parseSequence("sequenceDiagram\n  activate A\n  deactivate A");
    expect(model.events.map((e) => e.kind)).toEqual(["activate", "deactivate"]);
  });

  it("reads notes and their placement", () => {
    const model = parseSequence(`sequenceDiagram
  Note right of A: to the side
  Note over A,B: spanning both`);

    const notes = model.events.filter((e) => e.kind === "note");
    expect(notes).toHaveLength(2);
    expect(notes[0]).toMatchObject({ placement: "right", participants: ["A"], text: "to the side" });
    expect(notes[1]).toMatchObject({ placement: "over", participants: ["A", "B"] });
  });

  it("reads fragments and their sections", () => {
    const model = parseSequence(`sequenceDiagram
  alt is ok
    A->>B: yes
  else is not
    A->>B: no
  end
  loop every minute
    A->>B: poll
  end`);

    expect(model.events.filter((e) => e.kind === "fragment-start").map((e) => (e as { fragment: string }).fragment))
      .toEqual(["alt", "loop"]);
    expect(model.events.filter((e) => e.kind === "fragment-section")).toHaveLength(1);
    expect(model.events.filter((e) => e.kind === "fragment-end")).toHaveLength(2);
  });

  it("reads a title and autonumber", () => {
    const model = parseSequence("sequenceDiagram\n  autonumber\n  title Order flow\n  A->>B: x");

    expect(model.autonumber).toBe(true);
    expect(model.title).toBe("Order flow");
  });

  it("ignores comments, including an arrow inside one", () => {
    const model = messages("sequenceDiagram\n  %% A->>B: not real\n  C->>D: real");
    expect(model.map((m) => m.text)).toEqual(["real"]);
  });

  it("survives a half-typed line", () => {
    for (const partial of ["sequenceDiagram\n  A->>", "sequenceDiagram\n  Note over", "sequenceDiagram\n  alt"]) {
      expect(() => parseSequence(partial)).not.toThrow();
    }
  });
});
