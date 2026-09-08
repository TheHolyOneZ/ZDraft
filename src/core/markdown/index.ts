import { detectEol } from "../eol";
import type { EngineId, SourceRange } from "../model/scene";


const FENCE_ENGINES: Record<string, EngineId> = {
  mermaid: "mermaid",
  mmd: "mermaid",
  dot: "graphviz",
  graphviz: "graphviz",
  gv: "graphviz",
  d2: "d2",
  plantuml: "plantuml",
  puml: "plantuml",
  uml: "plantuml",
};

export interface MarkdownBlock {


  id: string;

  marked: boolean;
  engine: EngineId;

  info: string;

  source: string;

  body: SourceRange;

  whole: SourceRange;


  markerAt: number;

  markerRange?: SourceRange;

  line: number;
}


const MARKER = /^[ \t]*<!--\s*zdraft:\s*([^\s>-][^>]*?)\s*-->[ \t]*\r?$/;

export function isMarkdown(name: string): boolean {
  return /\.(md|markdown|mdx)$/i.test(name);
}


export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = splitLines(source);
  const blocks: MarkdownBlock[] = [];
  const ordinals = new Map<EngineId, number>();

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const fence = openingFence(line.text);

    if (!fence) {
      i += 1;
      continue;
    }

    const engine = FENCE_ENGINES[fence.info.split(/\s+/)[0]?.toLowerCase() ?? ""];


    if (!engine) {
      i = closeOf(lines, i, fence) + 1;
      continue;
    }

    const close = closeOf(lines, i, fence);
    const bodyFrom = i + 1 < lines.length ? lines[i + 1]!.offset : line.offset + line.text.length;
    const bodyTo = close < lines.length ? lines[close]!.offset : source.length;


    const above = i > 0 ? lines[i - 1]! : null;
    const name = above ? MARKER.exec(above.text)?.[1]?.trim() : undefined;

    const ordinal = ordinals.get(engine) ?? 0;
    ordinals.set(engine, ordinal + 1);

    blocks.push({
      id: name && name !== "" ? name : `${engine}:${ordinal}`,
      marked: Boolean(name),
      engine,
      info: fence.info,


      source: trimTrailingNewline(source.slice(bodyFrom, bodyTo)),
      body: { from: bodyFrom, to: bodyTo },
      whole: {
        from: line.offset,
        to: close < lines.length ? lines[close]!.offset + lines[close]!.text.length : source.length,
      },
      markerAt: line.offset,
      markerRange:
        name !== undefined && above
          ? { from: above.offset, to: above.offset + above.text.length + 1 }
          : undefined,
      line: i + 1,
    });

    i = close + 1;
  }

  return blocks;
}


export function withMarker(
  source: string,
  block: MarkdownBlock,
  name: string,
): { source: string; id: string } | null {
  const id = name.trim();
  if (id === "" || !/^[\w][\w .-]*$/.test(id)) return null;

  const taken = parseMarkdownBlocks(source).some((b) => b !== block && b.id === id && b.marked);
  if (taken) return null;

  const indent = /^[ \t]*/.exec(sliceLine(source, block.markerAt))?.[0] ?? "";


  const marker = `${indent}<!-- zdraft: ${id} -->${detectEol(source)}`;

  const at = block.markerRange?.from ?? block.markerAt;
  const end = block.markerRange?.to ?? block.markerAt;

  return { source: source.slice(0, at) + marker + source.slice(end), id };
}


export function withBlockSource(
  source: string,
  block: MarkdownBlock,
  next: string,
): string {


  const eol = detectEol(source);
  const text = next.endsWith("\n") || next === "" ? next : next + eol;
  return source.slice(0, block.body.from) + text + source.slice(block.body.to);
}


export function blockAt(blocks: readonly MarkdownBlock[], offset: number): MarkdownBlock | null {
  return blocks.find((b) => offset >= b.whole.from && offset <= b.whole.to) ?? null;
}


interface Fence {

  marker: string;
  info: string;
  indent: number;
}


function openingFence(text: string): Fence | null {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)\r?$/.exec(text);
  if (!match) return null;

  const marker = match[2]!;
  const info = match[3]!.trim();
  if (marker.startsWith("`") && info.includes("`")) return null;

  return { marker, info, indent: match[1]!.length };
}


function closeOf(lines: readonly Line[], open: number, fence: Fence): number {
  const char = fence.marker[0]!;

  for (let i = open + 1; i < lines.length; i += 1) {
    const match = /^( {0,3})(`{3,}|~{3,})[ \t]*\r?$/.exec(lines[i]!.text);
    if (!match) continue;

    if (match[2]![0] === char && match[2]!.length >= fence.marker.length) return i;
  }


  return lines.length;
}


interface Line {
  text: string;
  offset: number;
}

function splitLines(source: string): Line[] {
  const out: Line[] = [];
  let offset = 0;

  for (const text of source.split("\n")) {
    out.push({ text, offset });
    offset += text.length + 1;
  }

  return out;
}

function sliceLine(source: string, at: number): string {
  const end = source.indexOf("\n", at);
  return source.slice(at, end < 0 ? source.length : end);
}

function trimTrailingNewline(text: string): string {
  if (text.endsWith("\r\n")) return text.slice(0, -2);
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}
