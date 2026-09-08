import {
  HighlightStyle,
  StreamLanguage,
  syntaxHighlighting,
  type StreamParser,
} from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import type { Extension } from "@codemirror/state";


const DOT_KEYWORDS = new Set(["digraph", "graph", "subgraph", "node", "edge", "strict"]);

const DOT_ATTRS = new Set([
  "label", "shape", "style", "color", "fillcolor", "fontcolor", "fontname", "fontsize",
  "rankdir", "rank", "penwidth", "arrowhead", "arrowtail", "dir", "width", "height",
  "constraint", "weight", "cluster", "bgcolor", "margin", "nodesep", "ranksep", "splines",
  "class", "id", "tooltip", "peripheries", "orientation", "sides", "distortion", "skew",
]);

interface DotState {

  inAttrs: boolean;

  afterEquals: boolean;
}

export const dotSpec: StreamParser<DotState> = {
  name: "dot",

  startState: () => ({ inAttrs: false, afterEquals: false }),

  token(stream, state) {
    if (stream.eatSpace()) return null;


    if (stream.match("//") || stream.match("#")) {
      stream.skipToEnd();
      return "comment";
    }
    if (stream.match("/*")) {
      while (!stream.eol()) {
        if (stream.match("*/")) break;
        stream.next();
      }
      return "comment";
    }


    if (stream.peek() === '"') {
      stream.next();
      let escaped = false;
      while (!stream.eol()) {
        const ch = stream.next();
        if (escaped) {
          escaped = false;
          continue;
        }
        if (ch === "\\") escaped = true;
        else if (ch === '"') break;
      }
      state.afterEquals = false;
      return "string";
    }


    if (stream.match("->") || stream.match("--")) {
      return "operator";
    }

    if (stream.match("[")) {
      state.inAttrs = true;
      return "bracket";
    }
    if (stream.match("]")) {
      state.inAttrs = false;
      state.afterEquals = false;
      return "bracket";
    }
    if (stream.match("{") || stream.match("}")) return "bracket";

    if (stream.match("=")) {
      state.afterEquals = true;
      return "operator";
    }
    if (stream.match(";") || stream.match(",") || stream.match(":")) {
      state.afterEquals = false;
      return "punctuation";
    }

    if (stream.match(/^[0-9]+(\.[0-9]+)?/)) {
      state.afterEquals = false;
      return "number";
    }

    const word = stream.match(/^([A-Za-z_-￿][A-Za-z0-9_-￿]*)/);


    if (word && word !== true) {
      const text = word[0].toLowerCase();
      const wasAfterEquals = state.afterEquals;
      state.afterEquals = false;

      if (DOT_KEYWORDS.has(text)) return "keyword";
      if (wasAfterEquals) return "string";
      if (state.inAttrs && DOT_ATTRS.has(text)) return "propertyName";
      if (state.inAttrs) return "attributeName";


      return "variableName";
    }

    stream.next();
    return null;
  },
};

export const dotLanguage = StreamLanguage.define(dotSpec);


export const zdraftHighlight = HighlightStyle.define([
  { tag: t.comment, color: "var(--text-3)", fontStyle: "italic" },
  { tag: t.string, color: "var(--ok)" },
  { tag: t.keyword, color: "var(--accent)", fontWeight: "600" },
  { tag: t.operator, color: "var(--pin)" },
  { tag: t.number, color: "var(--warn)" },
  { tag: t.propertyName, color: "var(--text-2)" },
  { tag: t.attributeName, color: "var(--text-2)" },
  { tag: t.variableName, color: "var(--text)" },
  { tag: t.bracket, color: "var(--text-3)" },
  { tag: t.punctuation, color: "var(--text-3)" },


  { tag: t.heading, color: "var(--text)", fontWeight: "600" },
  { tag: t.quote, color: "var(--text-2)", fontStyle: "italic" },
  { tag: t.list, color: "var(--accent)" },
  { tag: t.monospace, color: "var(--text-2)" },
  { tag: t.strong, color: "var(--text)", fontWeight: "600" },
  { tag: t.emphasis, color: "var(--text)", fontStyle: "italic" },
  { tag: t.link, color: "var(--accent)" },
  { tag: t.meta, color: "var(--text-3)" },
]);


