import type { Compartment, Family, NodeShape, SourceRange } from "../model/scene";
import { edgeId } from "../model/scene";
import type { LocateIndex } from "./types";


export function detectMermaidType(source: string): string {
  let text = source;


  if (/^\s*---\r?\n/.test(text)) {
    const end = text.indexOf("\n---", 4);
    if (end >= 0) text = text.slice(text.indexOf("\n", end + 1) + 1);
  }

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line === "" || line.startsWith("%%")) continue;

    const word = /^(\w[\w-]*)/.exec(line)?.[1] ?? "";
    switch (word) {
      case "graph":
      case "flowchart":
        return "flowchart";
      case "flowchart-v2":
        return "flowchart";
      case "stateDiagram":
      case "stateDiagram-v2":
        return "state";
      case "classDiagram":
      case "classDiagram-v2":
        return "class";
      case "erDiagram":
        return "er";
      case "sequenceDiagram":
        return "sequence";
      case "gantt":
      case "pie":
      case "journey":
      case "mindmap":
      case "timeline":
      case "gitGraph":
      case "quadrantChart":
      case "sankey-beta":
      case "xychart-beta":
      case "block-beta":
      case "requirementDiagram":
      case "C4Context":
      case "C4Container":
      case "C4Component":
      case "C4Dynamic":
      case "C4Deployment":
        return word;
      default:
        return word || "unknown";
    }
  }

  return "unknown";
}


export function familyForMermaidType(type: string): Family {
  switch (type) {
    case "flowchart":
    case "state":
    case "class":
    case "er":
    case "requirementDiagram":
    case "C4Context":
    case "C4Container":
    case "C4Component":
    case "C4Dynamic":
    case "C4Deployment":
      return "graph";
    case "sequence":
      return "sequence";
    default:


      return "passthrough";
  }
}


export interface ParsedNode {
  id: string;
  label: string;
  shape: NodeShape;
  range: SourceRange;


  sections?: Compartment[];

  stereotype?: string;
}

export interface ParsedEdge {
  from: string;
  to: string;
  label?: string;

  dashed: boolean;
  thick: boolean;
  arrowEnd: boolean;
  arrowStart: boolean;
  range: SourceRange;
}

export interface ParsedSubgraph {
  id: string;
  title?: string;
  range: SourceRange;


  members: string[];

  parent?: string;
}


const NODE_FORMS: Array<{ open: string; close: string; shape: NodeShape }> = [
  { open: "[[", close: "]]", shape: "subroutine" },
  { open: "[(", close: ")]", shape: "cylinder" },
  { open: "[/", close: "\\]", shape: "trapezoid" },
  { open: "[\\", close: "/]", shape: "trapezoid" },
  { open: "[/", close: "/]", shape: "parallelogram" },
  { open: "[\\", close: "\\]", shape: "parallelogram" },
  { open: "(((", close: ")))", shape: "circle" },
  { open: "((", close: "))", shape: "circle" },
  { open: "([", close: "])", shape: "stadium" },
  { open: "{{", close: "}}", shape: "hexagon" },
  { open: "[", close: "]", shape: "rect" },
  { open: "(", close: ")", shape: "round" },
  { open: "{", close: "}", shape: "diamond" },
  { open: ">", close: "]", shape: "note" },
];


