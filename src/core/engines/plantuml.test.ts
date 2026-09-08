import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { rectCenter } from "../model/geometry";
import { isGraph, nodeText } from "../model/scene";
import { applyPins, pinFor } from "../pins";
import { themeByName } from "../theme";
import { buildPlantUmlScene, plantumlAdapter, setPlantUmlRunner, skinparamsFor } from "./plantuml";
import { isGraphDiagramType, readPlantUmlGeometry } from "./plantumlReadback";


const DIR = resolve(__dirname, "../../../tests/fixtures/plantuml");

function fixture(name: string): { source: string; svg: Element } {
  const source = readFileSync(resolve(DIR, `${name}.puml`), "utf8");
  const text = readFileSync(resolve(DIR, `${name}.svg`), "utf8");
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  return { source, svg: doc.documentElement };
}

function scene(name: string) {
  const { source, svg } = fixture(name);
  return buildPlantUmlScene(readPlantUmlGeometry(svg), source);
}

describe("readPlantUmlGeometry", () => {
  it("finds every entity a component diagram declares", () => {
    const { svg } = fixture("components");
    const geometry = readPlantUmlGeometry(svg);

    expect(geometry.diagramType).toBe("DESCRIPTION");
    expect(geometry.entities.map((e) => e.id).sort()).toEqual([
      "core.ops",
      "core.q",
      "db",
      "gw",
      "w",
    ]);
  });

  it("reads a package as a cluster", () => {
    const geometry = readPlantUmlGeometry(fixture("components").svg);
    expect(geometry.clusters.map((c) => c.id)).toEqual(["core"]);
  });

  it("gives every entity a real box", () => {
    const geometry = readPlantUmlGeometry(fixture("components").svg);
    for (const entity of geometry.entities) {
      expect(entity.rect.w, entity.id).toBeGreaterThan(0);
      expect(entity.rect.h, entity.id).toBeGreaterThan(0);
    }
  });

  it("carries the source line PlantUML reports", () => {
    const geometry = readPlantUmlGeometry(fixture("components").svg);
    for (const entity of geometry.entities) {
      expect(entity.sourceLine, entity.id).toBeGreaterThan(0);
    }
  });

  it("names both ends of every link", () => {
    const geometry = readPlantUmlGeometry(fixture("components").svg);
    expect(geometry.links.length).toBeGreaterThanOrEqual(4);
    for (const link of geometry.links) {
      expect(link.fromRef).toMatch(/^ent/);
      expect(link.toRef).toMatch(/^ent/);
      expect(link.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("reads a link's label off its own text run", () => {
    const geometry = readPlantUmlGeometry(fixture("components").svg);
    const labels = geometry.links.map((l) => l.label).filter(Boolean);
    expect(labels).toContain("dispatch");
    expect(labels).toContain("watches");
  });

  it("classifies which diagram types can be modelled", () => {
    expect(isGraphDiagramType("DESCRIPTION")).toBe(true);
    expect(isGraphDiagramType("CLASS")).toBe(true);
    expect(isGraphDiagramType("STATE")).toBe(true);
    expect(isGraphDiagramType("SEQUENCE")).toBe(false);
    expect(isGraphDiagramType("MINDMAP")).toBe(false);
  });
});

describe("buildPlantUmlScene", () => {
  it("takes labels from the source, not the rendered text", () => {
    const graph = scene("components");
    const gw = graph.nodes.find((n) => n.id === "gw")!;
    expect(nodeText(gw.body)).toBe("API Gateway");
  });


  it("takes shapes from the keyword the source used", () => {
    const graph = scene("components");
    const shapeOf = (id: string) => graph.nodes.find((n) => n.id === id)!.shape;

    expect(shapeOf("db")).toBe("cylinder");
    expect(shapeOf("core.q")).toBe("queue");
    expect(shapeOf("core.ops")).toBe("person");
    expect(shapeOf("w")).toBe("subroutine");
  });

  it("puts a package's members inside it", () => {
    const graph = scene("components");
    expect(graph.nodes.find((n) => n.id === "core.q")!.parent).toBe("core");
    expect(graph.nodes.find((n) => n.id === "gw")!.parent).toBeUndefined();
  });

  it("sizes the cluster around what it holds", () => {
    const graph = scene("components");
    const cluster = graph.clusters.find((c) => c.id === "core")!;
    const member = graph.nodes.find((n) => n.id === "core.q")!;

    expect(member.rect.x).toBeGreaterThanOrEqual(cluster.rect.x);
    expect(member.rect.y).toBeGreaterThanOrEqual(cluster.rect.y);
  });

  it("turns a class body into compartments", () => {
    const graph = scene("classes");
    const body = graph.nodes.find((n) => n.id === "Document")!.body;

    expect(body.kind).toBe("compartments");
    if (body.kind !== "compartments") return;

    const items = body.sections.flatMap((s) => s.items);
    expect(items).toContain("+String path");
    expect(items).toContain("+open()");
  });

  it("separates fields from methods", () => {
    const graph = scene("classes");
    const body = graph.nodes.find((n) => n.id === "Document")!.body;
    if (body.kind !== "compartments") throw new Error("expected compartments");


    expect(body.sections.length).toBe(2);
    expect(body.sections[0]!.items.every((i) => !i.includes("("))).toBe(true);
    expect(body.sections[1]!.items.every((i) => i.includes("("))).toBe(true);
  });

  it("keeps a stereotype off the title", () => {
    const graph = scene("classes");
    const body = graph.nodes.find((n) => n.id === "Layout")!.body;
    if (body.kind !== "compartments") throw new Error("expected compartments");

    expect(body.title).toBe("Layout");
    expect(body.stereotype).toBe("sidecar");
  });


  it("takes arrowheads from the connector in the source", () => {
    const graph = scene("classes");
    const composition = graph.edges.find((e) => e.from === "Document" && e.to === "Layout")!;
    expect(composition.startArrow).toBe("diamond");

    const realises = graph.edges.find((e) => e.from === "Document" && e.to === "Adapter")!;
    expect(realises.endArrow).toBe("open");
    expect(realises.style?.dashed).toBe(true);
  });

  it("gives every node a source range containing its own name", () => {
    const { source } = fixture("components");
    const graph = scene("components");

    for (const node of graph.nodes) {
      expect(node.sourceRange, node.id).toBeDefined();
      const text = source.slice(node.sourceRange!.from, node.sourceRange!.to);
      expect(text, node.id).toContain(node.id.slice(node.id.lastIndexOf(".") + 1));
    }
  });

  it("models a state diagram, markers and all", () => {
    const graph = scene("states");
    const ids = graph.nodes.map((n) => n.id);

    expect(ids).toContain("Idle");
    expect(ids).toContain("Loading");


    expect(graph.edges.length).toBe(6);
  });

  it("draws the start and end markers as empty circles", () => {
    const graph = scene("states");
    const markers = graph.nodes.filter((n) => n.id === ".start." || n.id === ".end.");

    expect(markers).toHaveLength(2);
    for (const marker of markers) {
      expect(marker.shape).toBe("circle");
      expect(nodeText(marker.body)).toBe("");
    }
  });

  it("keeps a pin when an unrelated part of the source changes", () => {
    const graph = scene("components");
    const node = graph.nodes.find((n) => n.id === "gw")!;
    const applied = applyPins(graph, { pins: { gw: pinFor(node, { x: 900, y: 400 }) } });

    expect(rectCenter(applied.scene.nodes.find((n) => n.id === "gw")!.rect)).toEqual({
      x: 900,
      y: 400,
    });
    expect(applied.orphans).toEqual([]);
  });
});

describe("plantumlAdapter", () => {
  const runner = (name: string) => {
    const { svg } = fixture(name);
    return {
      render: async (_source: string, _params: readonly string[]) =>
        readFileSync(resolve(DIR, `${name}.svg`), "utf8"),
      status: async () => ({ ready: true, reason: "", remedy: "" }),
      parse: () => svg,
    };
  };

  it("says which piece is missing when there is no runner", async () => {
    setPlantUmlRunner(null);
    const result = await plantumlAdapter.layout("@startuml\na -> b\n@enduml");

    expect(result.diagnostics[0]!.severity).toBe("error");
    expect(result.diagnostics[0]!.message).toContain("desktop app");
  });

  it("reports unavailability rather than throwing", async () => {
    setPlantUmlRunner(null);
    const status = await plantumlAdapter.available!();
    expect(status.ok).toBe(false);
  });

  it("builds a graph scene from a component diagram", async () => {
    setPlantUmlRunner(runner("components"));
    const { source } = fixture("components");
    const result = await plantumlAdapter.layout(source);

    expect(isGraph(result.scene)).toBe(true);
    if (!isGraph(result.scene)) return;
    expect(result.scene.nodes.length).toBe(5);
    setPlantUmlRunner(null);
  });


  it("falls back to passthrough for a diagram it cannot model", async () => {
    setPlantUmlRunner(runner("sequence"));
    const { source } = fixture("sequence");
    const result = await plantumlAdapter.layout(source);

    expect(result.scene.family).toBe("passthrough");
    expect(result.diagnostics[0]!.message).toContain("nothing here can be dragged");
    setPlantUmlRunner(null);
  });

  it("strips the outer svg element from a passthrough diagram", async () => {
    setPlantUmlRunner(runner("sequence"));
    const result = await plantumlAdapter.layout(fixture("sequence").source);

    if (result.scene.family !== "passthrough") throw new Error("expected passthrough");


    expect(result.scene.svg).not.toContain("<svg");
    expect(result.scene.svg.length).toBeGreaterThan(100);
    setPlantUmlRunner(null);
  });

  it("turns a runner failure into a diagnostic with a line to jump to", async () => {
    setPlantUmlRunner({
      render: async () => {
        throw { message: "Syntax Error at line 3", remedy: "Check the syntax." };
      },
      status: async () => ({ ready: true, reason: "", remedy: "" }),
      parse: () => null,
    });

    const result = await plantumlAdapter.layout("@startuml\na -> b\nbroken here\n@enduml");
    const [d] = result.diagnostics;

    expect(d!.severity).toBe("error");
    expect(d!.line).toBe(3);
    expect(d!.message).toContain("Check the syntax.");
    setPlantUmlRunner(null);
  });
});

describe("skinparamsFor", () => {
  const theme = themeByName("neon");

  it("makes the background transparent so the canvas shows through", () => {
    expect(skinparamsFor(theme)).toContain("backgroundColor=transparent");
  });

  it("carries the theme's own colours across", () => {
    const params = skinparamsFor(theme);
    expect(params).toContain(`arrowColor=${theme.edge}`);
    expect(params).toContain(`participantBackgroundColor=${theme.nodeFill}`);
  });


  it("sets a font colour the canvas can actually show", () => {
    expect(skinparamsFor(theme)).toContain(`defaultFontColor=${theme.nodeText}`);
  });

  it("leaves out values PlantUML has no equivalent for", () => {


    for (const param of skinparamsFor(theme)) {
      expect(param, param).not.toContain("rgba");
    }
  });

  it("emits every colour as a hex literal", () => {
    for (const param of skinparamsFor(theme)) {
      const value = param.slice(param.indexOf("=") + 1);
      if (value.startsWith("#")) expect(value).toMatch(/^#[0-9a-fA-F]{3,6}$/);
    }
  });

  it("says nothing at all without a theme", () => {
    expect(skinparamsFor(undefined)).toEqual([]);
  });
});
