import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  edgeEndpointsFromDomId,
  localBBox,
  nearestNode,
  nodeIdFromDomId,
  parseTranslate,
  pathPoints,
  readMermaidGeometry,
} from "./mermaidReadback";


const FIXTURES = resolve(__dirname, "../../../tests/fixtures/mermaid");

function fixture(name: string): { svg: Element; renderId: string } {
  const text = readFileSync(resolve(FIXTURES, `${name}.svg`), "utf8");
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  return { svg, renderId: svg.getAttribute("id") ?? "" };
}

function parse(markup: string): Element {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    "image/svg+xml",
  );
  return doc.documentElement.firstElementChild!;
}

describe("parseTranslate", () => {
  it("reads both forms Mermaid emits", () => {
    expect(parseTranslate("translate(10, 20)")).toEqual({ x: 10, y: 20 });
    expect(parseTranslate("translate(10.5 -20.25)")).toEqual({ x: 10.5, y: -20.25 });
    expect(parseTranslate("translate(7)")).toEqual({ x: 7, y: 0 });
  });

  it("is a no-op for a missing or unrecognised transform", () => {
    expect(parseTranslate(null)).toEqual({ x: 0, y: 0 });
    expect(parseTranslate("rotate(45)")).toEqual({ x: 0, y: 0 });
  });
});

describe("pathPoints", () => {
  it("walks line and curve commands", () => {
    expect(pathPoints("M 0 0 L 10 20")).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 20 },
    ]);
    expect(pathPoints("M0,0 C1,2 3,4 5,6")).toHaveLength(4);
  });

  it("does not mistake an arc's radii for a coordinate", () => {


    const points = pathPoints("M 0 0 A 500 500 0 0 1 10 10");
    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 10 },
    ]);
  });

  it("handles relative commands and implicit line-tos after M", () => {
    expect(pathPoints("m 5 5 l 5 5")).toEqual([
      { x: 5, y: 5 },
      { x: 10, y: 10 },
    ]);
    expect(pathPoints("M 0 0 10 0 10 10")).toHaveLength(3);
  });

  it("returns to the subpath start on Z", () => {
    expect(pathPoints("M 4 4 L 8 8 Z L 12 4")).toContainEqual({ x: 12, y: 4 });
  });

  it("survives junk without looping forever", () => {
    expect(() => pathPoints("M 0 0 Ω 5 5 L 1 1")).not.toThrow();
    expect(pathPoints("")).toEqual([]);
  });
});

describe("localBBox", () => {
  it("measures a rect, including its own transform", () => {
    expect(localBBox(parse('<rect x="-10" y="-5" width="20" height="10"/>'))).toEqual({
      x: -10,
      y: -5,
      w: 20,
      h: 10,
    });
    expect(
      localBBox(parse('<rect x="0" y="0" width="4" height="4" transform="translate(6,7)"/>')),
    ).toEqual({ x: 6, y: 7, w: 4, h: 4 });
  });

  it("measures polygons and circles", () => {
    expect(localBBox(parse('<polygon points="0,0 10,0 5,8"/>'))).toEqual({ x: 0, y: 0, w: 10, h: 8 });
    expect(localBBox(parse('<circle cx="5" cy="5" r="3"/>'))).toEqual({ x: 2, y: 2, w: 6, h: 6 });
  });

  it("unions a group's children", () => {
    const box = localBBox(
      parse('<g><rect x="0" y="0" width="4" height="4"/><rect x="10" y="2" width="2" height="6"/></g>'),
    );
    expect(box).toEqual({ x: 0, y: 0, w: 12, h: 8 });
  });

  it("ignores text, which attributes cannot measure", () => {
    const box = localBBox(parse('<g><rect x="0" y="0" width="4" height="4"/><text x="99" y="99">x</text></g>'));
    expect(box).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });

  it("reports nothing for an element with no geometry", () => {
    expect(localBBox(parse("<g></g>"))).toBeNull();
  });
});

describe("id recovery", () => {
  it("strips the render id, the kind prefix and Mermaid's ordinal", () => {
    expect(nodeIdFromDomId("capture-flowchart-lr-flowchart-cdn-0", "capture-flowchart-lr")).toBe("cdn");
    expect(nodeIdFromDomId("capture-class-classId-Order-0", "capture-class")).toBe("Order");
    expect(nodeIdFromDomId("capture-er-entity-LINE_ITEM-2", "capture-er")).toBe("LINE_ITEM");
    expect(nodeIdFromDomId("capture-state-state-Idle-1", "capture-state")).toBe("Idle");
  });

  it("keeps a hyphen that belongs to the author's id", () => {
    expect(nodeIdFromDomId("r-flowchart-my-node-3", "r")).toBe("my-node");
  });

  it("splits an edge id only where both halves are known nodes", () => {
    const known = new Set(["LINE_ITEM", "ORDER", "a", "b"]);
    expect(edgeEndpointsFromDomId("L_a_b_0", "", known)).toEqual({ from: "a", to: "b" });

    expect(edgeEndpointsFromDomId("id_ORDER_LINE_ITEM_0", "", known)).toEqual({
      from: "ORDER",
      to: "LINE_ITEM",
    });
  });

  it("gives up rather than guessing when the id carries no endpoints", () => {


    expect(edgeEndpointsFromDomId("edge3", "", new Set(["a"]))).toBeNull();
  });
});

