import { describe, expect, it } from "vitest";

import { parseSequence } from "../locate/sequence";
import { layoutSequence } from "../sequence/layout";
import { themeByName } from "../theme";
import type { Annotation } from "../sidecar/types";
import type { GraphScene, PassthroughScene } from "../model/scene";
import { sceneToSvg } from "./svg";

const theme = themeByName("blueprint");


function parseSvg(markup: string): Element {
  const doc = new DOMParser().parseFromString(markup, "image/svg+xml");
  expect(doc.querySelector("parsererror")).toBeNull();
  return doc.documentElement;
}

const graph: GraphScene = {
  family: "graph",
  engine: "graphviz",
  diagramType: "digraph",
  direction: "LR",
  nodes: [
    {
      id: "a",
      body: { kind: "label", text: "Alpha & <Beta>" },
      shape: "rect",
      rect: { x: 0, y: 0, w: 80, h: 40 },
      fingerprint: "node:a:0",
    },
  ],
  edges: [],
  clusters: [],
  bounds: { x: 0, y: 0, w: 80, h: 40 },
};

describe("sceneToSvg — graph", () => {
  it("produces parseable SVG with a viewBox", () => {
    const svg = parseSvg(sceneToSvg(graph, theme));
    expect(svg.getAttribute("viewBox")).toBeTruthy();
  });

  it("escapes label text rather than emitting broken markup", () => {
    const markup = sceneToSvg(graph, theme);


    const svg = parseSvg(markup);
    const joined = Array.from(svg.querySelectorAll("text"))
      .map((t) => t.textContent)
      .join(" ");

    expect(joined).toContain("Alpha");
    expect(joined).toContain("<Beta>");
    expect(markup).not.toContain("<Beta>");
  });

  it("omits the background when asked, for a transparent export", () => {

    const withBg = parseSvg(sceneToSvg(graph, theme, { background: true }));
    const without = parseSvg(sceneToSvg(graph, theme, { background: false }));

    expect(withBg.querySelector("rect")?.getAttribute("fill")).toBe(theme.background);
    expect(without.querySelector("rect")).toBeNull();
  });

  it("scales width and height without touching the viewBox", () => {
    const one = parseSvg(sceneToSvg(graph, theme, { scale: 1 }));
    const three = parseSvg(sceneToSvg(graph, theme, { scale: 3 }));

    expect(Number(three.getAttribute("width"))).toBeCloseTo(Number(one.getAttribute("width")) * 3, 3);
    expect(three.getAttribute("viewBox")).toBe(one.getAttribute("viewBox"));
  });
});

describe("sceneToSvg — sequence", () => {
  const scene = layoutSequence(
    parseSequence(`sequenceDiagram
  participant U as User
  participant A as API
  U->>A: POST /orders
  activate A
  A-->>U: 201 Created
  deactivate A
  Note over U,A: the whole exchange
  loop retry
    U->>A: again
  end`),
    { theme },
  );

  const markup = sceneToSvg(scene, theme);

  it("produces parseable SVG", () => {
    expect(parseSvg(markup).getAttribute("viewBox")).toBeTruthy();
  });

  it("draws head and foot boxes for every lifeline", () => {
    const svg = parseSvg(markup);
    const labels = Array.from(svg.querySelectorAll("text")).map((t) => t.textContent);


    expect(labels.filter((l) => l === "User")).toHaveLength(2);
    expect(labels.filter((l) => l === "API")).toHaveLength(2);
  });

  it("carries the messages, the note and the fragment", () => {
    const text = Array.from(parseSvg(markup).querySelectorAll("text")).map((t) => t.textContent);

    expect(text).toContain("POST /orders");
    expect(text).toContain("201 Created");
    expect(text).toContain("the whole exchange");
    expect(text).toContain("loop");
    expect(text).toContain("[retry]");
  });

  it("draws the activation bar", () => {

    expect(markup).toContain(theme.accent);
  });

  it("dashes a reply and leaves a call solid", () => {
    const dashed = markup.split('stroke-dasharray="6 4"').length - 1;
    expect(dashed).toBeGreaterThanOrEqual(1);
  });
});

describe("sceneToSvg — passthrough", () => {
  const scene: PassthroughScene = {
    family: "passthrough",
    engine: "mermaid",
    diagramType: "pie",
    svg: "<g><circle r='4'/></g>",
    bounds: { x: 0, y: 0, w: 10, h: 10 },
    reason: "not modelled",
  };


  it("keeps the engine's drawing verbatim", () => {
    expect(sceneToSvg(scene, theme)).toContain(scene.svg);
  });

  it("gives it the root element the canvas took off it", () => {
    const svg = sceneToSvg(scene, theme, { padding: 6 });

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('viewBox="-6 -6 22 22"');
  });

  it("paints the theme's background, or leaves it out when asked", () => {
    expect(sceneToSvg(scene, theme)).toContain(theme.background);
    expect(sceneToSvg(scene, theme, { background: false })).not.toContain(theme.background);
  });

  it("scales the pixel size without touching the viewBox", () => {
    const svg = sceneToSvg(scene, theme, { padding: 0, scale: 3 });

    expect(svg).toContain('viewBox="0 0 10 10"');
    expect(svg).toContain('width="30"');
  });

  it("carries a title through for the file's own record", () => {
    expect(sceneToSvg(scene, theme, { title: "chart.mmd" })).toContain("<title>chart.mmd</title>");
  });
});


describe("the annotation layer, exported", () => {
  const note: Annotation = {
    kind: "note",
    at: [200, 10],
    size: [170, 80],
    points: [],
    text: "why two writers?",
    color: "rose",
    anchor: "a",
  };

  it("draws the marks and their text", () => {
    const svg = sceneToSvg(graph, theme, { annotations: { a1: note } });

    parseSvg(svg);
    expect(svg).toContain('data-layer="annotations"');
    expect(svg).toContain("why two writers?");
  });

  it("draws the line back to the node a note is about", () => {
    const svg = sceneToSvg(graph, theme, { annotations: { a1: note } });
    expect(svg).toContain("<line");
  });

  it("keeps a note out in the margin inside the exported box", () => {
    const svg = sceneToSvg(graph, theme, { padding: 0, annotations: { a1: note } });


    const viewBox = parseSvg(svg).getAttribute("viewBox")!.split(" ").map(Number);
    expect(viewBox[0]! + viewBox[2]!).toBeGreaterThanOrEqual(370);
  });

  it("says nothing at all when there is nothing to say", () => {
    expect(sceneToSvg(graph, theme)).not.toContain("annotations");
    expect(sceneToSvg(graph, theme, { annotations: {} })).not.toContain("annotations");
  });

  it("escapes note text rather than letting it close the document", () => {
    const svg = sceneToSvg(graph, theme, {
      annotations: { a1: { ...note, text: "a < b && c" } },
    });

    parseSvg(svg);
    expect(svg).toContain("&lt;");
  });
});
