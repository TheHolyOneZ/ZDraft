

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const ORIGIN: Point = { x: 0, y: 0 };

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}


export function rectFromCenter(cx: number, cy: number, w: number, h: number): Rect {
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function rectRight(r: Rect): number {
  return r.x + r.w;
}

export function rectBottom(r: Rect): number {
  return r.y + r.h;
}

export function rectContains(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}


export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}


export function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

export function expandRect(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + by * 2, h: r.h + by * 2 };
}

export function translateRect(r: Rect, dx: number, dy: number): Rect {
  return { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
}


export function rectAtCenter(r: Rect, p: Point): Rect {
  return { x: p.x - r.w / 2, y: p.y - r.h / 2, w: r.w, h: r.h };
}

export function unionRects(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

export function boundsOfPoints(points: readonly Point[]): Rect {
  return unionRects(points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}


export type BoundaryShape = "rect" | "ellipse" | "diamond";


export function boundaryPoint(r: Rect, toward: Point, shape: BoundaryShape = "rect"): Point {
  const c = rectCenter(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;

  if (dx === 0 && dy === 0) return c;

  const a = r.w / 2;
  const b = r.h / 2;
  if (a <= 0 || b <= 0) return c;

  let t: number;
  switch (shape) {
    case "ellipse": {

      t = 1 / Math.hypot(dx / a, dy / b);
      break;
    }
    case "diamond": {

      t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
      break;
    }
    default: {

      const tx = dx === 0 ? Infinity : a / Math.abs(dx);
      const ty = dy === 0 ? Infinity : b / Math.abs(dy);
      t = Math.min(tx, ty);
      break;
    }
  }

  return { x: c.x + dx * t, y: c.y + dy * t };
}


export function snap(value: number, size: number): number {
  return size > 0 ? Math.round(value / size) * size : value;
}

export function snapPoint(p: Point, size: number): Point {
  return { x: snap(p.x, size), y: snap(p.y, size) };
}


export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const len2 = vx * vx + vy * vy;
  if (len2 === 0) return distance(p, a);

  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
  return distance(p, { x: a.x + vx * t, y: a.y + vy * t });
}


export function distanceToPolyline(p: Point, points: readonly Point[]): number {
  if (points.length === 0) return Infinity;
  if (points.length === 1) return distance(p, points[0]!);

  let best = Infinity;
  for (let i = 1; i < points.length; i++) {
    best = Math.min(best, distanceToSegment(p, points[i - 1]!, points[i]!));
  }
  return best;
}


export function segmentIntersectsRect(a: Point, b: Point, r: Rect): boolean {


  if (rectContains(r, a) || rectContains(r, b)) return true;

  let tMin = 0;
  let tMax = 1;

  const dx = b.x - a.x;
  const dy = b.y - a.y;

  const clip = (delta: number, origin: number, lo: number, hi: number): boolean => {
    if (delta === 0) return origin > lo && origin < hi;

    let t0 = (lo - origin) / delta;
    let t1 = (hi - origin) / delta;
    if (t0 > t1) [t0, t1] = [t1, t0];

    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    return tMin < tMax;
  };

  if (!clip(dx, a.x, r.x, r.x + r.w)) return false;
  if (!clip(dy, a.y, r.y, r.y + r.h)) return false;

  return tMin < tMax;
}


export function simplifyPolyline(points: readonly Point[], epsilon = 0.5): Point[] {
  if (points.length <= 2) return [...points];

  const out: Point[] = [points[0]!];

  for (let i = 1; i < points.length - 1; i++) {
    const prev = out[out.length - 1]!;
    const here = points[i]!;
    const next = points[i + 1]!;


    const cross = (here.x - prev.x) * (next.y - prev.y) - (here.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > epsilon) out.push(here);
  }

  out.push(points[points.length - 1]!);
  return out;
}
