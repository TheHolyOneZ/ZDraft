import { edgeId, type Compartment, type NodeShape, type SourceRange } from "../model/scene";
import type { LocateIndex } from "./types";


export interface PumlEntity {

  id: string;
  label: string;
  shape: NodeShape;

  stereotype?: string;

  sections: Compartment[];
  range: SourceRange;
}

export interface PumlPackage {
  id: string;
  label: string;
  parent?: string;
  range: SourceRange;
}

export interface PumlLink {
  from: string;
  to: string;
  label?: string;

  dashed: boolean;

  head: string;
  tail: string;
  range: SourceRange;
}

export interface PumlModel {

  kind: string;
  entities: Map<string, PumlEntity>;
  packages: Map<string, PumlPackage>;
  links: PumlLink[];
}


export const KEYWORD_SHAPES: Record<string, NodeShape> = {
  rectangle: "rect",
  component: "subroutine",
  node: "package",
  folder: "folder",
  frame: "rect",
  cloud: "cloud",
  database: "cylinder",
  storage: "stored",
  queue: "queue",
  card: "rect",
  file: "doc",
  collections: "page",
  stack: "page",
  agent: "rect",
  person: "person",
  actor: "person",
  usecase: "ellipse",
  boundary: "rect",
  control: "circle",
  entity: "rect",
  class: "rect",
  interface: "circle",
  abstract: "rect",
  enum: "rect",
  struct: "rect",
  annotation: "note",
  state: "round",
  object: "rect",
  circle: "circle",
  hexagon: "hexagon",
  archimate: "rect",
};


export const CONTAINER_KEYWORDS = new Set(["package", "namespace", "together", "partition"]);

const DECLARATION = new RegExp(
  String.raw`^(?:(abstract|static)\s+)?(` +
    Object.keys(KEYWORD_SHAPES).join("|") +
    String.raw`)\s+(.*)$`,
  "i",
);


export const LINK = new RegExp(
  String.raw`^(?<a>"[^"]+"|\[[^\]]+\]|\([^)]+\)|:[^:]+:|[\w.$]+)\s*` +
    String.raw`(?<line>[-.<>|*o+#^)\\/]{2,})\s*` +
    String.raw`(?<b>"[^"]+"|\[[^\]]+\]|\([^)]+\)|:[^:]+:|[\w.$]+)\s*` +
    String.raw`(?::\s*(?<label>.*))?$`,
);

export function parsePlantUml(source: string): PumlModel {
  const model: PumlModel = {
    kind: detectPumlKind(source),
    entities: new Map(),
    packages: new Map(),
    links: [],
  };

  const lines = splitLines(source);

  const scope: string[] = [];

  let openBody: PumlEntity | null = null;
  let bodyDepth = 0;

  for (const { text, offset } of lines) {
    const line = stripComment(text).trim();
    if (line === "") continue;


    if (openBody) {
      if (line === "}" || line.startsWith("}")) {
        bodyDepth -= 1;
        if (bodyDepth <= 0) openBody = null;
        continue;
      }
      if (line.endsWith("{")) bodyDepth += 1;
      addMember(openBody, line);
      continue;
    }

    if (line === "}" || line.startsWith("}")) {
      scope.pop();
      continue;
    }

    if (/^@(start|end)/i.test(line)) continue;
    if (/^(skinparam|!|hide|show|scale|title|header|footer|legend|caption|note|end note|left to right|top to bottom|autonumber|allow_mixing|mainframe)\b/i.test(line)) {
      continue;
    }

    const container = matchContainer(line);
    if (container) {
      const id = qualify(scope, container.name);
      model.packages.set(id, {
        id,
        label: container.label,
        parent: scope.length > 0 ? scope.join(".") : undefined,
        range: rangeOf(text, offset, container.name),
      });
      scope.push(container.name);
      continue;
    }

    const declaration = matchDeclaration(line);
    if (declaration) {
      const id = qualify(scope, declaration.name);
      const entity: PumlEntity = {
        id,
        label: declaration.label,
        shape: declaration.shape,
        stereotype: declaration.stereotype,
        sections: [],
        range: rangeOf(text, offset, declaration.anchor),
      };
      model.entities.set(id, entity);

      if (declaration.opensBody) {
        openBody = entity;
        bodyDepth = 1;
      }
      continue;
    }

    const link = matchLink(line, offset, text, scope);
    if (link) {
      model.links.push(link);


      for (const end of [link.from, link.to]) {
        if (!model.entities.has(end)) {
          model.entities.set(end, {
            id: end,
            label: end.slice(end.lastIndexOf(".") + 1),
            shape: "rect",
            sections: [],
            range: link.range,
          });
        }
      }
    }
  }

  return model;
}


