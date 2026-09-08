import { motion } from "motion/react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

import { usePrefersReducedMotion } from "./hooks";


export const SPRING = {
  default: { type: "spring", stiffness: 300, damping: 30, mass: 1 },
  snappy: { type: "spring", stiffness: 500, damping: 35 },
  soft: { type: "spring", stiffness: 180, damping: 24 },
} as const;


type Side = "top" | "bottom" | "left" | "right";


const TIP_GAP = 8;


const TITLEBAR = 36;


export function Tooltip({
  label,
  shortcut,
  side = "top",
  children,
}: {
  label: ReactNode;
  shortcut?: string;
  side?: Side;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const tipRef = useRef<HTMLSpanElement | null>(null);
  const timer = useRef<number | null>(null);
  const id = useId();


  const show = () => {
    timer.current = window.setTimeout(() => setOpen(true), 400);
  };
  const hide = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    setOpen(false);
    setAt(null);
  };

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    const trigger = anchorRef.current?.getBoundingClientRect();
    const tip = tipRef.current?.getBoundingClientRect();
    if (!trigger || !tip) return;

    const next = place(side, trigger, tip);


    setAt((current) =>
      current && current.top === next.top && current.left === next.left ? current : next,
    );


  }, [open, side]);

  return (
    <>
      <span
        ref={anchorRef}
        className="relative inline-flex"
        onPointerEnter={show}
        onPointerLeave={hide}
        onPointerDown={hide}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>

      {open &&
        createPortal(
          <motion.span
            ref={tipRef}
            id={id}
            role="tooltip"
            initial={{ opacity: 0 }}
            animate={{ opacity: at ? 1 : 0 }}
            transition={{ duration: 0.18 }}
            className={clsx(
              "glass pointer-events-none fixed z-[600] w-max rounded-lg px-2.5 py-1.5",
              "text-[11px] font-medium",


              "max-w-[min(280px,calc(100vw-16px))]",
            )}
            style={{
              color: "var(--text)",
              top: at?.top ?? 0,
              left: at?.left ?? 0,

              visibility: at ? "visible" : "hidden",
            }}
          >
            {label}
            {shortcut && (
              <kbd
                className="ml-2 rounded px-1.5 py-0.5 text-[10px] font-medium"
                style={{ background: "var(--input)", color: "var(--text-2)" }}
              >
                {shortcut}
              </kbd>
            )}
          </motion.span>,
          document.body,
        )}
    </>
  );
}


function place(
  side: Side,
  trigger: DOMRect,
  tip: DOMRect,
): { top: number; left: number } {
  const room = {
    top: trigger.top - TITLEBAR,
    bottom: window.innerHeight - trigger.bottom,
    left: trigger.left,
    right: window.innerWidth - trigger.right,
  };
  const need = {
    top: tip.height + TIP_GAP,
    bottom: tip.height + TIP_GAP,
    left: tip.width + TIP_GAP,
    right: tip.width + TIP_GAP,
  };

  const opposite: Record<Side, Side> = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  };


  const chosen =
    room[side] < need[side] && room[opposite[side]] >= need[opposite[side]] ? opposite[side] : side;

  const clamp = (value: number, max: number) =>
    Math.max(TIP_GAP, Math.min(value, max - TIP_GAP));

  const clampTop = (value: number, max: number) =>
    Math.max(TITLEBAR + TIP_GAP, Math.min(value, max - TIP_GAP));

  if (chosen === "top" || chosen === "bottom") {
    return {
      top:
        chosen === "top"
          ? Math.max(TITLEBAR + TIP_GAP, trigger.top - tip.height - TIP_GAP)
          : Math.min(trigger.bottom + TIP_GAP, window.innerHeight - tip.height - TIP_GAP),
      left: clamp(
        trigger.left + trigger.width / 2 - tip.width / 2,
        window.innerWidth - tip.width,
      ),
    };
  }

  return {
    top: clampTop(
      trigger.top + trigger.height / 2 - tip.height / 2,
      window.innerHeight - tip.height,
    ),
    left:
      chosen === "left"
        ? Math.max(TIP_GAP, trigger.left - tip.width - TIP_GAP)
        : Math.min(trigger.right + TIP_GAP, window.innerWidth - tip.width - TIP_GAP),
  };
}


interface ButtonBase {
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  shortcut?: string;
  className?: string;
  "aria-label"?: string;
}

