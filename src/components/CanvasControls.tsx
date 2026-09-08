import { Maximize2, Minus, Plus, Scan } from "lucide-react";

import { IconButton, Tooltip } from "./ui";


export function CanvasControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onFitSelection,
  onReset,
  canZoomIn,
  canZoomOut,
  hasSelection,
}: {
  zoom: number;
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  onFitSelection(): void;
  onReset(): void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  hasSelection: boolean;
}) {
  return (
    <div
      className="absolute right-3 bottom-3 flex items-center gap-0.5 rounded-xl p-1 opacity-70 transition-opacity hover:opacity-100"
      data-canvas-ui
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-2)",
      }}
    >
      <IconButton
        icon={<Minus size={15} strokeWidth={1.75} />}
        onClick={onZoomOut}
        disabled={!canZoomOut}
        title="Zoom out"
        shortcut="Ctrl+−"
      />

      <Tooltip label="Reset to 100%" shortcut="Ctrl+0">
        <button
          type="button"
          onClick={onReset}
          className="focus-ring tnum h-7 min-w-[52px] cursor-pointer rounded-lg text-[11px] font-medium tabular-nums transition-colors"
          style={{ color: "var(--text-2)" }}
          onPointerEnter={(e) => {
            e.currentTarget.style.background = "var(--control-hover)";
            e.currentTarget.style.color = "var(--text)";
          }}
          onPointerLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text-2)";
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tooltip>

      <IconButton
        icon={<Plus size={15} strokeWidth={1.75} />}
        onClick={onZoomIn}
        disabled={!canZoomIn}
        title="Zoom in"
        shortcut="Ctrl++"
      />

      <div className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} />

      <IconButton
        icon={<Scan size={15} strokeWidth={1.75} />}
        onClick={onFit}
        title="Fit to view"
        shortcut="Ctrl+Shift+F"
      />
      <IconButton
        icon={<Maximize2 size={15} strokeWidth={1.75} />}
        onClick={onFitSelection}
        disabled={!hasSelection}
        title="Zoom to selection"
      />
    </div>
  );
}
