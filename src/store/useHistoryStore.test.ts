import { beforeEach, describe, expect, it } from "vitest";

import type { Layout } from "../core/sidecar/types";
import { useHistoryStore } from "./useHistoryStore";

const empty: Layout = {};
const pinned: Layout = { pins: { a: { x: 1, y: 2 } } };
const moved: Layout = { pins: { a: { x: 9, y: 9 } } };

function layoutEntry(before: Layout, after: Layout, label = "Move a node") {
  return { kind: "layout" as const, label, before, after };
}

describe("useHistoryStore", () => {
  beforeEach(() => useHistoryStore.getState().clear());

  it("starts with nothing to undo or redo", () => {
    const s = useHistoryStore.getState();
    expect(s.canUndo()).toBe(false);
    expect(s.canRedo()).toBe(false);
    expect(s.nextUndoLabel()).toBeNull();
  });

  it("hands back what was recorded, newest first", () => {
    const store = useHistoryStore.getState();
    store.record(layoutEntry(empty, pinned, "Move a node"));
    store.record({ kind: "source", label: "Undo typing" });

    expect(useHistoryStore.getState().nextUndoLabel()).toBe("Undo typing");
    expect(useHistoryStore.getState().takeUndo()?.kind).toBe("source");
    expect(useHistoryStore.getState().takeUndo()?.kind).toBe("layout");
    expect(useHistoryStore.getState().canUndo()).toBe(false);
  });

  it("moves an undone entry onto the redo side", () => {
    useHistoryStore.getState().record(layoutEntry(empty, pinned));
    useHistoryStore.getState().takeUndo();

    expect(useHistoryStore.getState().canRedo()).toBe(true);
    expect(useHistoryStore.getState().nextRedoLabel()).toBe("Move a node");

    const redone = useHistoryStore.getState().takeRedo();
    expect(redone?.kind).toBe("layout");
    expect(useHistoryStore.getState().canUndo()).toBe(true);
    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });

  it("interleaves text and layout in one timeline", () => {
    const store = useHistoryStore.getState();
    store.record({ kind: "source", label: "Undo typing" });
    store.record(layoutEntry(empty, pinned));
    store.record({ kind: "source", label: "Undo typing" });


    expect(useHistoryStore.getState().takeUndo()?.kind).toBe("source");
    expect(useHistoryStore.getState().takeUndo()?.kind).toBe("layout");
    expect(useHistoryStore.getState().takeUndo()?.kind).toBe("source");
  });

  it("abandons the redo branch when a new edit lands", () => {
    const store = useHistoryStore.getState();
    store.record(layoutEntry(empty, pinned));
    store.record(layoutEntry(pinned, moved));
    useHistoryStore.getState().takeUndo();
    expect(useHistoryStore.getState().canRedo()).toBe(true);

    useHistoryStore.getState().record({ kind: "source", label: "Undo typing" });
    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });


  it("records nothing while an undo is being applied", () => {
    const store = useHistoryStore.getState();
    store.record(layoutEntry(empty, pinned));

    useHistoryStore.getState().withApplying(() => {
      useHistoryStore.getState().record(layoutEntry(pinned, empty, "restore"));
    });

    expect(useHistoryStore.getState().past).toHaveLength(1);
  });

  it("stops suppressing once the application is over, even if it threw", () => {
    expect(() =>
      useHistoryStore.getState().withApplying(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    useHistoryStore.getState().record({ kind: "source", label: "Undo typing" });
    expect(useHistoryStore.getState().canUndo()).toBe(true);
  });

  it("carries the layout to restore on each side of a step", () => {
    useHistoryStore.getState().record(layoutEntry(pinned, moved));
    const entry = useHistoryStore.getState().takeUndo();

    if (entry?.kind !== "layout") throw new Error("expected a layout entry");
    expect(entry.before).toBe(pinned);
    expect(entry.after).toBe(moved);
  });

  it("drops the oldest steps rather than growing without bound", () => {
    for (let i = 0; i < 260; i += 1) {
      useHistoryStore.getState().record({ kind: "source", label: `step ${i}` });
    }
    const past = useHistoryStore.getState().past;

    expect(past).toHaveLength(200);
    expect(past[past.length - 1]!.label).toBe("step 259");
  });


  it("clears both sides when a different file is opened", () => {
    useHistoryStore.getState().record(layoutEntry(empty, pinned));
    useHistoryStore.getState().takeUndo();
    useHistoryStore.getState().clear();

    expect(useHistoryStore.getState().canUndo()).toBe(false);
    expect(useHistoryStore.getState().canRedo()).toBe(false);
  });
});