export function IconButton({
  icon,
  onClick,
  disabled,
  active,
  title,
  shortcut,
  className,
  size = 28,
  ...rest
}: ButtonBase & { icon: ReactNode; size?: number }) {
  const reduced = usePrefersReducedMotion();

  const button = (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={rest["aria-label"] ?? title}
      aria-pressed={active}

      whileHover={disabled || reduced ? undefined : { y: -1 }}
      whileTap={disabled || reduced ? undefined : { scale: 0.94, y: 0 }}
      transition={SPRING.snappy}
      className={clsx(
        "focus-ring inline-flex shrink-0 items-center justify-center rounded-lg transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-2)",
      }}
      onPointerEnter={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = "var(--control-hover)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onPointerLeave={(e) => {
        if (disabled || active) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-2)";
      }}
    >
      {icon}
    </motion.button>
  );

  return title ? (
    <Tooltip label={title} shortcut={shortcut}>
      {button}
    </Tooltip>
  ) : (
    button
  );
}

export function Button({
  children,
  onClick,
  disabled,
  variant = "ghost",
  className,
}: ButtonBase & {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
}) {
  const reduced = usePrefersReducedMotion();

  const palette = {
    primary: { background: "var(--accent)", color: "var(--accent-text)", border: "transparent" },
    ghost: { background: "var(--control)", color: "var(--text)", border: "var(--border)" },
    danger: { background: "transparent", color: "var(--error)", border: "var(--border)" },
  }[variant];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled || reduced ? undefined : { y: -1 }}
      whileTap={disabled || reduced ? undefined : { scale: 0.97, y: 0 }}
      transition={SPRING.snappy}
      className={clsx(
        "focus-ring inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        className,
      )}
      style={{
        background: palette.background,
        color: palette.color,
        border: `1px solid ${palette.border}`,
      }}
    >
      {children}
    </motion.button>
  );
}


export function Panel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={clsx("flex min-h-0 flex-col", className)}
      style={{ background: "var(--surface)", ...style }}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  children,
  actions,
  count,
}: {
  children: ReactNode;
  actions?: ReactNode;
  count?: number;
}) {
  return (
    <div
      className="flex h-7 shrink-0 items-center gap-2 px-3 text-[10px] font-semibold tracking-[0.08em] uppercase"
      style={{ color: "var(--text-3)" }}
    >
      <span className="truncate">{children}</span>
      {count !== undefined && count > 0 && (
        <span className="tnum" style={{ color: "var(--text-3)" }}>
          {count}
        </span>
      )}
      <span className="ml-auto flex items-center gap-0.5">{actions}</span>
    </div>
  );
}


export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      {icon && <div style={{ color: "var(--text-3)" }}>{icon}</div>}
      <div className="text-[14px] font-medium" style={{ color: "var(--text)" }}>
        {title}
      </div>
      {body && (
        <div className="max-w-[320px] text-[12px] leading-relaxed" style={{ color: "var(--text-3)" }}>
          {body}
        </div>
      )}
      {action}
    </div>
  );
}


export function Splitter({
  orientation,
  onDrag,
  onDoubleClick,
}: {
  orientation: "vertical" | "horizontal";
  onDrag(deltaPx: number): void;
  onDoubleClick?(): void;
}) {
  const [active, setActive] = useState(false);
  const last = useRef(0);

  const vertical = orientation === "vertical";

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      onDoubleClick={onDoubleClick}
      onPointerDown={(e) => {


        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        last.current = vertical ? e.clientX : e.clientY;
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!active) return;
        const now = vertical ? e.clientX : e.clientY;
        onDrag(now - last.current);
        last.current = now;
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setActive(false);
      }}
      className={clsx(
        "group relative shrink-0",
        vertical ? "w-px cursor-col-resize" : "h-px cursor-row-resize",
      )}
      style={{ background: active ? "var(--accent)" : "var(--border)" }}
    >


      <div
        className={clsx(
          "absolute",
          vertical ? "-left-1.5 -right-1.5 top-0 bottom-0" : "-top-1.5 -bottom-1.5 left-0 right-0",
        )}
      />
    </div>
  );
}

export { usePrefersReducedMotion } from "./hooks";
export { Select, Swatch, type SelectOption } from "./Select";
export { Checkbox, Field, SegmentedControl, Slider, Switch, TextInput, type Segment } from "./controls";
export { ContextMenu, useContextMenu, type MenuItem } from "./Menu";
export { Modal } from "./Modal";
export { Toasts } from "./Toasts";