const MERMAID_KEYWORDS = new Set([
  "flowchart", "graph", "subgraph", "end", "direction",
  "stateDiagram", "stateDiagram-v2", "classDiagram", "erDiagram", "sequenceDiagram",
  "gantt", "pie", "journey", "mindmap", "timeline", "gitGraph", "quadrantChart",
  "requirementDiagram", "C4Context", "C4Container", "C4Component", "C4Deployment",
  "class", "classDef", "style", "linkStyle", "click", "participant", "actor",
  "activate", "deactivate", "note", "loop", "alt", "else", "opt", "par", "and",
  "critical", "break", "rect", "autonumber", "title", "section", "state",
]);

interface MermaidState {

  inLabel: boolean;
  closer: string;
}

export const mermaidSpec: StreamParser<MermaidState> = {
  name: "mermaid",

  startState: () => ({ inLabel: false, closer: "" }),

  token(stream, state) {
    if (stream.eatSpace()) return null;


    if (stream.match("%%")) {
      stream.skipToEnd();
      return "comment";
    }

    if (state.inLabel) {

      if (stream.match(state.closer)) {
        state.inLabel = false;
        state.closer = "";
        return "bracket";
      }
      stream.next();
      return "string";
    }

    if (stream.peek() === '"') {
      stream.next();
      while (!stream.eol()) {
        if (stream.next() === '"') break;
      }
      return "string";
    }


    if (stream.match(/^(?:<?(?:-{2,}|-\.+-|={2,}|~{3,})>?|<-{2,}>?|\|{1}|-->|\.->)/)) {
      return "operator";
    }


    if (stream.match(/^(?:->>|-->>|-\)|--\)|-x|--x|->|-->)/)) return "operator";


    for (const [open, close] of [
      ["[[", "]]"], ["[(", ")]"], ["[/", "/]"], ["[\\", "\\]"],
      ["((", "))"], ["([", "])"], ["{{", "}}"], ["[", "]"], ["(", ")"], ["{", "}"],
    ] as const) {
      if (stream.match(open)) {
        state.inLabel = true;
        state.closer = close;
        return "bracket";
      }
    }

    if (stream.match(/^[0-9]+(?:\.[0-9]+)?/)) return "number";

    const word = stream.match(/^([A-Za-z_][\w-]*)/);
    if (word && word !== true) {
      return MERMAID_KEYWORDS.has(word[0]) ? "keyword" : "variableName";
    }

    stream.next();
    return null;
  },
};

export const mermaidLanguage = StreamLanguage.define(mermaidSpec);


const D2_KEYWORDS = new Set([
  "shape", "label", "icon", "style", "near", "direction", "constraint", "width",
  "height", "top", "left", "link", "tooltip", "class", "classes", "vars",
  "layers", "scenarios", "steps", "grid-rows", "grid-columns", "grid-gap",
  "vertical-gap", "horizontal-gap", "source-arrowhead", "target-arrowhead",
  "fill", "stroke", "opacity", "stroke-width", "stroke-dash", "border-radius",
  "font-size", "font-color", "shadow", "multiple", "double-border", "3d",
  "animated", "bold", "italic", "underline", "text-transform", "filled",
]);

interface D2State {

  block: string | null;

  inValue: boolean;
}