describe("readMermaidGeometry — flowchart", () => {
  const { svg, renderId } = fixture("flowchart-lr");
  const geo = readMermaidGeometry(svg, renderId);

  it("finds every declared node with a real box", () => {
    const ids = geo.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(["api", "cache", "cdn", "db", "decide", "gateway", "queue", "worker"]);

    for (const node of geo.nodes) {
      expect(node.rect.w).toBeGreaterThan(0);
      expect(node.rect.h).toBeGreaterThan(0);
    }
  });

  it("reads node label text", () => {
    expect(geo.nodes.find((n) => n.id === "gateway")!.text).toBe("API Gateway");
  });

  it("finds both subgraphs and their titles", () => {
    expect(geo.clusters.map((c) => c.id).sort()).toEqual(["core", "edge"]);
    expect(geo.clusters.find((c) => c.id === "core")!.label).toBe("services");
  });

  it("places clusters around their members", () => {
    const core = geo.clusters.find((c) => c.id === "core")!;
    const api = geo.nodes.find((n) => n.id === "api")!;
    expect(api.rect.x).toBeGreaterThanOrEqual(core.rect.x - 1);
    expect(api.rect.x + api.rect.w).toBeLessThanOrEqual(core.rect.x + core.rect.w + 1);
  });

  it("reads every edge as a polyline", () => {
    expect(geo.edges.length).toBe(8);
    for (const edge of geo.edges) {
      expect(edge.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("attaches edge labels by data-id", () => {
    const labelled = geo.edges.filter((e) => e.labelText);
    expect(labelled.map((e) => e.labelText).sort()).toEqual([
      "HTTP",
      "consume",
      "miss",
      "no",
      "publish",
      "yes",
    ]);
    for (const edge of labelled) expect(edge.labelAt).toBeDefined();
  });

  it("reports bounds that contain every node", () => {
    for (const node of geo.nodes) {
      expect(node.rect.x).toBeGreaterThanOrEqual(geo.bounds.x - 1);
      expect(node.rect.y).toBeGreaterThanOrEqual(geo.bounds.y - 1);
    }
  });
});

describe("readMermaidGeometry — other families", () => {
  it("reads a state diagram, whose edge ids carry no endpoints", () => {
    const { svg, renderId } = fixture("state");
    const geo = readMermaidGeometry(svg, renderId);

    expect(geo.nodes.map((n) => n.id)).toEqual(
      expect.arrayContaining(["Idle", "Running", "Paused", "Done"]),
    );
    expect(geo.edges.length).toBeGreaterThanOrEqual(5);


    const first = geo.edges[0]!;
    expect(nearestNode(first.points[0]!, geo.nodes)).toBeTruthy();
    expect(nearestNode(first.points[first.points.length - 1]!, geo.nodes)).toBeTruthy();
  });

  it("reads a class diagram's boxes", () => {
    const { svg, renderId } = fixture("class");
    const geo = readMermaidGeometry(svg, renderId);

    expect(geo.nodes.map((n) => n.id).sort()).toEqual(["Customer", "LineItem", "Order"]);
    for (const node of geo.nodes) expect(node.rect.h).toBeGreaterThan(20);
  });

  it("reads an ER diagram, whose ids contain underscores", () => {
    const { svg, renderId } = fixture("er");
    const geo = readMermaidGeometry(svg, renderId);

    expect(geo.nodes.map((n) => n.id).sort()).toEqual(["CUSTOMER", "LINE_ITEM", "ORDER"]);
  });

  it("finds no graph nodes in a pie chart, which is passthrough", () => {
    const { svg, renderId } = fixture("pie");
    expect(readMermaidGeometry(svg, renderId).nodes).toEqual([]);
  });
});

describe("nearestNode", () => {
  const nodes = [
    { id: "a", rect: { x: 0, y: 0, w: 10, h: 10 }, text: "" },
    { id: "b", rect: { x: 100, y: 0, w: 10, h: 10 }, text: "" },
  ];

  it("picks the box a point sits on or nearest to", () => {
    expect(nearestNode({ x: 5, y: 5 }, nodes)).toBe("a");
    expect(nearestNode({ x: 99, y: 5 }, nodes)).toBe("b");
    expect(nearestNode({ x: 12, y: 5 }, nodes)).toBe("a");
  });

  it("returns nothing when there are no nodes", () => {
    expect(nearestNode({ x: 0, y: 0 }, [])).toBeNull();
  });
});

describe("edge endpoint resolution", () => {
  it("resolves flowchart edges straight from the DOM id", () => {
    const { svg, renderId } = fixture("flowchart-lr");
    const geo = readMermaidGeometry(svg, renderId);

    const pairs = geo.edges.map((e) => `${e.from}->${e.to}`).sort();
    expect(pairs).toEqual([
      "api->decide",
      "api->queue",
      "cdn->gateway",
      "decide->cache",
      "decide->db",
      "gateway->api",
      "queue->worker",
      "worker->db",
    ]);
  });

  it("resolves ER edges whose ids embed DOM ids and underscores", () => {
    const { svg, renderId } = fixture("er");
    const geo = readMermaidGeometry(svg, renderId);

    expect(geo.edges.map((e) => `${e.from}->${e.to}`).sort()).toEqual([
      "CUSTOMER->ORDER",
      "ORDER->LINE_ITEM",
    ]);
  });

  it("leaves state edges unresolved, for the geometric fallback", () => {
    const { svg, renderId } = fixture("state");
    const geo = readMermaidGeometry(svg, renderId);

    expect(geo.edges.every((e) => e.from === undefined)).toBe(true);
  });
});