export function locatePlantUml(source: string): LocateIndex {
  const model = parsePlantUml(source);

  const nodes = new Map<string, SourceRange>();
  for (const [id, entity] of model.entities) nodes.set(id, entity.range);
  for (const [id, pkg] of model.packages) nodes.set(id, pkg.range);

  const edges = new Map<string, SourceRange>();
  const seen = new Map<string, number>();
  for (const link of model.links) {
    const pair = `${link.from}->${link.to}`;
    const ordinal = seen.get(pair) ?? 0;
    seen.set(pair, ordinal + 1);
    edges.set(edgeId(link.from, link.to, ordinal), link.range);
  }

  return { nodes, edges };
}


export function detectPumlKind(source: string): string {
  const match = /^\s*@start(\w+)/im.exec(source);
  return match ? match[1]!.toLowerCase() : "uml";
}


export function matchContainer(line: string): { name: string; label: string } | null {
  const match = /^(package|namespace|together|partition)\b\s*(.*)$/i.exec(line);
  if (!match || !CONTAINER_KEYWORDS.has(match[1]!.toLowerCase())) return null;

  let rest = match[2]!.trim();
  if (!rest.endsWith("{")) return null;
  rest = rest.slice(0, -1).trim();


  const aliased = /^(?:"([^"]*)"|(\S+))\s+as\s+(\S+)$/.exec(rest);
  if (aliased) {
    return { name: aliased[3]!, label: aliased[1] ?? aliased[2] ?? aliased[3]! };
  }

  const quoted = /^"([^"]*)"$/.exec(rest);
  const name = quoted ? quoted[1]! : rest.replace(/<<.*?>>/g, "").trim();
  return name === "" ? null : { name, label: name };
}

export interface Declaration {
  name: string;
  label: string;
  shape: NodeShape;
  stereotype?: string;
  opensBody: boolean;

  anchor: string;
}

export function matchDeclaration(line: string): Declaration | null {
  const keyworded = DECLARATION.exec(line);
  if (keyworded) {
    const shape = KEYWORD_SHAPES[keyworded[2]!.toLowerCase()] ?? "rect";
    return fromRest(keyworded[3]!, shape);
  }


  const bracketed = /^(\[[^\]]+\]|\([^)]+\)|:[^:\n]+:)\s*(.*)$/.exec(line);
  if (bracketed) {
    const raw = bracketed[1]!;
    const shape: NodeShape = raw.startsWith("[")
      ? "subroutine"
      : raw.startsWith("(")
        ? "ellipse"
        : "person";
    const inner = raw.slice(1, -1);
    const rest = bracketed[2]!.trim();

    const alias = /^as\s+("?)([^"\s]+)\1/.exec(rest);
    return {
      name: alias ? alias[2]! : inner,
      label: inner,
      shape,
      opensBody: false,
      anchor: alias ? alias[2]! : raw,
    };
  }

  return null;
}


