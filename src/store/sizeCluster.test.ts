import { beforeEach, describe, expect, it } from "vitest";

import type { GraphScene } from "../core/model/scene";
import { useDocumentStore } from "./useDocumentStore";
import { useHistoryStore } from "./useHistoryStore";

const raw: GraphScene = {
  family: "graph",
  engine: "graphviz",
  diagramType: "digraph",
  direction: "TB",
  nodes: [
    { id: "a", body: { kind: "label", text: "a" }, shape: "rect", rect: { x: 20, y: 30, w: 40, h: 20 }, fingerprint: "a", parent: "core" },
  ],
  edges: [],
  clusters: [{ id: "core", label: "core", rect: { x: 0, y: 0, w: 100, h: 80 } }],
  bounds: { x: 0, y: 0, w: 100, h: 80 },
};

describe("sizeCluster", () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
    useDocumentStore.setState({ path: null, raw, layout: {} });
  });

  it("pins the subgraph's box with its size, as one undoable step", () => {
    useDocumentStore.getState().sizeCluster("core", { x: 0, y: 0, w: 300, h: 200 });

    expect(useDocumentStore.getState().layout.pins?.core).toEqual({
      x: 150,
      y: 100,
      fingerprint: null,
      auto: [50, 40],
      size: [300, 200],
    });
    expect(useHistoryStore.getState().nextUndoLabel()).toBe("Resize a subgraph");

    const scene = useDocumentStore.getState().scene as GraphScene;
    expect(scene.clusters[0]!.rect).toEqual({ x: 0, y: 0, w: 300, h: 200 });
  });

  it("lets it size itself again", () => {
    useDocumentStore.getState().sizeCluster("core", { x: 0, y: 0, w: 300, h: 200 });
    useDocumentStore.getState().sizeCluster("core", null);

    expect(useDocumentStore.getState().layout.pins).toEqual({});
    expect(useHistoryStore.getState().nextUndoLabel()).toBe("Let a subgraph size itself");
  });

  it("carries a fixed box along when the subgraph is dragged, keeping its size", () => {
    useDocumentStore.getState().sizeCluster("core", { x: 0, y: 0, w: 300, h: 200 });
    useDocumentStore.getState().pinAt(
      new Map([
        ["a", { x: 140, y: 140 }],
        ["core", { x: 250, y: 200 }],
      ]),
    );

    const pin = useDocumentStore.getState().layout.pins?.core;
    expect(pin).toMatchObject({ x: 250, y: 200, size: [300, 200] });
    expect(useHistoryStore.getState().nextUndoLabel()).toBe("Move a node");
  });
});
