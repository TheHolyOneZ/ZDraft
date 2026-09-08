import { tokenizeDot, type DotToken } from "../locate/dot";
import type { NodeShape, SourceRange } from "../model/scene";
import { spliceAll, type LayoutKnob, type LayoutTuner, type SemanticEditor } from "./types";


const KEYWORDS = new Set(["graph", "digraph", "subgraph", "node", "edge", "strict"]);


const ID_VALUED = new Set(["ltail", "lhead", "root"]);


const SHAPE_WORDS: Partial<Record<NodeShape, string>> = {
  rect: "box",
  round: "box",
  stadium: "box",
  circle: "circle",
  ellipse: "ellipse",
  diamond: "diamond",
  hexagon: "hexagon",
  parallelogram: "parallelogram",
  trapezoid: "trapezium",
  cylinder: "cylinder",
  note: "note",
  folder: "folder",
  doc: "note",
  subroutine: "component",
  triangle: "triangle",
  step: "house",
  package: "box3d",
  text: "plaintext",
};

const SHAPES = Object.keys(SHAPE_WORDS) as NodeShape[];


export function idOccurrences(source: string, id: string): SourceRange[] {
  const tokens = tokenizeDot(source);
  const out: SourceRange[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.kind !== "id" || token.value !== id) continue;
    if (KEYWORDS.has(token.value.toLowerCase())) continue;


    const before = tokens[i - 1];
    if (before?.value === "=") {
      const name = tokens[i - 2];
      if (!name || !ID_VALUED.has(name.value.toLowerCase())) continue;
    }


    const after = tokens[i + 1];
    if (after?.value === "=" && insideAttrList(tokens, i)) continue;

    out.push({ from: token.from, to: token.to });
  }

  return out;
}

function insideAttrList(tokens: readonly DotToken[], index: number): boolean {
  let depth = 0;
  for (let i = index; i >= 0; i -= 1) {
    const value = tokens[i]!.value;
    if (value === "]") depth += 1;
    if (value === "[") {
      if (depth === 0) return true;
      depth -= 1;
    }
  }
  return false;
}


function attrListOf(
  source: string,
  id: string,
): { open: number; close: number; declaration: SourceRange } | null {
  const tokens = tokenizeDot(source);

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (token.kind !== "id" || token.value !== id) continue;
    if (KEYWORDS.has(token.value.toLowerCase())) continue;

    const next = tokens[i + 1];
    if (next?.value !== "[") continue;


    const previous = tokens[i - 1];
    if (previous?.kind === "edgeop") continue;

    let depth = 0;
    for (let j = i + 1; j < tokens.length; j += 1) {
      if (tokens[j]!.value === "[") depth += 1;
      if (tokens[j]!.value === "]") {
        depth -= 1;
        if (depth === 0) {
          return {
            open: next.to,
            close: tokens[j]!.from,
            declaration: { from: token.from, to: token.to },
          };
        }
      }
    }
  }

  return null;
}


function attributeIn(
  source: string,
  open: number,
  close: number,
  name: string,
): { value: SourceRange } | null {
  const tokens = tokenizeDot(source.slice(open, close));

  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i]!.kind !== "id" || tokens[i]!.value.toLowerCase() !== name) continue;
    if (tokens[i + 1]?.value !== "=") continue;

    const value = tokens[i + 2];
    if (!value) return null;


    return { value: { from: open + value.from, to: open + value.to } };
  }

  return null;
}


