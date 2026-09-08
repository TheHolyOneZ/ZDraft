import type { Layout, Pin } from "../sidecar/types";
import type { NodeShape } from "../model/scene";
import type { ImportedModel, ImportedNode } from "./types";


export interface EmitResult {
  source: string;
  layout: Layout;

  ids: Map<string, string>;
}


const FORMS: Partial<Record<NodeShape, [string, string]>> = {
  rect: ["[", "]"],
  round: ["(", ")"],
  stadium: ["([", "])"],
  circle: ["((", "))"],
  ellipse: ["((", "))"],
  diamond: ["{", "}"],
  hexagon: ["{{", "}}"],
  cylinder: ["[(", ")]"],
  parallelogram: ["[/", "/]"],
  trapezoid: ["[/", "\\]"],
  subroutine: ["[[", "]]"],
  note: [">", "]"],
};

export function emitMermaid(model: ImportedModel): EmitResult {
  const ids = assignIds(model.nodes);
  const lines: string[] = ["flowchart TD"];

  const byParent = new Map<string | undefined, ImportedNode[]>();
  for (const node of model.nodes) {
    const key = node.parent;
    const list = byParent.get(key) ?? [];
    list.push(node);
    byParent.set(key, list);
  }

  for (const node of byParent.get(undefined) ?? []) {
    lines.push(`  ${declare(node, ids)}`);
  }


  for (const group of model.groups) {
    const members = byParent.get(group.id) ?? [];
    if (members.length === 0) continue;

    lines.push("");
    lines.push(`  subgraph ${slug(`group_${group.label || group.id}`)}[${label(group.label)}]`);
    for (const node of members) lines.push(`    ${declare(node, ids)}`);
    lines.push("  end");
  }

  if (model.edges.length > 0) lines.push("");

  for (const edge of model.edges) {
    const from = ids.get(edge.from);
    const to = ids.get(edge.to);
    if (!from || !to) continue;

    const arrow = edge.dashed ? "-.->" : "-->";
    lines.push(
      edge.label
        ? `  ${from} ${arrow}|${label(edge.label)}| ${to}`
        : `  ${from} ${arrow} ${to}`,
    );
  }

  return {
    source: `${lines.join("\n")}\n`,
    layout: { pins: pinsFor(model.nodes, ids) },
    ids,
  };
}

function declare(node: ImportedNode, ids: Map<string, string>): string {
  const id = ids.get(node.id)!;
  const [open, close] = FORMS[node.shape] ?? FORMS.rect!;
  return `${id}${open}${label(node.label)}${close}`;
}


function pinsFor(nodes: readonly ImportedNode[], ids: Map<string, string>): Record<string, Pin> {
  if (nodes.length === 0) return {};

  const left = Math.min(...nodes.map((n) => n.x));
  const top = Math.min(...nodes.map((n) => n.y));

  const pins: Record<string, Pin> = {};
  for (const node of nodes) {
    const id = ids.get(node.id);
    if (!id) continue;

    pins[id] = {
      x: Math.round(node.x - left + node.w / 2),
      y: Math.round(node.y - top + node.h / 2),


      fingerprint: null,
      auto: null,
    };
  }

  return pins;
}


function assignIds(nodes: readonly ImportedNode[]): Map<string, string> {
  const taken = new Set<string>();
  const ids = new Map<string, string>();

  nodes.forEach((node, index) => {
    const base = slug(node.label) || `n${index + 1}`;

    let id = base;
    let suffix = 2;
    while (taken.has(id)) id = `${base}${suffix++}`;

    taken.add(id);
    ids.set(node.id, id);
  });

  return ids;
}


function slug(text: string): string {
  const cleaned = text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);

  if (!cleaned) return "";

  return /^[0-9]/.test(cleaned) ? `n${cleaned}` : cleaned;
}


function label(text: string): string {
  const escaped = text
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br/>")
    .trim();

  return `"${escaped}"`;
}