function fromRest(rest: string, shape: NodeShape): Declaration | null {
  let body = rest.trim();
  const opensBody = body.endsWith("{");
  if (opensBody) body = body.slice(0, -1).trim();

  let stereotype: string | undefined;
  body = body.replace(/<<([^>]*)>>/g, (_, s: string) => {
    stereotype = s.trim();
    return " ";
  });


  body = body.replace(/#[\w[\]:;,.-]+\s*$/g, "").trim();
  if (body === "") return null;

  const aliased = /^(?:"([^"]*)"|(\S+))\s+as\s+(?:"([^"]*)"|(\S+))$/.exec(body);
  if (aliased) {
    const first = aliased[1] ?? aliased[2]!;
    const second = aliased[3] ?? aliased[4]!;


    const nameIsSecond = aliased[1] !== undefined || aliased[4] !== undefined;
    return nameIsSecond
      ? { name: second, label: first, shape, stereotype, opensBody, anchor: second }
      : { name: first, label: second, shape, stereotype, opensBody, anchor: first };
  }

  const quoted = /^"([^"]*)"$/.exec(body);
  if (quoted) {
    return {
      name: quoted[1]!,
      label: quoted[1]!,
      shape,
      stereotype,
      opensBody,
      anchor: quoted[1]!,
    };
  }

  const name = body.split(/\s+/)[0]!;
  return { name, label: name, shape, stereotype, opensBody, anchor: name };
}

function matchLink(
  line: string,
  offset: number,
  raw: string,
  scope: readonly string[],
): PumlLink | null {
  const match = LINK.exec(line);
  if (!match?.groups) return null;

  const connector = match.groups.line!;


  if (!/[\w"\][):]/.test(match.groups.a ?? "")) return null;

  const from = qualify(scope, cleanEnd(match.groups.a!));
  const to = qualify(scope, cleanEnd(match.groups.b!));
  if (from === "" || to === "") return null;

  const label = match.groups.label?.trim();

  return {
    from,
    to,
    label: label || undefined,
    dashed: connector.includes(".."),
    head: headOf(connector, "end"),
    tail: headOf(connector, "start"),
    range: { from: offset, to: offset + raw.length },
  };
}


function cleanEnd(text: string): string {
  const trimmed = text.trim();
  if (/^(\[.*\]|\(.*\)|:.*:|".*")$/.test(trimmed)) return trimmed.slice(1, -1).trim();
  return trimmed;
}


function headOf(connector: string, end: "start" | "end"): string {
  const token = end === "start" ? connector.slice(0, 2) : connector.slice(-2);

  if (end === "start") {
    if (token.startsWith("<|")) return "generalisation";
    if (token.startsWith("<")) return "arrow";
    if (token.startsWith("*")) return "composition";
    if (token.startsWith("o")) return "aggregation";
    return "none";
  }

  if (token.endsWith("|>")) return "generalisation";
  if (token.endsWith(">")) return "arrow";
  if (token.endsWith("*")) return "composition";
  if (token.endsWith("o")) return "aggregation";
  return "none";
}


function addMember(entity: PumlEntity, line: string): void {
  const text = line.replace(/\{(field|method|static|abstract)\}/gi, "").trim();
  if (text === "" || text === "--" || /^\.\.+$/.test(text)) return;


  if (/^(-{2,}|={2,}|\.{2,}|_{2,})/.test(text)) {
    entity.sections.push({ items: [] });
    return;
  }

  const isMethod = /\(.*\)/.test(text);
  const wanted = isMethod ? 1 : 0;

  while (entity.sections.length <= wanted) entity.sections.push({ items: [] });
  entity.sections[wanted]!.items.push(text);
}


export function qualify(scope: readonly string[], name: string): string {
  return scope.length > 0 ? `${scope.join(".")}.${name}` : name;
}

export function splitLines(source: string): Array<{ text: string; offset: number }> {
  const out: Array<{ text: string; offset: number }> = [];
  let offset = 0;
  for (const text of source.split("\n")) {
    out.push({ text, offset });
    offset += text.length + 1;
  }
  return out;
}


export function stripComment(line: string): string {
  const block = line.indexOf("/'");
  if (block >= 0) return line.slice(0, block);

  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === "'" && !inQuote) return line.slice(0, i);
  }
  return line;
}


function rangeOf(text: string, offset: number, needle: string): SourceRange {
  const at = needle ? text.indexOf(needle) : -1;
  if (at < 0) return { from: offset, to: offset + text.length };
  return { from: offset + at, to: offset + at + needle.length };
}