function cleanLabel(raw: string): string {
  let text = raw.trim();
  if (
    (text.startsWith('"') && text.endsWith('"') && text.length >= 2) ||
    (text.startsWith("'") && text.endsWith("'") && text.length >= 2)
  ) {
    text = text.slice(1, -1);
  }
  return text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/#quot;/g, '"')
    .replace(/#35;/g, "#")
    .trim();
}

const ID_RE = /[A-Za-z0-9_À-￿][\w\-.À-￿]*/y;


export interface MermaidModel {
  type: string;
  family: Family;
  direction: "TB" | "BT" | "LR" | "RL";
  nodes: Map<string, ParsedNode>;
  edges: ParsedEdge[];
  subgraphs: ParsedSubgraph[];
}

export function parseMermaid(source: string): MermaidModel {
  const type = detectMermaidType(source);
  const model: MermaidModel = {
    type,
    family: familyForMermaidType(type),
    direction: "TB",
    nodes: new Map(),
    edges: [],
    subgraphs: [],
  };

  if (model.family !== "graph") return model;


  if (type === "class") return parseClassDiagram(source, model);
  if (type === "er") return parseErDiagram(source, model);
  if (type === "state") return parseStateDiagram(source, model);

  const lines = splitLines(source);
  const pairSeen = new Map<string, number>();
  const openSubgraphs: ParsedSubgraph[] = [];

  for (const { text, offset } of lines) {
    const line = stripComment(text);
    const trimmed = line.trim();
    if (trimmed === "") continue;


    const dir = /^(?:flowchart|graph)\s+(TB|TD|BT|LR|RL)\b/.exec(trimmed) ??
      /^direction\s+(TB|TD|BT|LR|RL)\b/.exec(trimmed);
    if (dir) {
      model.direction = dir[1] === "TD" ? "TB" : (dir[1] as MermaidModel["direction"]);
      continue;
    }

    if (/^(?:flowchart|graph|stateDiagram(?:-v2)?|classDiagram|erDiagram)\b/.test(trimmed)) continue;


    if (/^(?:classDef|class|style|linkStyle|click|accTitle|accDescr|subgraph|end)\b/.test(trimmed)) {
      const sub = /^subgraph\s+(.*)$/.exec(trimmed);
      if (sub) {
        const parsed = parseSubgraphHeader(sub[1]!, offset + line.indexOf("subgraph"));
        if (parsed) {
          parsed.parent = openSubgraphs[openSubgraphs.length - 1]?.id;
          model.subgraphs.push(parsed);
          openSubgraphs.push(parsed);
        }
        continue;
      }
      if (trimmed === "end") {
        openSubgraphs.pop();
        continue;
      }
      continue;
    }

    parseStatement(line, offset, model, pairSeen, openSubgraphs);
  }

  return model;
}

function splitLines(source: string): Array<{ text: string; offset: number }> {
  const out: Array<{ text: string; offset: number }> = [];
  let offset = 0;

  for (const text of source.split("\n")) {
    out.push({ text, offset });
    offset += text.length + 1;
  }
  return out;
}


function stripComment(line: string): string {
  let quote: string | null = null;

  for (let i = 0; i < line.length - 1; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "%" && line[i + 1] === "%") return line.slice(0, i);
  }

  return line;
}

