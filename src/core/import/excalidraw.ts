import type { NodeShape } from "../model/scene";
import {
  emptyModel,
  ImportError,
  type ImportedModel,
  type ImportedNode,
} from "./types";


const SHAPES: Record<string, NodeShape> = {
  rectangle: "rect",
  ellipse: "ellipse",
  diamond: "diamond",
};


const BIND_SLACK = 24;

export function parseExcalidraw(text: string): ImportedModel {
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    throw new ImportError(
      "This file is not valid JSON.",
      "Check it is a .excalidraw file and not an exported image.",
    );
  }

  const elements = (file as { elements?: unknown })?.elements;
  if (!Array.isArray(elements)) {
    throw new ImportError(
      "No Excalidraw elements in this file.",
      "Use File → Save to… in Excalidraw to write a .excalidraw file.",
    );
  }

  const model = emptyModel();
  const live = elements.filter(
    (el): el is Record<string, unknown> =>
      Boolean(el) && typeof el === "object" && !(el as { isDeleted?: boolean }).isDeleted,
  );


  const boxes = new Map<string, ImportedNode>();
  for (const el of live) {
    const shape = SHAPES[String(el.type)];
    if (!shape) continue;

    const id = String(el.id ?? "");
    if (!id) continue;

    boxes.set(id, {
      id,
      label: "",
      shape,
      x: num(el.x),
      y: num(el.y),
      w: num(el.width, 120),
      h: num(el.height, 60),
    });
  }


  const onEdges = new Set<string>();
  for (const el of live) {
    if (el.type !== "arrow" && el.type !== "line") continue;
    if (!Array.isArray(el.boundElements)) continue;

    for (const entry of el.boundElements) {
      const id = (entry as { id?: unknown })?.id;
      if (typeof id === "string") onEdges.add(id);
    }
  }

  const loose: Array<{ id: string; text: string; x: number; y: number }> = [];

  for (const el of live) {
    if (el.type !== "text") continue;
    if (onEdges.has(String(el.id ?? ""))) continue;

    const text = String(el.text ?? "").trim();
    if (!text) continue;

    const container = el.containerId ? boxes.get(String(el.containerId)) : undefined;
    if (container) {
      container.label = container.label ? `${container.label}\n${text}` : text;
      continue;
    }

    loose.push({
      id: String(el.id ?? ""),
      text,
      x: num(el.x) + num(el.width) / 2,
      y: num(el.y) + num(el.height) / 2,
    });
  }


  let adopted = 0;
  const standalone: typeof loose = [];

  for (const label of loose) {
    const inside = [...boxes.values()].find(
      (box) => !box.label && contains(box, label.x, label.y),
    );
    if (inside) {
      inside.label = label.text;
      adopted += 1;
    } else {
      standalone.push(label);
    }
  }


  for (const label of standalone) {
    boxes.set(label.id, {
      id: label.id,
      label: label.text,
      shape: "rect",
      x: label.x - 60,
      y: label.y - 20,
      w: 120,
      h: 40,
    });
  }

  for (const box of boxes.values()) {
    if (!box.label) box.label = box.id.slice(0, 6);
  }


  let guessed = 0;
  let dangling = 0;

  for (const el of live) {
    if (el.type !== "arrow" && el.type !== "line") continue;

    const start = binding(el.startBinding, boxes);
    const end = binding(el.endBinding, boxes);


    const ends = arrowEnds(el);
    const from = start ?? (ends && nearest(boxes, ends.from));
    const to = end ?? (ends && nearest(boxes, ends.to));

    if (!from || !to || from === to) {
      dangling += 1;
      continue;
    }
    if (!start || !end) guessed += 1;

    model.edges.push({
      from,
      to,
      label: arrowLabel(el, live) || undefined,
      dashed: el.strokeStyle === "dashed" || el.strokeStyle === "dotted",
    });
  }

  model.nodes = [...boxes.values()];


  const freehand = live.filter((el) => el.type === "freedraw").length;
  const images = live.filter((el) => el.type === "image").length;

  if (adopted > 0) {
    model.warnings.push(
      `${adopted} ${adopted === 1 ? "label was" : "labels were"} matched to the shape ${
        adopted === 1 ? "it sits" : "they sit"
      } inside.`,
    );
  }
  if (guessed > 0) {
    model.warnings.push(
      `${guessed} ${guessed === 1 ? "arrow was" : "arrows were"} matched by position — ${
        guessed === 1 ? "it was" : "they were"
      } not attached to a shape in Excalidraw. Check ${guessed === 1 ? "it" : "them"}.`,
    );
  }
  if (dangling > 0) {
    model.warnings.push(
      `${dangling} ${dangling === 1 ? "line was" : "lines were"} dropped: ${
        dangling === 1 ? "it does" : "they do"
      } not join two shapes.`,
    );
  }
  if (freehand > 0) {
    model.warnings.push(
      `${freehand} freehand ${freehand === 1 ? "stroke" : "strokes"} could not be imported. Redraw ${
        freehand === 1 ? "it" : "them"
      } with ZDraft's pen once the diagram is in.`,
    );
  }
  if (images > 0) {
    model.warnings.push(
      `${images} embedded ${images === 1 ? "image" : "images"} could not be imported.`,
    );
  }

  return model;
}

function binding(value: unknown, boxes: Map<string, ImportedNode>): string | null {
  const id = (value as { elementId?: unknown })?.elementId;
  if (typeof id !== "string") return null;
  return boxes.has(id) ? id : null;
}


function arrowEnds(
  el: Record<string, unknown>,
): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const points = el.points;
  if (!Array.isArray(points) || points.length < 2) return null;

  const first = points[0];
  const last = points[points.length - 1];
  if (!Array.isArray(first) || !Array.isArray(last)) return null;

  const ox = num(el.x);
  const oy = num(el.y);

  return {
    from: { x: ox + num(first[0]), y: oy + num(first[1]) },
    to: { x: ox + num(last[0]), y: oy + num(last[1]) },
  };
}


function nearest(boxes: Map<string, ImportedNode>, at: { x: number; y: number }): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const box of boxes.values()) {
    const dx = Math.max(box.x - at.x, 0, at.x - (box.x + box.w));
    const dy = Math.max(box.y - at.y, 0, at.y - (box.y + box.h));
    const distance = Math.hypot(dx, dy);

    if (distance <= BIND_SLACK && distance < bestDistance) {
      best = box.id;
      bestDistance = distance;
    }
  }

  return best;
}


function arrowLabel(el: Record<string, unknown>, all: Array<Record<string, unknown>>): string {
  const bound = el.boundElements;
  if (!Array.isArray(bound)) return "";

  for (const entry of bound) {
    const id = (entry as { id?: unknown; type?: unknown })?.id;
    if ((entry as { type?: unknown })?.type !== "text" || typeof id !== "string") continue;

    const text = all.find((candidate) => candidate.id === id)?.text;
    if (typeof text === "string") return text.trim();
  }

  return "";
}

function contains(box: ImportedNode, x: number, y: number): boolean {
  return x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
}

function num(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
