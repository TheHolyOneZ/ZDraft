import { edgeId, type SourceRange } from "../model/scene";
import type { LocateIndex } from "./types";


interface Key {

  path: string;

  range: SourceRange;
}

interface Statement {
  keys: Key[];

  value: SourceRange | null;

  arrows: string[];

  range: SourceRange;

  opensBlock: boolean;
}


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
  "grid-rows",
  "grid-columns",
  "grid-gap",
  "vertical-gap",
  "horizontal-gap",
  "source-arrowhead",
  "target-arrowhead",
  "layers",
  "scenarios",
  "steps",
  "vars",
]);

const ARROWS = ["<->", "-->", "->", "<-", "--"];


export interface D2Key {

  path: string;

  text: string;
  range: SourceRange;

  value: SourceRange | null;

  isEdgeEnd: boolean;
}


export function scanD2(source: string): D2Key[] {
  const out: D2Key[] = [];
  const scope: string[] = [];

  for (const statement of scan(source)) {
    if (statement === "close") {
      scope.pop();
      continue;
    }

    const isEdge = statement.arrows.length > 0 && statement.keys.length >= 2;
    const prefix = scope.length > 0 ? scope.join(".") + "." : "";

    statement.keys.forEach((key, i) => {
      const path = absolute(scope, key.path);
      out.push({
        path,
        text: key.path,
        range: key.range,

        value: !isEdge && i === statement.keys.length - 1 ? statement.value : null,
        isEdgeEnd: isEdge,
      });
    });


    if (statement.keys.length === 1 && !isEdge) {
      const key = statement.keys[0]!;
      const path = absolute(scope, key.path);
      const last = path.slice(path.lastIndexOf(".") + 1);

      if (statement.opensBlock) {
        scope.push(RESERVED.has(last) ? last : path.slice(prefix.length));
      }
    } else if (statement.opensBlock) {
      scope.push("");
    }
  }

  return out;
}

export function locateD2(source: string): LocateIndex {
  const nodes = new Map<string, SourceRange>();
  const edges = new Map<string, SourceRange>();
  const pairSeen = new Map<string, number>();


  const scope: string[] = [];

  const declare = (path: string, range: SourceRange) => {


    if (!nodes.has(path)) nodes.set(path, range);
  };

  for (const statement of scan(source)) {
    if (statement === "close") {
      scope.pop();
      continue;
    }

    const resolved = statement.keys.map((k) => ({ ...k, path: absolute(scope, k.path) }));
    const prefix = scope.length > 0 ? scope.join(".") + "." : "";

    if (statement.arrows.length > 0 && resolved.length >= 2) {
      for (const key of resolved) declare(key.path, key.range);


      for (let i = 0; i + 1 < resolved.length; i += 1) {
        const arrow = statement.arrows[i] ?? "->";
        const [from, to] = orient(arrow, resolved[i]!.path, resolved[i + 1]!.path);
        const pair = `${from}->${to}`;
        const ordinal = pairSeen.get(pair) ?? 0;
        pairSeen.set(pair, ordinal + 1);
        edges.set(edgeId(from, to, ordinal), statement.range);
      }
    } else if (resolved.length === 1) {
      const key = resolved[0]!;
      const last = key.path.slice(key.path.lastIndexOf(".") + 1);

      if (!RESERVED.has(last)) declare(key.path, key.range);
      if (statement.opensBlock && !RESERVED.has(last)) scope.push(key.path.slice(prefix.length));
      else if (statement.opensBlock) scope.push(last);
    } else if (statement.opensBlock) {


      scope.push("");
    }
  }

  return { nodes, edges };
}


function absolute(scope: readonly string[], path: string): string {
  let up = 0;
  let rest = path;
  while (rest === "_" || rest.startsWith("_.")) {
    up += 1;
    if (rest === "_") {
      rest = "";
      break;
    }
    rest = rest.slice(2);
  }

  const base = up > 0 ? scope.slice(0, Math.max(0, scope.length - up)) : scope;
  const prefix = base.length > 0 ? base.join(".") + "." : "";
  return rest === "" ? base.join(".") : prefix + rest;
}


function orient(arrow: string, a: string, b: string): [string, string] {
  return arrow === "<-" ? [b, a] : [a, b];
}


function* scan(source: string): Generator<Statement | "close"> {
  let i = 0;
  const n = source.length;

  let keys: Key[] = [];
  let arrows: string[] = [];
  let value: SourceRange | null = null;
  let start = 0;
  let pending: { text: string; from: number; to: number } | null = null;

  const flushKey = () => {
    if (!pending) return;


    const lead = pending.text.length - pending.text.trimStart().length;
    const trail = pending.text.length - pending.text.trimEnd().length;
    const text = pending.text.trim();
    if (text !== "") {
      keys.push({ path: text, range: { from: pending.from + lead, to: pending.to - trail } });
    }
    pending = null;
  };

  const emit = function* (end: number, opensBlock: boolean): Generator<Statement> {
    flushKey();
    if (keys.length > 0) {
      yield { keys, arrows, value, range: { from: start, to: end }, opensBlock };
    }
    keys = [];
    arrows = [];
    value = null;
  };

  const reset = (at: number) => {
    start = at;
  };

  while (i < n) {
    const ch = source[i]!;


    if (ch === "#" && pending === null) {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/" && pending === null) {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }


    if ((ch === '"' || ch === "'") && pending === null) {
      const from = i;
      i += 1;
      while (i < n && source[i] !== ch) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      pending = { text: source.slice(from + 1, Math.max(from + 1, i - 1)), from, to: i };
      continue;
    }

    if (ch === "\n" || ch === ";") {
      yield* emit(i, false);
      i += 1;
      reset(i);
      continue;
    }

    if (ch === "{") {
      yield* emit(i, true);
      i += 1;
      reset(i);
      continue;
    }

    if (ch === "}") {
      yield* emit(i, false);
      yield "close";
      i += 1;
      reset(i);
      continue;
    }


    if (ch === ":") {
      flushKey();
      i += 1;

      while (i < n && (source[i] === " " || source[i] === "\t")) i += 1;


      if (source[i] === "|") {
        let bars = 0;
        while (source[i + bars] === "|") bars += 1;
        const close = "|".repeat(bars);
        const at = source.indexOf(close, i + bars);
        i = at === -1 ? n : at + bars;
        continue;
      }

      if (source[i] === "{") continue;


      const from = i;
      while (
        i < n &&
        source[i] !== "\n" &&
        source[i] !== ";" &&
        source[i] !== "}" &&
        source[i] !== "{"
      ) {
        i += 1;
      }

      let to = i;
      while (to > from && /\s/.test(source[to - 1]!)) to -= 1;
      value = { from, to };
      continue;
    }


    const arrow = ARROWS.find((a) => source.startsWith(a, i));
    if (arrow) {
      flushKey();
      arrows.push(arrow);
      i += arrow.length;
      continue;
    }

    if (/\s/.test(ch)) {


      if (pending) pending.text += ch;
      i += 1;
      if (pending) pending.to = i;
      continue;
    }

    if (pending === null) pending = { text: ch, from: i, to: i + 1 };
    else {
      pending.text += ch;
      pending.to = i + 1;
    }
    i += 1;
  }

  yield* emit(n, false);
}