function parseSubgraphHeader(rest: string, offset: number): ParsedSubgraph | null {

  const withBrackets = /^([^\s[]+)\s*\[(.*)\]\s*$/.exec(rest.trim());
  if (withBrackets) {
    return {
      id: withBrackets[1]!,
      title: cleanLabel(withBrackets[2]!),
      range: { from: offset, to: offset + rest.length + 9 },
      members: [],
    };
  }

  const bare = rest.trim();
  if (bare === "") return null;
  return { id: bare, title: bare, range: { from: offset, to: offset + bare.length + 9 }, members: [] };
}


function parseStatement(
  line: string,
  lineOffset: number,
  model: MermaidModel,
  pairSeen: Map<string, number>,
  openSubgraphs: ParsedSubgraph[],
): void {
  let i = 0;

  let pending: string[] = [];
  let link: { dashed: boolean; thick: boolean; arrowEnd: boolean; arrowStart: boolean; label?: string } | null =
    null;
  const statementFrom = lineOffset + (line.length - line.trimStart().length);

  while (i < line.length) {
    const ch = line[i]!;

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === "&") {
      i++;
      continue;
    }

    const linkMatch = matchLink(line, i);
    if (linkMatch) {
      link = linkMatch.link;
      i = linkMatch.next;
      continue;
    }

    const node = matchNode(line, i, lineOffset);
    if (!node) {
      i++;
      continue;
    }

    i = node.next;


    const existing = model.nodes.get(node.parsed.id);
    if (!existing || (existing.shape === "rect" && existing.label === existing.id && node.hadBrackets)) {
      model.nodes.set(node.parsed.id, node.parsed);
    }

    for (const sub of openSubgraphs) {
      if (!sub.members.includes(node.parsed.id)) sub.members.push(node.parsed.id);
    }

    if (link && pending.length > 0) {
      for (const from of pending) {
        const key = `${from}->${node.parsed.id}`;
        const ordinal = pairSeen.get(key) ?? 0;
        pairSeen.set(key, ordinal + 1);
        model.edges.push({
          from,
          to: node.parsed.id,
          label: link.label,
          dashed: link.dashed,
          thick: link.thick,
          arrowEnd: link.arrowEnd,
          arrowStart: link.arrowStart,
          range: { from: statementFrom, to: lineOffset + line.trimEnd().length },
        });
      }
      pending = [node.parsed.id];
      link = null;
    } else {
      pending = link ? [node.parsed.id] : [...pending, node.parsed.id];
      if (!link && pending.length > 2) pending = [node.parsed.id];
    }
  }
}


function matchLink(
  line: string,
  i: number,
): { link: { dashed: boolean; thick: boolean; arrowEnd: boolean; arrowStart: boolean; label?: string }; next: number } | null {

  const re = /^(<?(?:-{2,}|-\.+-|={2,}|~{3,})>?|<-{2,}>?)/;
  const rest = line.slice(i);
  const m = re.exec(rest);
  if (!m) return null;

  const op = m[1]!;
  let next = i + op.length;
  let label: string | undefined;


  if (line[next] === "|") {
    const close = line.indexOf("|", next + 1);
    if (close > 0) {
      label = cleanLabel(line.slice(next + 1, close));
      next = close + 1;
    }
  } else {

    const tail = line.slice(next);
    const inline = /^\s*([^-=~<>|]+?)\s*((?:-{2,}|={2,})>?)/.exec(tail);
    if (inline && !op.endsWith(">")) {
      label = cleanLabel(inline[1]!);
      next += inline[0]!.length;
    }
  }

  return {
    link: {
      dashed: op.includes("."),
      thick: op.includes("="),

      arrowEnd: op.endsWith(">"),
      arrowStart: op.startsWith("<"),
      label,
    },
    next,
  };
}

function matchNode(
  line: string,
  i: number,
  lineOffset: number,
): { parsed: ParsedNode; next: number; hadBrackets: boolean } | null {
  ID_RE.lastIndex = i;
  const idMatch = ID_RE.exec(line);
  if (!idMatch || idMatch.index !== i) return null;

  const id = idMatch[0];
  let next = i + id.length;
  const from = lineOffset + i;

  for (const form of NODE_FORMS) {
    if (!line.startsWith(form.open, next)) continue;

    const close = findClose(line, next + form.open.length, form.close);
    if (close < 0) continue;

    const label = cleanLabel(line.slice(next + form.open.length, close));
    const to = lineOffset + close + form.close.length;
    return {
      parsed: { id, label: label || id, shape: form.shape, range: { from, to } },
      next: close + form.close.length,
      hadBrackets: true,
    };
  }

  return {
    parsed: { id, label: id, shape: "rect", range: { from, to: lineOffset + next } },
    next,
    hadBrackets: false,
  };
}


function findClose(line: string, start: number, close: string): number {
  let quote: string | null = null;

  for (let i = start; i <= line.length - close.length; i++) {
    const ch = line[i]!;
    if (quote) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (line.startsWith(close, i)) return i;
  }

  return -1;
}


