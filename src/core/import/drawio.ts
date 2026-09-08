import type { NodeShape } from "../model/scene";
import {
  emptyModel,
  ImportError,
  type ImportedEdge,
  type ImportedModel,
  type ImportedNode,
} from "./types";


const SHAPES: Array<[string, NodeShape]> = [
  ["ellipse", "ellipse"],
  ["rhombus", "diamond"],
  ["hexagon", "hexagon"],
  ["cylinder", "cylinder"],
  ["mxgraph.flowchart.database", "cylinder"],
  ["shape=parallelogram", "parallelogram"],
  ["shape=trapezoid", "trapezoid"],
  ["shape=step", "parallelogram"],
  ["shape=document", "note"],
  ["shape=note", "note"],
  ["shape=process", "subroutine"],
  ["shape=actor", "person"],
  ["shape=umlActor", "person"],
  ["triangle", "triangle"],
];

export async function parseDrawio(text: string): Promise<ImportedModel> {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new ImportError(
      "This file is not valid XML.",
      "Open it in draw.io and use File → Save as to write a fresh copy.",
    );
  }

  const model = emptyModel();


  const pages = [...doc.querySelectorAll("diagram")];
  const models: Element[] = [];

  if (pages.length === 0) {
    const bare = doc.querySelector("mxGraphModel");
    if (!bare) {
      throw new ImportError(
        "No draw.io diagram in this file.",
        "Check it is a .drawio or .xml file exported from draw.io, not an image.",
      );
    }
    models.push(bare);
  } else {
    for (const page of pages) {
      const inner = page.querySelector("mxGraphModel");
      if (inner) {
        models.push(inner);
        continue;
      }


      const decoded = await inflatePage(page.textContent ?? "");
      if (!decoded) {
        model.warnings.push(
          `Page “${page.getAttribute("name") ?? "untitled"}” is compressed and could not be read.`,
        );
        continue;
      }

      const parsed = new DOMParser().parseFromString(decoded, "application/xml");
      const inflated = parsed.querySelector("mxGraphModel");
      if (inflated) models.push(inflated);
    }
  }

  if (models.length === 0) {
    throw new ImportError(
      "Nothing in this file could be read.",
      "In draw.io, turn off File → Properties → Compressed and save again.",
    );
  }


  if (models.length > 1) {
    model.warnings.push(
      `Only the first of ${models.length} pages was imported. Import the others separately.`,
    );
  }

  readModel(models[0]!, model);
  return model;
}


async function inflatePage(payload: string): Promise<string | null> {
  const trimmed = payload.trim();
  if (!trimmed) return null;

  try {
    const binary = atob(trimmed);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));


    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }).pipeThrough(new DecompressionStream("deflate-raw"));

    const inflated = await new Response(stream).text();

    return decodeURIComponent(inflated);
  } catch {


    return null;
  }
}

function readModel(graph: Element, model: ImportedModel): void {
  const cells = [...graph.querySelectorAll("mxCell")];
  const geometry = new Map<string, { x: number; y: number; w: number; h: number }>();
  const pending: Array<{ cell: Element; node: ImportedNode }> = [];
  const edges: Array<{ cell: Element; edge: ImportedEdge }> = [];

  let unnamed = 0;
  let ignored = 0;

  for (const cell of cells) {
    const id = cell.getAttribute("id");
    if (!id) continue;

    const geo = cell.querySelector("mxGeometry");
    const style = cell.getAttribute("style") ?? "";

    if (cell.getAttribute("edge") === "1") {
      const from = cell.getAttribute("source");
      const to = cell.getAttribute("target");


      if (!from || !to) {
        ignored += 1;
        continue;
      }

      edges.push({
        cell,
        edge: {
          from,
          to,
          label: labelOf(cell) || undefined,
          dashed: style.includes("dashed=1"),
        },
      });
      continue;
    }

    if (cell.getAttribute("vertex") !== "1") continue;

    const rect = {
      x: num(geo?.getAttribute("x")),
      y: num(geo?.getAttribute("y")),
      w: num(geo?.getAttribute("width"), 120),
      h: num(geo?.getAttribute("height"), 60),
    };
    geometry.set(id, rect);

    const label = labelOf(cell);
    if (!label) unnamed += 1;

    pending.push({
      cell,
      node: {
        id,
        label: label || id,
        shape: shapeFor(style),
        ...rect,
        parent: cell.getAttribute("parent") ?? undefined,
      },
    });
  }


  for (const { node } of pending) {
    let parent = node.parent;
    const seen = new Set<string>([node.id]);

    while (parent && !seen.has(parent)) {
      seen.add(parent);
      const box = geometry.get(parent);
      if (box) {
        node.x += box.x;
        node.y += box.y;
      }
      parent = cells.find((c) => c.getAttribute("id") === parent)?.getAttribute("parent") ?? undefined;
    }
  }


  const containers = new Set(
    pending
      .filter(({ node }) => pending.some((other) => other.node.parent === node.id))
      .map(({ node }) => node.id),
  );

  for (const { node } of pending) {
    if (containers.has(node.id)) {
      model.groups.push({ id: node.id, label: node.label });
      continue;
    }

    if (node.parent && !containers.has(node.parent)) delete node.parent;
    model.nodes.push(node);
  }

  const known = new Set(model.nodes.map((n) => n.id));
  for (const { edge } of edges) {


    if (!known.has(edge.from) || !known.has(edge.to)) {
      ignored += 1;
      continue;
    }
    model.edges.push(edge);
  }

  if (unnamed > 0) {
    model.warnings.push(
      `${unnamed} ${unnamed === 1 ? "shape has" : "shapes have"} no text, so ${
        unnamed === 1 ? "its id was used" : "their ids were used"
      } as the label.`,
    );
  }
  if (ignored > 0) {
    model.warnings.push(
      `${ignored} ${ignored === 1 ? "connector was" : "connectors were"} dropped: ${
        ignored === 1 ? "it does" : "they do"
      } not join two shapes.`,
    );
  }
}


function labelOf(cell: Element): string {
  const raw = cell.getAttribute("value") ?? "";
  if (!raw) return "";

  const html = raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  const decoded = new DOMParser().parseFromString(html, "text/html").documentElement.textContent ?? "";

  return decoded
    .split("\n")
    .map((line) => line.trim())
    .filter((line, i, all) => line !== "" || (i > 0 && i < all.length - 1))
    .join("\n")
    .trim();
}

function shapeFor(style: string): NodeShape {
  const lower = style.toLowerCase();


  for (const [key, shape] of SHAPES) {
    if (lower.includes(key)) return shape;
  }
  if (lower.includes("rounded=1")) return "round";

  return "rect";
}

function num(value: string | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
