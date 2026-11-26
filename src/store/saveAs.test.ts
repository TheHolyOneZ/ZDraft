import { beforeEach, describe, expect, it, vi } from "vitest";

const calls: Array<[string, ...unknown[]]> = [];

vi.mock("../lib/tauri", () => {
  const record =
    (name: string, result: unknown = undefined) =>
    (...args: unknown[]) => {
      calls.push([name, ...args]);
      return Promise.resolve(result);
    };
  return {
    isTauri: () => true,
    appWindow: () => null,
    api: {
      writeFile: record("writeFile"),
      writeLayout: record("writeLayout"),
      resolveLayoutConflict: record("resolveLayoutConflict"),
      deleteLayout: record("deleteLayout"),
      layoutPathFor: (p: string) => Promise.resolve(`${p}.zlayout.toml`),
      pathExists: () => Promise.resolve(true),
      readFile: (path: string) => {
        calls.push(["readFile", path]);
        return Promise.resolve({
          path,
          name: "other.mmd",
          text: "flowchart LR\n  x --> y\n",
          engine: "mermaid",
          layoutText: path.includes("bare") ? null : "version = 1\n# kept as written\n",
          layout_text: null,
        });
      },
    },
  };
});

const memory = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
});

const { useDocumentStore } = await import("./useDocumentStore");

describe("saveAs", () => {
  beforeEach(() => {
    calls.length = 0;
    useDocumentStore.setState({
      path: "/d/flow.mmd",
      name: "flow.mmd",
      source: "flowchart LR\n  a --> b\n",
      eol: "\r\n",
      dirty: true,
      layoutDirty: true,
      conflict: null,
      activeBlock: null,
      blocks: [],
      sidecar: { version: 1, blocks: {} },
      layout: { pins: { a: { x: 1, y: 2 } } },
    });
  });

  it("writes the source and the current layout under the new name, then works on the copy", async () => {
    await useDocumentStore.getState().saveAs("/d/flow-copy.mmd");

    expect(calls[0]).toEqual(["writeFile", "/d/flow-copy.mmd", "flowchart LR\r\n  a --> b\r\n"]);
    const layout = calls.find((c) => c[0] === "writeLayout")!;
    expect(layout[1]).toBe("/d/flow-copy.mmd");
    expect(layout[2]).toMatchObject({ version: 1, pins: { a: { x: 1, y: 2 } } });

    const state = useDocumentStore.getState();
    expect(state.path).toBe("/d/flow-copy.mmd");
    expect(state.name).toBe("flow-copy.mmd");
    expect(state.dirty).toBe(false);
    expect(state.layoutDirty).toBe(false);
  });

  it("only reads the original, never writes it", async () => {
    await useDocumentStore.getState().saveAs("/d/flow-copy.mmd");
    const touched = calls.filter((c) => c[1] === "/d/flow.mmd").map((c) => c[0]);
    expect(touched).toEqual(["readFile"]);
  });

  it("starts the new layout file from the original's text, so comments in it survive", async () => {
    await useDocumentStore.getState().saveAs("/d/flow-copy.mmd");
    const seeded = calls.findIndex((c) => c[0] === "resolveLayoutConflict");
    const written = calls.findIndex((c) => c[0] === "writeLayout");

    expect(calls[seeded]).toEqual([
      "resolveLayoutConflict",
      "/d/flow-copy.mmd",
      "version = 1\n# kept as written\n",
    ]);
    expect(seeded).toBeLessThan(written);
  });

  it("is a plain save when the name does not change", async () => {
    await useDocumentStore.getState().saveAs("/d/flow.mmd");
    expect(calls[0]).toEqual(["writeFile", "/d/flow.mmd", "flowchart LR\r\n  a --> b\r\n"]);
    expect(useDocumentStore.getState().path).toBe("/d/flow.mmd");
  });

  it("refuses while the layout file has an unresolved conflict", async () => {
    useDocumentStore.setState({
      conflict: { ours_label: "a", theirs_label: "b", ours: "", theirs: "", line: 1 },
    });
    await expect(useDocumentStore.getState().saveAs("/d/x.mmd")).rejects.toThrow(/conflict/);
    expect(calls).toEqual([]);
  });
});

describe("saveCopy", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("copies a file that is not open, layout file and all, exactly as written", async () => {
    await useDocumentStore.getState().saveCopy("/d/other.mmd", "/d/other-copy.mmd");

    expect(calls).toEqual([
      ["readFile", "/d/other.mmd"],
      ["writeFile", "/d/other-copy.mmd", "flowchart LR\n  x --> y\n"],
      ["resolveLayoutConflict", "/d/other-copy.mmd", "version = 1\n# kept as written\n"],
    ]);
  });

  it("clears a stale layout file at the target when the original has none", async () => {
    await useDocumentStore.getState().saveCopy("/d/bare.mmd", "/d/taken.mmd");
    expect(calls.at(-1)).toEqual(["deleteLayout", "/d/taken.mmd"]);
  });
});