export function locateMermaid(source: string): LocateIndex {
  const model = parseMermaid(source);
  const nodes = new Map<string, SourceRange>();
  const edges = new Map<string, SourceRange>();

  for (const [id, node] of model.nodes) nodes.set(id, node.range);
  for (const sub of model.subgraphs) nodes.set(sub.id, sub.range);

  const pairSeen = new Map<string, number>();
  for (const edge of model.edges) {
    const key = `${edge.from}->${edge.to}`;
    const ordinal = pairSeen.get(key) ?? 0;
    pairSeen.set(key, ordinal + 1);
    edges.set(edgeId(edge.from, edge.to, ordinal), edge.range);
  }

  return { nodes, edges };
}


const CLASS_RELATIONS = [
  "<|--|>", "<|..|>", "*--", "o--", "<|--", "--|>", "<|..", "..|>",
  "<--", "-->", "<..", "..>", "--", "..",
] as const;


const CARDINALITY = /^\s*"[^"]*"\s*/;

function parseClassDiagram(source: string, model: MermaidModel): MermaidModel {
  const lines = splitLines(source);
  const pairSeen = new Map<string, number>();


  let openClass: { node: ParsedNode; attributes: string[]; methods: string[] } | null = null;

  const ensure = (id: string, from: number, to: number): ParsedNode => {
    const existing = model.nodes.get(id);
    if (existing) return existing;

    const node: ParsedNode = { id, label: id, shape: "rect", range: { from, to } };
    model.nodes.set(id, node);
    return node;
  };


  const addMember = (target: NonNullable<typeof openClass>, raw: string) => {
    const member = raw.trim();
    if (member === "") return;

    if (/^<<.*>>$/.test(member)) {
      target.node.stereotype = member.slice(2, -2).trim();
      return;
    }
    if (member.includes("(")) target.methods.push(member);
    else target.attributes.push(member);
  };

  const closeClass = () => {
    if (!openClass) return;
    const sections: Compartment[] = [];
    if (openClass.attributes.length) sections.push({ items: openClass.attributes });
    if (openClass.methods.length) sections.push({ items: openClass.methods });
    if (sections.length) openClass.node.sections = sections;
    openClass = null;
  };

  for (const { text, offset } of lines) {
    const line = stripComment(text);
    const trimmed = line.trim();
    if (trimmed === "" || /^classDiagram(?:-v2)?\b/.test(trimmed)) continue;

    if (openClass) {
      if (trimmed === "}") {
        closeClass();
        continue;
      }
      addMember(openClass, trimmed);
      continue;
    }

    if (/^(?:direction|namespace|style|classDef|cssClass|click|note|link|callback)\b/.test(trimmed)) {
      const dir = /^direction\s+(TB|TD|BT|LR|RL)\b/.exec(trimmed);
      if (dir) model.direction = dir[1] === "TD" ? "TB" : (dir[1] as MermaidModel["direction"]);
      continue;
    }


    const declared = /^class\s+([\w.~$-]+)(?:\s*\[\s*"([^"]*)"\s*\])?\s*(\{)?/.exec(trimmed);
    if (declared) {
      const id = declared[1]!;
      const at = offset + line.indexOf(id);
      const node = ensure(id, at, at + id.length);
      if (declared[2]) node.label = cleanLabel(declared[2]);
      if (declared[3]) openClass = { node, attributes: [], methods: [] };
      continue;
    }


    const relation = matchClassRelation(trimmed);
    if (relation) {
      const fromNode = ensure(relation.from, offset, offset + trimmed.length);
      const toNode = ensure(relation.to, offset, offset + trimmed.length);
      void fromNode;
      void toNode;

      const key = `${relation.from}->${relation.to}`;
      const ordinal = pairSeen.get(key) ?? 0;
      pairSeen.set(key, ordinal + 1);

      model.edges.push({
        from: relation.from,
        to: relation.to,
        label: relation.label,
        dashed: relation.dashed,
        thick: false,
        arrowEnd: relation.arrowEnd,
        arrowStart: relation.arrowStart,
        range: { from: offset + line.indexOf(trimmed), to: offset + line.trimEnd().length },
      });
      continue;
    }


    const member = /^([\w.~$-]+)\s*:\s*(.+)$/.exec(trimmed);
    if (member) {
      const id = member[1]!;
      const at = offset + line.indexOf(id);
      const node = ensure(id, at, at + id.length);
      const holder = { node, attributes: [], methods: [] };
      addMember(holder, member[2]!);

      const sections = node.sections ?? [];
      const items = [...holder.attributes, ...holder.methods];
      if (items.length) {


        if (sections.length === 0) sections.push({ items: [] });
        sections[0]!.items.push(...items);
        node.sections = sections;
      }
    }
  }

  closeClass();
  return model;
}

