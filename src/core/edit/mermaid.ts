import type { NodeShape, SourceRange } from "../model/scene";
import { spliceAll, type LayoutKnob, type LayoutTuner, type SemanticEditor } from "./types";


const FORMS: Array<{ open: string; close: string; shape: NodeShape }> = [
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "[/", close: "/]", shape: "parallelogram" },
  { open: "[\\", close: "\\]", shape: "trapezoid" },
  { open: "((", close: "))", shape: "circle" },
  { open: "([", close: "])", shape: "stadium" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "rect" },
  { open: "(", close: ")", shape: "round" },
  { open: "{", close: "}", shape: "diamond" },
];

const SHAPES = FORMS.map((f) => f.shape);


const KEYWORDS = new Set([
  "flowchart",
  "graph",
  "subgraph",
  "end",
  "direction",
  "classDef",
  "class",
  "style",
  "linkStyle",
  "click",
  "state",
  "note",
  "participant",
  "actor",
]);

interface Declaration {

  id: SourceRange;

  whole?: SourceRange;

  label?: SourceRange;
  form?: (typeof FORMS)[number];
}


function masked(source: string): string {
  const out = source.split("");
  let i = 0;

  while (i < source.length) {
    if (source.startsWith("%%", i)) {
      while (i < source.length && source[i] !== "\n") out[i++] = " ";
      continue;
    }
    if (source[i] === '"') {
      out[i++] = " ";
      while (i < source.length && source[i] !== '"') out[i++] = " ";
      if (i < source.length) out[i++] = " ";
      continue;
    }
    i += 1;
  }

  return out.join("");
}


export function idOccurrences(source: string, id: string): SourceRange[] {
  if (id === "") return [];

  const text = masked(source);
  const out: SourceRange[] = [];

  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|[^\\w.-])(${escaped})(?![\\w.-])`, "g");

  for (const match of text.matchAll(pattern)) {
    const from = match.index + match[1]!.length;

    if (insideLabel(text, from)) continue;
    out.push({ from, to: from + id.length });
  }

  return out;
}


function insideLabel(text: string, at: number): boolean {
  const lineStart = text.lastIndexOf("\n", at - 1) + 1;
  const line = text.slice(lineStart, at);

  let depth = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (ch === "[" || ch === "(" || ch === "{") depth += 1;
    else if (ch === "]" || ch === ")" || ch === "}") depth = Math.max(0, depth - 1);
  }
  return depth > 0;
}


function declarationOf(source: string, id: string): Declaration | null {
  const text = masked(source);

  for (const range of idOccurrences(source, id)) {
    const after = range.to;

    for (const form of FORMS) {
      if (!text.startsWith(form.open, after)) continue;

      const close = text.indexOf(form.close, after + form.open.length);
      if (close < 0) continue;

      return {
        id: range,
        whole: { from: range.from, to: close + form.close.length },
        label: { from: after + form.open.length, to: close },
        form,
      };
    }
  }


  const first = idOccurrences(source, id)[0];
  return first ? { id: first } : null;
}


function asLabel(text: string): string {
  return /[[\](){}|"<>]/.test(text) ? `"${text.replace(/"/g, "#quot;")}"` : text;
}

/** A subgraph id not already taken. */
function freeSubgraphName(source: string, title: string): string {
  const base = title.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "") || "group";
  if (idOccurrences(source, base).length === 0) return base;

  for (let n = 2; ; n += 1) {
    const candidate = `${base}_${n}`;
    if (idOccurrences(source, candidate).length === 0) return candidate;
  }
}

/**
 * Mermaid's layout parameters (§5's layout-tuning UI).
 *
 * Two different mechanisms behind one list, which is the point of the
 * abstraction. `direction` is a keyword on the diagram's own first line;
 * everything else lives in an `%%{init: …}%%` directive above it. Both are read
 * by Mermaid itself, so GitHub draws the diagram exactly as ZDraft does — which
 * is why these are source edits and not sidecar ones.
 */
