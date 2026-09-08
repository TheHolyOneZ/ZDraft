import {
  annotationBounds,
  annotationColor,
  annotationPath,
  byCreation,
  leaderLine,
} from "../annotate";
import type { Annotation } from "../sidecar/types";
import type { Point, Rect } from "../model/geometry";
import type { GraphScene, Scene } from "../model/scene";
import { isGraph } from "../model/scene";
import type { DiagramTheme } from "../theme";
import { arrowGeometry } from "./edges";
import { shapeGeometry } from "./shapes";
import { wrapText } from "./text";


export interface AnnotationText {
  text: string;
  x: number;
  y: number;
}

export interface AnnotationRender {
  id: string;
  kind: Annotation["kind"];
  color: string;

  bounds: Rect;

  boxPath?: string;

  linePath?: string;

  headPath?: string;

  lines?: AnnotationText[];

  leader?: { from: Point; to: Point };
}


const NOTE_PAD = 10;
const ARROW_SIZE = 13;


export const ANNOTATION_STROKE = 2.5;
export const HIGHLIGHT_OPACITY = 0.16;

export function renderAnnotations(
  annotations: Readonly<Record<string, Annotation>> | undefined,
  scene: Scene | null,
  theme: DiagramTheme,
): AnnotationRender[] {
  if (!annotations) return [];

  const graph = scene && isGraph(scene) ? scene : null;

  return Object.keys(annotations)
    .sort(byCreation)
    .map((id) => renderAnnotation(id, annotations[id]!, graph, theme));
}

export function renderAnnotation(
  id: string,
  mark: Annotation,
  scene: GraphScene | null,
  theme: DiagramTheme,
): AnnotationRender {
  const color = annotationColor(mark.color);
  const bounds = annotationBounds(mark);

  const base: AnnotationRender = { id, kind: mark.kind, color, bounds };

  switch (mark.kind) {
    case "highlight":
      return {
        ...base,
        boxPath: shapeGeometry("rect", { x: 0, y: 0, w: bounds.w, h: bounds.h }, 4).path,
      };

    case "note":
      return {
        ...base,
        boxPath: shapeGeometry(
          "rect",
          { x: 0, y: 0, w: bounds.w, h: bounds.h },
          theme.cornerRadius,
        ).path,
        lines: noteLines(mark, bounds, theme),
        leader: leaderFor(mark, bounds, scene) ?? undefined,
      };

    case "arrow": {
      const path = annotationPath(mark);
      const tip = path[path.length - 1];
      const from = path[path.length - 2];

      return {
        ...base,
        linePath: polyline(path),
        headPath:
          tip && from ? (arrowGeometry("arrow", tip, from, ARROW_SIZE)?.path ?? undefined) : undefined,
      };
    }

    case "stroke":
      return { ...base, linePath: smoothed(annotationPath(mark)) };
  }
}


function noteLines(mark: Annotation, bounds: Rect, theme: DiagramTheme): AnnotationText[] {
  const text = mark.text?.trim();
  if (!text) return [];

  const size = theme.fontSize;
  const lineHeight = size * 1.35;
  const width = Math.max(bounds.w - NOTE_PAD * 2, 20);
  const maxLines = Math.max(1, Math.floor((bounds.h - NOTE_PAD * 2) / lineHeight));

  return wrapText(text, width, size, 400, maxLines).map((line, i) => ({
    text: line,
    x: bounds.x + NOTE_PAD,
    y: bounds.y + NOTE_PAD + size * 0.85 + i * lineHeight,
  }));
}

function leaderFor(mark: Annotation, bounds: Rect, scene: GraphScene | null) {
  if (!mark.anchor || !scene) return null;

  const node = scene.nodes.find((n) => n.id === mark.anchor);


  if (!node) return null;

  return leaderLine({ ...mark, at: [bounds.x, bounds.y] }, node.rect);
}

function polyline(points: readonly Point[]): string {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ");
}


function smoothed(points: readonly Point[]): string {
  if (points.length < 3) return polyline(points);

  const first = points[0]!;
  const parts = [`M${r(first.x)},${r(first.y)}`];

  for (let i = 1; i < points.length - 1; i += 1) {
    const p = points[i]!;
    const next = points[i + 1]!;
    parts.push(
      `Q${r(p.x)},${r(p.y)} ${r((p.x + next.x) / 2)},${r((p.y + next.y) / 2)}`,
    );
  }

  const last = points[points.length - 1]!;
  parts.push(`L${r(last.x)},${r(last.y)}`);
  return parts.join(" ");
}

function r(v: number): number {
  return Math.round(v * 100) / 100;
}


export function annotationsBounds(
  annotations: Readonly<Record<string, Annotation>> | undefined,
): Rect | null {
  const marks = Object.values(annotations ?? {});
  if (marks.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const mark of marks) {
    const box = annotationBounds(mark);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }

  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
