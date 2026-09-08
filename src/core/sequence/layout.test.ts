import { describe, expect, it } from "vitest";

import { parseSequence } from "../locate/sequence";
import { themeByName } from "../theme";
import { layoutSequence, messageId, orderLifelines } from "./layout";

const theme = themeByName("blueprint");
const lay = (source: string, hints?: Parameters<typeof layoutSequence>[1]["hints"]) =>
  layoutSequence(parseSequence(source), { theme, hints });

const SAMPLE = `sequenceDiagram
  participant U as User
  participant A as API
  participant D as Postgres
  U->>A: POST /orders
  activate A
  A->>D: INSERT
  D-->>A: id
  A-->>U: 201 Created
  deactivate A`;

describe("orderLifelines", () => {
  const people = [
    { id: "a", label: "a", actor: false, implicit: false, range: { from: 0, to: 0 } },
    { id: "b", label: "b", actor: false, implicit: false, range: { from: 0, to: 0 } },
    { id: "c", label: "c", actor: false, implicit: false, range: { from: 0, to: 0 } },
  ];

  it("keeps declaration order with no hint", () => {
    expect(orderLifelines(people, undefined).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("applies a stored order", () => {
    expect(orderLifelines(people, ["c", "a", "b"]).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("appends participants the hint does not mention", () => {

    expect(orderLifelines(people, ["c"]).map((p) => p.id)).toEqual(["c", "a", "b"]);
  });

  it("ignores ids in the hint that no longer exist", () => {

    expect(orderLifelines(people, ["gone", "b"]).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });

  it("ignores a duplicate in the hint", () => {
    expect(orderLifelines(people, ["b", "b", "a"]).map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
});

describe("layoutSequence — columns", () => {
  it("places lifelines left to right in order", () => {
    const scene = lay(SAMPLE);
    expect(scene.lifelines.map((l) => l.id)).toEqual(["U", "A", "D"]);

    const xs = scene.lifelines.map((l) => l.x);
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
  });

  it("reorders columns from a stored hint — the point of the whole family", () => {
    const scene = lay(SAMPLE, { lifeline_order: ["D", "U", "A"] });
    expect(scene.lifelines.map((l) => l.id)).toEqual(["D", "U", "A"]);

    const byId = new Map(scene.lifelines.map((l) => [l.id, l.x]));
    expect(byId.get("D")!).toBeLessThan(byId.get("U")!);
    expect(byId.get("U")!).toBeLessThan(byId.get("A")!);
  });

  it("widens a column for extra gap", () => {
    const plain = lay(SAMPLE);
    const spaced = lay(SAMPLE, { lifeline_gap: { A: 80 } });

    const gapOf = (s: typeof plain) => s.lifelines[1]!.x - s.lifelines[0]!.x;
    expect(gapOf(spaced)).toBeCloseTo(gapOf(plain) + 80, 3);
  });

  it("sizes a head box to its label", () => {
    const scene = lay("sequenceDiagram\n  participant X as A very long participant name\n  X->>X: x");
    expect(scene.lifelines[0]!.head.w).toBeGreaterThan(200);
  });

  it("never overlaps two head boxes", () => {
    const scene = lay(SAMPLE);
    for (let i = 1; i < scene.lifelines.length; i++) {
      const left = scene.lifelines[i - 1]!.head;
      const right = scene.lifelines[i]!.head;
      expect(right.x).toBeGreaterThanOrEqual(left.x + left.w);
    }
  });

  it("widens gaps so a long message label fits between its endpoints", () => {
    const short = lay("sequenceDiagram\n  A->>B: hi");
    const long = lay(
      "sequenceDiagram\n  A->>B: a considerably longer message label that needs room",
    );

    expect(long.lifelines[1]!.x - long.lifelines[0]!.x).toBeGreaterThan(
      short.lifelines[1]!.x - short.lifelines[0]!.x,
    );
  });
});

describe("layoutSequence — vertical flow", () => {
  it("stacks messages in source order", () => {
    const scene = lay(SAMPLE);
    expect(scene.messages.map((m) => m.label)).toEqual([
      "POST /orders",
      "INSERT",
      "id",
      "201 Created",
    ]);

    for (let i = 1; i < scene.messages.length; i++) {
      expect(scene.messages[i]!.y).toBeGreaterThan(scene.messages[i - 1]!.y);
    }
  });

  it("adds extra room after a message on request", () => {
    const plain = lay(SAMPLE);
    const spaced = lay(SAMPLE, { message_gap: { "U->A": 60 } });

    const second = (s: typeof plain) => s.messages[1]!.y;
    expect(second(spaced)).toBeCloseTo(second(plain) + 60, 3);
  });

  it("numbers repeated messages between the same pair", () => {
    const scene = lay("sequenceDiagram\n  A->>B: one\n  A->>B: two");
    expect(scene.messages.map((m) => m.id)).toEqual(["A->B", "A->B#1"]);
    expect(messageId("A", "B", 1)).toBe("A->B#1");
  });

  it("gives a self-message more vertical room than a plain one", () => {
    const plain = lay("sequenceDiagram\n  A->>B: x\n  A->>B: y");
    const selfLoop = lay("sequenceDiagram\n  A->>A: retry\n  A->>B: y");

    const spanOf = (s: typeof plain) => s.messages[1]!.y - s.messages[0]!.y;
    expect(spanOf(selfLoop)).toBeGreaterThan(spanOf(plain));
    expect(selfLoop.messages[0]!.kind).toBe("self");
  });
});

describe("layoutSequence — activations and fragments", () => {
  it("brackets an activation between its activate and deactivate", () => {
    const scene = lay(SAMPLE);
    expect(scene.activations).toHaveLength(1);

    const bar = scene.activations[0]!;
    expect(bar.lifeline).toBe("A");
    expect(bar.bottom).toBeGreaterThan(bar.top);
  });

  it("reads the +/- shorthand", () => {
    const scene = lay("sequenceDiagram\n  A->>+B: call\n  B-->>-A: reply");
    expect(scene.activations).toHaveLength(1);
    expect(scene.activations[0]!.lifeline).toBe("B");
  });

  it("nests activations by depth", () => {
    const scene = lay(`sequenceDiagram
  activate A
  activate A
  deactivate A
  deactivate A`);

    expect(scene.activations.map((a) => a.depth).sort()).toEqual([0, 1]);
  });

  it("closes an activation left open at the end rather than dropping it", () => {

    const scene = lay("sequenceDiagram\n  activate A\n  A->>B: x");
    expect(scene.activations).toHaveLength(1);
    expect(scene.activations[0]!.bottom).toBeGreaterThan(scene.activations[0]!.top);
  });

  it("boxes a fragment around its contents and records its sections", () => {
    const scene = lay(`sequenceDiagram
  alt is ok
    A->>B: yes
  else is not
    A->>B: no
  end`);

    expect(scene.fragments).toHaveLength(1);
    const fragment = scene.fragments[0]!;
    expect(fragment.kind).toBe("alt");
    expect(fragment.label).toBe("is ok");
    expect(fragment.sectionLabels).toEqual(["is not"]);
    expect(fragment.rect.h).toBeGreaterThan(0);
    expect(fragment.rect.w).toBeGreaterThan(0);


    for (const m of scene.messages) {
      expect(m.y).toBeGreaterThan(fragment.rect.y);
      expect(m.y).toBeLessThan(fragment.rect.y + fragment.rect.h);
    }
  });

  it("closes an unbalanced fragment at the bottom", () => {
    const scene = lay("sequenceDiagram\n  loop forever\n    A->>B: x");
    expect(scene.fragments[0]!.rect.h).toBeGreaterThan(0);
  });
});

describe("layoutSequence — notes and bounds", () => {
  it("spans a note placed over two participants", () => {
    const scene = lay("sequenceDiagram\n  participant A\n  participant B\n  Note over A,B: shared");
    const note = scene.notes[0]!;

    expect(note.rect.x).toBeLessThanOrEqual(scene.lifelines[0]!.head.x);
    expect(note.rect.x + note.rect.w).toBeGreaterThanOrEqual(
      scene.lifelines[1]!.head.x + scene.lifelines[1]!.head.w,
    );
  });

  it("puts a side note beside its lifeline", () => {
    const scene = lay("sequenceDiagram\n  participant A\n  Note right of A: aside");
    expect(scene.notes[0]!.rect.x).toBeGreaterThan(scene.lifelines[0]!.x);
  });

  it("reports bounds containing every lifeline and message", () => {
    const scene = lay(SAMPLE);

    for (const l of scene.lifelines) {
      expect(l.head.x).toBeGreaterThanOrEqual(scene.bounds.x);
      expect(l.head.x + l.head.w).toBeLessThanOrEqual(scene.bounds.x + scene.bounds.w);
      expect(l.bottom).toBeLessThanOrEqual(scene.bounds.y + scene.bounds.h);
    }
  });

  it("handles an empty diagram without throwing", () => {
    const scene = lay("sequenceDiagram");
    expect(scene.lifelines).toEqual([]);
    expect(scene.messages).toEqual([]);
    expect(Number.isFinite(scene.bounds.w)).toBe(true);
  });
});