const MERMAID_KNOBS: readonly LayoutKnob[] = [
  {
    id: "direction",
    label: "Direction",
    note: "Which way the flow runs. The single biggest change to how a diagram reads.",
    kind: "choice",
    fallback: "TD",
    choices: [
      { value: "TD", label: "Top down" },
      { value: "LR", label: "Left to right" },
      { value: "BT", label: "Bottom to top" },
      { value: "RL", label: "Right to left" },
    ],
  },
  {
    id: "nodeSpacing",
    label: "Node gap",
    note: "Pixels between nodes on the same rank.",
    kind: "number",
    fallback: "50",
    min: 10,
    max: 200,
    step: 5,
  },
  {
    id: "rankSpacing",
    label: "Rank gap",
    note: "Pixels between one rank and the next.",
    kind: "number",
    fallback: "50",
    min: 10,
    max: 300,
    step: 5,
  },
  {
    id: "curve",
    label: "Edges",
    note: "How edges bend. Linear suits architecture; basis suits a busy graph.",
    kind: "choice",
    fallback: "basis",
    choices: [
      { value: "basis", label: "Basis" },
      { value: "linear", label: "Straight" },
      { value: "step", label: "Orthogonal" },
      { value: "cardinal", label: "Cardinal" },
      { value: "monotoneX", label: "Monotone" },
    ],
  },
];

/** Everything but `direction` lives inside the init directive. */
const IN_INIT = new Set(["nodeSpacing", "rankSpacing", "curve"]);

/** The diagram's opening keyword and the direction that follows it. */
const HEADER = /^([ \t]*)(flowchart|graph)([ \t]+)(TB|TD|BT|RL|LR)?/m;

/** Mermaid's config directive, which must sit above the diagram keyword. */
const INIT = /^[ \t]*%%\{\s*init\s*:\s*(\{[\s\S]*?\})\s*\}%%[ \t]*\n?/m;

/**
 * The flowchart config Mermaid is currently given.
 *
 * Parsed with `JSON.parse` after the unquoted keys and single quotes Mermaid
 * tolerates are normalised. A directive ZDraft cannot read is left strictly
 * alone rather than rewritten — someone's hand-tuned `theme` block is not
 * ZDraft's to reformat.
 */
function readInit(source: string): { flowchart: Record<string, unknown>; whole: Record<string, unknown> } | null {
  const match = INIT.exec(source);
  if (!match) return null;

  try {
    const normalised = match[1]!
      .replace(/'/g, '"')
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)(\s*:)/g, '$1"$2"$3');

    const parsed = JSON.parse(normalised) as Record<string, unknown>;
    const flowchart = (parsed.flowchart ?? {}) as Record<string, unknown>;
    return { flowchart, whole: parsed };
  } catch {
    return null;
  }
}

export const mermaidTuner: LayoutTuner = {
  knobs: MERMAID_KNOBS,

  read(source) {
    const out: Record<string, string> = {};

    const header = HEADER.exec(source);
    // `graph TD` and `flowchart TD` mean the same thing here.
    if (header?.[4]) out.direction = header[4] === "TB" ? "TD" : header[4];

    const init = readInit(source);
    for (const knob of MERMAID_KNOBS) {
      if (!IN_INIT.has(knob.id)) continue;
      const value = init?.flowchart[knob.id];
      if (value !== undefined) out[knob.id] = String(value);
    }

    return out;
  },

  set(source, knob, value) {
    const spec = MERMAID_KNOBS.find((k) => k.id === knob);
    if (!spec) return null;

    if (knob === "direction") {
      const header = HEADER.exec(source);
      if (!header || header.index === undefined) return null;

      /* The keyword needs *a* direction — dropping it entirely would leave
         `flowchart` alone, which Mermaid rejects. So the default is written
         out here, unlike the init keys below. */
      const from = header.index + header[1]!.length + header[2]!.length + header[3]!.length;
      const to = from + (header[4]?.length ?? 0);

      const { source: out, changed } = spliceAll(source, [{ range: { from, to }, text: value }]);
      return { source: out, changed, label: `Set direction to ${value}` };
    }

    if (!IN_INIT.has(knob)) return null;

    const existing = readInit(source);
    const match = INIT.exec(source);

    // A directive ZDraft could not parse is not one it may rewrite.
    if (match && !existing) return null;

    const config = { ...(existing?.whole ?? {}) };
    const flowchart = { ...(existing?.flowchart ?? {}) };

    if (value === spec.fallback) delete flowchart[knob];
    else flowchart[knob] = spec.kind === "number" ? Number(value) : value;

    if (Object.keys(flowchart).length === 0) delete config.flowchart;
    else config.flowchart = flowchart;

    const label = value === spec.fallback ? `Reset ${knob}` : `Set ${knob} to ${value}`;

    /* Nothing left to say: the directive comes out entirely rather than being
       left as an empty `%%{init: {}}%%`, which is noise in every diff. */
    if (Object.keys(config).length === 0) {
      if (!match) return { source, changed: [], label };

      const { source: out, changed } = spliceAll(source, [
        { range: { from: match.index, to: match.index + match[0].length }, text: "" },
      ]);
      return { source: out, changed, label };
    }

    const directive = `%%{init: ${JSON.stringify(config)}}%%\n`;

    if (match) {
      const { source: out, changed } = spliceAll(source, [
        { range: { from: match.index, to: match.index + match[0].length }, text: directive },
      ]);
      return { source: out, changed, label };
    }

    // Above the diagram keyword, which is the only place Mermaid reads it.
    const header = HEADER.exec(source);
    const at = header?.index ?? 0;

    const { source: out, changed } = spliceAll(source, [
      { range: { from: at, to: at }, text: directive },
    ]);
    return { source: out, changed, label };
  },
};

