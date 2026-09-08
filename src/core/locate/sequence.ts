import type { MessageKind, SourceRange } from "../model/scene";


export interface ParsedParticipant {
  id: string;
  label: string;

  actor: boolean;
  range: SourceRange;

  implicit: boolean;
}

export interface ParsedMessage {
  kind: "message";
  from: string;
  to: string;
  text: string;
  arrow: MessageKind;
  dashed: boolean;

  activates: boolean;
  deactivates: boolean;
  range: SourceRange;
}

export type SequenceEvent =
  | ParsedMessage
  | { kind: "activate" | "deactivate"; participant: string; range: SourceRange }
  | {
      kind: "note";
      placement: "left" | "right" | "over";
      participants: string[];
      text: string;
      range: SourceRange;
    }
  | {
      kind: "fragment-start";
      fragment: "alt" | "opt" | "loop" | "par" | "critical" | "break" | "rect";
      label: string;
      range: SourceRange;
    }
  | { kind: "fragment-section"; label: string; range: SourceRange }
  | { kind: "fragment-end"; range: SourceRange };

export interface SequenceModel {
  title?: string;
  autonumber: boolean;
  participants: ParsedParticipant[];
  events: SequenceEvent[];
}


const ARROWS: Array<{ op: string; arrow: MessageKind; dashed: boolean }> = [
  { op: "<<-->>", arrow: "sync", dashed: true },
  { op: "<<->>", arrow: "sync", dashed: false },
  { op: "-->>", arrow: "reply", dashed: true },
  { op: "->>", arrow: "sync", dashed: false },
  { op: "--)", arrow: "async", dashed: true },
  { op: "-)", arrow: "async", dashed: false },
  { op: "--x", arrow: "destroy", dashed: true },
  { op: "-x", arrow: "destroy", dashed: false },
  { op: "-->", arrow: "reply", dashed: true },
  { op: "->", arrow: "sync", dashed: false },
];

const FRAGMENTS = ["alt", "opt", "loop", "par", "critical", "break", "rect"] as const;

function clean(text: string): string {
  return text
    .trim()
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/^["']|["']$/g, "")
    .trim();
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

export function parseSequence(source: string): SequenceModel {
  const model: SequenceModel = { autonumber: false, participants: [], events: [] };
  const byId = new Map<string, ParsedParticipant>();


  const ensure = (id: string, range: SourceRange, implicit = true): ParsedParticipant => {
    const existing = byId.get(id);
    if (existing) return existing;

    const participant: ParsedParticipant = { id, label: id, actor: false, range, implicit };
    byId.set(id, participant);
    model.participants.push(participant);
    return participant;
  };

  for (const { text, offset } of splitLines(source)) {
    const line = text.replace(/%%.*$/, "");
    const trimmed = line.trim();
    if (trimmed === "" || /^sequenceDiagram\b/.test(trimmed)) continue;

    const at = offset + line.indexOf(trimmed);
    const range: SourceRange = { from: at, to: offset + line.trimEnd().length };

    if (/^autonumber\b/.test(trimmed)) {
      model.autonumber = true;
      continue;
    }

    const title = /^title\s+(.*)$/.exec(trimmed);
    if (title) {
      model.title = clean(title[1]!);
      continue;
    }


    const declared = /^(participant|actor)\s+(.+)$/.exec(trimmed);
    if (declared) {
      const rest = declared[2]!;
      const alias = /^(\S+)\s+as\s+(.+)$/.exec(rest);
      const id = alias ? alias[1]! : rest.trim().split(/\s+/)[0]!;

      const participant = ensure(id, range, false);
      participant.implicit = false;
      participant.actor = declared[1] === "actor";
      participant.range = range;
      if (alias) participant.label = clean(alias[2]!);
      continue;
    }

    if (/^(activate|deactivate)\s+\S+/.test(trimmed)) {
      const [, verb, who] = /^(activate|deactivate)\s+(\S+)/.exec(trimmed)!;
      ensure(who!, range);
      model.events.push({
        kind: verb === "activate" ? "activate" : "deactivate",
        participant: who!,
        range,
      });
      continue;
    }


    const note = /^note\s+(left of|right of|over)\s+([^:]+):\s*(.*)$/i.exec(trimmed);
    if (note) {
      const who = note[2]!
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const id of who) ensure(id, range);

      model.events.push({
        kind: "note",
        placement: note[1]!.toLowerCase().startsWith("left")
          ? "left"
          : note[1]!.toLowerCase().startsWith("right")
            ? "right"
            : "over",
        participants: who,
        text: clean(note[3]!),
        range,
      });
      continue;
    }

    if (trimmed === "end") {
      model.events.push({ kind: "fragment-end", range });
      continue;
    }


    const section = /^(else|and|option)\b\s*(.*)$/.exec(trimmed);
    if (section) {
      model.events.push({ kind: "fragment-section", label: clean(section[2]!), range });
      continue;
    }

    const fragment = FRAGMENTS.find((f) => new RegExp(`^${f}\\b`).test(trimmed));
    if (fragment) {
      model.events.push({
        kind: "fragment-start",
        fragment,
        label: clean(trimmed.slice(fragment.length)),
        range,
      });
      continue;
    }

    const message = parseMessage(trimmed, range);
    if (message) {
      ensure(message.from, range);
      ensure(message.to, range);
      model.events.push(message);
    }
  }

  return model;
}

function parseMessage(line: string, range: SourceRange): ParsedMessage | null {
  for (const form of ARROWS) {
    const at = line.indexOf(form.op);
    if (at <= 0) continue;

    const left = line.slice(0, at).trim();
    const rest = line.slice(at + form.op.length);

    const colon = rest.indexOf(":");
    if (colon < 0) continue;

    let right = rest.slice(0, colon).trim();
    const text = clean(rest.slice(colon + 1));


    let activates = false;
    let deactivates = false;
    if (right.startsWith("+")) {
      activates = true;
      right = right.slice(1).trim();
    } else if (right.startsWith("-")) {
      deactivates = true;
      right = right.slice(1).trim();
    }

    if (!/^[\w.$-]+$/.test(left) || !/^[\w.$-]+$/.test(right)) continue;

    return {
      kind: "message",
      from: left,
      to: right,
      text,


      arrow: left === right ? "self" : form.arrow,
      dashed: form.dashed,
      activates,
      deactivates,
      range,
    };
  }

  return null;
}


export function locateSequence(source: string): {
  nodes: Map<string, SourceRange>;
  edges: Map<string, SourceRange>;
} {
  const model = parseSequence(source);
  const nodes = new Map<string, SourceRange>();
  const edges = new Map<string, SourceRange>();

  for (const participant of model.participants) nodes.set(participant.id, participant.range);

  let ordinal = 0;
  for (const event of model.events) {
    if (event.kind === "message") edges.set(`m${ordinal++}`, event.range);
  }

  return { nodes, edges };
}
