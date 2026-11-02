import { beforeEach, describe, expect, it } from "vitest";

import { useDocumentStore } from "./useDocumentStore";
import { useHistoryStore } from "./useHistoryStore";

describe("setStyle", () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
    useDocumentStore.setState({ path: null, raw: null, layout: {} });
  });

  it("writes colours into the layout as one undoable step", () => {
    useDocumentStore.getState().setStyle(["a", "b"], { fill: "#112233" });

    expect(useDocumentStore.getState().layout.styles).toEqual({
      a: { fill: "#112233" },
      b: { fill: "#112233" },
    });
    expect(useHistoryStore.getState().past).toHaveLength(1);
    expect(useHistoryStore.getState().nextUndoLabel()).toBe("Change 2 colours");
  });

  it("removes a colour on reset, and the entry with its last colour", () => {
    useDocumentStore.getState().setStyle(["a"], { fill: "#112233", outline: "#445566" });
    useDocumentStore.getState().setStyle(["a"], { fill: null });
    expect(useDocumentStore.getState().layout.styles).toEqual({ a: { outline: "#445566" } });

    useDocumentStore.getState().setStyle(["a"], { outline: null });
    expect(useDocumentStore.getState().layout.styles).toEqual({});
    expect(useHistoryStore.getState().nextUndoLabel()).toBe("Reset a colour");
  });
});