interface ClassRelation {
  from: string;
  to: string;
  label?: string;
  dashed: boolean;
  arrowEnd: boolean;
  arrowStart: boolean;
}

function matchClassRelation(line: string): ClassRelation | null {
  for (const op of CLASS_RELATIONS) {
    const at = line.indexOf(op);
    if (at <= 0) continue;

    let left = line.slice(0, at).trim();
    let rightWhole = line.slice(at + op.length);


    left = left.replace(/\s*"[^"]*"\s*$/, "").trim();
    rightWhole = rightWhole.replace(CARDINALITY, "");

    const colon = rightWhole.indexOf(":");
    const label = colon >= 0 ? cleanLabel(rightWhole.slice(colon + 1)) : undefined;
    const right = (colon >= 0 ? rightWhole.slice(0, colon) : rightWhole).trim();

    if (!/^[\w.~$-]+$/.test(left) || !/^[\w.~$-]+$/.test(right)) continue;

    return {
      from: left,
      to: right,
      label: label || undefined,
      dashed: op.includes("."),


      arrowEnd: op.includes(">"),
      arrowStart: op.startsWith("<"),
    };
  }

  return null;
}


const ER_RELATION = /^([\w."-]+)\s+([|}{o][|}{o]?(?:--|\.\.)[|}{o][|}{o]?)\s+([\w."-]+)\s*:\s*(.+)$/;

