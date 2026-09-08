import type { Point } from "../model/geometry";
import { distance, lerp } from "../model/geometry";
import type { ArrowKind, EdgeRoute } from "../model/scene";


function n(v: number): string {
  return Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : "0";
}


export function edgePathD(route: EdgeRoute): string {
  const pts = route.points;
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${n(pts[0]!.x)},${n(pts[0]!.y)}`;

  if (route.kind === "spline" && pts.length >= 4 && (pts.length - 1) % 3 === 0) {
    let d = `M${n(pts[0]!.x)},${n(pts[0]!.y)}`;
    for (let i = 1; i < pts.length; i += 3) {
      const c1 = pts[i]!;
      const c2 = pts[i + 1]!;
      const end = pts[i + 2]!;
      d += ` C${n(c1.x)},${n(c1.y)} ${n(c2.x)},${n(c2.y)} ${n(end.x)},${n(end.y)}`;
    }
    return d;
  }

  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${n(p.x)},${n(p.y)}`).join(" ");
}


export function routeTail(route: EdgeRoute): Point | undefined {
  return route.points[route.points.length - 1];
}

export function routeHead(route: EdgeRoute): Point | undefined {
  return route.points[0];
}


function anchorAwayFrom(
  points: readonly Point[],
  tip: Point,
  fromEnd: boolean,
): Point | undefined {
  const ordered = fromEnd ? [...points].reverse() : [...points];

  for (const p of ordered) {
    if (distance(p, tip) > 0.5) return p;
  }
  return undefined;
}

export interface ArrowGeometry {
  path: string;

  filled: boolean;
}


export function arrowGeometry(
  kind: ArrowKind,
  tip: Point,
  from: Point,
  size: number,
): ArrowGeometry | null {
  if (kind === "none") return null;

  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;

  const ux = dx / len;
  const uy = dy / len;

  const px = -uy;
  const py = ux;

  const half = size * 0.31;
  const baseX = tip.x - ux * size;
  const baseY = tip.y - uy * size;

  switch (kind) {
    case "arrow":
    case "open": {
      const a = { x: baseX + px * half, y: baseY + py * half };
      const b = { x: baseX - px * half, y: baseY - py * half };
      return {
        path: `M${n(tip.x)},${n(tip.y)} L${n(a.x)},${n(a.y)} L${n(b.x)},${n(b.y)} Z`,
        filled: kind === "arrow",
      };
    }

    case "dot":
    case "odot": {
      const r = size * 0.34;
      const cx = tip.x - ux * r;
      const cy = tip.y - uy * r;
      return {
        path: `M${n(cx - r)},${n(cy)} a${n(r)},${n(r)} 0 1 0 ${n(r * 2)},0 a${n(r)},${n(r)} 0 1 0 ${n(-r * 2)},0 Z`,
        filled: kind === "dot",
      };
    }

    case "diamond":
    case "odiamond": {
      const midX = tip.x - ux * (size / 2);
      const midY = tip.y - uy * (size / 2);
      return {
        path: [
          `M${n(tip.x)},${n(tip.y)}`,
          `L${n(midX + px * half)},${n(midY + py * half)}`,
          `L${n(baseX)},${n(baseY)}`,
          `L${n(midX - px * half)},${n(midY - py * half)}`,
          "Z",
        ].join(" "),
        filled: kind === "diamond",
      };
    }

    case "cross": {
      const a = { x: tip.x + px * half, y: tip.y + py * half };
      const b = { x: tip.x - px * half, y: tip.y - py * half };
      return { path: `M${n(a.x)},${n(a.y)} L${n(b.x)},${n(b.y)}`, filled: false };
    }

    default:
      return null;
  }
}


export function headArrow(
  route: EdgeRoute,
  tip: Point | undefined,
  kind: ArrowKind,
  size: number,
): ArrowGeometry | null {
  const actualTip = tip ?? routeTail(route);
  if (!actualTip) return null;

  const from = anchorAwayFrom(route.points, actualTip, true);
  if (!from) return null;

  return arrowGeometry(kind, actualTip, from, size);
}


export function tailArrow(
  route: EdgeRoute,
  tip: Point | undefined,
  kind: ArrowKind,
  size: number,
): ArrowGeometry | null {
  const actualTip = tip ?? routeHead(route);
  if (!actualTip) return null;

  const from = anchorAwayFrom(route.points, actualTip, false);
  if (!from) return null;

  return arrowGeometry(kind, actualTip, from, size);
}


export function pointAlong(route: EdgeRoute, t: number): Point {
  const pts = route.points;
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0]!;

  let total = 0;
  const segments: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const d = distance(pts[i - 1]!, pts[i]!);
    segments.push(d);
    total += d;
  }
  if (total === 0) return pts[0]!;

  let target = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    if (target <= seg || i === segments.length - 1) {
      return lerp(pts[i]!, pts[i + 1]!, seg === 0 ? 0 : target / seg);
    }
    target -= seg;
  }

  return pts[pts.length - 1]!;
}


export function routeLength(route: EdgeRoute): number {
  let total = 0;
  for (let i = 1; i < route.points.length; i++) {
    total += distance(route.points[i - 1]!, route.points[i]!);
  }
  return total;
}
