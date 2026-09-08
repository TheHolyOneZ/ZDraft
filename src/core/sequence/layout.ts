import type {
  ParsedMessage,
  ParsedParticipant,
  SequenceEvent,
  SequenceModel,
} from "../locate/sequence";
import type { Rect } from "../model/geometry";
import type {
  Activation,
  Fragment,
  Lifeline,
  Message,
  SequenceNote,
  SequenceScene,
} from "../model/scene";
import type { SequenceHints } from "../sidecar/types";
import { measureText } from "../render/text";
import type { DiagramTheme } from "../theme";


const HEAD_HEIGHT = 34;
const HEAD_MIN_WIDTH = 88;
const HEAD_PAD_X = 18;

const COLUMN_GAP = 56;
const TOP_MARGIN = 16;

const MESSAGE_SPACING = 40;

const SELF_MESSAGE_HEIGHT = 52;
export const ACTIVATION_WIDTH = 10;

export const ACTIVATION_STEP = 5;

export const SEQUENCE_HEAD_HEIGHT = HEAD_HEIGHT;
const FRAGMENT_HEADER = 22;
const FRAGMENT_PAD = 12;
const NOTE_PAD = 10;
const BOTTOM_MARGIN = 16;


export function messageId(from: string, to: string, ordinal: number): string {
  return ordinal === 0 ? `${from}->${to}` : `${from}->${to}#${ordinal}`;
}


export function orderLifelines(
  participants: readonly ParsedParticipant[],
  hint: readonly string[] | undefined,
): ParsedParticipant[] {
  if (!hint?.length) return [...participants];

  const byId = new Map(participants.map((p) => [p.id, p]));
  const ordered: ParsedParticipant[] = [];
  const placed = new Set<string>();

  for (const id of hint) {
    const participant = byId.get(id);
    if (participant && !placed.has(id)) {
      ordered.push(participant);
      placed.add(id);
    }
  }
  for (const participant of participants) {
    if (!placed.has(participant.id)) ordered.push(participant);
  }

  return ordered;
}

export interface SequenceLayoutOptions {
  theme: DiagramTheme;
  hints?: SequenceHints | null;
}

export function layoutSequence(
  model: SequenceModel,
  { theme, hints }: SequenceLayoutOptions,
): SequenceScene {
  const ordered = orderLifelines(model.participants, hints?.lifeline_order);
  const titleSize = theme.fontSize;


  const widths = ordered.map((p) =>
    Math.max(HEAD_MIN_WIDTH, measureText(p.label, titleSize, 600) + HEAD_PAD_X * 2),
  );


  const gaps = ordered.map((p, i) => (i === 0 ? 0 : COLUMN_GAP + (hints?.lifeline_gap?.[p.id] ?? 0)));

  widenForMessages(model, ordered, widths, gaps, theme);

  const centres: number[] = [];
  let cursor = 0;
  ordered.forEach((_, i) => {
    cursor += gaps[i]! + (i === 0 ? 0 : widths[i - 1]! / 2);
    cursor += widths[i]! / 2;
    centres.push(cursor);


  });

  const indexOf = new Map(ordered.map((p, i) => [p.id, i]));


  const messages: Message[] = [];
  const activations: Activation[] = [];
  const fragments: Fragment[] = [];
  const notes: SequenceNote[] = [];


  const open = new Map<string, number[]>();
  const openFragments: Array<{ fragment: Fragment; startY: number }> = [];
  const pairSeen = new Map<string, number>();

  let y = TOP_MARGIN + HEAD_HEIGHT + 24;
  let order = 0;

  const activate = (id: string) => {
    const stack = open.get(id) ?? [];
    stack.push(y);
    open.set(id, stack);
  };

  const deactivate = (id: string) => {
    const stack = open.get(id);
    const top = stack?.pop();
    if (top === undefined) return;
    activations.push({ lifeline: id, top, bottom: y, depth: stack!.length });
  };

  for (const event of model.events) {
    switch (event.kind) {
      case "message": {
        const placed = placeMessage(event, y, indexOf, theme, pairSeen, order++);
        if (!placed) break;

        if (event.activates) activate(event.to);
        messages.push(placed.message);
        y += placed.height + (hints?.message_gap?.[placed.message.id] ?? 0);
        if (event.deactivates) deactivate(event.to === event.from ? event.from : event.to);
        break;
      }

      case "activate":
        activate(event.participant);
        break;

      case "deactivate":
        deactivate(event.participant);
        break;

      case "note": {
        const note = placeNote(event, y, indexOf, centres, widths, theme);
        if (!note) break;
        notes.push(note);
        y += note.rect.h + 12;
        break;
      }

      case "fragment-start": {
        const fragment: Fragment = {
          id: `frag-${fragments.length}`,
          kind: event.fragment,
          label: event.label,
          rect: { x: 0, y, w: 0, h: 0 },
          dividers: [],
          sectionLabels: [],
        };
        fragments.push(fragment);
        openFragments.push({ fragment, startY: y });
        y += FRAGMENT_HEADER + FRAGMENT_PAD;
        break;
      }

      case "fragment-section": {
        const current = openFragments[openFragments.length - 1];
        if (!current) break;
        current.fragment.dividers.push(y);
        current.fragment.sectionLabels.push(event.label);
        y += FRAGMENT_HEADER;
        break;
      }

      case "fragment-end": {
        const current = openFragments.pop();
        if (!current) break;
        y += FRAGMENT_PAD;
        current.fragment.rect = { x: 0, y: current.startY, w: 0, h: y - current.startY };
        break;
      }
    }
  }


  for (const [id, stack] of open) {
    for (let depth = stack.length - 1; depth >= 0; depth--) {
      activations.push({ lifeline: id, top: stack[depth]!, bottom: y, depth });
    }
  }
  for (const { fragment, startY } of openFragments) {
    fragment.rect = { x: 0, y: startY, w: 0, h: y - startY };
  }

  const bottom = y + BOTTOM_MARGIN;


  const lifelines: Lifeline[] = ordered.map((p, i) => {
    const w = widths[i]!;
    const x = centres[i]!;
    return {
      id: p.id,
      label: p.label,
      head: { x: x - w / 2, y: TOP_MARGIN, w, h: HEAD_HEIGHT },
      x,
      bottom,
      actor: p.actor,
      sourceRange: p.range,
    };
  });


  const left = Math.min(...lifelines.map((l) => l.head.x), 0);
  const right = Math.max(...lifelines.map((l) => l.head.x + l.head.w), 0);
  for (const fragment of fragments) {
    fragment.rect = {
      x: left - FRAGMENT_PAD,
      y: fragment.rect.y,
      w: right - left + FRAGMENT_PAD * 2,
      h: fragment.rect.h,
    };
  }

  const bounds: Rect = {
    x: left - FRAGMENT_PAD * 2,
    y: 0,
    w: right - left + FRAGMENT_PAD * 4,

    h: bottom + HEAD_HEIGHT + TOP_MARGIN,
  };

  return {
    family: "sequence",
    engine: "mermaid",
    diagramType: "sequence",
    lifelines,
    messages,
    activations: activations.map((a) => ({
      ...a,

      depth: a.depth,
    })),
    fragments,
    notes,
    bounds,
  };
}


