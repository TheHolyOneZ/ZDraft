import { motion } from "motion/react";
import { Check, Command, Download, Keyboard, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import type { Pin } from "../core/sidecar/types";
import { useDocumentStore } from "../store/useDocumentStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useTourStore } from "../store/useTourStore";
import { Button, IconButton, SPRING, usePrefersReducedMotion } from "./ui";


interface Gauge {
  pins: string;
  selection: number;
}


interface Facts {
  name: string;
  pin: [string, Pin] | null;
}

type Placement = "auto" | "top" | "bottom" | "left" | "right" | "inside" | "centre";

interface Step {
  id: string;
  title: string;
  body(facts: Facts): ReactNode;

  anchor?: string;
  place?: Placement;


  task?: {
    prompt: string;
    praise: string;
    done(now: Gauge, start: Gauge): boolean;
  };
}

const STEPS: readonly Step[] = [
  {
    id: "opening",
    title: "ZDraft",
    place: "centre",
    body: () => (
      <>
        <p>
          You write the diagram in text. Auto-layout draws it. When it puts something in a stupid
          place you drag it — and the drag survives, without your source file changing by a byte.
        </p>
        <p className="mt-2">Eight screens, and two of them you get to do yourself.</p>
      </>
    ),
  },
  {
    id: "panes",
    title: "One document, two views",
    anchor: "panes",
    place: "inside",
    body: () => (
      <p>
        Type on the left and the picture redraws. Click a box on the right and the cursor lands on
        the line that declares it. Neither side is a preview of the other.
      </p>
    ),
    task: {
      prompt: "Click any box on the canvas",
      praise: "The cursor moved to the line that box came from.",
      done: (now) => now.selection > 0,
    },
  },
  {
    id: "drag",
    title: "Move something",
    anchor: "canvas",
    place: "inside",
    body: () => (
      <p>
        Auto-layout is a guess. It is a good guess, and it is wrong often enough that every
        diagram-as-code tool gets the same complaint: two boxes on top of each other and no way to
        nudge them.
      </p>
    ),
    task: {
      prompt: "Drag a box somewhere better",
      praise:
        "That is a pin. Amber, in every theme, and it means exactly one thing: you overrode the layout here.",
      done: (now, start) => now.pins !== start.pins,
    },
  },
  {
    id: "sidecar",
    title: "Where the move went",
    anchor: "pins",
    place: "right",
    body: ({ name, pin }) => (
      <>
        <p>
          Not into your diagram. Into a file beside it — readable, reviewable, and yours to delete.
        </p>
        <pre
          className="mt-2.5 overflow-x-auto rounded-lg px-2.5 py-2 font-mono text-[11px] leading-relaxed"
          style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text-2)" }}
        >
          <span style={{ color: "var(--text-3)" }}># {name}.zlayout.toml</span>
          {"\n"}
          <span style={{ color: "var(--pin)" }}>[pins.{pin ? pin[0] : "gateway"}]</span>
          {"\n"}x = {pin ? round(pin[1].x) : "128"}
          {"\n"}y = {pin ? round(pin[1].y) : "96"}
        </pre>
        <p className="mt-2.5">
          Every pin is listed here, counted, and removable. Delete the file and you are back to pure
          auto-layout — there is no cache anywhere that has to agree with it.
        </p>
      </>
    ),
  },
  {
    id: "diagnostics",
    title: "When something is wrong",
    anchor: "diagnostics",
    place: "top",
    body: () => (
      <p>
        Parse errors, boxes that overlap, pins that no longer fit anything they can be placed on —
        they arrive down here with a line number and something to click. Never as a dialog in front
        of the work.
      </p>
    ),
  },
  {
    id: "engines",
    title: "Four engines, one canvas",
    anchor: "engine",
    place: "bottom",
    body: () => (
      <p>
        Graphviz, Mermaid, D2 and PlantUML, chosen per file. Dragging, pinning and exporting work
        the same in all four, and ZDraft never rewrites your source into a language of its own —
        what you paste into GitHub is what you typed.
      </p>
    ),
  },
  {
    id: "present",
    title: "Show it to a room",
    anchor: "present",
    place: "bottom",
    body: () => (
      <p>
        <kbd className="tour-kbd">F5</kbd> reveals the diagram a step at a time, full screen, with
        your notes and highlights. It is the drawing itself, not an export of it — so the last thing
        you changed is the thing on the wall.
      </p>
    ),
  },
  {
    id: "done",
    title: "That is the whole idea",
    place: "centre",
    body: () => (
      <>
        <p>Everything else is in reach from three keys:</p>
        <div className="mt-3 flex flex-col gap-1.5">
          <Chip icon={<Command size={13} strokeWidth={1.75} />} keys="Ctrl K">
            Everything ZDraft does, by name
          </Chip>
          <Chip icon={<Keyboard size={13} strokeWidth={1.75} />} keys="Ctrl /">
            The keyboard, written down
          </Chip>
          <Chip icon={<Download size={13} strokeWidth={1.75} />} keys="Ctrl E">
            SVG, PNG, PDF, or straight to the clipboard
          </Chip>
        </div>
        <p className="mt-3 text-[11px]" style={{ color: "var(--text-3)" }}>
          Run this again any time: <kbd className="tour-kbd">Ctrl K</kbd> → “Take the tour”.
        </p>
      </>
    ),
  },
];

