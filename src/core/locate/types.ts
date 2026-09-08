import type { SourceRange } from "../model/scene";


export interface LocateIndex {

  nodes: ReadonlyMap<string, SourceRange>;

  edges: ReadonlyMap<string, SourceRange>;
}


export function idAt(index: LocateIndex, offset: number): string | undefined {
  let best: string | undefined;
  let bestSize = Infinity;

  for (const [id, range] of index.nodes) {
    if (offset >= range.from && offset <= range.to) {
      const size = range.to - range.from;


      if (size < bestSize) {
        best = id;
        bestSize = size;
      }
    }
  }

  return best;
}


export function edgeAt(index: LocateIndex, offset: number): string | undefined {
  let best: string | undefined;
  let bestSize = Infinity;

  for (const [id, range] of index.edges) {
    if (offset >= range.from && offset <= range.to) {
      const size = range.to - range.from;
      if (size < bestSize) {
        best = id;
        bestSize = size;
      }
    }
  }

  return best;
}

export const EMPTY_INDEX: LocateIndex = { nodes: new Map(), edges: new Map() };


export function lineColumnAt(source: string, offset: number): { line: number; column: number } {
  let line = 1;
  let lineStart = 0;

  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }

  return { line, column: offset - lineStart + 1 };
}


export function offsetOfLine(source: string, line: number): number {
  if (line <= 1) return 0;

  let seen = 1;
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      seen++;
      if (seen === line) return i + 1;
    }
  }

  return source.length;
}
