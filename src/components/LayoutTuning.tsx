import { AnimatePresence, motion } from "motion/react";
import { FileCode2, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { LayoutKnob } from "../core/edit/types";
import { adapterFor, useDocumentStore } from "../store/useDocumentStore";
import { IconButton, Select, Slider, Tooltip } from "./ui";
import { useDismiss, useFloatingPosition, usePrefersReducedMotion } from "./ui/hooks";


export function LayoutTuning() {
  const engine = useDocumentStore((s) => s.engine);
  const source = useDocumentStore((s) => s.source);
  const tuneLayout = useDocumentStore((s) => s.tuneLayout);

  const tuner = adapterFor(engine).edit?.tuning;

  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const reduced = usePrefersReducedMotion();

  const close = useCallback(() => setOpen(false), []);
  const refs = useMemo(() => [anchorRef, panelRef], []);
  useDismiss(open, close, refs);
  const position = useFloatingPosition(open, anchorRef, panelRef);

  const current = useMemo(
    () => (tuner ? tuner.read(source) : {}),
    [tuner, source],
  );

  if (!tuner) return null;

  const changed = tuner.knobs.filter(
    (knob) => current[knob.id] !== undefined && current[knob.id] !== knob.fallback,
  ).length;

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        <IconButton
          icon={<SlidersHorizontal size={15} strokeWidth={1.75} />}
          onClick={() => setOpen((v) => !v)}
          active={open}
          title={
            changed === 0
              ? "Tune the layout — direction, spacing, edge style"
              : `Tune the layout — ${changed} set`
          }
        />
      </span>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: -2 }}
              transition={reduced ? { duration: 0.1 } : { duration: 0.14 }}


              className="glass fixed z-[400] flex w-[320px] flex-col gap-3 rounded-xl p-3"
              style={{
                top: position?.top ?? -9999,
                left: position?.left ?? -9999,
                visibility: position ? "visible" : "hidden",
              }}
            >
          <Tooltip label="Every control here changes your diagram source file">
            <span
              className="flex items-center gap-1.5"
              style={{ color: "var(--text-3)" }}
            >
              <FileCode2 size={12} strokeWidth={1.75} />
              <span className="text-[10px] font-semibold tracking-[0.08em] uppercase">
                Layout · {engine}
              </span>
            </span>
          </Tooltip>

          {tuner.knobs.map((knob) => (
            <Knob
              key={knob.id}
              knob={knob}
              value={current[knob.id] ?? knob.fallback}
              set={(next) => tuneLayout(knob.id, next)}
            />
          ))}

              <p className="text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
                These are the engine's own parameters, written into your source —
                so the diagram looks the same wherever it is rendered.
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}

/**
 * A number as short as it can be written without changing it.
 *
 * A step of 0.05 produces `0.35000000000000003`, and writing that into
 * someone's source is the kind of thing that makes a tool look careless.
 */
function trim(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function Knob({
  knob,
  value,
  set,
}: {
  knob: LayoutKnob;
  value: string;
  set(next: string): void;
}) {
  const isDefault = value === knob.fallback;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <span className="text-[12px]" style={{ color: "var(--text)" }}>
          {knob.label}
        </span>
        {!isDefault && (
          <Tooltip label={`Back to the engine's default (${knob.fallback})`}>
            <button
              type="button"
              onClick={() => set(knob.fallback)}
              className="focus-ring ml-auto inline-flex cursor-pointer items-center gap-1 rounded px-1 text-[10px]"
              style={{ color: "var(--text-3)" }}
            >
              <RotateCcw size={10} strokeWidth={2} />
              default
            </button>
          </Tooltip>
        )}
      </div>

      {knob.kind === "choice" ? (
        <Select
          value={value}
          options={(knob.choices ?? []).map((c) => ({ value: c.value, label: c.label }))}
          onChange={set}
          menuWidth={260}
          block
        />
      ) : (
        <Slider
          value={Number(value)}
          min={knob.min ?? 0}
          max={knob.max ?? 1}
          step={knob.step ?? 1}
          onChange={(next) => set(trim(next))}
        />
      )}

      <span className="text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
        {knob.note}
      </span>
    </div>
  );
}
