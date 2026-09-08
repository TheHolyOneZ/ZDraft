import { Command as CommandPrimitive } from "cmdk";
import { AnimatePresence, motion } from "motion/react";
import {
  Columns2,
  Compass,
  Crosshair,
  Download,
  FileInput,
  FilePlus2,
  FolderOpen,
  GitCompare,
  Keyboard,
  LayoutTemplate,
  MapPin,
  Maximize,
  Palette,
  PinOff,
  Play,
  RotateCcw,
  Scan,
  Redo2,
  SlidersHorizontal,
  Search,
  Settings2,
  Sidebar as SidebarIcon,
  Undo2,
} from "lucide-react";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { isGraph, nodeText } from "../core/model/scene";
import { DIAGRAM_THEMES } from "../core/theme";
import { adapterFor, useDocumentStore } from "../store/useDocumentStore";
import { useHistoryStore } from "../store/useHistoryStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useTourStore } from "../store/useTourStore";
import { usePrefersReducedMotion } from "./ui";


export function CommandPalette({
  open,
  onClose,
  onOpenSettings,
  onExport,
  onOpenFolder,
  onNewDiagram,
  onShowTemplates,
  onShowShortcuts,
  onUndo,
  onRedo,
  onPresent,
  onImport,
}: {
  open: boolean;
  onClose(): void;
  onOpenSettings(): void;
  onExport(): void;
  onOpenFolder(): void;
  onNewDiagram(): void;
  onShowTemplates(): void;
  onShowShortcuts(): void;
  onUndo(): void;
  onRedo(): void;
  onPresent(): void;
  onImport(): void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const reduced = usePrefersReducedMotion();

  const scene = useDocumentStore((s) => s.scene);
  const pins = useDocumentStore((s) => s.layout.pins);
  const select = useDocumentStore((s) => s.select);
  const releasePins = useDocumentStore((s) => s.releasePins);
  const releaseAllPins = useDocumentStore((s) => s.releaseAllPins);
  const selection = useDocumentStore((s) => s.selection);
  const engine = useDocumentStore((s) => s.engine);
  const source = useDocumentStore((s) => s.source);
  const tuneLayout = useDocumentStore((s) => s.tuneLayout);
  const path = useDocumentStore((s) => s.path);
  const diffMode = useDocumentStore((s) => s.diffMode);
  const setDiffMode = useDocumentStore((s) => s.setDiffMode);

  const settings = useSettingsStore();


  const undoLabel = useHistoryStore((s) => s.past[s.past.length - 1]?.label ?? null);
  const redoLabel = useHistoryStore((s) => s.future[s.future.length - 1]?.label ?? null);

  const nodes = useMemo(() => (scene && isGraph(scene) ? scene.nodes : []), [scene]);


  const tuner = adapterFor(engine).edit?.tuning;
  const direction = useMemo(() => {
    const knob = tuner?.knobs.find((k) => k.id === "direction" || k.id === "rankdir");
    if (!knob) return null;
    return { knob, current: tuner!.read(source)[knob.id] ?? knob.fallback };
  }, [tuner, source]);
  const pinCount = Object.keys(pins ?? {}).length;

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[450] flex items-start justify-center p-6 pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0.1 : 0.18 }}
            className="absolute inset-0"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
            onClick={onClose}
          />

          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.99 }}
            transition={
              reduced ? { duration: 0.1 } : { type: "spring", stiffness: 340, damping: 30, delay: 0.03 }
            }
            className="glass relative w-full max-w-[560px] overflow-hidden rounded-2xl"
          >
            <CommandPrimitive
              loop
              onKeyDown={(e) => {
                if (e.key === "Escape") onClose();
              }}
            >
              <div
                className="flex items-center gap-2.5 px-4 py-3"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <Search size={15} strokeWidth={2} style={{ color: "var(--text-3)" }} />
                <CommandPrimitive.Input
                  ref={inputRef}
                  placeholder="Search commands and nodes…"
                  className="w-full bg-transparent text-[14px] outline-none"
                  style={{ color: "var(--text)" }}
                />
                <kbd
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
                  style={{ background: "var(--input)", color: "var(--text-3)" }}
                >
                  Esc
                </kbd>
              </div>

              <CommandPrimitive.List className="max-h-[min(50vh,420px)] overflow-y-auto p-2">
                <CommandPrimitive.Empty>
                  <div className="px-3 py-8 text-center text-[12px]" style={{ color: "var(--text-3)" }}>
                    Nothing matches that. Try a node name, or “pin”, “theme”, “export”.
                  </div>
                </CommandPrimitive.Empty>

                <Group heading="Layout">
                  <Item
                    icon={<Scan size={14} strokeWidth={1.75} />}
                    label="Fit to view"
                    shortcut="Ctrl+Shift+F"
                    onSelect={run(() =>
                      useDocumentStore.setState((s) => ({ fitToken: s.fitToken + 1 })),
                    )}
                  />
                  <Item
                    icon={<Columns2 size={14} strokeWidth={1.75} />}
                    label="Cycle split layout"
                    shortcut="Ctrl+\"
                    onSelect={run(settings.cycleSplit)}
                  />
                  <Item
                    icon={<SidebarIcon size={14} strokeWidth={1.75} />}
                    label={settings.sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                    shortcut="Ctrl+B"
                    onSelect={run(settings.toggleSidebar)}
                  />
                  <Item
                    icon={<Maximize size={14} strokeWidth={1.75} />}
                    label={settings.zenMode ? "Leave zen mode" : "Zen mode — canvas only"}
                    onSelect={run(settings.toggleZen)}
                  />
                </Group>

                <Group heading="Pins">
                  <Item
                    icon={<PinOff size={14} strokeWidth={1.75} />}
                    label="Release pins on the selection"
                    hint={selection.size === 0 ? "nothing selected" : `${selection.size} selected`}
                    disabled={selection.size === 0}
                    onSelect={run(() => releasePins([...selection]))}
                  />
                  <Item
                    icon={<RotateCcw size={14} strokeWidth={1.75} />}
                    label="Release every pin — back to pure auto-layout"
                    hint={pinCount === 0 ? "nothing pinned" : `${pinCount} pinned`}
                    disabled={pinCount === 0}
                    onSelect={run(releaseAllPins)}
                  />
                </Group>

                <Group heading="Edit">
                  {/* Named after what they would actually undo, so the palette
                      answers "what will Ctrl+Z do?" rather than repeating the
                      word back. */}
                  <Item
                    icon={<Undo2 size={14} strokeWidth={1.75} />}
                    label={undoLabel ? `Undo ${undoLabel.toLowerCase()}` : "Undo"}
                    shortcut="Ctrl+Z"
                    disabled={!undoLabel}
                    onSelect={run(onUndo)}
                  />
                  <Item
                    icon={<Redo2 size={14} strokeWidth={1.75} />}
                    label={redoLabel ? `Redo ${redoLabel.toLowerCase()}` : "Redo"}
                    shortcut="Ctrl+Y"
                    disabled={!redoLabel}
                    onSelect={run(onRedo)}
                  />
                </Group>

                {direction && (
                  <Group heading="Layout">
                    {direction.knob.choices?.map((choice) => (
                      <Item
                        key={choice.value}
                        icon={<SlidersHorizontal size={14} strokeWidth={1.75} />}
                        label={`Layout: ${choice.label.toLowerCase()}`}
                        hint={
                          choice.value === direction.current
                            ? "current"
                            : "writes one line to your source"
                        }
                        disabled={choice.value === direction.current}
                        onSelect={run(() => tuneLayout(direction.knob.id, choice.value))}
                      />
                    ))}
                  </Group>
                )}

                <Group heading="Present">
                  <Item
                    icon={<Play size={14} strokeWidth={1.75} />}
                    label="Present — reveal the diagram a step at a time"
                    shortcut="F5"
                    onSelect={run(onPresent)}
                  />
                </Group>

                <Group heading="Compare">
                  <Item
                    icon={<GitCompare size={14} strokeWidth={1.75} />}
                    label={
                      diffMode
                        ? "Stop comparing with the last commit"
                        : "Compare with the last commit"
                    }
                    shortcut="Ctrl+Shift+G"
                    hint={path ? undefined : "save this file first"}
                    disabled={!path}
                    onSelect={run(() => void setDiffMode(!diffMode))}
                  />
                </Group>

                <Group heading="File">
                  <Item
                    icon={<FilePlus2 size={14} strokeWidth={1.75} />}
                    label="New diagram…"
                    shortcut="Ctrl+N"
                    onSelect={run(onNewDiagram)}
                  />
                  <Item
                    icon={<LayoutTemplate size={14} strokeWidth={1.75} />}
                    label="New from a template…"
                    shortcut="Ctrl+Shift+N"
                    onSelect={run(onShowTemplates)}
                  />
                  <Item
                    icon={<FolderOpen size={14} strokeWidth={1.75} />}
                    label="Open a folder…"
                    onSelect={run(onOpenFolder)}
                  />
                  <Item
                    icon={<FileInput size={14} strokeWidth={1.75} />}
                    label="Import from draw.io or Excalidraw…"
                    hint="the layout comes with it"
                    shortcut="Ctrl+Shift+O"
                    onSelect={run(onImport)}
                  />
                  <Item
                    icon={<Download size={14} strokeWidth={1.75} />}
                    label="Export…"
                    shortcut="Ctrl+E"
                    onSelect={run(onExport)}
                  />
                  <Item
                    icon={<Settings2 size={14} strokeWidth={1.75} />}
                    label="Settings"
                    shortcut="Ctrl+,"
                    onSelect={run(onOpenSettings)}
                  />
                  <Item
                    icon={<Keyboard size={14} strokeWidth={1.75} />}
                    label="Keyboard shortcuts"
                    shortcut="Ctrl+/"
                    onSelect={run(onShowShortcuts)}
                  />
                  <Item
                    icon={<Compass size={14} strokeWidth={1.75} />}
                    label="Take the tour"
                    hint="eight screens, two of them hands-on"
                    onSelect={run(() => useTourStore.getState().start())}
                  />
                </Group>

                <Group heading="Diagram theme">
                  {DIAGRAM_THEMES.map((t) => (
                    <Item
                      key={t.id}
                      icon={<Palette size={14} strokeWidth={1.75} />}
                      label={`Theme: ${t.label}`}
                      hint={t.note}
                      onSelect={run(() => {
                        settings.setDiagramTheme(t.id);
                        useDocumentStore.getState().setDiagramTheme(t.id);
                      })}
                    />
                  ))}
                </Group>

                {nodes.length > 0 && (
                  <Group heading="Go to node">
                    {nodes.map((node) => (
                      <Item
                        key={node.id}
                        // Both the id and the label are searchable: people
                        // remember one or the other, rarely both.
                        value={`${node.id} ${nodeText(node.body)}`}
                        icon={
                          pins?.[node.id] ? (
                            <MapPin size={14} strokeWidth={2} style={{ color: "var(--pin)" }} />
                          ) : (
                            <Crosshair size={14} strokeWidth={1.75} />
                          )
                        }
                        label={nodeText(node.body) || node.id}
                        hint={nodeText(node.body) === node.id ? undefined : node.id}
                        onSelect={run(() => select([node.id], false))}
                      />
                    ))}
                  </Group>
                )}
              </CommandPrimitive.List>
            </CommandPrimitive>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <CommandPrimitive.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:uppercase"
      style={{ ["--tw-prose-headings" as string]: "var(--text-3)" }}
    >
      {children}
    </CommandPrimitive.Group>
  );
}

function Item({
  icon,
  label,
  hint,
  shortcut,
  value,
  disabled,
  onSelect,
}: {
  icon: ReactNode;
  label: string;
  hint?: string;
  shortcut?: string;
  value?: string;
  disabled?: boolean;
  onSelect(): void;
}) {
  return (
    <CommandPrimitive.Item
      value={value ?? label}
      disabled={disabled}
      onSelect={onSelect}
      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-[13px] transition-colors data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-40 data-[selected=true]:bg-[var(--row-selected)]"
      style={{ color: "var(--text-2)" }}
    >
      <span className="flex w-4 shrink-0 justify-center" style={{ color: "var(--text-3)" }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate" style={{ color: "var(--text)" }}>
        {label}
      </span>
      {hint && (
        <span className="max-w-[190px] shrink-0 truncate text-[11px]" style={{ color: "var(--text-3)" }}>
          {hint}
        </span>
      )}
      {shortcut && (
        <kbd
          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium"
          style={{ background: "var(--input)", color: "var(--text-3)" }}
        >
          {shortcut}
        </kbd>
      )}
    </CommandPrimitive.Item>
  );
}
