import { scanD2, type D2Key } from "../locate/d2";
import type { NodeShape, SourceRange } from "../model/scene";
import { spliceAll, type LayoutKnob, type LayoutTuner, type SemanticEditor } from "./types";


const SHAPE_WORDS: Partial<Record<NodeShape, string>> = {
  rect: "rectangle",
  round: "rectangle",
  stadium: "oval",
  circle: "circle",
  ellipse: "oval",
  diamond: "diamond",
  hexagon: "hexagon",
  parallelogram: "parallelogram",
  cylinder: "cylinder",
  queue: "queue",
  package: "package",
  step: "step",
  callout: "callout",
  stored: "stored_data",
  person: "person",
  doc: "document",
  page: "page",
  cloud: "cloud",
  text: "text",
};

const SHAPES = Object.keys(SHAPE_WORDS) as NodeShape[];


const RESERVED = new Set([
  "shape",
  "label",
  "icon",
  "style",
  "near",
  "direction",
  "constraint",
  "width",
  "height",
  "top",
  "left",
  "link",
  "tooltip",
  "class",
  "classes",
  "layers",
  "scenarios",
  "steps",
  "vars",
  "grid-rows",
  "grid-columns",
]);


function segmentsFor(source: string, id: string): SourceRange[] {
  const wanted = id.split(".");
  const out: SourceRange[] = [];

  for (const key of scanD2(source)) {
    const resolved = key.path.split(".");
    const written = key.text.split(".");


    const offset = resolved.length - written.length;
    if (offset < 0) continue;


    const at = wanted.length - 1;
    if (at < offset) continue;


    if (resolved.slice(0, wanted.length).join(".") !== id) continue;

    const local = at - offset;
    if (local >= written.length) continue;


    let from = key.range.from;
    for (let i = 0; i < local; i += 1) from += written[i]!.length + 1;

    out.push({ from, to: from + written[local]!.length });
  }

  return out;
}


function declarationOf(source: string, id: string): D2Key | null {
  for (const key of scanD2(source)) {
    if (key.path === id && !key.isEdgeEnd) return key;
  }
  return null;
}


function settingOf(
  source: string,
  path: string,
  name: string,
): { value: SourceRange; whole: SourceRange } | null {
  const wanted = path ? `${path}.${name}` : name;

  for (const key of scanD2(source)) {
    if (key.path !== wanted || key.value === null) continue;
    return { value: key.value, whole: { from: key.range.from, to: key.value.to } };
  }
  return null;
}


function indentAt(source: string, at: number): string {
  const lineStart = source.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? "";
}


function endOfLine(source: string, at: number): number {
  const nl = source.indexOf("\n", at);
  return nl === -1 ? source.length : nl;
}


