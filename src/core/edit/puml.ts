import {
  KEYWORD_SHAPES,
  LINK,
  matchContainer,
  matchDeclaration,
  qualify,
  splitLines,
  stripComment,
} from "../locate/puml";
import type { NodeShape, SourceRange } from "../model/scene";
import { spliceAll, type LayoutKnob, type LayoutTuner, type SemanticEditor } from "./types";


const SHAPE_WORDS: Partial<Record<NodeShape, string>> = {
  rect: "rectangle",
  round: "state",
  circle: "circle",
  ellipse: "usecase",
  hexagon: "hexagon",
  cylinder: "database",
  stored: "storage",
  queue: "queue",
  package: "node",
  folder: "folder",
  cloud: "cloud",
  doc: "file",
  page: "collections",
  person: "actor",
  subroutine: "component",
  note: "annotation",
};


const DIRECTIVE =
  /^@(start|end)|^(skinparam|!|hide|show|scale|title|header|footer|legend|caption|note|end note|left to right|top to bottom|autonumber|allow_mixing|mainframe|together|newpage)\b/i;


interface Statement {

  text: string;

  offset: number;

  line: string;

  lead: number;

  scope: string[];
}


function* statements(source: string): Generator<Statement> {
  const scope: string[] = [];
  let inBody = false;
  let bodyDepth = 0;

  for (const { text, offset } of splitLines(source)) {
    const stripped = stripComment(text);
    const line = stripped.trim();
    if (line === "") continue;

    const lead = stripped.length - stripped.trimStart().length;

    if (inBody) {

      if (line.startsWith("}")) {
        bodyDepth -= 1;
        if (bodyDepth <= 0) inBody = false;
      } else if (line.endsWith("{")) {
        bodyDepth += 1;
      }
      continue;
    }

    if (line.startsWith("}")) {
      scope.pop();
      continue;
    }
    if (DIRECTIVE.test(line)) continue;

    yield { text, offset, line, lead, scope: [...scope] };

    const container = matchContainer(line);
    if (container) {
      scope.push(container.name);
      continue;
    }

    const declaration = matchDeclaration(line);
    if (declaration?.opensBody) {
      inBody = true;
      bodyDepth = 1;
    }
  }
}


function rangeIn(text: string, offset: number, needle: string, from = 0): SourceRange | null {
  const at = text.indexOf(needle, from);
  return at < 0 ? null : { from: offset + at, to: offset + at + needle.length };
}


function occurrences(source: string, id: string): SourceRange[] {
  const out: SourceRange[] = [];

  for (const statement of statements(source)) {
    const { text, offset, line, lead, scope } = statement;

    const container = matchContainer(line);
    if (container) {
      if (qualify(scope, container.name) === id) {
        const range = rangeIn(text, offset, container.name, lead);
        if (range) out.push(range);
      }
      continue;
    }

    const declaration = matchDeclaration(line);
    if (declaration) {
      if (qualify(scope, declaration.name) === id) {


        const as = /\bas\s+/i.exec(line);
        const from = as ? lead + as.index + as[0].length : lead;
        const range = rangeIn(text, offset, declaration.name, from);
        if (range) out.push(range);
      }
      continue;
    }

    const link = LINK.exec(line);
    if (link?.groups) {
      let from = lead;
      for (const end of ["a", "b"] as const) {
        const token = link.groups[end]!;
        const bare = unwrap(token);
        const range = rangeIn(text, offset, token, from);
        if (!range) continue;

        from = range.to - offset;
        if (qualify(scope, bare) === id) {

          const trim = token === bare ? 0 : 1;
          out.push({ from: range.from + trim, to: range.to - trim });
        }
      }
    }
  }

  return out;
}


function unwrap(token: string): string {
  return /^(\[.*\]|\(.*\)|:.*:|".*")$/.test(token) ? token.slice(1, -1) : token;
}


function declarationLine(source: string, id: string): Statement | null {
  for (const statement of statements(source)) {
    const declaration = matchDeclaration(statement.line);
    if (declaration && qualify(statement.scope, declaration.name) === id) return statement;
  }
  return null;
}


const PUML_KNOBS: readonly LayoutKnob[] = [
  {
    id: "direction",
    label: "Direction",
    note: "PlantUML lays out top to bottom unless told otherwise.",
    kind: "choice",
    fallback: "top to bottom direction",
    choices: [
      { value: "top to bottom direction", label: "Top down" },
      { value: "left to right direction", label: "Left to right" },
    ],
  },
];


const DIRECTION_LINE = /^[ \t]*(left to right|top to bottom) direction[ \t]*$/im;

