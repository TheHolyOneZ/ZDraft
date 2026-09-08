import { describe, expect, it } from "vitest";

import type { Annotation } from "../sidecar/types";
import {
  ANNOTATION_COLORS,
  annotationAt,
  annotationBounds,
  annotationColor,
  annotationFromDrag,
  byCreation,
  leaderLine,
  moveAnnotation,
  nextAnnotationId,
  retargetAnnotations,
  simplify,
} from ".";

const P = (x: number, y: number) => ({ x, y });

describe("the palette", () => {


  it("has no amber in it", () => {
    for (const colour of ANNOTATION_COLORS) {
      expect(colour.id).not.toBe("amber");
      expect(colour.value.toLowerCase()).not.toBe("#fbbf24");
    }
  });

  it("falls back rather than rendering an unknown colour as nothing", () => {
    expect(annotationColor("no-such-colour")).toBe(ANNOTATION_COLORS[0]!.value);
    expect(annotationColor(null)).toBe(ANNOTATION_COLORS[0]!.value);
  });
});

describe("making a mark", () => {
  it("places a note on a click, with a size to type into", () => {
    const note = annotationFromDrag("note", P(100, 100), P(101, 100));
    expect(note?.size?.[0]).toBeGreaterThan(0);
    expect(note?.size?.[1]).toBeGreaterThan(0);
  });

  it("sizes a note to the drag when there was one", () => {
    const note = annotationFromDrag("note", P(10, 20), P(210, 120));
    expect(note?.size).toEqual([200, 100]);
  });


  it("leaves nothing behind when a drag was really a click", () => {
    expect(annotationFromDrag("arrow", P(10, 10), P(12, 11))).toBeNull();
    expect(annotationFromDrag("highlight", P(10, 10), P(12, 11))).toBeNull();
  });


  it("refuses a highlight with no height to it", () => {
    expect(annotationFromDrag("highlight", P(0, 0), P(200, 1))).toBeNull();
    expect(annotationFromDrag("highlight", P(0, 0), P(1, 200))).toBeNull();
  });

  it("gives a note dragged flat its default size rather than a sliver", () => {
    const note = annotationFromDrag("note", P(0, 0), P(200, 1));
    expect(note!.size![1]).toBeGreaterThan(20);
  });

  it("normalises a highlight dragged up and to the left", () => {
    const mark = annotationFromDrag("highlight", P(200, 200), P(100, 140));
    expect(mark?.at).toEqual([100, 140]);
    expect(mark?.size).toEqual([100, 60]);
  });

  it("stores an arrow as two points relative to where it started", () => {
    const arrow = annotationFromDrag("arrow", P(50, 50), P(150, 80));
    expect(arrow?.at).toEqual([50, 50]);
    expect(arrow?.points).toEqual([
      [0, 0],
      [100, 30],
    ]);
  });

  it("gives every mark a colour, so none of them render as black on black", () => {
    for (const kind of ["note", "arrow", "highlight"] as const) {
      expect(annotationFromDrag(kind, P(0, 0), P(120, 90))?.color).toBeTruthy();
    }
  });
});

describe("ink", () => {


  it("thins a stroke to the points that carry its shape", () => {
    const drawn = Array.from({ length: 200 }, (_, i) => P(i, 0));
    const mark = annotationFromDrag("stroke", drawn[0]!, drawn[199]!, drawn);

    expect(mark!.points!.length).toBeLessThan(6);
  });

  it("keeps a corner, because that is the shape", () => {
    const drawn = [P(0, 0), P(10, 0), P(20, 0), P(20, 10), P(20, 20)];
    expect(simplify(drawn, 1).length).toBe(3);
  });

  it("leaves a two-point line alone", () => {
    expect(simplify([P(0, 0), P(10, 10)], 1)).toEqual([P(0, 0), P(10, 10)]);
  });

  it("stores a stroke relative to its own start", () => {
    const drawn = [P(100, 100), P(120, 140), P(160, 100)];
    const mark = annotationFromDrag("stroke", drawn[0]!, drawn[2]!, drawn);

    expect(mark?.at).toEqual([100, 100]);
    expect(mark?.points?.[0]).toEqual([0, 0]);
  });
});

