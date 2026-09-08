import { Maximize2, Minus, Square, X } from "lucide-react";
import { useEffect, useState } from "react";

import { appWindow } from "../lib/tauri";


export function Titlebar({ subtitle }: { subtitle?: string }) {
  const [maximized, setMaximized] = useState(false);


  const [available] = useState(() => appWindow() !== null);

  useEffect(() => {
    const win = appWindow();
    if (!win) return;

    let cancelled = false;
    const sync = () => {
      void win.isMaximized().then((value) => {
        if (!cancelled) setMaximized(value);
      });
    };

    sync();
    const unlisten = win.onResized(sync);

    return () => {
      cancelled = true;
      void unlisten.then((fn) => fn());
    };
  }, []);

  const action = (fn: (win: NonNullable<ReturnType<typeof appWindow>>) => Promise<unknown>) => () => {
    const win = appWindow();
    if (win) void fn(win);
  };

  return (
    <div
      data-tauri-drag-region
      className="flex h-9 shrink-0 items-center gap-2 px-3 select-none"
      style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div data-tauri-drag-region className="flex items-center gap-2">
        <Mark />
        <span
          data-tauri-drag-region
          className="text-[12px] font-semibold tracking-tight"
          style={{ color: "var(--text)" }}
        >
          ZDraft
        </span>
      </div>

      {subtitle && (
        <span
          data-tauri-drag-region
          className="truncate text-[11px]"
          style={{ color: "var(--text-3)" }}
        >
          {subtitle}
        </span>
      )}

      <div data-tauri-drag-region className="flex-1" />

      {available && (
        <div className="flex items-center gap-0.5">
          <WindowButton onClick={action((w) => w.minimize())} label="Minimise">
            <Minus size={14} strokeWidth={1.75} />
          </WindowButton>
          <WindowButton onClick={action((w) => w.toggleMaximize())} label="Maximise">
            {maximized ? <Square size={11} strokeWidth={2} /> : <Maximize2 size={12} strokeWidth={1.75} />}
          </WindowButton>
          <WindowButton onClick={action((w) => w.close())} label="Close" danger>
            <X size={15} strokeWidth={1.75} />
          </WindowButton>
        </div>
      )}
    </div>
  );
}

function WindowButton({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick(): void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="focus-ring flex h-7 w-8 cursor-pointer items-center justify-center rounded-md transition-colors"
      style={{ color: "var(--text-3)" }}
      onPointerEnter={(e) => {
        e.currentTarget.style.background = danger ? "#e11d48" : "var(--control-hover)";
        e.currentTarget.style.color = danger ? "#fff" : "var(--text)";
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-3)";
      }}
    >
      {children}
    </button>
  );
}


function Mark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="var(--accent)"
        d="M4.8 3.6 H19.4 L7.56 17.54 H18.4 A1 1 0 0 1 19.4 18.54 V19.4 A1 1 0 0 1 18.4 20.4
           H3.8 L15.64 6.46 H4.8 A1 1 0 0 1 3.8 5.46 V4.6 A1 1 0 0 1 4.8 3.6 Z"
      />


      <circle cx="19.2" cy="3.6" r="2" fill="var(--pin)" />
    </svg>
  );
}