function parseErDiagram(source: string, model: MermaidModel): MermaidModel {
  const lines = splitLines(source);
  const pairSeen = new Map<string, number>();
  let openEntity: ParsedNode | null = null;
  let attributes: string[] = [];

  const ensure = (raw: string, from: number, to: number): ParsedNode => {
    const id = raw.replace(/^"|"$/g, "");
    const existing = model.nodes.get(id);
    if (existing) return existing;

    const node: ParsedNode = { id, label: id, shape: "rect", range: { from, to } };
    model.nodes.set(id, node);
    return node;
  };

  for (const { text, offset } of lines) {
    const line = stripComment(text);
    const trimmed = line.trim();
    if (trimmed === "" || /^erDiagram\b/.test(trimmed)) continue;

    if (openEntity) {
      if (trimmed === "}") {
        if (attributes.length) openEntity.sections = [{ items: attributes }];
        openEntity = null;
        attributes = [];
        continue;
      }

      attributes.push(trimmed.replace(/\s*"[^"]*"\s*$/, "").trim());
      continue;
    }

    const block = /^([\w."-]+)\s*\{$/.exec(trimmed);
    if (block) {
      const at = offset + line.indexOf(block[1]!);
      openEntity = ensure(block[1]!, at, at + block[1]!.length);
      attributes = [];
      continue;
    }

    const relation = ER_RELATION.exec(trimmed);
    if (relation) {
      const from = ensure(relation[1]!, offset, offset + trimmed.length).id;
      const to = ensure(relation[3]!, offset, offset + trimmed.length).id;

      const key = `${from}->${to}`;
      const ordinal = pairSeen.get(key) ?? 0;
      pairSeen.set(key, ordinal + 1);

      model.edges.push({
        from,
        to,
        label: cleanLabel(relation[4]!),
        dashed: relation[2]!.includes(".."),
        thick: false,


        arrowEnd: false,
        arrowStart: false,
        range: { from: offset + line.indexOf(trimmed), to: offset + line.trimEnd().length },
      });
    }
  }

  if (openEntity && attributes.length) openEntity.sections = [{ items: attributes }];
  return model;
}


const STATE_TERMINAL = "[*]";

function parseStateDiagram(source: string, model: MermaidModel): MermaidModel {
  const lines = splitLines(source);
  const pairSeen = new Map<string, number>();
  const openComposites: ParsedSubgraph[] = [];

  const ensure = (id: string, from: number, to: number): ParsedNode | null => {
    if (id === STATE_TERMINAL) return null;

    const existing = model.nodes.get(id);
    if (existing) return existing;

    const node: ParsedNode = { id, label: id, shape: "round", range: { from, to } };
    model.nodes.set(id, node);
    for (const composite of openComposites) {
      if (!composite.members.includes(id)) composite.members.push(id);
    }
    return node;
  };

  for (const { text, offset } of lines) {
    const line = stripComment(text);
    const trimmed = line.trim();
    if (trimmed === "" || /^stateDiagram(?:-v2)?\b/.test(trimmed)) continue;

    const dir = /^direction\s+(TB|TD|BT|LR|RL)\b/.exec(trimmed);
    if (dir) {
      model.direction = dir[1] === "TD" ? "TB" : (dir[1] as MermaidModel["direction"]);
      continue;
    }

    if (trimmed === "}") {
      openComposites.pop();
      continue;
    }
    if (/^(?:note|end note|class|classDef|style)\b/.test(trimmed)) continue;


    const renamed = /^state\s+"([^"]*)"\s+as\s+([\w.-]+)/.exec(trimmed);
    if (renamed) {
      const id = renamed[2]!;
      const at = offset + line.indexOf(id);
      const node = ensure(id, at, at + id.length);
      if (node) node.label = cleanLabel(renamed[1]!);
      continue;
    }

    const composite = /^state\s+([\w.-]+)\s*\{/.exec(trimmed);
    if (composite) {
      const id = composite[1]!;
      const at = offset + line.indexOf(id);
      const sub: ParsedSubgraph = {
        id,
        title: id,
        range: { from: at, to: at + id.length },
        members: [],
        parent: openComposites[openComposites.length - 1]?.id,
      };
      model.subgraphs.push(sub);
      openComposites.push(sub);
      continue;
    }


    const transition = /^(\[\*\]|[\w.-]+)\s*-->\s*(\[\*\]|[\w.-]+)\s*(?::\s*(.*))?$/.exec(trimmed);
    if (transition) {
      const fromId = transition[1]!;
      const toId = transition[2]!;
      ensure(fromId, offset + line.indexOf(fromId), offset + line.indexOf(fromId) + fromId.length);
      ensure(toId, offset + line.lastIndexOf(toId), offset + line.lastIndexOf(toId) + toId.length);


      if (fromId !== STATE_TERMINAL && toId !== STATE_TERMINAL) {
        const key = `${fromId}->${toId}`;
        const ordinal = pairSeen.get(key) ?? 0;
        pairSeen.set(key, ordinal + 1);

        model.edges.push({
          from: fromId,
          to: toId,
          label: transition[3] ? cleanLabel(transition[3]) : undefined,
          dashed: false,
          thick: false,
          arrowEnd: true,
          arrowStart: false,
          range: { from: offset + line.indexOf(trimmed), to: offset + line.trimEnd().length },
        });
      }
      continue;
    }


    const bare = /^([\w.-]+)$/.exec(trimmed);
    if (bare) {
      const at = offset + line.indexOf(bare[1]!);
      ensure(bare[1]!, at, at + bare[1]!.length);
    }
  }

  return model;
}
