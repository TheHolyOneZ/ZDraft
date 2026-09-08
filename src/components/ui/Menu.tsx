import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useDismiss, usePrefersReducedMotion } from "./hooks";


export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  shortcut?: string;
  onSelect?(): void;
  disabled?: boolean;
  danger?: boolean;

  separator?: boolean;
}

export interface MenuAnchor {
  x: number;
  y: number;
}

export function ContextMenu({
  anchor,
  items,
  onClose,
}: {
  anchor: MenuAnchor | null;
  items: MenuItem[];
  onClose(): void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [position, setPosition] = useState<MenuAnchor | null>(null);
  const reduced = usePrefersReducedMotion();

  const selectable = useMemo(
    () => items.map((item, i) => (item.separator || item.disabled ? -1 : i)).filter((i) => i >= 0),
    [items],
  );

  useDismiss(anchor !== null, onClose, useMemo(() => [panelRef], []));


  useEffect(() => {
    if (!anchor) {
      setPosition(null);
      return;
    }
    setPosition(anchor);
    setActive(selectable[0] ?? 0);

    const frame = requestAnimationFrame(() => {
      const box = panelRef.current?.getBoundingClientRect();
      if (!box) return;
      setPosition({
        x: Math.min(anchor.x, Math.max(8, window.innerWidth - box.width - 8)),
        y: Math.min(anchor.y, Math.max(8, window.innerHeight - box.height - 8)),
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor, selectable]);

  const step = useCallback(
    (delta: number) => {
      if (selectable.length === 0) return;
      const current = selectable.indexOf(active);
      const next = current < 0 ? 0 : (current + delta + selectable.length) % selectable.length;
      setActive(selectable[next]!);
    },
    [active, selectable],
  );

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        step(-1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = items[active];
        if (item && !item.disabled && !item.separator) {
          item.onSelect?.();
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [anchor, active, items, step, onClose]);

  return createPortal(
    <AnimatePresence>
      {anchor && position && (
        <motion.div
          ref={panelRef}
          role="menu"
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -3 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          transition={reduced ? { duration: 0.1 } : { type: "spring", stiffness: 500, damping: 35 }}
          className="glass fixed z-[550] min-w-[210px] rounded-xl p-1"
          style={{ top: position.y, left: position.x, transformOrigin: "top left" }}
        >
          {items.map((item, i) =>
            item.separator ? (
              <div key={item.id} className="my-1 h-px" style={{ background: "var(--border)" }} />
            ) : (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onPointerEnter={() => !item.disabled && setActive(i)}
                onClick={() => {
                  item.onSelect?.();
                  onClose();
                }}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors",
                  item.disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
                )}
                style={{
                  background: i === active && !item.disabled ? "var(--row-selected)" : "transparent",
                  color: item.danger ? "var(--error)" : "var(--text)",
                }}
              >
                <span className="flex w-4 shrink-0 justify-center" style={{ color: "var(--text-3)" }}>
                  {item.icon}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {item.shortcut && (
                  <kbd
                    className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                    style={{ background: "var(--input)", color: "var(--text-3)" }}
                  >
                    {item.shortcut}
                  </kbd>
                )}
              </button>
            ),
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}


export function useContextMenu() {
  const [anchor, setAnchor] = useState<MenuAnchor | null>(null);

  const openAt = useCallback((e: { clientX: number; clientY: number; preventDefault(): void }) => {
    e.preventDefault();
    setAnchor({ x: e.clientX, y: e.clientY });
  }, []);

  const close = useCallback(() => setAnchor(null), []);

  return { anchor, openAt, close };
}
