import { edgeId, type SourceRange } from "../model/scene";
import type { LocateIndex } from "./types";


export type DotTokenKind = "id" | "edgeop" | "punct";

export interface DotToken {
  kind: DotTokenKind;
  value: string;
  from: number;
  to: number;
}

const KEYWORDS = new Set(["graph", "digraph", "subgraph", "node", "edge", "strict"]);


const ID_START = /[A-Za-z_-￿]/;
const ID_CHAR = /[A-Za-z0-9_-￿]/;

export function tokenizeDot(source: string): DotToken[] {
  const tokens: DotToken[] = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i]!;

    if (/\s/.test(ch)) {
      i++;
      continue;
    }


    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }


    if (ch === '"') {
      const from = i;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ kind: "id", value: source.slice(from + 1, i - 1), from, to: i });
      continue;
    }


    if (ch === "<") {
      const from = i;
      let depth = 0;
      while (i < source.length) {
        if (source[i] === "<") depth++;
        else if (source[i] === ">") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        i++;
      }
      tokens.push({ kind: "id", value: source.slice(from, i), from, to: i });
      continue;
    }


    if (ch === "-" && (source[i + 1] === ">" || source[i + 1] === "-")) {
      tokens.push({ kind: "edgeop", value: source.slice(i, i + 2), from: i, to: i + 2 });
      i += 2;
      continue;
    }


    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      const from = i;
      while (i < source.length && /[0-9.]/.test(source[i]!)) i++;
      tokens.push({ kind: "id", value: source.slice(from, i), from, to: i });
      continue;
    }

    if (ID_START.test(ch)) {
      const from = i;
      while (i < source.length && ID_CHAR.test(source[i]!)) i++;
      tokens.push({ kind: "id", value: source.slice(from, i), from, to: i });
      continue;
    }

    tokens.push({ kind: "punct", value: ch, from: i, to: i + 1 });
    i++;
  }

  return tokens;
}


function skipAttrList(tokens: DotToken[], start: number): { next: number; end: number } {
  let depth = 0;
  let i = start;
  let end = tokens[start]?.to ?? 0;

  while (i < tokens.length) {
    const tok = tokens[i]!;
    if (tok.value === "[") depth++;
    if (tok.value === "]") {
      depth--;
      end = tok.to;
      if (depth === 0) return { next: i + 1, end };
    }
    i++;
  }

  return { next: i, end };
}

export function locateDot(source: string): LocateIndex {
  const tokens = tokenizeDot(source);
  const nodes = new Map<string, SourceRange>();
  const edges = new Map<string, SourceRange>();
  const pairSeen = new Map<string, number>();


  const declare = (name: string, from: number, to: number) => {
    if (!nodes.has(name)) nodes.set(name, { from, to });
  };


  const skipPorts = (i: number): number => {
    while (tokens[i]?.value === ":" && tokens[i + 1]?.kind === "id") i += 2;
    return i;
  };

  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;


    if (t.kind === "punct" && t.value === "[") {
      i = skipAttrList(tokens, i).next;
      continue;
    }

    if (t.kind !== "id") {
      i++;
      continue;
    }

    const lower = t.value.toLowerCase();


    if (lower === "subgraph") {
      const next = tokens[i + 1];
      if (next?.kind === "id") {
        declare(next.value, next.from, next.to);
        i += 2;
        continue;
      }
      i++;
      continue;
    }


    if (KEYWORDS.has(lower)) {


      if ((lower === "graph" || lower === "digraph") && tokens[i + 1]?.kind === "id") {
        i += 2;
        continue;
      }
      i++;
      continue;
    }


    if (tokens[i + 1]?.value === "=") {
      i += 3;
      continue;
    }

    const statementFrom = t.from;
    let prev: DotToken = t;
    declare(prev.value, prev.from, prev.to);
    i = skipPorts(i + 1);

    let sawEdge = false;
    const chain: Array<{ from: string; to: string }> = [];


    while (tokens[i]?.kind === "edgeop") {
      const target = tokens[i + 1];
      if (!target || (target.kind !== "id" && target.value !== "{")) {
        i++;
        break;
      }
      sawEdge = true;


      if (target.value === "{") {
        i += 2;
        const fanned: DotToken[] = [];
        while (i < tokens.length && tokens[i]!.value !== "}") {
          const tok = tokens[i]!;
          if (tok.kind === "id") {
            declare(tok.value, tok.from, tok.to);
            fanned.push(tok);
          }
          i++;
        }
        i++;
        for (const f of fanned) chain.push({ from: prev.value, to: f.value });

        break;
      }

      declare(target.value, target.from, target.to);
      chain.push({ from: prev.value, to: target.value });
      prev = target;
      i = skipPorts(i + 2);
    }


    let statementTo = prev.to;
    if (tokens[i]?.value === "[") {
      const skipped = skipAttrList(tokens, i);
      statementTo = skipped.end;
      i = skipped.next;
    }

    if (sawEdge) {
      for (const link of chain) {
        const key = `${link.from}->${link.to}`;
        const ordinal = pairSeen.get(key) ?? 0;
        pairSeen.set(key, ordinal + 1);
        edges.set(edgeId(link.from, link.to, ordinal), { from: statementFrom, to: statementTo });
      }
    } else {


      const existing = nodes.get(t.value);
      if (existing && existing.from === statementFrom && statementTo > existing.to) {
        nodes.set(t.value, { from: statementFrom, to: statementTo });
      }
    }
  }

  return { nodes, edges };
}