function asLabel(text: string): string {
  const trimmed = text.replace(/\n/g, "\\n");
  return /[{}:;#|<>&"'\n]|->|--/.test(trimmed) || trimmed !== trimmed.trim()
    ? `"${trimmed.replace(/"/g, '\\"')}"`
    : trimmed;
}

/* -------------------------------------------------------------------------- */
/* Tuning                                                                     */
/* -------------------------------------------------------------------------- */

const D2_KNOBS: readonly LayoutKnob[] = [
  {
    id: "direction",
    label: "Direction",
    note: "Which way the diagram flows. The single biggest change to how it reads.",
    kind: "choice",
    fallback: "down",
    choices: [
      { value: "down", label: "Top down" },
      { value: "right", label: "Left to right" },
      { value: "up", label: "Bottom to top" },
      { value: "left", label: "Right to left" },
    ],
  },
];

export const d2Tuner: LayoutTuner = {
  knobs: D2_KNOBS,

  read(source) {
    const out: Record<string, string> = {};
    for (const knob of D2_KNOBS) {
      const found = settingOf(source, "", knob.id);
      if (found) out[knob.id] = source.slice(found.value.from, found.value.to).trim();
    }
    return out;
  },

  set(source, knob, value) {
    const spec = D2_KNOBS.find((k) => k.id === knob);
    if (!spec) return null;

    const existing = settingOf(source, "", knob);

    /* Back to D2's own default: the line comes out rather than being written
       as the value it already had. A file restating defaults is noise in every
       diff from then on. */
    if (value === spec.fallback) {
      if (!existing) return { source, changed: [], label: `Set ${knob}` };

      const to = Math.min(endOfLine(source, existing.whole.to) + 1, source.length);
      const from = source.lastIndexOf("\n", existing.whole.from - 1) + 1;

      const { source: out, changed } = spliceAll(source, [{ range: { from, to }, text: "" }]);
      return { source: out, changed, label: `Reset ${knob}` };
    }

    if (existing) {
      const { source: out, changed } = spliceAll(source, [{ range: existing.value, text: value }]);
      return { source: out, changed, label: `Set ${knob} to ${value}` };
    }


    const { source: out, changed } = spliceAll(source, [
      { range: { from: 0, to: 0 }, text: `${knob}: ${value}\n` },
    ]);
    return { source: out, changed, label: `Set ${knob} to ${value}` };
  },
};

/* -------------------------------------------------------------------------- */
/* The editor                                                                 */
/* -------------------------------------------------------------------------- */

export const d2Editor: SemanticEditor = {
  shapes: SHAPES,
  tuning: d2Tuner,

  /**
   * A D2 id is a path, so each segment is checked in turn.
   *
   * The whole dotted form is legal and is what the properties bar shows for a
   * node inside a container — refusing it there would make every such node
   * unrenameable.
   */
  idProblem(name) {
    const trimmed = name.trim();
    if (trimmed === "") return "A name is needed.";
    if (/->|--|<-/.test(trimmed)) return "That looks like a connection, not a name.";

    for (const segment of trimmed.split(".")) {
      if (segment === "") return "A name cannot have an empty part between dots.";
      if (RESERVED.has(segment)) return `“${segment}” configures a shape in D2.`;
      if (/[{}:;#|<>]/.test(segment)) return "A D2 id cannot contain { } : ; # | < or >.";
    }
    return null;
  },

  rename(source, id, next) {
    const problem = d2Editor.idProblem(next);
    if (problem) return null;

    /* Only the name changes, never the container. `services.orders` may become
       `services.billing`; making it `platform.billing` would *move* the node,
       which means shifting its declaration into another block — a reorder, and
       the one thing a patch is supposed to avoid. */
    const parent = id.slice(0, id.lastIndexOf(".") + 1);
    if (!next.startsWith(parent) || next.slice(parent.length).includes(".")) return null;

    const ranges = segmentsFor(source, id);
    if (ranges.length === 0) return null;

    const local = next.slice(parent.length);
    const { source: out, changed } = spliceAll(
      source,
      ranges.map((range) => ({ range, text: local })),
    );
    return { source: out, changed, label: `Rename ${id} to ${next}` };
  },

  setLabel(source, id, next) {
    const declaration = declarationOf(source, id);
    if (!declaration) return null;

    const text = asLabel(next);

    /* An explicit `label:` wins over the inline one, so it is what gets
       changed when it exists — writing the inline form instead would leave two
       labels and D2 would draw the other one. */
    const explicit = settingOf(source, id, "label");
    if (explicit) {
      const { source: out, changed } = spliceAll(source, [{ range: explicit.value, text }]);
      return { source: out, changed, label: `Relabel ${id}` };
    }

    // The inline value: `orders: Orders` — everything after the colon, up to
    // the block or the end of the line.
    if (declaration.value) {
      const { source: out, changed } = spliceAll(source, [
        { range: declaration.value, text },
      ]);
      return { source: out, changed, label: `Relabel ${id}` };
    }

    // No value at all: `orders` or `orders: { … }`. Add the inline form.
    const at = declaration.range.to;
    const { source: out, changed } = spliceAll(source, [
      { range: { from: at, to: at }, text: `: ${text}` },
    ]);
    return { source: out, changed, label: `Relabel ${id}` };
  },

  setShape(source, id, next) {
    const word = SHAPE_WORDS[next];
    if (!word) return null;

    const declaration = declarationOf(source, id);
    if (!declaration) return null;

    const existing = settingOf(source, id, "shape");
    if (existing) {
      const { source: out, changed } = spliceAll(source, [{ range: existing.value, text: word }]);
      return { source: out, changed, label: `Reshape ${id}` };
    }

    /* Written as a dotted key on its own line rather than opened into a block.
       Adding `{ shape: … }` to a declaration that has none would reformat
       someone's line; a sibling statement says the same thing and leaves the
       file as it was. */
    const line = endOfLine(source, declaration.range.to);
    const indent = indentAt(source, declaration.range.from);
    const local = id.slice(id.lastIndexOf(".") + 1);

    const { source: out, changed } = spliceAll(source, [
      { range: { from: line, to: line }, text: `\n${indent}${local}.shape: ${word}` },
    ]);
    return { source: out, changed, label: `Reshape ${id}` };
  },
};
