import { AlertTriangle, Check, Info, RefreshCw, Wand2, XCircle } from "lucide-react";
import { useRef } from "react";

import { rectCenter } from "../core/model/geometry";
import { isGraph, type Diagnostic } from "../core/model/scene";
import { separateNodes } from "../core/overlap";
import { useDocumentStore } from "../store/useDocumentStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { Splitter } from "./ui";


const DEFAULT_HEIGHT = 96;


export function DiagnosticsStrip({ onGoTo }: { onGoTo(range: { from: number; to: number }): void }) {
  const diagnostics = useDocumentStore((s) => s.diagnostics);
  const scene = useDocumentStore((s) => s.scene);
  const select = useDocumentStore((s) => s.select);
  const pinAt = useDocumentStore((s) => s.pinAt);
  const releasePins = useDocumentStore((s) => s.releasePins);
  const stale = useDocumentStore((s) => s.stale);
  const source = useDocumentStore((s) => s.source);
  const setSource = useDocumentStore((s) => s.setSource);

  const height = useSettingsStore((s) => s.diagnosticsHeight);
  const setHeight = useSettingsStore((s) => s.setDiagnosticsHeight);

  const heightRef = useRef(height);
  heightRef.current = height;

  const errors = diagnostics.filter((d) => d.severity === "error");
  const shown = errors.length > 0 ? errors : diagnostics;

  const applyFix = (d: Diagnostic) => {
    const fix = d.fix;
    if (!fix) return;

    switch (fix.kind) {
      case "goto":
        onGoTo(fix.range);
        break;

      case "release-pins":
        releasePins(fix.nodes);
        break;

      case "separate-nodes": {
        if (!scene || !isGraph(scene)) return;


        pinAt(separateNodes(scene, fix.nodes), 0);
        select(fix.nodes, false);
        break;
      }
    }
  };


  if (stale) {
    return (
      <div
        data-tour="diagnostics"
        className="flex h-7 shrink-0 items-center gap-2 px-3 text-[11px]"
        style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)", color: "var(--warn)" }}
      >
        <RefreshCw size={12} strokeWidth={2} />
        <span>The canvas is behind the source.</span>
        <button
          type="button"
          onClick={() => setSource(source, true)}
          className="focus-ring cursor-pointer rounded px-1.5 py-0.5 font-medium"
          style={{ background: "var(--control)", border: "1px solid var(--border)", color: "var(--text)" }}
        >
          Re-render
        </button>
        <span style={{ color: "var(--text-3)" }}>Ctrl+Enter</span>
      </div>
    );
  }

  if (shown.length === 0) {
    return (
      <div
        data-tour="diagnostics"
        className="flex h-7 shrink-0 items-center gap-2 px-3 text-[11px]"
        style={{ background: "var(--surface-2)", borderTop: "1px solid var(--border)", color: "var(--text-3)" }}
      >
        <Check size={12} strokeWidth={2} style={{ color: "var(--ok)" }} />
        <span>No problems.</span>
      </div>
    );
  }

  return (
    <div data-tour="diagnostics" className="flex shrink-0 flex-col" style={{ background: "var(--surface-2)" }}>


      <Splitter
        orientation="horizontal"
        onDoubleClick={() => setHeight(DEFAULT_HEIGHT)}
        onDrag={(delta) => setHeight(heightRef.current - delta)}
      />


      <div
        className="flex flex-col overflow-y-auto"
        style={{ maxHeight: height, borderTop: "1px solid var(--border)" }}
      >
      {shown.map((d, i) => (
        <div
          key={i}
          className="flex min-h-7 items-center gap-2 px-3 py-1 text-[11px]"
          style={{ color: "var(--text-2)" }}
        >
          <Icon severity={d.severity} />

          {d.line !== undefined ? (
            <button
              type="button"
              onClick={() => d.range && onGoTo(d.range)}
              className="focus-ring tnum shrink-0 cursor-pointer rounded px-1 font-medium"
              style={{ color: "var(--text-3)" }}
            >
              line {d.line}
            </button>
          ) : null}

          <span className="min-w-0 flex-1">{d.message}</span>

          {d.nodes && d.nodes.length > 0 && (
            <button
              type="button"
              onClick={() => select(d.nodes!, false)}
              className="focus-ring shrink-0 cursor-pointer rounded px-1.5 py-0.5 font-medium transition-colors"
              style={{ color: "var(--text-3)" }}
            >
              show
            </button>
          )}

          {d.fix && (
            <button
              type="button"
              onClick={() => applyFix(d)}
              className="focus-ring flex shrink-0 cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 font-medium transition-colors"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <Wand2 size={11} strokeWidth={2} />
              {fixLabel(d)}
            </button>
          )}
        </div>
      ))}
      </div>
    </div>
  );
}

function fixLabel(d: Diagnostic): string {
  switch (d.fix?.kind) {
    case "separate-nodes":
      return "Separate and pin";
    case "release-pins":
      return "Release pin";
    case "goto":
      return "Go to";
    default:
      return "Fix";
  }
}

function Icon({ severity }: { severity: Diagnostic["severity"] }) {
  const props = { size: 12, strokeWidth: 2, className: "shrink-0" };
  switch (severity) {
    case "error":
      return <XCircle {...props} style={{ color: "var(--error)" }} />;
    case "warning":
      return <AlertTriangle {...props} style={{ color: "var(--warn)" }} />;
    default:
      return <Info {...props} style={{ color: "var(--text-3)" }} />;
  }
}


export function centerOfSelection(): { x: number; y: number } | null {
  const { scene, selection } = useDocumentStore.getState();
  if (!scene || !isGraph(scene) || selection.size === 0) return null;

  const rects = scene.nodes.filter((n) => selection.has(n.id)).map((n) => n.rect);
  if (rects.length === 0) return null;

  const centers = rects.map(rectCenter);
  return {
    x: centers.reduce((sum, c) => sum + c.x, 0) / centers.length,
    y: centers.reduce((sum, c) => sum + c.y, 0) / centers.length,
  };
}
