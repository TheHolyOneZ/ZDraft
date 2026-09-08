import { describe, expect, it } from "vitest";

import { parseMermaid } from "../locate/mermaid";
import { formatFor, importDiagram, ImportError } from ".";


function drawio(body: string, { compressed = false } = {}): string {
  const inner = `<mxGraphModel dx="1422" dy="798" grid="1" pageWidth="850" pageHeight="1100">
    <root>
      <mxCell id="0"/>
      <mxCell id="1" parent="0"/>
      ${body}
    </root>
  </mxGraphModel>`;

  return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="abc">${
    compressed ? "" : inner
  }</diagram></mxfile>`;
}

function vertex(
  id: string,
  value: string,
  x: number,
  y: number,
  { style = "rounded=0;", w = 120, h = 60, parent = "1" } = {},
): string {
  return `<mxCell id="${id}" value="${value}" style="${style}" vertex="1" parent="${parent}">
    <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>
  </mxCell>`;
}

function edge(id: string, source: string, target: string, value = ""): string {
  return `<mxCell id="${id}" value="${value}" style="edgeStyle=none;" edge="1" parent="1" source="${source}" target="${target}">
    <mxGeometry relative="1" as="geometry"/>
  </mxCell>`;
}


async function deflateRaw(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("deflate-raw"));

  const packed = new Uint8Array(await new Response(stream).arrayBuffer());
  return btoa(String.fromCharCode(...packed));
}

describe("choosing an importer", () => {
  it("knows what it can open", () => {
    expect(formatFor("architecture.drawio")).toBe("drawio");
    expect(formatFor("sketch.excalidraw")).toBe("excalidraw");
    expect(formatFor("notes.md")).toBeNull();
  });
});

describe("importing a draw.io file", () => {
  const FILE = drawio(`
    ${vertex("n1", "API gateway", 200, 80, { style: "rounded=1;" })}
    ${vertex("n2", "Orders", 120, 240)}
    ${vertex("n3", "Postgres", 320, 240, { style: "shape=cylinder;" })}
    ${edge("e1", "n1", "n2", "HTTP")}
    ${edge("e2", "n2", "n3")}
  `);

  it("reads the shapes and the connectors between them", async () => {
    const result = await importDiagram(FILE, "drawio");

    expect(result.counts).toEqual({ nodes: 3, edges: 2, groups: 0 });
    expect(result.source).toContain("flowchart TD");
  });


  it("pins every node where its author put it", async () => {
    const result = await importDiagram(FILE, "drawio");
    const pins = result.layout.pins!;

    expect(Object.keys(pins)).toHaveLength(3);


    expect(pins.API_gateway).toEqual({ x: 140, y: 30, fingerprint: null, auto: null });
  });

  it("keeps the diagram's own relative arrangement", async () => {
    const pins = (await importDiagram(FILE, "drawio")).layout.pins!;


    expect(pins.Orders!.y).toBeGreaterThan(pins.API_gateway!.y);
    expect(pins.Orders!.x).toBeLessThan(pins.Postgres!.x);
  });

  it("emits ids a reviewer can read", async () => {
    const result = await importDiagram(FILE, "drawio");
    expect(result.source).toContain("API_gateway");
    expect(result.source).not.toMatch(/\bn1\b/);
  });

  it("carries shapes across where it has one, and squares off where it does not", async () => {
    const result = await importDiagram(FILE, "drawio");

    expect(result.source).toContain("Postgres[(");
    expect(result.source).toContain("API_gateway(");
  });

  it("labels the edges", async () => {
    expect((await importDiagram(FILE, "drawio")).source).toContain('-->|"HTTP"|');
  });


  it("emits Mermaid that ZDraft can parse straight back", async () => {
    const result = await importDiagram(FILE, "drawio");
    const parsed = parseMermaid(result.source);

    expect([...parsed.nodes.keys()].sort()).toEqual(["API_gateway", "Orders", "Postgres"]);


    for (const id of Object.keys(result.layout.pins!)) {
      expect(parsed.nodes.has(id), id).toBe(true);
    }
  });

  it("turns a container into a subgraph rather than a box behind its contents", async () => {
    const file = drawio(`
      ${vertex("g1", "services", 100, 100, { w: 400, h: 300 })}
      ${vertex("n1", "Orders", 20, 40, { parent: "g1" })}
      ${vertex("n2", "Payments", 20, 140, { parent: "g1" })}
    `);
    const result = await importDiagram(file, "drawio");

    expect(result.counts).toEqual({ nodes: 2, edges: 0, groups: 1 });
    expect(result.source).toContain("subgraph");
    expect(result.source).toContain('"services"');
  });


  it("resolves a nested shape's position against its container", async () => {
    const file = drawio(`
      ${vertex("g1", "services", 1000, 500, { w: 400, h: 300 })}
      ${vertex("n1", "Orders", 20, 40, { parent: "g1" })}
      ${vertex("n2", "Loose", 1000, 900)}
    `);
    const pins = (await importDiagram(file, "drawio")).layout.pins!;


    expect(pins.Orders!.x).toBeGreaterThan(pins.Loose!.x);
  });

  it("flattens draw.io's HTML labels into text", async () => {
    const file = drawio(vertex("n1", "&lt;b&gt;API&lt;/b&gt;&lt;br&gt;gateway", 0, 0));
    const result = await importDiagram(file, "drawio");

    expect(result.source).toContain("API<br/>gateway");
    expect(result.source).not.toContain("<b>");
  });

  it("says so when a connector goes nowhere, rather than dropping it in silence", async () => {
    const file = drawio(`
      ${vertex("n1", "Alone", 0, 0)}
      <mxCell id="e1" edge="1" parent="1" source="n1"><mxGeometry as="geometry"/></mxCell>
    `);
    const result = await importDiagram(file, "drawio");

    expect(result.warnings.join(" ")).toMatch(/connector was dropped/);
  });

  it("names the other pages instead of silently importing one of five", async () => {
    const two = `<mxfile><diagram name="One"><mxGraphModel><root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>${vertex("n1", "First", 0, 0)}
      </root></mxGraphModel></diagram><diagram name="Two"><mxGraphModel><root>
        <mxCell id="0"/><mxCell id="1" parent="0"/>${vertex("n2", "Second", 0, 0)}
      </root></mxGraphModel></diagram></mxfile>`;

    const result = await importDiagram(two, "drawio");
    expect(result.warnings.join(" ")).toContain("first of 2 pages");
    expect(result.source).toContain("First");
  });


  it("reads a compressed page, which is what draw.io writes by default", async () => {
    const inner = `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${vertex(
      "n1",
      "Compressed",
      40,
      40,
    )}</root></mxGraphModel>`;

    const packed = await deflateRaw(encodeURIComponent(inner));
    const file = `<mxfile><diagram name="Page-1">${packed}</diagram></mxfile>`;

    const result = await importDiagram(file, "drawio");
    expect(result.source).toContain("Compressed");
    expect(result.layout.pins!.Compressed).toBeTruthy();
  });

  it("names a page it cannot decompress instead of reporting an empty diagram", async () => {
    await expect(
      importDiagram('<mxfile><diagram name="Page-1">!!not base64!!</diagram></mxfile>', "drawio"),
    ).rejects.toThrow(ImportError);
  });

  it("refuses a file that is not draw.io, with a remedy", async () => {
    const error = await importDiagram("not xml at all <<<", "drawio").catch((e) => e);

    expect(error).toBeInstanceOf(ImportError);
    expect((error as ImportError).remedy).toBeTruthy();
  });
});

describe("importing an Excalidraw file", () => {
  function file(elements: unknown[]): string {
    return JSON.stringify({ type: "excalidraw", version: 2, elements });
  }

  function box(id: string, x: number, y: number, type = "rectangle") {
    return { id, type, x, y, width: 140, height: 70 };
  }

  const BOUND = file([
    box("a", 0, 0),
    box("b", 300, 0),
    { id: "ta", type: "text", text: "Gateway", containerId: "a", x: 10, y: 10 },
    { id: "tb", type: "text", text: "Orders", containerId: "b", x: 310, y: 10 },
    {
      id: "ar",
      type: "arrow",
      x: 140,
      y: 35,
      points: [
        [0, 0],
        [160, 0],
      ],
      startBinding: { elementId: "a" },
      endBinding: { elementId: "b" },
    },
  ]);

  it("reads bound text as the shape's label", async () => {
    const result = await importDiagram(BOUND, "excalidraw");

    expect(result.source).toContain("Gateway");
    expect(result.source).toContain("Gateway --> Orders");
  });

  it("pins the shapes where they were drawn", async () => {
    const pins = (await importDiagram(BOUND, "excalidraw")).layout.pins!;

    expect(pins.Gateway).toEqual({ x: 70, y: 35, fingerprint: null, auto: null });
    expect(pins.Orders!.x).toBe(370);
  });

  it("maps the three shapes it has an outline for", async () => {
    const result = await importDiagram(
      file([
        { ...box("a", 0, 0, "ellipse"), id: "a" },
        { ...box("b", 200, 0, "diamond"), id: "b" },
        { id: "ta", type: "text", text: "Round", containerId: "a", x: 0, y: 0 },
        { id: "tb", type: "text", text: "Choice", containerId: "b", x: 0, y: 0 },
      ]),
      "excalidraw",
    );

    expect(result.source).toContain("Round((");
    expect(result.source).toContain("Choice{");
  });


  it("adopts a loose label sitting inside a shape, and says it guessed", async () => {
    const result = await importDiagram(
      file([box("a", 0, 0), { id: "t", type: "text", text: "Cache", x: 40, y: 25, width: 60, height: 20 }]),
      "excalidraw",
    );

    expect(result.source).toContain("Cache");
    expect(result.warnings.join(" ")).toMatch(/matched to the shape/);
  });

  it("matches an unbound arrow by where its ends land, and says it guessed", async () => {
    const result = await importDiagram(
      file([
        box("a", 0, 0),
        box("b", 300, 0),
        { id: "ta", type: "text", text: "One", containerId: "a", x: 0, y: 0 },
        { id: "tb", type: "text", text: "Two", containerId: "b", x: 0, y: 0 },
        {
          id: "ar",
          type: "arrow",
          x: 142,
          y: 35,
          points: [
            [0, 0],
            [156, 0],
          ],
        },
      ]),
      "excalidraw",
    );

    expect(result.counts.edges).toBe(1);
    expect(result.warnings.join(" ")).toMatch(/matched by position/);
  });


  it("does not turn an arrow's own label into a node as well", async () => {
    const result = await importDiagram(
      file([
        box("a", 0, 0),
        box("b", 300, 0),
        { id: "ta", type: "text", text: "One", containerId: "a", x: 0, y: 0 },
        { id: "tb", type: "text", text: "Two", containerId: "b", x: 0, y: 0 },
        {
          id: "ar",
          type: "arrow",
          x: 140,
          y: 35,
          points: [
            [0, 0],
            [160, 0],
          ],
          startBinding: { elementId: "a" },
          endBinding: { elementId: "b" },
          boundElements: [{ id: "lbl", type: "text" }],
        },
        { id: "lbl", type: "text", text: "GET /", x: 200, y: 20, width: 40, height: 20 },
      ]),
      "excalidraw",
    );

    expect(result.counts.nodes).toBe(2);
    expect(result.source).toContain('-->|"GET /"|');
  });

  it("keeps a caption as a box rather than losing the words", async () => {
    const result = await importDiagram(
      file([
        box("a", 0, 0),
        { id: "ta", type: "text", text: "Boxed", containerId: "a", x: 0, y: 0 },
        { id: "t", type: "text", text: "Written 2026", x: 0, y: 400, width: 100, height: 20 },
      ]),
      "excalidraw",
    );

    expect(result.source).toContain("Written 2026");
  });

  it("counts the freehand it cannot bring across", async () => {
    const result = await importDiagram(
      file([
        box("a", 0, 0),
        { id: "ta", type: "text", text: "Kept", containerId: "a", x: 0, y: 0 },
        { id: "f1", type: "freedraw", x: 0, y: 0, points: [[0, 0]] },
        { id: "f2", type: "freedraw", x: 0, y: 0, points: [[0, 0]] },
      ]),
      "excalidraw",
    );

    expect(result.warnings.join(" ")).toMatch(/2 freehand strokes/);
  });

  it("ignores what the author deleted", async () => {
    const result = await importDiagram(
      file([
        box("a", 0, 0),
        { id: "ta", type: "text", text: "Kept", containerId: "a", x: 0, y: 0 },
        { ...box("gone", 500, 0), isDeleted: true },
      ]),
      "excalidraw",
    );

    expect(result.counts.nodes).toBe(1);
  });

  it("refuses a file with no elements, with a remedy", async () => {
    const error = await importDiagram('{"type":"excalidraw"}', "excalidraw").catch((e) => e);

    expect(error).toBeInstanceOf(ImportError);
    expect((error as ImportError).remedy).toBeTruthy();
  });

  it("refuses an empty diagram rather than opening a blank file", async () => {
    await expect(importDiagram(file([]), "excalidraw")).rejects.toThrow(ImportError);
  });
});