function asId(value: string): string {
  return /^[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*$/.test(value)
    ? value
    : `"${value.replace(/(["\\])/g, "\\$1")}"`;
}

function quoted(value: string): string {
  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
}


function insertAttribute(
  source: string,
  id: string,
  text: string,
): { range: SourceRange; text: string } | null {
  const list = attrListOf(source, id);
  if (list) {
    const body = source.slice(list.open, list.close).trim();
    return {
      range: { from: list.open, to: list.close },
      text: body === "" ? text : `${body}, ${text}`,
    };
  }

  const occurrences = idOccurrences(source, id);
  const first = occurrences[0];
  if (!first) return null;

  return { range: { from: first.to, to: first.to }, text: ` [${text}]` };
}


function indentAt(source: string, at: number): string {
  const lineStart = source.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? "";
}


function freeClusterName(source: string, title: string): string {
  const base = `cluster_${title.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "") || "group"}`;
  if (!new RegExp(`\\b${base}\\b`).test(source)) return base;

  for (let n = 2; ; n += 1) {
    const candidate = `${base}_${n}`;
    if (!new RegExp(`\\b${candidate}\\b`).test(source)) return candidate;
  }
}


const DOT_KNOBS: readonly LayoutKnob[] = [
  {
    id: "rankdir",
    label: "Direction",
    note: "Which way the ranks run. The single biggest change to how a graph reads.",
    kind: "choice",
    fallback: "TB",
    choices: [
      { value: "TB", label: "Top to bottom" },
      { value: "LR", label: "Left to right" },
      { value: "BT", label: "Bottom to top" },
      { value: "RL", label: "Right to left" },
    ],
  },
  {
    id: "nodesep",
    label: "Node gap",
    note: "Inches between nodes on the same rank.",
    kind: "number",
    fallback: "0.25",
    min: 0.05,
    max: 3,
    step: 0.05,
  },
  {
    id: "ranksep",
    label: "Rank gap",
    note: "Inches between one rank and the next.",
    kind: "number",
    fallback: "0.5",
    min: 0.05,
    max: 4,
    step: 0.05,
  },
  {
    id: "splines",
    label: "Edges",
    note: "How edges are drawn. Orthogonal suits architecture; curved suits state machines.",
    kind: "choice",
    fallback: "spline",
    choices: [
      { value: "spline", label: "Splines" },
      { value: "ortho", label: "Orthogonal" },
      { value: "polyline", label: "Polyline" },
      { value: "curved", label: "Curved" },
      { value: "line", label: "Straight" },
    ],
  },
  {
    id: "concentrate",
    label: "Merge edges",
    note: "Draws parallel edges as one where it can. Tidies a hub with a dozen arrows into it.",
    kind: "choice",
    fallback: "false",
    choices: [
      { value: "false", label: "No" },
      { value: "true", label: "Yes" },
    ],
  },
];


function graphAttribute(
  source: string,
  name: string,
): { value: SourceRange; whole: SourceRange } | null {
  const tokens = tokenizeDot(source);
  let depth = 0;

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i]!;

    if (token.kind === "punct" && token.value === "{") depth += 1;
    else if (token.kind === "punct" && token.value === "}") depth -= 1;

    if (depth !== 1 || token.kind !== "id") continue;
    if (token.value.toLowerCase() !== name) continue;
    if (insideAttrList(tokens, i)) continue;

    const equals = tokens[i + 1];
    const value = tokens[i + 2];
    if (equals?.kind !== "punct" || equals.value !== "=" || !value) continue;

    return {
      value: { from: value.from, to: value.to },
      whole: { from: token.from, to: value.to },
    };
  }

  return null;
}

export const dotTuner: LayoutTuner = {
  knobs: DOT_KNOBS,

  read(source) {
    const out: Record<string, string> = {};
    for (const knob of DOT_KNOBS) {
      const found = graphAttribute(source, knob.id);
      if (found) out[knob.id] = unquote(source.slice(found.value.from, found.value.to));
    }
    return out;
  },

  set(source, knob, value) {
    const spec = DOT_KNOBS.find((k) => k.id === knob);
    if (!spec) return null;

    const existing = graphAttribute(source, knob);
    const text = asId(value);


    if (value === spec.fallback) {
      if (!existing) return { source, changed: [], label: `Set ${knob}` };

      const line = lineAround(source, existing.whole);
      const { source: out, changed } = spliceAll(source, [{ range: line, text: "" }]);
      return { source: out, changed, label: `Reset ${knob}` };
    }

    if (existing) {
      const { source: out, changed } = spliceAll(source, [
        { range: existing.value, text },
      ]);
      return { source: out, changed, label: `Set ${knob} to ${value}` };
    }


    const open = source.indexOf("{");
    if (open < 0) return null;

    const indent = indentAt(source, source.indexOf("\n", open) + 1) || "  ";
    const { source: out, changed } = spliceAll(source, [
      { range: { from: open + 1, to: open + 1 }, text: `\n${indent}${knob}=${text};` },
    ]);

    return { source: out, changed, label: `Set ${knob} to ${value}` };
  },
};


