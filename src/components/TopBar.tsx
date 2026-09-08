import {
  Columns2,
  Command,
  Download,
  GitCompare,
  Keyboard,
  Maximize,
  Play,
  Redo2,
  Rows2,
  Scan,
  Settings2,
  Square,
  Undo2,
} from "lucide-react";
import { useMemo } from "react";

import type { EngineId } from "../core/model/scene";
import { DIAGRAM_THEMES } from "../core/theme";
import { useDocumentStore } from "../store/useDocumentStore";
import { useHistoryStore } from "../store/useHistoryStore";
import { APP_THEMES, useSettingsStore, type AppTheme, type SplitMode } from "../store/useSettingsStore";
import { LayoutTuning } from "./LayoutTuning";
import { IconButton, SegmentedControl, Select, type SelectOption } from "./ui";


export function TopBar({
  onOpenSettings,
  onOpenPalette,
  onExport,
  onShowShortcuts,
  onUndo,
  onRedo,
  onPresent,
}: {
  onOpenSettings(): void;
  onOpenPalette(): void;
  onExport(): void;
  onShowShortcuts(): void;
  onUndo(): void;
  onRedo(): void;
  onPresent(): void;
}) {
  const undoLabel = useHistoryStore((s) => s.past[s.past.length - 1]?.label ?? null);
  const redoLabel = useHistoryStore((s) => s.future[s.future.length - 1]?.label ?? null);

  const engine = useDocumentStore((s) => s.engine);
  const path = useDocumentStore((s) => s.path);
  const diffMode = useDocumentStore((s) => s.diffMode);
  const setDiffMode = useDocumentStore((s) => s.setDiffMode);
  const setEngine = useDocumentStore((s) => s.setEngine);
  const layoutTheme = useDocumentStore((s) => s.layout.theme);
  const setDocTheme = useDocumentStore((s) => s.setDiagramTheme);

  const appTheme = useSettingsStore((s) => s.appTheme);
  const setAppTheme = useSettingsStore((s) => s.setAppTheme);
  const diagramTheme = useSettingsStore((s) => s.diagramTheme);
  const setDiagramTheme = useSettingsStore((s) => s.setDiagramTheme);
  const splitMode = useSettingsStore((s) => s.splitMode);
  const setSplitMode = useSettingsStore((s) => s.setSplitMode);
  const zenMode = useSettingsStore((s) => s.zenMode);
  const toggleZen = useSettingsStore((s) => s.toggleZen);


  const themeOptions = useMemo<SelectOption<string>[]>(
    () =>
      DIAGRAM_THEMES.map((t) => ({
        value: t.id,
        label: t.label,
        description: t.note,
        swatch: [t.background, t.nodeFill, t.nodeStroke, t.edge, t.accent],
      })),
    [],
  );

  const appThemeOptions = useMemo<SelectOption<AppTheme>[]>(
    () => APP_THEMES.map((t) => ({ value: t.id, label: t.label, description: t.note })),
    [],
  );

  const splits: Array<{ value: SplitMode; icon: React.ReactNode; title: string }> = [
    { value: "vertical", icon: <Columns2 size={14} strokeWidth={1.75} />, title: "Source beside canvas" },
    { value: "horizontal", icon: <Rows2 size={14} strokeWidth={1.75} />, title: "Source above canvas" },
    { value: "canvas", icon: <Square size={14} strokeWidth={1.75} />, title: "Canvas only" },
  ];

  return (
    <div
      className="flex h-11 shrink-0 items-center gap-2 px-3"
      style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)" }}
    >


      <div data-tour="engine" className="flex items-center">
        <Select
          label="Engine"
          value={engine}
          onChange={(next) => setEngine(next as EngineId)}
          menuWidth={280}
          options={[
            {
              value: "graphviz",
              label: "Graphviz",
              description: "Bundled WASM. Exact geometry, including edge splines.",
            },
            {
              value: "mermaid",
              label: "Mermaid",
              description: "The one most repositories already have. Flowchart, state, class and ER.",
            },
            {
              value: "d2",
              label: "D2",
              description: "Bundled WASM. Containers, classes and SQL tables.",
            },
            {
              value: "plantuml",
              label: "PlantUML",
              description: "Uses the Java and plantuml.jar already on this machine.",
            },
          ]}
        />
      </div>

      <Select
        label="Diagram"
        value={layoutTheme?.name ?? diagramTheme}
        menuWidth={300}
        options={themeOptions}
        onChange={(name) => {


          setDiagramTheme(name);
          setDocTheme(name);
        }}
      />

      <Select
        label="App"
        value={appTheme}
        menuWidth={280}
        options={appThemeOptions}
        onChange={setAppTheme}
      />

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenPalette}
        className="focus-ring flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-[12px] transition-colors"
        style={{ background: "var(--control)", border: "1px solid var(--border)", color: "var(--text-3)" }}
        onPointerEnter={(e) => {
          e.currentTarget.style.background = "var(--control-hover)";
          e.currentTarget.style.color = "var(--text-2)";
        }}
        onPointerLeave={(e) => {
          e.currentTarget.style.background = "var(--control)";
          e.currentTarget.style.color = "var(--text-3)";
        }}
      >
        <Command size={12} strokeWidth={2} />
        <span>Commands</span>
        <kbd
          className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--input)", color: "var(--text-3)" }}
        >
          Ctrl K
        </kbd>
      </button>

      <SegmentedControl
        aria-label="Layout"
        value={splitMode}
        segments={splits}
        onChange={setSplitMode}
      />

      <div className="flex items-center gap-0.5">


        <IconButton
          icon={<Undo2 size={15} strokeWidth={1.75} />}
          onClick={onUndo}
          disabled={!undoLabel}
          title={undoLabel ? `Undo ${undoLabel.toLowerCase()}` : "Nothing to undo"}
          shortcut="Ctrl+Z"
        />
        <IconButton
          icon={<Redo2 size={15} strokeWidth={1.75} />}
          onClick={onRedo}
          disabled={!redoLabel}
          title={redoLabel ? `Redo ${redoLabel.toLowerCase()}` : "Nothing to redo"}
          shortcut="Ctrl+Y"
        />

        <div className="mx-1 h-4 w-px" style={{ background: "var(--border)" }} />


        <LayoutTuning />
        <IconButton
          icon={<Scan size={15} strokeWidth={1.75} />}
          onClick={() => useDocumentStore.setState((s) => ({ fitToken: s.fitToken + 1 }))}
          title="Fit to view"
          shortcut="Ctrl+Shift+F"
        />
        <span data-tour="present" className="flex">
          <IconButton
            icon={<Play size={15} strokeWidth={1.75} />}
            onClick={onPresent}
            title="Present — reveal the diagram a step at a time"
            shortcut="F5"
          />
        </span>
        <IconButton
          icon={<Maximize size={15} strokeWidth={1.75} />}
          onClick={toggleZen}
          active={zenMode}
          title="Zen mode — canvas only"
          shortcut="Ctrl+Shift+D"
        />


        <IconButton
          icon={<GitCompare size={15} strokeWidth={1.75} />}
          onClick={() => void setDiffMode(!diffMode)}
          active={diffMode}
          disabled={!path}
          title={
            !path
              ? "Save this file before comparing it with git"
              : diffMode
                ? "Stop comparing with the last commit"
                : "Compare with the last commit"
          }
          shortcut="Ctrl+Shift+G"
        />
        <IconButton
          icon={<Download size={15} strokeWidth={1.75} />}
          onClick={onExport}
          title="Export"
          shortcut="Ctrl+E"
        />
        <IconButton
          icon={<Keyboard size={15} strokeWidth={1.75} />}
          onClick={onShowShortcuts}
          title="Keyboard shortcuts"
          shortcut="Ctrl+/"
        />
        <IconButton
          icon={<Settings2 size={15} strokeWidth={1.75} />}
          onClick={onOpenSettings}
          title="Settings"
          shortcut="Ctrl+,"
        />
      </div>
    </div>
  );
}
