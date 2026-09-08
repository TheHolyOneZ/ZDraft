import type { Point, Rect } from "../model/geometry";
import { unionRects } from "../model/geometry";
import { localBBox, pathPoints } from "./mermaidReadback";


export interface ReadPumlEntity {

  id: string;

  ref: string;
  rect: Rect;

  sourceLine?: number;

  text?: string;


  marker?: "start" | "end";
}

export interface ReadPumlLink {

  fromRef: string;
  toRef: string;
  points: Point[];
  label?: string;
  labelAt?: Point;
  sourceLine?: number;

  linkType?: string;

  arrowEnd: boolean;
}

export interface ReadPumlGeometry {
  entities: ReadPumlEntity[];
  clusters: ReadPumlEntity[];
  links: ReadPumlLink[];
  bounds: Rect;

  diagramType: string;
}


const GRAPH_TYPES = new Set(["DESCRIPTION", "CLASS", "STATE", "OBJECT", "DEPLOYMENT", "USECASE"]);

export function isGraphDiagramType(type: string): boolean {
  return GRAPH_TYPES.has(type.toUpperCase());
}

export function readPlantUmlGeometry(svg: Element): ReadPumlGeometry {
  const diagramType = svg.getAttribute("data-diagram-type") ?? "";

  const entities: ReadPumlEntity[] = [];
  const clusters: ReadPumlEntity[] = [];

  const selector = "g.entity, g.cluster, g.start_entity, g.end_entity";

  for (const el of Array.from(svg.querySelectorAll(selector))) {
    const id = el.getAttribute("data-qualified-name");
    const ref = el.getAttribute("id");
    if (!id || !ref) continue;

    const rect = localBBox(el);
    if (!rect || rect.w <= 0 || rect.h <= 0) continue;

    const read: ReadPumlEntity = {
      id,
      ref,
      rect,
      sourceLine: numberOr(el.getAttribute("data-source-line")),
      text: firstText(el),
      marker: el.classList.contains("start_entity")
        ? "start"
        : el.classList.contains("end_entity")
          ? "end"
          : undefined,
    };

    if (el.classList.contains("cluster")) clusters.push(read);
    else entities.push(read);
  }

  const links: ReadPumlLink[] = [];

  for (const el of Array.from(svg.querySelectorAll("g.link"))) {
    const fromRef = el.getAttribute("data-entity-1");
    const toRef = el.getAttribute("data-entity-2");
    if (!fromRef || !toRef) continue;

    const points = routeOf(el);
    if (points.length < 2) continue;

    const label = labelOf(el);

    links.push({
      fromRef,
      toRef,
      points,
      label: label?.text,
      labelAt: label?.at,
      sourceLine: numberOr(el.getAttribute("data-source-line")),
      linkType: el.getAttribute("data-link-type") ?? undefined,
      arrowEnd: el.querySelector("polygon") !== null,
    });
  }

  return {
    entities,
    clusters,
    links,
    bounds: boundsOf(svg, entities, clusters, links),
    diagramType,
  };
}


function routeOf(el: Element): Point[] {
  const path = el.querySelector("path");
  if (path) return pathPoints(path.getAttribute("d") ?? "");

  const line = el.querySelector("line");
  if (line) {
    return [
      { x: num(line, "x1"), y: num(line, "y1") },
      { x: num(line, "x2"), y: num(line, "y2") },
    ];
  }

  const poly = el.querySelector("polyline");
  if (!poly) return [];

  const numbers = (poly.getAttribute("points") ?? "").trim().split(/[\s,]+/).map(Number);
  const out: Point[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    out.push({ x: numbers[i]!, y: numbers[i + 1]! });
  }
  return out;
}


function labelOf(el: Element): { text: string; at: Point } | undefined {
  const texts = Array.from(el.querySelectorAll("text"));
  if (texts.length === 0) return undefined;

  const parts = texts.map((t) => t.textContent ?? "").filter((t) => t.trim() !== "");
  if (parts.length === 0) return undefined;

  const first = texts[0]!;
  const size = Number(first.getAttribute("font-size")) || 13;
  const x = num(first, "x");
  const y = num(first, "y");
  const width = Number(first.getAttribute("textLength")) || 0;

  return {
    text: parts.join(" ").trim(),


    at: { x: x + width / 2, y: y - size * 0.34 },
  };
}

function boundsOf(
  svg: Element,
  entities: readonly ReadPumlEntity[],
  clusters: readonly ReadPumlEntity[],
  links: readonly ReadPumlLink[],
): Rect {
  const viewBox = (svg.getAttribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (viewBox.length === 4 && viewBox.every((v) => Number.isFinite(v))) {
    return { x: viewBox[0]!, y: viewBox[1]!, w: viewBox[2]!, h: viewBox[3]! };
  }

  const rects: Rect[] = [
    ...entities.map((e) => e.rect),
    ...clusters.map((c) => c.rect),
    ...links.flatMap((l) => l.points.map((p) => ({ x: p.x, y: p.y, w: 0, h: 0 }))),
  ];
  return rects.length > 0 ? unionRects(rects) : { x: 0, y: 0, w: 0, h: 0 };
}


function firstText(el: Element): string | undefined {
  for (const text of Array.from(el.querySelectorAll("text"))) {
    const value = (text.textContent ?? "").trim();
    if (value !== "") return value;
  }
  return undefined;
}

function num(el: Element, name: string): number {
  const value = Number(el.getAttribute(name));
  return Number.isFinite(value) ? value : 0;
}

function numberOr(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
