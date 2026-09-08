import type { Point, Rect } from "../core/model/geometry";


export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

export const IDENTITY: Viewport = { x: 0, y: 0, zoom: 1 };

export function clampZoom(z: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

export function worldToScreen(v: Viewport, p: Point): Point {
  return { x: p.x * v.zoom + v.x, y: p.y * v.zoom + v.y };
}

export function screenToWorld(v: Viewport, p: Point): Point {
  return { x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom };
}


export function zoomAt(v: Viewport, at: Point, factor: number): Viewport {
  const zoom = clampZoom(v.zoom * factor);
  if (zoom === v.zoom) return v;

  const world = screenToWorld(v, at);
  return { zoom, x: at.x - world.x * zoom, y: at.y - world.y * zoom };
}

export function pan(v: Viewport, dx: number, dy: number): Viewport {
  return { ...v, x: v.x + dx, y: v.y + dy };
}


export function visibleWorldRect(v: Viewport, width: number, height: number): Rect {
  const topLeft = screenToWorld(v, { x: 0, y: 0 });
  const bottomRight = screenToWorld(v, { x: width, y: height });
  return {
    x: topLeft.x,
    y: topLeft.y,
    w: bottomRight.x - topLeft.x,
    h: bottomRight.y - topLeft.y,
  };
}


export const MAX_FIT_ZOOM = 2.6;


export function fitBox(box: Rect, width: number, height: number, padding = 56): Viewport {
  const bw = Math.max(box.w, 1);
  const bh = Math.max(box.h, 1);

  const zoom = clampZoom(
    Math.min((width - padding * 2) / bw, (height - padding * 2) / bh, MAX_FIT_ZOOM),
  );

  return {
    zoom,
    x: width / 2 - (box.x + box.w / 2) * zoom,
    y: height / 2 - (box.y + box.h / 2) * zoom,
  };
}


export function centerOn(v: Viewport, p: Point, width: number, height: number): Viewport {
  return { ...v, x: width / 2 - p.x * v.zoom, y: height / 2 - p.y * v.zoom };
}


export function scrollIntoView(
  v: Viewport,
  box: Rect,
  width: number,
  height: number,
  margin = 40,
): Viewport {
  const topLeft = worldToScreen(v, { x: box.x, y: box.y });
  const bottomRight = worldToScreen(v, { x: box.x + box.w, y: box.y + box.h });

  let dx = 0;
  let dy = 0;

  if (topLeft.x < margin) dx = margin - topLeft.x;
  else if (bottomRight.x > width - margin) dx = width - margin - bottomRight.x;

  if (topLeft.y < margin) dy = margin - topLeft.y;
  else if (bottomRight.y > height - margin) dy = height - margin - bottomRight.y;

  return dx === 0 && dy === 0 ? v : pan(v, dx, dy);
}


export function screenPerWorld(v: Viewport): number {
  return v.zoom;
}


export function worldTolerance(v: Viewport, screenPx: number): number {
  return screenPx / Math.max(v.zoom, 1e-6);
}