function lineAround(source: string, range: SourceRange): SourceRange {
  let from = range.from;
  while (from > 0 && source[from - 1] !== "\n") {

    if (!/\s/.test(source[from - 1]!)) return { from: range.from, to: semicolonAfter(source, range.to) };
    from -= 1;
  }

  let to = semicolonAfter(source, range.to);
  while (to < source.length && source[to] !== "\n" && /\s/.test(source[to]!)) to += 1;
  if (source[to] === "\n") to += 1;

  return { from, to };
}

function semicolonAfter(source: string, at: number): number {
  let to = at;
  while (to < source.length && /[ \t]/.test(source[to]!)) to += 1;
  return source[to] === ";" ? to + 1 : at;
}

function unquote(value: string): string {
  const trimmed = value.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"')
    ? trimmed.slice(1, -1).replace(/\\"/g, '"')
    : trimmed;
}

export const dotEditor: SemanticEditor = {
  shapes: SHAPES,
  tuning: dotTuner,

  idProblem(name) {
    const trimmed = name.trim();
    if (trimmed === "") return "A name is needed.";
    if (KEYWORDS.has(trimmed.toLowerCase())) return `“${trimmed}” is a DOT keyword.`;
    if (/[{}[\];,=]/.test(trimmed)) return "A DOT id cannot contain { } [ ] ; , or =.";
    if (/^[0-9]/.test(trimmed)) return "A DOT id cannot start with a digit.";
    return null;
  },

  rename(source, id, next) {
    const trimmed = next.trim();
    if (trimmed === "" || trimmed === id) return null;

    const occurrences = idOccurrences(source, id);
    if (occurrences.length === 0) return null;

    const text = asId(trimmed);
    const { source: out, changed } = spliceAll(
      source,
      occurrences.map((range) => ({ range, text })),
    );

    return { source: out, changed, label: `Rename ${id} to ${trimmed}` };
  },

  setLabel(source, id, next) {
    const list = attrListOf(source, id);

    if (list) {
      const existing = attributeIn(source, list.open, list.close, "label");
      if (existing) {


        const { source: out, changed } = spliceAll(source, [
          { range: existing.value, text: quoted(next) },
        ]);
        return { source: out, changed, label: `Relabel ${id}` };
      }
    }

    const insert = insertAttribute(source, id, `label=${quoted(next)}`);
    if (!insert) return null;

    const { source: out, changed } = spliceAll(source, [insert]);
    return { source: out, changed, label: `Relabel ${id}` };
  },

  group(source, ids, title) {
    if (ids.length === 0) return null;


    const close = source.lastIndexOf("}");
    if (close < 0) return null;

    const name = freeClusterName(source, title);
    const indent = indentAt(source, close) + "  ";
    const inner = ids.map((id) => `${indent}  ${asId(id)};`).join("\n");

    const block =
      `\n${indent}subgraph ${name} {\n` +
      `${indent}  label=${quoted(title)};\n` +
      `${inner}\n` +
      `${indent}}\n`;

    const { source: out, changed } = spliceAll(source, [
      { range: { from: close, to: close }, text: block },
    ]);

    return { source: out, changed, label: `Group ${ids.length} nodes` };
  },

  setShape(source, id, next) {
    const word = SHAPE_WORDS[next];
    if (!word) return null;

    const list = attrListOf(source, id);
    if (list) {
      const existing = attributeIn(source, list.open, list.close, "shape");
      if (existing) {
        const { source: out, changed } = spliceAll(source, [
          { range: existing.value, text: word },
        ]);
        return { source: out, changed, label: `Reshape ${id}` };
      }
    }

    const insert = insertAttribute(source, id, `shape=${word}`);
    if (!insert) return null;

    const { source: out, changed } = spliceAll(source, [insert]);
    return { source: out, changed, label: `Reshape ${id}` };
  },
};