describe("moving and finding", () => {
  const note: Annotation = {
    kind: "note",
    at: [100, 100],
    size: [200, 60],
    points: [],
    text: "why two writers here?",
    color: "rose",
    anchor: null,
  };

  const arrow: Annotation = {
    kind: "arrow",
    at: [400, 400],
    size: null,
    points: [
      [0, 0],
      [100, 0],
    ],
    text: null,
    color: "sky",
    anchor: null,
  };

  it("moves a stroke by moving its origin, not its points", () => {
    const moved = moveAnnotation(arrow, 50, -20);
    expect(moved.at).toEqual([450, 380]);
    expect(moved.points).toEqual(arrow.points);
  });

  it("bounds a path mark by the path", () => {
    expect(annotationBounds(arrow)).toEqual({ x: 400, y: 400, w: 100, h: 0 });
  });

  it("finds a note anywhere inside it", () => {
    expect(annotationAt({ a1: note }, P(150, 120))).toBe("a1");
    expect(annotationAt({ a1: note }, P(600, 600))).toBeNull();
  });


  it("grabs a highlight by its edge and lets the middle through", () => {
    const wash: Annotation = {
      kind: "highlight",
      at: [0, 0],
      size: [300, 200],
      points: [],
      text: null,
      color: "emerald",
      anchor: null,
    };

    expect(annotationAt({ a1: wash }, P(150, 2))).toBe("a1");
    expect(annotationAt({ a1: wash }, P(150, 100))).toBeNull();
  });

  it("finds a thin arrow near the line rather than exactly on it", () => {
    expect(annotationAt({ a1: arrow }, P(450, 403))).toBe("a1");
    expect(annotationAt({ a1: arrow }, P(450, 460))).toBeNull();
  });


  it("grabs the newest mark where two overlap", () => {
    const under = { ...note, at: [100, 100] as [number, number] };
    const over = { ...note, at: [120, 110] as [number, number] };

    expect(annotationAt({ a2: under, a10: over }, P(150, 130))).toBe("a10");
  });

  it("orders ids the way they were made, not the way they sort as text", () => {
    expect(["a10", "a2", "a1"].sort(byCreation)).toEqual(["a1", "a2", "a10"]);
  });

  it("picks an id nothing is using", () => {
    expect(nextAnnotationId({})).toBe("a1");
    expect(nextAnnotationId({ a1: 1, a2: 1 })).toBe("a3");

    expect(nextAnnotationId({ a1: 1, a3: 1 })).toBe("a2");
  });
});

describe("the leader line to what a note is about", () => {
  const note: Annotation = {
    kind: "note",
    at: [0, 0],
    size: [100, 40],
    points: [],
    text: "here",
    color: "rose",
    anchor: "api",
  };

  it("touches both edges rather than starting in the middle of the note", () => {
    const line = leaderLine(note, { x: 400, y: 0, w: 100, h: 40 });

    expect(line!.from.x).toBeCloseTo(100);
    expect(line!.to.x).toBeCloseTo(400);
  });


  it("draws nothing when the note is over the node", () => {
    expect(leaderLine(note, { x: 20, y: 10, w: 100, h: 40 })).toBeNull();
  });
});


describe("following a rename", () => {
  const note: Annotation = {
    kind: "note",
    at: [0, 0],
    size: [100, 40],
    points: [],
    text: "why two writers?",
    color: "rose",
    anchor: "payments",
  };

  it("points a note at the node's new name", () => {
    const next = retargetAnnotations({ a1: note }, "payments", "billing");
    expect(next!.a1!.anchor).toBe("billing");
  });

  it("leaves marks about something else alone", () => {
    const before = { a1: { ...note, anchor: "orders" } };


    expect(retargetAnnotations(before, "payments", "billing")).toBe(before);
  });

  it("returns the very same object when nothing pointed at the old name", () => {
    const before = { a1: { ...note, anchor: null } };
    expect(retargetAnnotations(before, "payments", "billing")).toBe(before);
  });

  it("copes with a file that has no annotations at all", () => {
    expect(retargetAnnotations(undefined, "a", "b")).toBeUndefined();
  });
});
