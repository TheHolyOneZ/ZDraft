import type { Annotation, AnnotationKind } from "../sidecar/types";
import { rectCenter, type Point, type Rect } from "../model/geometry";


export type { Annotation, AnnotationKind };


export interface AnnotationColor {
  id: string;
  label: string;
  value: string;
}


export const ANNOTATION_COLORS: readonly AnnotationColor[] = [
  { id: "rose", label: "Rose", value: "#f43f5e" },
  { id: "sky", label: "Sky", value: "#0ea5e9" },
  { id: "emerald", label: "Emerald", value: "#10b981" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "slate", label: "Slate", value: "#64748b" },
];

export const DEFAULT_ANNOTATION_COLOR = "rose";

export function annotationColor(name: string | null | undefined): string {
  return (
    ANNOTATION_COLORS.find((c) => c.id === name)?.value ??
    ANNOTATION_COLORS[0]!.value
  );
}


const MIN_DRAG = 6;


const NOTE_DEFAULT = { w: 190, h: 68 };


export function annotationFromDrag(
  kind: AnnotationKind,
  from: Point,
  to: Point,
  path?: readonly Point[],
): Annotation | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dragged = Math.hypot(dx, dy) >= MIN_DRAG;


  const boxed = Math.abs(dx) >= MIN_DRAG && Math.abs(dy) >= MIN_DRAG;

  const base = { text: null, color: DEFAULT_ANNOTATION_COLOR, anchor: null };

  switch (kind) {
    case "note":
      return {
        ...base,
        kind,
        at: [Math.round(from.x), Math.round(from.y)],
        size: boxed
          ? [Math.round(Math.abs(dx)), Math.round(Math.abs(dy))]
          : [NOTE_DEFAULT.w, NOTE_DEFAULT.h],
        points: [],
      };

    case "arrow":
      if (!dragged) return null;
      return {
        ...base,
        kind,
        at: [Math.round(from.x), Math.round(from.y)],
        size: null,
        points: [
          [0, 0],
          [Math.round(dx), Math.round(dy)],
        ],
      };

    case "highlight":
      if (!boxed) return null;
      return {
        ...base,
        kind,
        at: [Math.round(Math.min(from.x, to.x)), Math.round(Math.min(from.y, to.y))],
        size: [Math.round(Math.abs(dx)), Math.round(Math.abs(dy))],
        points: [],
      };

    case "stroke": {
      const points = simplify(path ?? [from, to], 1.5);
      if (points.length < 2) return null;

      const origin = points[0]!;
      return {
        ...base,
        kind,
        at: [Math.round(origin.x), Math.round(origin.y)],
        size: null,
        points: points.map((p) => [
          Math.round(p.x - origin.x),
          Math.round(p.y - origin.y),
        ]),
      };
    }
  }
}


export function nextAnnotationId(existing: Readonly<Record<string, unknown>>): string {
  let n = 1;
  while (`a${n}` in existing) n += 1;
  return `a${n}`;
}


export function annotationBounds(mark: Annotation): Rect {
  const [x, y] = mark.at;

  if (mark.size) {
    return { x, y, w: mark.size[0], h: mark.size[1] };
  }

  const points = mark.points ?? [];
  if (points.length === 0) return { x, y, w: 0, h: 0 };

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [px, py] of points) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return { x: x + minX, y: y + minY, w: maxX - minX, h: maxY - minY };
}


export function annotationPath(mark: Annotation): Point[] {
  const [x, y] = mark.at;
  return (mark.points ?? []).map(([px, py]) => ({ x: x + px, y: y + py }));
}

export function moveAnnotation(mark: Annotation, dx: number, dy: number): Annotation {
  return {
    ...mark,
    at: [Math.round(mark.at[0] + dx), Math.round(mark.at[1] + dy)],
  };
}


export function annotationAt(
  annotations: Readonly<Record<string, Annotation>>,
  point: Point,
  tolerance = 6,
): string | null {
  const ids = Object.keys(annotations).sort(byCreation);

  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const id = ids[i]!;
    const mark = annotations[id]!;

    if (mark.kind === "note") {
      if (inside(annotationBounds(mark), point, tolerance)) return id;
      continue;
    }

    if (mark.kind === "highlight") {
      const box = annotationBounds(mark);
      const band = Math.max(tolerance, HIGHLIGHT_GRAB);
      if (inside(box, point, band) && !inside(shrink(box, band), point, 0)) return id;
      continue;
    }

    const path = annotationPath(mark);
    for (let s = 0; s < path.length - 1; s += 1) {
      if (distanceToSegment(point, path[s]!, path[s + 1]!) <= tolerance) return id;
    }
  }

  return null;
}


export function byCreation(a: string, b: string): number {
  const n = (id: string) => Number.parseInt(id.replace(/^\D+/, ""), 10);
  const [x, y] = [n(a), n(b)];
  if (Number.isNaN(x) || Number.isNaN(y)) return a.localeCompare(b);
  return x - y || a.localeCompare(b);
}


export const HIGHLIGHT_GRAB = 8;

function shrink(rect: Rect, by: number): Rect {
  return {
    x: rect.x + by,
    y: rect.y + by,
    w: Math.max(rect.w - by * 2, 0),
    h: Math.max(rect.h - by * 2, 0),
  };
}

function inside(rect: Rect, p: Point, slack: number): boolean {
  return (
    p.x >= rect.x - slack &&
    p.x <= rect.x + rect.w + slack &&
    p.y >= rect.y - slack &&
    p.y <= rect.y + rect.h + slack
  );
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = dx * dx + dy * dy;

  if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}


export function leaderLine(
  mark: Annotation,
  target: Rect,
): { from: Point; to: Point } | null {
  const note = annotationBounds(mark);
  if (overlaps(note, target)) return null;

  const a = rectCenter(note);
  const b = rectCenter(target);

  return { from: clipToRect(a, b, note), to: clipToRect(b, a, target) };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}


function clipToRect(centre: Point, toward: Point, rect: Rect): Point {
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  if (dx === 0 && dy === 0) return centre;

  const halfW = rect.w / 2;
  const halfH = rect.h / 2;


  const scale = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy),
  );

  return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}


export function retargetAnnotations(
  annotations: Readonly<Record<string, Annotation>> | undefined,
  from: string,
  to: string,
): Readonly<Record<string, Annotation>> | undefined {
  if (!annotations) return annotations;

  const affected = Object.entries(annotations).filter(([, mark]) => mark.anchor === from);
  if (affected.length === 0) return annotations;

  const next = { ...annotations };
  for (const [id, mark] of affected) next[id] = { ...mark, anchor: to };
  return next;
}


export function simplify(points: readonly Point[], epsilon: number): Point[] {
  if (points.length < 3) return [...points];

  const first = points[0]!;
  const last = points[points.length - 1]!;

  let worst = 0;
  let at = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const d = distanceToSegment(points[i]!, first, last);
    if (d > worst) {
      worst = d;
      at = i;
    }
  }

  if (worst <= epsilon) return [first, last];

  return [
    ...simplify(points.slice(0, at + 1), epsilon).slice(0, -1),
    ...simplify(points.slice(at), epsilon),
  ];
}