export const mermaidEditor: SemanticEditor = {
  tuning: mermaidTuner,
  shapes: SHAPES,

  idProblem(name) {
    const trimmed = name.trim();
    if (trimmed === "") return "A name is needed.";
    if (KEYWORDS.has(trimmed)) return `“${trimmed}” is a Mermaid keyword.`;
    if (/[\s]/.test(trimmed)) return "A Mermaid id cannot contain a space.";
    if (/[[\](){}|"<>&;#]/.test(trimmed)) return "A Mermaid id cannot contain brackets or punctuation.";
    if (/^-/.test(trimmed)) return "A Mermaid id cannot start with a dash.";
    return null;
  },

  rename(source, id, next) {
    const trimmed = next.trim();
    if (trimmed === "" || trimmed === id) return null;

    const occurrences = idOccurrences(source, id);
    if (occurrences.length === 0) return null;

    const { source: out, changed } = spliceAll(
      source,
      occurrences.map((range) => ({ range, text: trimmed })),
    );

    return { source: out, changed, label: `Rename ${id} to ${trimmed}` };
  },

  setLabel(source, id, next) {
    const declaration = declarationOf(source, id);
    if (!declaration) return null;

    if (declaration.label) {
      const { source: out, changed } = spliceAll(source, [
        { range: declaration.label, text: asLabel(next) },
      ]);
      return { source: out, changed, label: `Relabel ${id}` };
    }

    /* No delimiters yet, so the node has never had a label. Giving it one means
       giving it a shape too — a rectangle, which is what Mermaid draws for a
       bare id anyway, so the picture does not change. */
    const { source: out, changed } = spliceAll(source, [
      { range: { from: declaration.id.to, to: declaration.id.to }, text: `[${asLabel(next)}]` },
    ]);
    return { source: out, changed, label: `Relabel ${id}` };
  },

  group(source, ids, title) {
    if (ids.length === 0) return null;

    /* Appended, because Mermaid claims a node by naming it inside the block —
       the declarations stay exactly where they were written. The trailing
       newline is only added when the file does not already end in one, so this
       never introduces a blank line at the end of someone's file. */
    const name = freeSubgraphName(source, title);
    const lead = source.endsWith("\n") ? "" : "\n";
    const body = ids.map((id) => `    ${id}`).join("\n");
    const block = `${lead}  subgraph ${name}[${asLabel(title)}]\n${body}\n  end\n`;

    const { source: out, changed } = spliceAll(source, [
      { range: { from: source.length, to: source.length }, text: block },
    ]);

    return { source: out, changed, label: `Group ${ids.length} nodes` };
  },

  setShape(source, id, next) {
    const form = FORMS.find((f) => f.shape === next);
    if (!form) return null;

    const declaration = declarationOf(source, id);
    if (!declaration) return null;

    // A node with no delimiters gets them, with its own id as the label —
    // which is what Mermaid was already drawing.
    const label =
      declaration.label && declaration.whole
        ? source.slice(declaration.label.from, declaration.label.to)
        : id;
    const range = declaration.whole ?? { from: declaration.id.to, to: declaration.id.to };
    const head = declaration.whole ? id : "";

    const { source: out, changed } = spliceAll(source, [
      { range, text: `${head}${form.open}${label}${form.close}` },
    ]);
    return { source: out, changed, label: `Reshape ${id}` };
  },
};
