import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirm, useConfirmStore, type ConfirmRequest } from "./useConfirmStore";
import { releaseAllPinsWithConfirm, useDocumentStore } from "./useDocumentStore";
import { useHistoryStore } from "./useHistoryStore";

const request: ConfirmRequest<"no" | "yes"> = {
  title: "Sure?",
  choices: [
    { id: "no", label: "No" },
    { id: "yes", label: "Yes" },
  ],
  dismiss: "no",
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useConfirmStore", () => {
  beforeEach(() => useConfirmStore.setState({ pending: null }));

  it("resolves with the choice that was picked", async () => {
    const answer = confirm(request);
    expect(useConfirmStore.getState().pending?.title).toBe("Sure?");

    useConfirmStore.getState().answer("yes");
    await expect(answer).resolves.toBe("yes");
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it("dismisses a question that is still open when a new one is asked", async () => {
    const first = confirm(request);
    const second = confirm({ ...request, title: "Second" });

    await expect(first).resolves.toBe("no");
    expect(useConfirmStore.getState().pending?.title).toBe("Second");

    useConfirmStore.getState().answer("yes");
    await expect(second).resolves.toBe("yes");
  });
});

describe("confirmLeave", () => {
  beforeEach(() => {
    useConfirmStore.setState({ pending: null });
    useDocumentStore.setState({ path: "/tmp/a.mmd", name: "a.mmd", dirty: false, layoutDirty: false });
  });

  it("lets a clean document go without asking", async () => {
    await expect(useDocumentStore.getState().confirmLeave()).resolves.toBe(true);
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it("asks about unsaved source, and Cancel keeps the document", async () => {
    useDocumentStore.setState({ dirty: true });
    const leaving = useDocumentStore.getState().confirmLeave();
    await settle();

    expect(useConfirmStore.getState().pending?.title).toBe("Save changes to a.mmd?");
    useConfirmStore.getState().answer("cancel");
    await expect(leaving).resolves.toBe(false);
  });

  it("asks about unsaved layout too, and Don't save lets it go", async () => {
    useDocumentStore.setState({ layoutDirty: true });
    const leaving = useDocumentStore.getState().confirmLeave();
    await settle();

    expect(useConfirmStore.getState().pending?.body).toMatch(/layout/);
    useConfirmStore.getState().answer("discard");
    await expect(leaving).resolves.toBe(true);
  });

  it("stays put when saving fails", async () => {
    const original = useDocumentStore.getState().saveSource;
    const save = vi.fn().mockRejectedValue(new Error("disk full"));
    useDocumentStore.setState({ dirty: true, saveSource: save });

    const leaving = useDocumentStore.getState().confirmLeave();
    await settle();
    useConfirmStore.getState().answer("save");

    await expect(leaving).resolves.toBe(false);
    expect(save).toHaveBeenCalledOnce();
    useDocumentStore.setState({ saveSource: original });
  });
});

describe("releaseAllPinsWithConfirm", () => {
  beforeEach(() => {
    useConfirmStore.setState({ pending: null });
    useHistoryStore.getState().clear();
    useDocumentStore.setState({
      path: null,
      name: "a.dot",
      raw: null,
      layout: { pins: { a: { x: 1, y: 2 }, b: { x: 3, y: 4 } } },
    });
  });

  it("leaves every pin alone when cancelled", async () => {
    const releasing = releaseAllPinsWithConfirm();
    await settle();

    expect(useConfirmStore.getState().pending?.title).toBe("Release all 2 pins?");
    useConfirmStore.getState().answer("cancel");
    await releasing;

    expect(Object.keys(useDocumentStore.getState().layout.pins ?? {})).toEqual(["a", "b"]);
  });

  it("releases on confirmation, as one undoable step", async () => {
    const releasing = releaseAllPinsWithConfirm();
    await settle();
    useConfirmStore.getState().answer("release");
    await releasing;

    expect(useDocumentStore.getState().layout.pins).toEqual({});
    expect(useHistoryStore.getState().nextUndoLabel()).toBe("Release every pin");
  });
});
