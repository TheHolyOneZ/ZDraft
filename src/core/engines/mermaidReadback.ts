import { distance, unionRects, type Point, type Rect } from "../model/geometry";


export function parseTranslate(transform: string | null | undefined): Point {
  if (!transform) return { x: 0, y: 0 };


  const m = /translate\(\s*([-\d.eE+]+)(?:[\s,]+([-\d.eE+]+))?\s*\)/.exec(transform);
  if (!m) return { x: 0, y: 0 };

  return { x: Number(m[1]) || 0, y: m[2] === undefined ? 0 : Number(m[2]) || 0 };
}

function num(el: Element, name: string, fallback = 0): number {
  const raw = el.getAttribute(name);
  if (raw === null) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}


export function pathPoints(d: string): Point[] {
  const out: Point[] = [];
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return out;

  let i = 0;
  let command = "";
  let x = 0;
  let y = 0;
  let startX = 0;
  let startY = 0;

  const take = () => Number(tokens[i++] ?? 0);
  const push = (px: number, py: number) => out.push({ x: px, y: py });

  while (i < tokens.length) {
    const token = tokens[i]!;
    if (/[a-zA-Z]/.test(token)) {
      command = token;
      i++;

      if (command === "Z" || command === "z") {
        x = startX;
        y = startY;
        continue;
      }
    }

    const relative = command === command.toLowerCase();
    const base = { x: relative ? x : 0, y: relative ? y : 0 };

    switch (command.toUpperCase()) {
      case "M":
      case "L":
      case "T": {
        x = base.x + take();
        y = base.y + take();
        push(x, y);
        if (command === "M" || command === "m") {
          startX = x;
          startY = y;

          command = relative ? "l" : "L";
        }
        break;
      }
      case "H": {
        x = base.x + take();
        push(x, y);
        break;
      }
      case "V": {
        y = base.y + take();
        push(x, y);
        break;
      }
      case "C": {
        for (let k = 0; k < 2; k++) push(base.x + take(), base.y + take());
        x = base.x + take();
        y = base.y + take();
        push(x, y);
        break;
      }
      case "S":
      case "Q": {
        push(base.x + take(), base.y + take());
        x = base.x + take();
        y = base.y + take();
        push(x, y);
        break;
      }
      case "A": {

        take();
        take();
        take();
        take();
        take();
        x = base.x + take();
        y = base.y + take();
        push(x, y);
        break;
      }
      default:

        i++;
        break;
    }
  }

  return out;
}


export function localBBox(el: Element): Rect | null {
  const shift = parseTranslate(el.getAttribute("transform"));
  const box = rawBBox(el);
  if (!box) return null;

  return { x: box.x + shift.x, y: box.y + shift.y, w: box.w, h: box.h };
}

function rawBBox(el: Element): Rect | null {
  switch (el.tagName.toLowerCase()) {
    case "rect":
      return { x: num(el, "x"), y: num(el, "y"), w: num(el, "width"), h: num(el, "height") };

    case "circle": {
      const r = num(el, "r");
      return { x: num(el, "cx") - r, y: num(el, "cy") - r, w: r * 2, h: r * 2 };
    }

    case "ellipse": {
      const rx = num(el, "rx");
      const ry = num(el, "ry");
      return { x: num(el, "cx") - rx, y: num(el, "cy") - ry, w: rx * 2, h: ry * 2 };
    }

    case "polygon":
    case "polyline": {
      const points = (el.getAttribute("points") ?? "")
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      const pairs: Point[] = [];
      for (let i = 0; i + 1 < points.length; i += 2) {
        pairs.push({ x: points[i]!, y: points[i + 1]! });
      }
      return pairs.length ? boundsOf(pairs) : null;
    }

    case "path": {
      const pts = pathPoints(el.getAttribute("d") ?? "");
      return pts.length ? boundsOf(pts) : null;
    }

    case "line":
      return boundsOf([
        { x: num(el, "x1"), y: num(el, "y1") },
        { x: num(el, "x2"), y: num(el, "y2") },
      ]);

    case "g": {
      const boxes: Rect[] = [];
      for (const child of Array.from(el.children)) {


        if (child.tagName.toLowerCase() === "text") continue;
        const box = localBBox(child);
        if (box) boxes.push(box);
      }
      return boxes.length ? unionRects(boxes) : null;
    }

    default:
      return null;
  }
}

function boundsOf(points: readonly Point[]): Rect {
  return unionRects(points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 })));
}


const NODE_ID_PREFIXES = ["flowchart-", "classId-", "entity-", "state-", "node-"];


export function nodeIdFromDomId(domId: string, renderId: string): string | null {
  let rest = domId;
  if (renderId && rest.startsWith(`${renderId}-`)) rest = rest.slice(renderId.length + 1);

  for (const prefix of NODE_ID_PREFIXES) {
    if (rest.startsWith(prefix)) {
      rest = rest.slice(prefix.length);
      break;
    }
  }


  const trimmed = rest.replace(/-\d+$/, "");
  return trimmed || null;
}