export const d2Spec: StreamParser<D2State> = {
  name: "d2",

  startState: () => ({ block: null, inValue: false }),

  token(stream, state) {


    if (state.block) {
      if (stream.match(state.block)) {
        state.block = null;
        return "string";
      }
      stream.next();
      return "string";
    }

    if (stream.sol()) state.inValue = false;
    if (stream.eatSpace()) return null;

    if (stream.match(/^(#|\/\/).*/)) return "comment";

    if (state.inValue) {


      if (stream.peek() === "{" || stream.peek() === "}") {
        state.inValue = false;
        stream.next();
        return "bracket";
      }
      if (stream.peek() === ";") {
        state.inValue = false;
        stream.next();
        return "punctuation";
      }
      stream.next();
      return "string";
    }

    if (stream.peek() === '"' || stream.peek() === "'") {
      const quote = stream.next()!;
      while (!stream.eol()) {
        const ch = stream.next();
        if (ch === "\\") stream.next();
        else if (ch === quote) break;
      }
      return "string";
    }


    if (stream.match(/^(?:<->|-->|->|<-|--)/)) return "operator";

    if (stream.match(/^[{}]/)) return "bracket";
    if (stream.match(/^[;.]/)) return "punctuation";

    if (stream.peek() === ":") {
      stream.next();
      const bars = stream.match(/^\s*(\|+)/) as RegExpMatchArray | null;
      if (bars) {
        state.block = bars[1]!;
        return "string";
      }
      state.inValue = true;
      return "punctuation";
    }

    if (stream.match(/^[0-9]+(?:\.[0-9]+)?/)) return "number";

    const word = stream.match(/^[A-Za-z_][\w-]*/) as RegExpMatchArray | null;
    if (word) return D2_KEYWORDS.has(word[0]) ? "keyword" : "variableName";

    stream.next();
    return null;
  },
};

export const d2Language = StreamLanguage.define(d2Spec);


const FENCE_SPECS: Record<string, StreamParser<unknown>> = {
  dot: dotSpec as StreamParser<unknown>,
  graphviz: dotSpec as StreamParser<unknown>,
  gv: dotSpec as StreamParser<unknown>,
  mermaid: mermaidSpec as StreamParser<unknown>,
  mmd: mermaidSpec as StreamParser<unknown>,
  d2: d2Spec as StreamParser<unknown>,
};

interface MarkdownState {

  fence: string | null;

  inner: { spec: StreamParser<unknown>; state: unknown } | null;
}

export const markdownLanguage = StreamLanguage.define<MarkdownState>({
  name: "markdown",

  startState: () => ({ fence: null, inner: null }),

  token(stream, state) {

    if (state.fence !== null && stream.sol()) {
      const close = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(stream.string);
      if (close && close[2]![0] === state.fence[0] && close[2]!.length >= state.fence.length) {
        state.fence = null;
        state.inner = null;
        stream.skipToEnd();
        return "meta";
      }
    }

    if (state.fence !== null) {
      if (!state.inner) {


        stream.skipToEnd();
        return null;
      }
      return state.inner.spec.token(stream, state.inner.state) ?? null;
    }

    if (stream.sol()) {
      const open = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(stream.string);
      if (open && !(open[2]!.startsWith("`") && open[3]!.includes("`"))) {
        state.fence = open[2]!;
        const language = open[3]!.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
        const spec = FENCE_SPECS[language];
        state.inner = spec ? { spec, state: spec.startState?.(2) } : null;
        stream.skipToEnd();
        return "meta";
      }

      if (stream.match(/^ {0,3}#{1,6}\s.*/)) return "heading";
      if (stream.match(/^ {0,3}>[^\n]*/)) return "quote";
      if (stream.match(/^ {0,3}(?:[-*+]|\d+[.)])\s/)) return "list";
      if (stream.match(/^ {0,3}(?:-{3,}|\*{3,}|_{3,})[ \t]*$/)) return "meta";
    }

    if (stream.match(/^<!--[\s\S]*?-->/)) return "comment";
    if (stream.match(/^`[^`\n]+`/)) return "monospace";
    if (stream.match(/^\*\*[^*\n]+\*\*/) || stream.match(/^__[^_\n]+__/)) return "strong";
    if (stream.match(/^\*[^*\n]+\*/) || stream.match(/^_[^_\n]+_/)) return "emphasis";
    if (stream.match(/^!?\[[^\]\n]*\]\([^)\n]*\)/)) return "link";
    if (stream.match(/^<[^>\n]+>/)) return "link";

    stream.next();
    return null;
  },
});

export function languageFor(engine: string): Extension {
  switch (engine) {
    case "graphviz":
      return [dotLanguage, syntaxHighlighting(zdraftHighlight)];
    case "mermaid":
      return [mermaidLanguage, syntaxHighlighting(zdraftHighlight)];
    case "d2":
      return [d2Language, syntaxHighlighting(zdraftHighlight)];
    case "markdown":
      return [markdownLanguage, syntaxHighlighting(zdraftHighlight)];
    default:

      return [syntaxHighlighting(zdraftHighlight)];
  }
}
