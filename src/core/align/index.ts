import { rectCenter, type Point, type Rect } from "../model/geometry";
import type { GraphNode } from "../model/scene";


export type AlignEdge = "left" | "center-x" | "right" | "top" | "middle-y" | "bottom";
export type DistributeAxis = "horizontal" | "vertical";


export interface Placed {
  id: string;
  rect: Rect;
}

export function placed(nodes: readonly GraphNode[]): Placed[] {
  return nodes.map((n) => ({ id: n.id, rect: n.rect }));
}


export function align(nodes: readonly Placed[], edge: AlignEdge): Map<string, Point> {
  const out = new Map<string, Point>();
  if (nodes.length < 2) return out;

  const left = Math.min(...nodes.map((n) => n.rect.x));
  const right = Math.max(...nodes.map((n) => n.rect.x + n.rect.w));
  const top = Math.min(...nodes.map((n) => n.rect.y));
  const bottom = Math.max(...nodes.map((n) => n.rect.y + n.rect.h));

  for (const node of nodes) {
    const c = rectCenter(node.rect);

    switch (edge) {
      case "left":
        out.set(node.id, { x: left + node.rect.w / 2, y: c.y });
        break;
      case "right":
        out.set(node.id, { x: right - node.rect.w / 2, y: c.y });
        break;
      case "center-x":
        out.set(node.id, { x: (left + right) / 2, y: c.y });
        break;
      case "top":
        out.set(node.id, { x: c.x, y: top + node.rect.h / 2 });
        break;
      case "bottom":
        out.set(node.id, { x: c.x, y: bottom - node.rect.h / 2 });
        break;
      case "middle-y":
        out.set(node.id, { x: c.x, y: (top + bottom) / 2 });
        break;
    }
  }

  return out;
}


export function distribute(
  nodes: readonly Placed[],
  axis: DistributeAxis,
): Map<string, Point> {
  const out = new Map<string, Point>();

  if (nodes.length < 3) return out;

  const horizontal = axis === "horizontal";
  const start = (n: Placed) => (horizontal ? n.rect.x : n.rect.y);
  const size = (n: Placed) => (horizontal ? n.rect.w : n.rect.h);

  const order = [...nodes].sort((a, b) => start(a) - start(b));

  const first = order[0]!;
  const last = order[order.length - 1]!;


  const span = start(last) + size(last) - start(first);
  const occupied = order.reduce((sum, n) => sum + size(n), 0);


  const gap = (span - occupied) / (order.length - 1);

  let cursor = start(first);
  for (const node of order) {
    const c = rectCenter(node.rect);
    const at = cursor + size(node) / 2;
    out.set(node.id, horizontal ? { x: at, y: c.y } : { x: c.x, y: at });
    cursor += size(node) + gap;
  }


  out.delete(first.id);
  out.delete(last.id);

  return out;
}


export function space(
  nodes: readonly Placed[],
  axis: DistributeAxis,
  gap: number,
): Map<string, Point> {
  const out = new Map<string, Point>();
  if (nodes.length < 2) return out;

  const horizontal = axis === "horizontal";
  const start = (n: Placed) => (horizontal ? n.rect.x : n.rect.y);
  const size = (n: Placed) => (horizontal ? n.rect.w : n.rect.h);

  const order = [...nodes].sort((a, b) => start(a) - start(b));

  let cursor = start(order[0]!);
  for (const node of order) {
    const c = rectCenter(node.rect);
    const at = cursor + size(node) / 2;
    out.set(node.id, horizontal ? { x: at, y: c.y } : { x: c.x, y: at });
    cursor += size(node) + gap;
  }

  return out;
}