export function edgeEndpointsFromDomId(
  domId: string,
  renderId: string,
  known: ReadonlySet<string>,
): { from: string; to: string } | null {
  let rest = domId;
  if (renderId && rest.startsWith(`${renderId}-`)) rest = rest.slice(renderId.length + 1);

  const body = /^(?:L_|id_)(.*)$/.exec(rest)?.[1];
  if (!body) return null;

  const withoutIndex = body.replace(/_\d+$/, "");
  const parts = withoutIndex.split("_");

  for (let split = 1; split < parts.length; split++) {
    const from = normaliseEndpoint(parts.slice(0, split).join("_"), renderId);
    const to = normaliseEndpoint(parts.slice(split).join("_"), renderId);
    if (known.has(from) && known.has(to)) return { from, to };
  }

  return null;
}


function normaliseEndpoint(raw: string, renderId: string): string {
  for (const prefix of NODE_ID_PREFIXES) {
    if (raw.startsWith(prefix)) return nodeIdFromDomId(raw, renderId) ?? raw;
  }
  return raw;
}


export interface ReadNode {
  id: string;
  rect: Rect;

  text: string;
}

export interface ReadCluster {
  id: string;
  rect: Rect;
  label?: string;
}

export interface ReadEdge {

  from?: string;
  to?: string;
  points: Point[];
  labelAt?: Point;
  labelText?: string;

  index: number;
}

export interface ReadGeometry {
  nodes: ReadNode[];
  clusters: ReadCluster[];
  edges: ReadEdge[];
  bounds: Rect;
}


function textOf(el: Element | null): string {
  if (!el) return "";
  const rows = Array.from(el.querySelectorAll("tspan.text-outer-tspan"));
  if (rows.length > 0) return rows.map((r) => r.textContent ?? "").join("\n").trim();
  return (el.textContent ?? "").trim();
}

export function readMermaidGeometry(svg: Element, renderId: string): ReadGeometry {
  const nodes: ReadNode[] = [];
  const clusters: ReadCluster[] = [];
  const edges: ReadEdge[] = [];

  for (const el of Array.from(svg.querySelectorAll("g.node"))) {
    const domId = el.getAttribute("id") ?? "";
    const id = nodeIdFromDomId(domId, renderId);
    if (!id) continue;

    const at = parseTranslate(el.getAttribute("transform"));


    const shape = Array.from(el.children).find(
      (c) => !c.classList.contains("label") && c.tagName.toLowerCase() !== "text",
    );
    const box = shape ? localBBox(shape) : null;
    if (!box) continue;

    nodes.push({
      id,
      rect: { x: at.x + box.x, y: at.y + box.y, w: box.w, h: box.h },
      text: textOf(el.querySelector("g.label")),
    });
  }

  for (const el of Array.from(svg.querySelectorAll("g.cluster"))) {
    const domId = el.getAttribute("id") ?? "";
    const id = nodeIdFromDomId(domId, renderId);
    if (!id) continue;

    const at = parseTranslate(el.getAttribute("transform"));
    const rect = el.querySelector("rect");
    const box = rect ? localBBox(rect) : localBBox(el);
    if (!box) continue;

    clusters.push({
      id,
      rect: { x: at.x + box.x, y: at.y + box.y, w: box.w, h: box.h },
      label: textOf(el.querySelector("g.cluster-label")) || undefined,
    });
  }


  const labelsByDomId = new Map<string, { at: Point; text: string }>();
  const orphanLabels: Array<{ at: Point; text: string }> = [];

  for (const group of Array.from(svg.querySelectorAll("g.edgeLabel"))) {
    const at = parseTranslate(group.getAttribute("transform"));
    const inner = group.querySelector("g.label");
    const text = textOf(group);
    if (!text) continue;

    const dataId = inner?.getAttribute("data-id");
    if (dataId) labelsByDomId.set(dataId, { at, text });
    else orphanLabels.push({ at, text });
  }

  const known = new Set(nodes.map((n) => n.id));
  const paths = Array.from(svg.querySelectorAll("g.edgePaths path, g.edgePath path, path.relation"));

  paths.forEach((path, index) => {
    const points = pathPoints(path.getAttribute("d") ?? "");
    if (points.length < 2) return;

    const domId = path.getAttribute("id") ?? "";
    const bare = renderId && domId.startsWith(`${renderId}-`) ? domId.slice(renderId.length + 1) : domId;
    const label = labelsByDomId.get(bare) ?? labelsByDomId.get(domId);


    const endpoints = edgeEndpointsFromDomId(domId, renderId, known);

    edges.push({
      from: endpoints?.from,
      to: endpoints?.to,
      points,
      index,
      labelAt: label?.at,
      labelText: label?.text,
    });
  });

  const all: Rect[] = [
    ...nodes.map((n) => n.rect),
    ...clusters.map((c) => c.rect),
    ...edges.flatMap((e) => e.points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }))),
  ];

  return {
    nodes,
    clusters,
    edges,
    bounds: all.length ? unionRects(all) : { x: 0, y: 0, w: 0, h: 0 },
  };
}


export function nearestNode(point: Point, nodes: readonly ReadNode[]): string | null {
  let best: string | null = null;
  let bestDistance = Infinity;

  for (const node of nodes) {
    const clamped = {
      x: Math.min(Math.max(point.x, node.rect.x), node.rect.x + node.rect.w),
      y: Math.min(Math.max(point.y, node.rect.y), node.rect.y + node.rect.h),
    };
    const d = distance(point, clamped);
    if (d < bestDistance) {
      bestDistance = d;
      best = node.id;
    }
  }

  return best;
}