export const pumlTuner: LayoutTuner = {
  knobs: PUML_KNOBS,

  read(source): Record<string, string> {
    const found = DIRECTION_LINE.exec(source);
    return found ? { direction: `${found[1]!.toLowerCase()} direction` } : {};
  },

  set(source, knob, value) {
    if (knob !== "direction") return null;

    const spec = PUML_KNOBS[0]!;
    const found = DIRECTION_LINE.exec(source);


    if (value === spec.fallback) {
      if (!found) return { source, changed: [], label: "Set direction" };

      const from = found.index;
      const to = Math.min(from + found[0].length + 1, source.length);
      const { source: out, changed } = spliceAll(source, [{ range: { from, to }, text: "" }]);
      return { source: out, changed, label: "Reset direction" };
    }

    if (found) {
      const { source: out, changed } = spliceAll(source, [
        { range: { from: found.index, to: found.index + found[0].length }, text: value },
      ]);
      return { source: out, changed, label: `Set direction to ${value}` };
    }


    const start = /^[ \t]*@start\w*.*$/im.exec(source);
    const at = start ? start.index + start[0].length : 0;

    const { source: out, changed } = spliceAll(source, [
      { range: { from: at, to: at }, text: `\n${value}` },
    ]);
    return { source: out, changed, label: `Set direction to ${value}` };
  },
};


export const pumlEditor: SemanticEditor = {
  shapes: Object.keys(SHAPE_WORDS) as NodeShape[],
  tuning: pumlTuner,

  idProblem(name) {
    const trimmed = name.trim();
    if (trimmed === "") return "A name is needed.";
    if (/\s/.test(trimmed)) return "A PlantUML name cannot contain a space. Use the label for that.";
    if (/["'{}[\]()<>:,;]/.test(trimmed)) {
      return "A PlantUML name cannot contain quotes, brackets or punctuation.";
    }
    if (KEYWORD_SHAPES[trimmed.toLowerCase()]) {
      return `“${trimmed}” is a PlantUML keyword.`;
    }
    return null;
  },

  rename(source, id, next) {
    if (pumlEditor.idProblem(next)) return null;


    const parent = id.slice(0, id.lastIndexOf(".") + 1);
    if (!next.startsWith(parent) || next.slice(parent.length).includes(".")) return null;

    const ranges = occurrences(source, id);
    if (ranges.length === 0) return null;

    const local = next.slice(parent.length);
    const { source: out, changed } = spliceAll(
      source,
      ranges.map((range) => ({ range, text: local })),
    );
    return { source: out, changed, label: `Rename ${id} to ${next}` };
  },

  setLabel(source, id, next) {
    const statement = declarationLine(source, id);
    if (!statement) return null;

    const { text, offset, line, lead } = statement;
    const declaration = matchDeclaration(line)!;
    const label = next.replace(/\n/g, "\\n");
    const quoted = `"${label.replace(/"/g, "'")}"`;

    // Already `keyword "Label" as name` — replace what is in the quotes.
    const existing = /"([^"]*)"/.exec(line);
    if (existing) {
      const at = lead + existing.index;
      const { source: out, changed } = spliceAll(source, [
        { range: { from: offset + at, to: offset + at + existing[0].length }, text: quoted },
      ]);
      return { source: out, changed, label: `Relabel ${id}` };
    }

    /* A bracket form carries its label between the brackets: `[Storefront]`.
       Renaming that text renames the node too, so an alias is added instead
       and the label goes where the label belongs. */
    if (/^(\[|\(|:)/.test(line)) {
      const closer = line[0] === "[" ? "]" : line[0] === "(" ? ")" : ":";
      const end = line.indexOf(closer, 1);
      if (end < 0) return null;

      const at = offset + lead;
      const opener = line[0]!;
      const { source: out, changed } = spliceAll(source, [
        {
          range: { from: at, to: at + end + 1 },
          text: `${opener}${label}${closer} as ${declaration.name}`,
        },
      ]);
      return { source: out, changed, label: `Relabel ${id}` };
    }

    // `component web` — the label has to be introduced along with the alias.
    const nameAt = rangeIn(text, offset, declaration.name, lead);
    if (!nameAt) return null;

    const { source: out, changed } = spliceAll(source, [
      { range: nameAt, text: `${quoted} as ${declaration.name}` },
    ]);
    return { source: out, changed, label: `Relabel ${id}` };
  },

  setShape(source, id, next) {
    const word = SHAPE_WORDS[next];
    if (!word) return null;

    const statement = declarationLine(source, id);
    if (!statement) return null;

    const { offset, line, lead } = statement;

    /* Only a keyword declaration can change shape. A bracket form *is* its
       shape — rewriting `[web]` as `database web` would be a bigger edit than
       the properties bar implies, so it is refused instead. */
    const keyword = /^(?:(?:abstract|static)\s+)?([A-Za-z_]+)\b/.exec(line);
    if (!keyword || !KEYWORD_SHAPES[keyword[1]!.toLowerCase()]) return null;

    const at = lead + keyword.index + keyword[0].length - keyword[1]!.length;
    const { source: out, changed } = spliceAll(source, [
      { range: { from: offset + at, to: offset + at + keyword[1]!.length }, text: word },
    ]);
    return { source: out, changed, label: `Reshape ${id}` };
  },
};
