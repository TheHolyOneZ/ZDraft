import { parse as parseToml } from "smol-toml";

import type { Annotation, EdgeHint, Layout, Pin, Sidecar } from "./types";


export class SidecarError extends Error {
  constructor(
    message: string,
    readonly remedy: string,
  ) {
    super(message);
    this.name = "SidecarError";
  }
}


const CONFLICT = /^<{7} |^={7}$|^>{7} /m;

export function parseSidecar(text: string): Sidecar {
  if (CONFLICT.test(text)) {
    throw new SidecarError(
      "This layout file has an unresolved merge conflict in it.",
      "Open the diagram in ZDraft to resolve it, or fix the markers by hand.",
    );
  }

  let raw: unknown;
  try {
    raw = parseToml(text);
  } catch (e) {
    throw new SidecarError(
      `This layout file is not valid TOML: ${(e as Error).message}`,
      "Delete it to go back to pure auto-layout — nothing else depends on it.",
    );
  }

  const table = asTable(raw);

  return {
    version: num(table.version) ?? 1,
    ...readLayout(table),
    blocks: Object.fromEntries(
      Object.entries(asTable(table.blocks)).map(([id, value]) => [id, readLayout(asTable(value))]),
    ),
  };
}

function readLayout(table: Record<string, unknown>): Layout {
  return {
    engine: str(table.engine) ?? null,
    theme: readTheme(table.theme),
    pins: mapValues(asTable(table.pins), readPin),
    edges: mapValues(asTable(table.edges), readEdge),
    sequence: readSequence(table.sequence),
    annotations: mapValues(asTable(table.annotations), readAnnotation),
  };
}

function readTheme(value: unknown): Layout["theme"] {
  const name = str(asTable(value).name);
  return name ? { name } : null;
}


function readPin(value: unknown): Pin | null {
  const table = asTable(value);
  const x = num(table.x);
  const y = num(table.y);
  if (x === null || y === null) return null;

  return {
    x,
    y,
    fingerprint: str(table.fingerprint) ?? null,
    auto: point(table.auto),
  };
}

function readEdge(value: unknown): EdgeHint | null {
  const table = asTable(value);
  const waypoints = points(table.waypoints);
  const offset = point(table.label_offset);

  if (waypoints.length === 0 && !offset) return null;
  return { waypoints, label_offset: offset };
}

function readSequence(value: unknown): Layout["sequence"] {
  const table = asTable(value);

  const order = Array.isArray(table.lifeline_order)
    ? table.lifeline_order.filter((id): id is string => typeof id === "string")
    : [];
  const lifelineGap = numbers(table.lifeline_gap);
  const messageGap = numbers(table.message_gap);

  if (order.length === 0 && !Object.keys(lifelineGap).length && !Object.keys(messageGap).length) {
    return null;
  }

  return { lifeline_order: order, lifeline_gap: lifelineGap, message_gap: messageGap };
}

const KINDS = new Set(["note", "arrow", "highlight", "stroke"]);

function readAnnotation(value: unknown): Annotation | null {
  const table = asTable(value);

  const kind = str(table.kind);
  const at = point(table.at);

  if (!kind || !KINDS.has(kind) || !at) return null;

  return {
    kind: kind as Annotation["kind"],
    at,
    size: point(table.size),
    points: points(table.points),
    text: str(table.text) ?? null,
    color: str(table.color) ?? null,
    anchor: str(table.anchor) ?? null,
  };
}


function asTable(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function num(value: unknown): number | null {

  const parsed = typeof value === "bigint" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function point(value: unknown): [number, number] | null {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = num(value[0]);
  const y = num(value[1]);
  return x === null || y === null ? null : [x, y];
}

function points(value: unknown): Array<[number, number]> {
  if (!Array.isArray(value)) return [];
  return value.map(point).filter((p): p is [number, number] => p !== null);
}

function numbers(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(asTable(value))) {
    const parsed = num(raw);
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}


function mapValues<T>(
  table: Record<string, unknown>,
  read: (value: unknown) => T | null,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [key, value] of Object.entries(table)) {
    const parsed = read(value);
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}
