import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useDismiss, useFloatingPosition, usePrefersReducedMotion, useTypeAhead } from "./hooks";


export interface SelectOption<T extends string> {
  value: T;
  label: string;

  description?: string;

  swatch?: readonly string[];
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectProps<T extends string> {
  value: T;
  options: readonly SelectOption<T>[];
  onChange(value: T): void;

  label?: string;
  placeholder?: string;
  disabled?: boolean;

  menuWidth?: number;


  block?: boolean;
  className?: string;
}

export function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  placeholder = "Select…",
  disabled,
  menuWidth,
  block,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, options.findIndex((o) => o.value === value)));

  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const reduced = usePrefersReducedMotion();
  const listId = useId();

  const selected = options.find((o) => o.value === value);
  const position = useFloatingPosition(open, triggerRef, panelRef);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, useMemo(() => [triggerRef, panelRef], []));

  const enabledIndexes = useMemo(
    () => options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0),
    [options],
  );

  const typeAhead = useTypeAhead(
    options.map((o) => o.label),
    setActive,
  );


  useEffect(() => {
    if (!open) return;
    const index = options.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : (enabledIndexes[0] ?? 0));
  }, [open, options, value, enabledIndexes]);


  useEffect(() => {
    if (!open) return;
    itemRefs.current[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const step = (delta: number) => {
    if (enabledIndexes.length === 0) return;
    const current = enabledIndexes.indexOf(active);
    const next = current < 0 ? 0 : (current + delta + enabledIndexes.length) % enabledIndexes.length;
    setActive(enabledIndexes[next]!);
  };

  const commit = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        step(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        step(-1);
        break;
      case "Home":
        e.preventDefault();
        setActive(enabledIndexes[0] ?? 0);
        break;
      case "End":
        e.preventDefault();
        setActive(enabledIndexes[enabledIndexes.length - 1] ?? 0);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        commit(active);
        break;
      case "Tab":

        setOpen(false);
        break;
      default:
        if (typeAhead(e.key)) e.preventDefault();
    }
  };

  return (
    <div className={clsx("flex items-center gap-1.5", className)}>
      {label && (
        <span
          className="shrink-0 text-[10px] font-semibold tracking-[0.08em] uppercase"
          style={{ color: "var(--text-3)" }}
        >
          {label}
        </span>
      )}

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        className={clsx(
          "focus-ring group flex items-center gap-1.5 rounded-lg px-2 font-medium transition-colors",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",

          block ? "h-8 w-full px-2.5 text-[13px]" : "h-7 text-[12px]",
        )}
        style={{
          background: open ? "var(--control-hover)" : "var(--control)",
          color: "var(--text)",
          border: `1px solid ${open ? "var(--accent-line)" : "var(--border)"}`,
          minWidth: 96,
        }}
        onPointerEnter={(e) => {
          if (!disabled && !open) e.currentTarget.style.background = "var(--control-hover)";
        }}
        onPointerLeave={(e) => {
          if (!open) e.currentTarget.style.background = "var(--control)";
        }}
      >
        {selected?.swatch && <Swatch colors={selected.swatch} />}
        {selected?.icon}
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <motion.span
          className="ml-auto flex shrink-0"
          animate={{ rotate: open ? 180 : 0 }}
          transition={reduced ? { duration: 0.1 } : { type: "spring", stiffness: 500, damping: 35 }}
          style={{ color: "var(--text-3)" }}
        >
          <ChevronDown size={13} strokeWidth={2} />
        </motion.span>
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              id={listId}
              role="listbox"
              aria-activedescendant={`${listId}-${active}`}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: position?.flipped ? 4 : -4, scale: 0.98 }}
              animate={{ opacity: position ? 1 : 0, y: 0, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, y: position?.flipped ? 2 : -2, scale: 0.985 }}
              transition={reduced ? { duration: 0.1 } : { type: "spring", stiffness: 500, damping: 35 }}
              className="glass fixed z-[600] max-h-[min(420px,60vh)] overflow-y-auto rounded-xl p-1"
              style={{


                top: position?.top ?? 0,
                left: position?.left ?? 0,
                visibility: position ? "visible" : "hidden",
                minWidth: menuWidth ?? Math.max(position?.minWidth ?? 0, 180),

                transformOrigin: position?.flipped ? "bottom left" : "top left",
              }}
            >
              {options.map((option, i) => (
                <Option
                  key={option.value}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  id={`${listId}-${i}`}
                  option={option}
                  selected={option.value === value}
                  active={i === active}
                  onHover={() => !option.disabled && setActive(i)}
                  onPick={() => commit(i)}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

function Option<T extends string>({
  ref,
  id,
  option,
  selected,
  active,
  onHover,
  onPick,
}: {
  ref: (el: HTMLDivElement | null) => void;
  id: string;
  option: SelectOption<T>;
  selected: boolean;
  active: boolean;
  onHover(): void;
  onPick(): void;
}) {
  return (
    <div
      ref={ref}
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={option.disabled}
      onPointerEnter={onHover}
      onClick={() => !option.disabled && onPick()}
      className={clsx(
        "flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors",
        option.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
      )}
      style={{


        background: active && !option.disabled ? "var(--row-selected)" : "transparent",
        color: active ? "var(--text)" : "var(--text-2)",
      }}
    >
      <span className="mt-[3px] flex w-3.5 shrink-0 justify-center">
        {selected ? (
          <Check size={13} strokeWidth={2.5} style={{ color: "var(--accent)" }} />
        ) : null}
      </span>

      {option.swatch && <span className="mt-[2px]"><Swatch colors={option.swatch} /></span>}
      {option.icon && <span className="mt-[1px] shrink-0">{option.icon}</span>}

      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium" style={{ color: "var(--text)" }}>
          {option.label}
        </span>
        {option.description && (
          <span className="mt-0.5 block text-[11px] leading-snug" style={{ color: "var(--text-3)" }}>
            {option.description}
          </span>
        )}
      </span>
    </div>
  );
}


export function Swatch({ colors }: { colors: readonly string[] }) {
  return (
    <span
      className="flex shrink-0 overflow-hidden rounded-[3px]"
      style={{ border: "1px solid var(--border-strong)" }}
      aria-hidden
    >
      {colors.slice(0, 5).map((c, i) => (
        <span key={i} style={{ background: c, width: 6, height: 12, display: "block" }} />
      ))}
    </span>
  );
}
