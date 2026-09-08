import { AnimatePresence, motion } from "motion/react";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { IconButton } from "./index";
import { useDismiss, usePrefersReducedMotion, useReturnFocus } from "./hooks";


export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  tabs,
  footer,
  width = 520,
}: {
  open: boolean;
  onClose(): void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;

  tabs?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const reduced = usePrefersReducedMotion();

  useDismiss(open, onClose, useMemo(() => [panelRef], []));
  useReturnFocus(open);


  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])",
      );
      focusable?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);


  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.2 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
          />

          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            transition={
              reduced
                ? { duration: 0.1 }
                : { type: "spring", stiffness: 180, damping: 24, delay: 0.04 }
            }
            className="glass relative flex max-h-[min(85vh,760px)] w-full flex-col overflow-hidden rounded-2xl"
            style={{ maxWidth: width }}
          >
            <div className="flex items-start gap-3 px-5 pt-4 pb-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-[16px] font-semibold tracking-[-0.005em]" style={{ color: "var(--text)" }}>
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 text-[12px] leading-snug" style={{ color: "var(--text-3)" }}>
                    {description}
                  </p>
                )}
              </div>
              <IconButton icon={<X size={15} strokeWidth={1.75} />} onClick={onClose} title="Close" />
            </div>


            {tabs && <div className="flex px-5 pb-3">{tabs}</div>}

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>

            {footer && (
              <div
                className="flex items-center justify-end gap-2 px-5 py-3"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
