import clsx from "clsx";
import { motion } from "motion/react";
import { Check, Minus } from "lucide-react";
import { useCallback, useId, useRef, useState, type ReactNode } from "react";

import { usePrefersReducedMotion } from "./hooks";


const SNAPPY = { type: "spring", stiffness: 500, damping: 35 } as const;
const DEFAULT = { type: "spring", stiffness: 300, damping: 30 } as const;


export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  size = "md",
}: {
  checked: boolean;
  onChange(next: boolean): void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const reduced = usePrefersReducedMotion();
  const id = useId();
  const dims = size === "sm" ? { w: 30, h: 17, knob: 13 } : { w: 38, h: 21, knob: 17 };

  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={label ? id : undefined}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={clsx(
        "focus-ring relative shrink-0 rounded-full transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      )}
      style={{
        width: dims.w,
        height: dims.h,
        background: checked ? "var(--accent)" : "var(--input)",
        border: `1px solid ${checked ? "var(--accent)" : "var(--border-strong)"}`,


        boxShadow: checked ? "0 0 0 3px var(--accent-soft)" : "none",
      }}
    >
      <motion.span
        className="absolute top-1/2 block rounded-full"
        style={{
          width: dims.knob,
          height: dims.knob,
          background: checked ? "var(--accent-text)" : "var(--text-2)",
          boxShadow: "var(--shadow-1)",
        }}
        animate={{
          x: checked ? dims.w - dims.knob - 3 : 1,
          y: "-50%",
        }}
        transition={reduced ? { duration: 0.1 } : SNAPPY}
      />
    </button>
  );

  if (!label) return track;

  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      {track}
      <span className="min-w-0">
        <span id={id} className="block text-[12px] font-medium" style={{ color: "var(--text)" }}>
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}


export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;

  indeterminate?: boolean;
  onChange(next: boolean): void;
  label?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const on = checked || indeterminate;

  const box = (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      whileTap={disabled || reduced ? undefined : { scale: 0.9 }}
      transition={SNAPPY}
      className={clsx(
        "focus-ring flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      )}
      style={{
        background: on ? "var(--accent)" : "transparent",
        border: `1.5px solid ${on ? "var(--accent)" : "var(--border-strong)"}`,
        color: "var(--accent-text)",
      }}
    >
      <motion.span
        initial={false}
        animate={{ scale: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={reduced ? { duration: 0.1 } : SNAPPY}
        className="flex"
      >
        {indeterminate ? <Minus size={11} strokeWidth={3.5} /> : <Check size={11} strokeWidth={3.5} />}
      </motion.span>
    </motion.button>
  );

  if (!label) return box;

  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      {box}
      <span className="min-w-0">
        <span className="block text-[12px] font-medium" style={{ color: "var(--text)" }}>
          {label}
        </span>
        {description && (
          <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}


export interface Segment<T extends string> {
  value: T;
  label?: ReactNode;
  icon?: ReactNode;
  title?: string;
}


export function SegmentedControl<T extends string>({
  value,
  segments,
  onChange,
  size = "md",
  "aria-label": ariaLabel,
}: {
  value: T;
  segments: readonly Segment<T>[];
  onChange(value: T): void;
  size?: "sm" | "md";
  "aria-label"?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const groupId = useId();
  const height = size === "sm" ? 24 : 28;

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="relative flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
      style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      onKeyDown={(e) => {
        const i = segments.findIndex((s) => s.value === value);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(segments[(i + 1) % segments.length]!.value);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(segments[(i - 1 + segments.length) % segments.length]!.value);
        }
      }}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <button
            key={segment.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={segment.title}
            title={segment.title}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(segment.value)}
            className="focus-ring relative flex cursor-pointer items-center justify-center gap-1.5 rounded-[6px] px-2 text-[12px] font-medium transition-colors"
            style={{ height, color: active ? "var(--accent)" : "var(--text-3)" }}
            onPointerEnter={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text-2)";
            }}
            onPointerLeave={(e) => {
              if (!active) e.currentTarget.style.color = "var(--text-3)";
            }}
          >
            {active && (
              <motion.span
                layoutId={`segment-${groupId}`}
                className="absolute inset-0 rounded-[6px]"
                style={{ background: "var(--accent-soft)", border: "1px solid var(--accent-line)" }}
                transition={reduced ? { duration: 0.1 } : DEFAULT}
              />
            )}
            <span className="relative flex items-center gap-1.5">
              {segment.icon}
              {segment.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}


export function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
  format = String,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange(value: number): void;
  label?: ReactNode;
  format?(value: number): string;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const percent = ((value - min) / (max - min)) * 100;

  const valueAt = useCallback(
    (clientX: number) => {
      const box = trackRef.current?.getBoundingClientRect();
      if (!box) return value;
      const ratio = Math.min(1, Math.max(0, (clientX - box.left) / box.width));


      const raw = min + ratio * (max - min);
      return Math.min(max, Math.max(min, Math.round(raw / step) * step));
    },
    [min, max, step, value],
  );

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      {label && (
        <span className="shrink-0 text-[12px]" style={{ color: "var(--text-2)" }}>
          {label}
        </span>
      )}

      <div
        ref={trackRef}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-disabled={disabled}
        onPointerDown={(e) => {
          if (disabled) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          onChange(valueAt(e.clientX));
        }}
        onPointerMove={(e) => dragging && onChange(valueAt(e.clientX))}
        onPointerUp={(e) => {
          e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          const jump = e.shiftKey ? step * 10 : step;
          if (e.key === "ArrowRight" || e.key === "ArrowUp") {
            e.preventDefault();
            onChange(Math.min(max, value + jump));
          } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
            e.preventDefault();
            onChange(Math.max(min, value - jump));
          } else if (e.key === "Home") {
            e.preventDefault();
            onChange(min);
          } else if (e.key === "End") {
            e.preventDefault();
            onChange(max);
          }
        }}
        className={clsx(
          "focus-ring relative flex h-5 min-w-0 flex-1 items-center",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        )}
      >
        <span
          className="absolute right-0 left-0 h-1 rounded-full"
          style={{ background: "var(--input)" }}
        />
        <span
          className="absolute left-0 h-1 rounded-full"
          style={{ width: `${percent}%`, background: "var(--accent)" }}
        />
        <motion.span
          className="absolute block rounded-full"
          style={{
            width: 13,
            height: 13,
            background: "var(--accent)",
            border: "2px solid var(--surface)",
            boxShadow: dragging ? "0 0 0 4px var(--accent-soft)" : "var(--shadow-1)",
            left: `calc(${percent}% - 6.5px)`,
          }}
          animate={{ scale: dragging ? 1.15 : 1 }}
          transition={SNAPPY}
        />
      </div>

      <span
        className="tnum w-10 shrink-0 text-right text-[11px] font-medium"
        style={{ color: "var(--text-2)" }}
      >
        {format(value)}
      </span>
    </div>
  );
}


export function Field({
  label,
  description,
  children,
}: {
  label: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-2.5">
      <div className="min-w-0">
        <div className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
          {label}
        </div>
        {description && (
          <div className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
            {description}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}


export function TextInput({
  value,
  onChange,
  placeholder,
  invalid,
  hint,
  suffix,
  autoFocus,
  onSubmit,
  className,
}: {
  value: string;
  onChange(value: string): void;
  placeholder?: string;

  invalid?: string | null;

  hint?: ReactNode;

  suffix?: string;
  autoFocus?: boolean;
  onSubmit?(): void;
  className?: string;
}) {
  const id = useId();

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <div
        className="flex h-8 items-center gap-1 rounded-lg px-2.5"
        style={{
          background: "var(--control)",
          border: `1px solid ${invalid ? "var(--error)" : "var(--border)"}`,
        }}
      >
        <input
          id={id}
          type="text"
          value={value}
          placeholder={placeholder}

          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit?.();


            e.stopPropagation();
          }}
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid || hint ? `${id}-note` : undefined}
          className="no-focus-ring min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          style={{ color: "var(--text)" }}
        />
        {suffix && (
          <span className="shrink-0 text-[13px]" style={{ color: "var(--text-3)" }}>
            {suffix}
          </span>
        )}
      </div>

      {(invalid || hint) && (
        <div
          id={`${id}-note`}
          className="text-[11px] leading-snug"
          style={{ color: invalid ? "var(--error)" : "var(--text-3)" }}
        >
          {invalid ?? hint}
        </div>
      )}
    </div>
  );
}
