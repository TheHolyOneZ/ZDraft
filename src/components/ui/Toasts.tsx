import { AnimatePresence, motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

import { useToastStore, type ToastKind } from "../../store/useToastStore";
import { usePrefersReducedMotion } from "./hooks";


export function Toasts() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  const reduced = usePrefersReducedMotion();

  return (
    <div
      className="pointer-events-none fixed top-12 right-4 z-[700] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 24, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, x: 16, scale: 0.98 }}
            transition={
              reduced
                ? { duration: 0.1 }
                :
                  { type: "spring", stiffness: 320, damping: 24 }
            }
            className="glass pointer-events-auto flex items-start gap-2.5 rounded-xl px-3 py-2.5"
          >
            <span className="mt-[1px] shrink-0">
              <ToastIcon kind={t.kind} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium" style={{ color: "var(--text)" }}>
                {t.title}
              </div>
              {t.body && (
                <div className="mt-0.5 text-[11px] leading-snug" style={{ color: "var(--text-2)" }}>
                  {t.body}
                </div>
              )}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.run();
                    dismiss(t.id);
                  }}
                  className="focus-ring mt-1.5 cursor-pointer rounded-md px-2 py-1 text-[11px] font-medium transition-colors"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  {t.action.label}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="focus-ring -mt-0.5 -mr-0.5 shrink-0 cursor-pointer rounded-md p-1 transition-colors"
              style={{ color: "var(--text-3)" }}
              onPointerEnter={(e) => (e.currentTarget.style.color = "var(--text)")}
              onPointerLeave={(e) => (e.currentTarget.style.color = "var(--text-3)")}
            >
              <X size={13} strokeWidth={2} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastIcon({ kind }: { kind: ToastKind }) {
  const props = { size: 15, strokeWidth: 2 };
  switch (kind) {
    case "success":
      return <CheckCircle2 {...props} style={{ color: "var(--ok)" }} />;
    case "warning":
      return <AlertTriangle {...props} style={{ color: "var(--warn)" }} />;
    case "error":
      return <XCircle {...props} style={{ color: "var(--error)" }} />;
    default:
      return <Info {...props} style={{ color: "var(--accent)" }} />;
  }
}