function widenForMessages(
  model: SequenceModel,
  ordered: readonly ParsedParticipant[],
  widths: readonly number[],
  gaps: number[],
  theme: DiagramTheme,
): void {
  const indexOf = new Map(ordered.map((p, i) => [p.id, i]));

  for (const event of model.events) {
    if (event.kind !== "message") continue;

    const from = indexOf.get(event.from);
    const to = indexOf.get(event.to);
    if (from === undefined || to === undefined || from === to) continue;

    const lo = Math.min(from, to);
    const hi = Math.max(from, to);

    const needed = measureText(event.text, theme.fontSize - 1, 500) + 28;
    let available = 0;
    for (let i = lo + 1; i <= hi; i++) available += gaps[i]! + widths[i - 1]! / 2 + widths[i]! / 2;

    const deficit = needed - available;
    if (deficit <= 0) continue;

    const share = deficit / (hi - lo);
    for (let i = lo + 1; i <= hi; i++) gaps[i] = gaps[i]! + share;
  }
}

function placeMessage(
  event: ParsedMessage,
  y: number,
  indexOf: ReadonlyMap<string, number>,
  theme: DiagramTheme,
  pairSeen: Map<string, number>,
  order: number,
): { message: Message; height: number } | null {
  const from = indexOf.get(event.from);
  const to = indexOf.get(event.to);
  if (from === undefined || to === undefined) return null;

  const key = `${event.from}->${event.to}`;
  const ordinal = pairSeen.get(key) ?? 0;
  pairSeen.set(key, ordinal + 1);

  const selfLoop = event.arrow === "self";
  const lines = event.text.split("\n").length;
  const height = selfLoop
    ? SELF_MESSAGE_HEIGHT
    : MESSAGE_SPACING + (lines - 1) * theme.fontSize * 1.3;

  return {
    message: {
      id: messageId(event.from, event.to, ordinal),
      from: event.from,
      to: event.to,
      label: event.text,
      y,
      kind: event.arrow,
      order,
      sourceRange: event.range,
    },
    height,
  };
}

function placeNote(
  event: Extract<SequenceEvent, { kind: "note" }>,
  y: number,
  indexOf: ReadonlyMap<string, number>,
  centres: readonly number[],
  widths: readonly number[],
  theme: DiagramTheme,
): SequenceNote | null {
  const columns = event.participants
    .map((id) => indexOf.get(id))
    .filter((i): i is number => i !== undefined);
  if (columns.length === 0) return null;

  const lines = event.text.split("\n");
  const textWidth = Math.max(...lines.map((l) => measureText(l, theme.fontSize - 1, 400)));
  const h = lines.length * theme.fontSize * 1.4 + NOTE_PAD * 2;

  if (event.placement === "over") {
    const lo = Math.min(...columns);
    const hi = Math.max(...columns);
    const x = centres[lo]! - widths[lo]! / 2;
    const w = Math.max(textWidth + NOTE_PAD * 2, centres[hi]! + widths[hi]! / 2 - x);
    return { id: `note-${y}`, text: event.text, rect: { x, y, w, h }, over: event.participants };
  }

  const column = columns[0]!;
  const w = textWidth + NOTE_PAD * 2;
  const x =
    event.placement === "right"
      ? centres[column]! + widths[column]! / 2 + 12
      : centres[column]! - widths[column]! / 2 - 12 - w;

  return { id: `note-${y}`, text: event.text, rect: { x, y, w, h }, over: event.participants };
}