function Chip({ icon, keys, children }: { icon: ReactNode; keys: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[12px]" style={{ color: "var(--text-2)" }}>
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
        style={{ background: "var(--control)", color: "var(--accent)" }}
      >
        {icon}
      </span>
      <kbd className="tour-kbd shrink-0">{keys}</kbd>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

const round = (n: number) => (Math.round(n * 10) / 10).toString();

/* -------------------------------------------------------------------------- */
/* Placement                                                                  */
/* -------------------------------------------------------------------------- */

/** Air between the card and the window edge, and between the card and its anchor. */
const MARGIN = 20;
const GAP = 16;
/** The titlebar's height, which is the window's close button and not free space. */
const TITLEBAR = 36;
/** How far the spotlight opens beyond the thing it is lighting. */
const HALO = 6;

const CARD_WIDTH = 344;

function place(
  mode: Placement,
  anchor: Box | null,
  card: { width: number; height: number },
): { left: number; top: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;

  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), Math.max(MARGIN, W - card.width - MARGIN));
  const clampY = (y: number) =>
    Math.min(Math.max(y, TITLEBAR + MARGIN), Math.max(TITLEBAR + MARGIN, H - card.height - MARGIN));

  if (!anchor || mode === "centre") {
    return { left: (W - card.width) / 2, top: clampY((H - card.height) / 2) };
  }

  /* The card sits *in* the region it is describing rather than beside it. The
     only thing that works when the region is most of the window: there is no
     "beside" for a canvas that runs to three edges. */
  if (mode === "inside") {
    return {
      left: clampX(anchor.right - card.width - GAP * 1.5),
      top: clampY(anchor.bottom - card.height - GAP * 1.5),
    };
  }

  const room = {
    top: anchor.top - TITLEBAR,
    bottom: H - anchor.bottom,
    left: anchor.left,
    right: W - anchor.right,
  };
  const need = { top: card.height, bottom: card.height, left: card.width, right: card.width };

  const sides = ["bottom", "top", "right", "left"] as const;
  const side =
    mode === "auto"
      ? (sides.find((s) => room[s] >= need[s] + GAP + MARGIN) ??
        sides.reduce((best, s) => (room[s] - need[s] > room[best] - need[best] ? s : best), "bottom"))
      : mode;

  const midX = anchor.left + anchor.width / 2 - card.width / 2;
  const midY = anchor.top + anchor.height / 2 - card.height / 2;

  switch (side) {
    case "top":
      return { left: clampX(midX), top: clampY(anchor.top - card.height - GAP) };
    case "left":
      return { left: clampX(anchor.left - card.width - GAP), top: clampY(midY) };
    case "right":
      return { left: clampX(anchor.right + GAP), top: clampY(midY) };
    default:
      return { left: clampX(midX), top: clampY(anchor.bottom + GAP) };
  }
}

interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
};

const sameBox = (a: Box | null, b: Box | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

/* -------------------------------------------------------------------------- */
/* The overlay                                                                */
/* -------------------------------------------------------------------------- */

export function Tour() {
  const running = useTourStore((s) => s.running);
  const index = useTourStore((s) => s.step);
  const go = useTourStore((s) => s.go);
  const end = useTourStore((s) => s.end);

  const reduced = usePrefersReducedMotion();

  const pinMap = useDocumentStore((s) => s.layout.pins);
  const selection = useDocumentStore((s) => s.selection.size);
  const name = useDocumentStore((s) => s.name);

  const pinsKey = useMemo(() => JSON.stringify(pinMap ?? {}), [pinMap]);

  /* Which pin the sidecar step shows. Set to whatever the drag step's own drag
     produced, so the TOML on screen is the move the reader just made rather
     than an arbitrary one from further up the file. */
  const [shown, setShown] = useState<string | null>(null);
  const facts = useMemo<Facts>(() => {
    const table = pinMap ?? {};
    const id = shown && table[shown] ? shown : (Object.keys(table)[0] ?? null);
    return { name, pin: id ? [id, table[id]!] : null };
  }, [name, pinMap, shown]);

  const step = STEPS[Math.min(index, STEPS.length - 1)]!;
  const last = index >= STEPS.length - 1;

  /* -- what the step is waiting for --------------------------------------- */

  const gauge = useMemo<Gauge>(() => ({ pins: pinsKey, selection }), [pinsKey, selection]);
  const gaugeRef = useRef(gauge);
  gaugeRef.current = gauge;

  const start = useRef<Gauge>(gauge);
  const [done, setDone] = useState(false);

  useEffect(() => {
    start.current = gaugeRef.current;
    setDone(false);
  }, [index, running]);

  /* The pin table as it was when the step opened, kept beside the gauge so the
     step that follows can name the box that moved. */
  const startPins = useRef(pinMap);
  const pinMapRef = useRef(pinMap);
  pinMapRef.current = pinMap;

  useEffect(() => {
    startPins.current = pinMapRef.current;
  }, [index, running]);

  useEffect(() => {
    if (!running || done || !step.task) return;
    if (!step.task.done(gauge, start.current)) return;

    setDone(true);

    const before = startPins.current ?? {};
    const after = pinMap ?? {};
    const moved = Object.keys(after).find(
      (id) => JSON.stringify(after[id]) !== JSON.stringify(before[id]),
    );
    if (moved) setShown(moved);
  }, [running, done, step, gauge, pinMap]);

  /* -- where to point ------------------------------------------------------ */

  const [anchor, setAnchor] = useState<Box | null>(null);

  useLayoutEffect(() => {
    if (!running) return;

    const measure = () => {
      const el = step.anchor ? document.querySelector(`[data-tour="${step.anchor}"]`) : null;
      const next = el ? boxOf(el) : null;
      setAnchor((prev) => (sameBox(prev, next) ? prev : next));
    };

    measure();
    window.addEventListener("resize", measure);
    /* Panels open, the diagnostics strip is dragged, a diagram re-lays out —
       none of which fires an event this component could listen for. Polling a
       single `getBoundingClientRect` is cheaper than the machinery that would
       catch every one of them, and the equality check above means an unchanged
       rect costs no render. */
    const timer = window.setInterval(measure, 300);
    return () => {
      window.removeEventListener("resize", measure);
      window.clearInterval(timer);
    };
  }, [running, step]);

  const nextRef = useRef<HTMLSpanElement | null>(null);
  const [card, setCard] = useState<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  /* Observed rather than measured once per step: the card's height changes when
     a task is satisfied and when its copy is swapped, and a card measured
     before either has happened is a card placed half off the bottom of the
     window. `offsetHeight` and not `getBoundingClientRect`, because the card
     scales as it appears and a rect would report the scaled size. */
  useLayoutEffect(() => {
    if (!card) return;

    const read = () =>
      setSize((prev) =>
        prev && prev.width === card.offsetWidth && prev.height === card.offsetHeight
          ? prev
          : { width: card.offsetWidth, height: card.offsetHeight },
      );

    read();
    const observer = new ResizeObserver(read);
    observer.observe(card);
    return () => observer.disconnect();
  }, [card]);

  useLayoutEffect(() => {
    if (!running || !size) return;

    const next = place(step.place ?? "auto", anchor, size);
    setAt((prev) =>
      prev && Math.abs(prev.left - next.left) < 0.5 && Math.abs(prev.top - next.top) < 0.5
        ? prev
        : next,
    );
  }, [running, step, anchor, size]);

  useEffect(() => {
    if (!running || step.task) return;
    nextRef.current?.querySelector("button")?.focus();
  }, [running, step]);

  /* -- getting out --------------------------------------------------------- */

  const next = useCallback(() => {
    if (last) end();
    else go(index + 1);
  }, [last, end, go, index]);

  /**
   * Escape leaves the tour, and does only that.
   *
   * On `window` and bubbling, like the app's own key handling, for two
   * reasons. A modal or the command palette opened over the tour dismisses on
   * Escape in the capture phase and stops the event there, so it never reaches
   * this — one Escape closes one thing, and the innermost thing wins. And
   * because a child's effect runs before its parent's, this listener is
   * registered ahead of App's, so stopping the rest of the chain here means
   * leaving the tour does not also clear the selection behind it.
   *
   * Nothing else is bound. The arrow keys nudge a node and Space pans the
   * canvas; a tour is not worth breaking either, and the card has buttons.
   */
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [running, end]);

  /* The pins panel and the diagnostics strip are two of the seven stops, and a
     tour pointing at something that is not on screen is worse than no tour. */
  useEffect(() => {
    if (!running) return;
    const settings = useSettingsStore.getState();
    if (settings.zenMode) settings.toggleZen();
    if (!settings.sidebarOpen) settings.toggleSidebar();
    if (settings.splitMode === "canvas") settings.setSplitMode("vertical");
  }, [running]);

  if (!running) return null;

  const waiting = Boolean(step.task) && !done;
  const spot = anchor ?? {
    left: window.innerWidth / 2,
    top: window.innerHeight / 2,
    right: window.innerWidth / 2,
    bottom: window.innerHeight / 2,
    width: 0,
    height: 0,
  };

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[380]">
      {/* The dim is this element's shadow, so it costs nothing to draw and takes
          no clicks — the app stays usable through the whole tour. */}
      <motion.div
        className="absolute"
        initial={false}
        animate={{
          left: spot.left - HALO,
          top: spot.top - HALO,
          width: Math.max(0, spot.width + HALO * 2),
          height: Math.max(0, spot.height + HALO * 2),
          opacity: 1,
        }}
        transition={reduced ? { duration: 0 } : SPRING.default}
        style={{
          borderRadius: 14,
          boxShadow: "0 0 0 9999px rgba(3,6,10,0.66)",
          border: anchor ? "1px solid var(--accent-line)" : "1px solid transparent",
        }}
      />

      {/* One card for the whole tour, moved rather than replaced. Replacing it
          per step meant measuring the outgoing element — which is how a card
          ends up clamped against a height it no longer has. The travelling is
          the spotlight's job; the card cuts, and only its contents fade. */}
      <motion.div
        ref={setCard}
        role="dialog"
        aria-label={step.title}
        className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-2xl"
        style={{
          width: CARD_WIDTH,
          left: at?.left ?? 0,
          top: at?.top ?? 0,
          visibility: at ? "visible" : "hidden",
          background: "var(--surface)",
          border: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-3)",
        }}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={reduced ? { duration: 0.1 } : { type: "spring", stiffness: 260, damping: 26 }}
      >
        {/* A hairline of accent along the top: the one piece of colour on a
            deliberately quiet card, and what makes it read as ZDraft's rather
            than the operating system's. */}
        <div className="h-[2px] shrink-0" style={{ background: "var(--accent)" }} />

        {/* Keyed on the step, so React replaces the copy outright and the fade
            below plays for the new one. No exit animation: an emptying card
            collapses, and a collapsing card is measured and re-placed. */}
        <motion.div
          key={step.id}
          className="px-4 pt-3.5 pb-3"
          initial={reduced ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.18 }}
        >
          <div className="mb-1.5 flex items-start justify-between gap-3">
            <h2
              className="mt-px text-[15px] font-semibold tracking-[-0.005em]"
              style={{ color: "var(--text)" }}
            >
              {step.title}
            </h2>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="tnum text-[11px]" style={{ color: "var(--text-3)" }}>
                {index + 1}/{STEPS.length}
              </span>
              {/* In the card rather than floating over the app: anywhere else it
                  eventually lands on top of the card, because the card goes
                  wherever the step it is describing is. */}
              <IconButton
                icon={<X size={14} strokeWidth={1.75} />}
                onClick={end}
                title="Skip the tour"
                shortcut="Esc"
                size={22}
              />
            </div>
          </div>

          <div className="text-[12px] leading-relaxed" style={{ color: "var(--text-2)" }}>
            {step.body(facts)}
          </div>

          {step.task && (
            <div
              className="mt-3 flex items-start gap-2.5 rounded-lg px-2.5 py-2"
              style={{
                background: done ? "var(--accent-soft)" : "var(--pin-soft)",
                border: `1px solid ${done ? "var(--accent-line)" : "var(--pin)"}`,
              }}
            >
              <span
                className="mt-[1px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
                style={{ background: done ? "var(--accent)" : "var(--pin)" }}
              >
                {done ? (
                  <motion.span
                    initial={reduced ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={SPRING.snappy}
                    className="flex"
                  >
                    <Check size={11} strokeWidth={3} color="var(--accent-text)" />
                  </motion.span>
                ) : (
                  /* The one thing on screen that keeps moving while the tour
                     waits, so an unfinished step never reads as a frozen app. */
                  <motion.span
                    className="block h-1.5 w-1.5 rounded-full"
                    style={{ background: "rgba(0,0,0,0.55)" }}
                    animate={reduced ? {} : { scale: [1, 0.5, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </span>
              <span className="text-[12px] leading-snug" style={{ color: "var(--text)" }}>
                {done ? step.task.praise : step.task.prompt}
              </span>
            </div>
          )}
        </motion.div>

        <div
          className="flex items-center gap-2 px-4 py-2.5"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <Dots count={STEPS.length} at={index} onGo={go} reduced={reduced} />

          <div className="ml-auto flex items-center gap-2">
            {index > 0 && <Button onClick={() => go(index - 1)}>Back</Button>}

            {waiting ? (
              <Button onClick={next}>Skip this</Button>
            ) : (
              /* Focused on arrival for the steps that only ask you to read, so
                 Enter carries on. Never during a task — the point of one is
                 that the app underneath has the focus. */
              <span ref={nextRef}>
                <Button variant="primary" onClick={next}>
                  {last ? "Start drawing" : index === 0 ? "Show me" : "Next"}
                </Button>
              </span>
            )}
          </div>
        </div>
      </motion.div>

    </div>,
    document.body,
  );
}

/**
 * The progress dots, which are also the fastest way back to a step.
 *
 * The current one is a pill rather than a bigger dot: it reads as a position on
 * a line instead of a decoration, and it animates its width, which is the one
 * piece of motion in the card that says "you moved".
 */
function Dots({
  count,
  at,
  onGo,
  reduced,
}: {
  count: number;
  at: number;
  onGo(step: number): void;
  reduced: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <motion.button
          key={i}
          type="button"
          aria-label={`Step ${i + 1}`}
          aria-current={i === at}
          onClick={() => onGo(i)}
          className="h-1.5 rounded-full"
          initial={false}
          animate={{ width: i === at ? 16 : 6 }}
          transition={reduced ? { duration: 0 } : SPRING.snappy}
          style={{
            background: i === at ? "var(--accent)" : i < at ? "var(--text-3)" : "var(--border-strong)",
          }}
        />
      ))}
    </div>
  );
}
