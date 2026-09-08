import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BlockBar } from "./components/BlockBar";
import { Canvas } from "./components/Canvas";
import { CommandPalette } from "./components/CommandPalette";
import { DiagnosticsStrip } from "./components/DiagnosticsStrip";
import { DiffBar } from "./components/DiffBar";
import { Editor, type EditorHandle } from "./components/editor/Editor";
import { ExportDialog } from "./components/ExportDialog";
import { ConflictDialog } from "./components/ConflictDialog";
import { GroupDialog } from "./components/GroupDialog";
import { ImportDialog } from "./components/ImportDialog";
import { NewDiagram } from "./components/NewDiagram";
import { Shortcuts } from "./components/Shortcuts";
import { TemplateGallery } from "./components/TemplateGallery";
import { Presentation } from "./components/Presentation";
import { PropertiesBar } from "./components/PropertiesBar";
import { Settings } from "./components/Settings";
import { Sidebar } from "./components/Sidebar";
import { Titlebar } from "./components/Titlebar";
import { Tour } from "./components/Tour";
import { TopBar } from "./components/TopBar";
import { Splitter, Toasts } from "./components/ui";
import { edgeAt, idAt } from "./core/locate/types";
import type { SourceRange } from "./core/model/scene";
import type { AnnotationKind } from "./core/sidecar/types";
import { themeByName } from "./core/theme";
import { api, isTauri } from "./lib/tauri";
import { adapterFor, useDocumentStore } from "./store/useDocumentStore";
import { useHistoryStore } from "./store/useHistoryStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { useTourStore } from "./store/useTourStore";
import { useWorkspaceStore } from "./store/useWorkspaceStore";


const SAMPLE = `digraph architecture {
  rankdir=LR;
  node [shape=box, style=rounded];

  subgraph cluster_edge {
    label="edge";
    cdn [label="CDN"];
    gateway [shape=hexagon, label="API Gateway"];
  }

  subgraph cluster_core {
    label="services";
    api [label="API"];
    worker [label="Worker"];
  }

  db [shape=cylinder, label="Postgres"];
  cache [shape=cylinder, label="Redis"];
  queue [shape=parallelogram, label="Queue"];

  cdn -> gateway [label="miss"];
  gateway -> api [label="HTTP"];
  api -> db [label="SQL"];
  api -> cache [label="get/set"];
  api -> queue [label="publish"];
  queue -> worker [label="consume"];
  worker -> db;
}`;

export default function App() {
  const appTheme = useSettingsStore((s) => s.appTheme);
  const splitMode = useSettingsStore((s) => s.splitMode);
  const splitRatio = useSettingsStore((s) => s.splitRatio);
  const setSplitRatio = useSettingsStore((s) => s.setSplitRatio);
  const sidebarOpen = useSettingsStore((s) => s.sidebarOpen);
  const zenMode = useSettingsStore((s) => s.zenMode);
  const cycleSplit = useSettingsStore((s) => s.cycleSplit);
  const toggleSidebar = useSettingsStore((s) => s.toggleSidebar);
  const toggleZen = useSettingsStore((s) => s.toggleZen);
  const defaultDiagramTheme = useSettingsStore((s) => s.diagramTheme);

  const source = useDocumentStore((s) => s.source);
  const sourceOrigin = useDocumentStore((s) => s.sourceOrigin);
  const blocks = useDocumentStore((s) => s.blocks);
  const engine = useDocumentStore((s) => s.engine);
  const name = useDocumentStore((s) => s.name);
  const dirty = useDocumentStore((s) => s.dirty);
  const layoutTheme = useDocumentStore((s) => s.layout.theme);
  const selection = useDocumentStore((s) => s.selection);
  const setSource = useDocumentStore((s) => s.setSource);
  const select = useDocumentStore((s) => s.select);
  const openSample = useDocumentStore((s) => s.openSample);
  const saveSource = useDocumentStore((s) => s.saveSource);

  const [locate, setLocate] = useState<SourceRange | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [keysOpen, setKeysOpen] = useState(false);
  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  const editorRef = useRef<EditorHandle | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [presentOpen, setPresentOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const splitRef = useRef<HTMLDivElement | null>(null);


  const diagramTheme = useMemo(
    () => themeByName(layoutTheme?.name ?? defaultDiagramTheme),
    [layoutTheme, defaultDiagramTheme],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = appTheme;
  }, [appTheme]);


  const tourSeen = useTourStore((s) => s.seen);
  useEffect(() => {
    if (tourSeen) return;
    const id = window.setTimeout(() => useTourStore.getState().start(), 1200);
    return () => window.clearTimeout(id);
  }, [tourSeen]);


  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      if (!isTauri()) {
        openSample("architecture.dot", SAMPLE);
        return;
      }
      try {
        const args = await api.startupArgs();
        if (cancelled) return;

        if (args.folder) useWorkspaceStore.getState().setRoot(args.folder);
        if (args.file) {
          await useDocumentStore.getState().openFile(args.file);
          return;
        }


        const remembered = useWorkspaceStore.getState().lastFile;
        if (remembered && (await api.pathExists(remembered).catch(() => false))) {
          try {
            await useDocumentStore.getState().openFile(remembered);
            return;
          } catch {
            useWorkspaceStore.getState().setLastFile(null);
          }
        }
        if (cancelled) return;

        if (!args.folder) openSample("architecture.dot", SAMPLE);
      } catch {
        openSample("architecture.dot", SAMPLE);
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [openSample]);


  const index = useMemo(() => adapterFor(engine).locate(source), [engine, source]);


  const indexRef = useRef(index);
  indexRef.current = index;


  const fromEditor = useRef(false);

  useEffect(() => {
    if (fromEditor.current) {
      fromEditor.current = false;
      return;
    }
    if (selection.size !== 1) return;

    const id = [...selection][0]!;
    const range = indexRef.current.nodes.get(id);
    if (range) setLocate({ ...range });
  }, [selection]);

  const onCursor = useCallback(
    (offset: number) => {
      const current = indexRef.current;
      const id = idAt(current, offset) ?? edgeAt(current, offset);
      if (!id) return;

      const selected = useDocumentStore.getState().selection;
      if (selected.size === 1 && selected.has(id)) return;
      if (current.nodes.has(id)) {
        fromEditor.current = true;
        select([id], false);
      }
    },
    [select],
  );

  const pickFolder = useCallback(async () => {
    if (!isTauri()) return;
    const chosen = await openDialog({ directory: true, multiple: false, title: "Open a folder" });
    if (typeof chosen === "string") useWorkspaceStore.getState().setRoot(chosen);
  }, []);


  const undo = useCallback(() => {
    const history = useHistoryStore.getState();
    const entry = history.takeUndo();
    if (!entry) return;

    history.withApplying(() => {
      if (entry.kind === "source") editorRef.current?.undo();
      else useDocumentStore.getState().restoreLayout(entry.before);
    });
  }, []);

  const redo = useCallback(() => {
    const history = useHistoryStore.getState();
    const entry = history.takeRedo();
    if (!entry) return;

    history.withApplying(() => {
      if (entry.kind === "source") editorRef.current?.redo();
      else useDocumentStore.getState().restoreLayout(entry.after);
    });
  }, []);


  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener("contextmenu", onContextMenu, true);
    return () => window.removeEventListener("contextmenu", onContextMenu, true);
  }, []);


  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (mod && e.key === ",") {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (mod && e.key.toLowerCase() === "e") {
        e.preventDefault();
        setExportOpen(true);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setNewOpen(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "n") {


        e.preventDefault();
        setTemplatesOpen(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "o") {


        e.preventDefault();
        setImportOpen(true);
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveSource();
      } else if (mod && e.key === "\\") {
        e.preventDefault();
        cycleSplit();
      } else if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {


        e.preventDefault();
        undo();
      } else if (mod && ((e.shiftKey && e.key.toLowerCase() === "z") || e.key.toLowerCase() === "y")) {


        e.preventDefault();
        redo();

      } else if (mod && e.shiftKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleZen();
      } else if (mod && e.key === "/") {
        e.preventDefault();
        setKeysOpen((v) => !v);
      } else if (mod && e.key === "Enter") {

        e.preventDefault();
        useDocumentStore.getState().setSource(useDocumentStore.getState().source, true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        useDocumentStore.setState((s) => ({ fitToken: s.fitToken + 1 }));
      } else if (e.key === "/" && !isTypingTarget(e.target)) {


        e.preventDefault();
        setPaletteOpen(true);
      } else if (e.key === "F5") {


        e.preventDefault();
        setPresentOpen(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === "g") {

        e.preventDefault();
        const store = useDocumentStore.getState();
        void store.setDiffMode(!store.diffMode);
      } else if (mod && e.key.toLowerCase() === "g" && !e.shiftKey) {

        const store = useDocumentStore.getState();
        if (store.selection.size === 0 || !adapterFor(store.engine).edit?.group) return;
        e.preventDefault();
        setGroupIds([...store.selection]);
      } else if (e.key === "F2" && !isTypingTarget(e.target)) {


        const store = useDocumentStore.getState();
        const only = store.selection.size === 1 ? [...store.selection][0]! : null;
        if (!only || !adapterFor(store.engine).edit) return;
        e.preventDefault();
        useDocumentStore.getState().requestRename(only);
      } else if (!mod && !isTypingTarget(e.target) && ANNOTATION_KEYS[e.key.toLowerCase()] !== undefined) {


        e.preventDefault();
        const next = ANNOTATION_KEYS[e.key.toLowerCase()]!;
        const store = useDocumentStore.getState();
        store.setAnnotationTool(store.annotationTool === next ? null : next);
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        !isTypingTarget(e.target) &&
        useDocumentStore.getState().annotationSelection.size > 0
      ) {
        e.preventDefault();
        const store = useDocumentStore.getState();
        store.removeAnnotations([...store.annotationSelection]);
      } else if (e.key.toLowerCase() === "p" && !mod && !isTypingTarget(e.target)) {

        const store = useDocumentStore.getState();
        if (store.selection.size === 0) return;
        e.preventDefault();
        store.togglePins([...store.selection]);
      } else if (e.key === "Escape") {

        const doc = useDocumentStore.getState();
        if (doc.annotationTool) doc.setAnnotationTool(null);
        else if (doc.annotationSelection.size > 0) doc.selectAnnotations([], false);
        else if (useSettingsStore.getState().zenMode) toggleZen();
        else if (useDocumentStore.getState().selectedEdge) {
          useDocumentStore.getState().selectEdge(null);
        } else select([], false);
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cycleSplit, toggleSidebar, toggleZen, select, saveSource, undo, redo]);

  const goTo = useCallback((range: SourceRange) => setLocate({ ...range }), []);

  const showEditor = splitMode !== "canvas" && !zenMode;
  const horizontal = splitMode === "horizontal";

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--canvas)" }}>
      <Titlebar subtitle={dirty ? `${name} •` : name} />
      {!zenMode && (
        <TopBar
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenPalette={() => setPaletteOpen(true)}
          onExport={() => setExportOpen(true)}
          onShowShortcuts={() => setKeysOpen(true)}
          onUndo={undo}
          onRedo={redo}
          onPresent={() => setPresentOpen(true)}
        />
      )}


      <DiffBar />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && !zenMode && <Sidebar onNewDiagram={() => setNewOpen(true)} />}

        <div
          ref={splitRef}
          data-tour="panes"
          className={`flex min-h-0 min-w-0 flex-1 ${horizontal ? "flex-col" : "flex-row"}`}
        >
          {showEditor && (
            <div
              className="flex min-h-0 min-w-0 flex-col"
              style={horizontal ? { height: `${splitRatio * 100}%` } : { width: `${splitRatio * 100}%` }}
            >
              <Editor
                value={source}


                engine={blocks.length > 0 ? "markdown" : engine}
                onChange={setSource}
                onCursor={onCursor}
                locate={locate}
                handle={editorRef}
                valueOrigin={sourceOrigin}
              />
            </div>
          )}

          {showEditor && (
            <Splitter
              orientation={horizontal ? "horizontal" : "vertical"}
              onDoubleClick={() => setSplitRatio(0.42)}
              onDrag={(delta) => {
                const box = splitRef.current?.getBoundingClientRect();
                if (!box) return;
                setSplitRatio(splitRatio + delta / (horizontal ? box.height : box.width));
              }}
            />
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">


            <BlockBar />
            <div className="min-h-0 flex-1" data-tour="canvas">
              <Canvas theme={diagramTheme} />
            </div>
          </div>
        </div>
      </div>

      {!zenMode && <PropertiesBar />}
      {!zenMode && <DiagnosticsStrip onGoTo={goTo} />}

      <NewDiagram
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onShowTemplates={() => setTemplatesOpen(true)}
      />
      <TemplateGallery open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <Shortcuts open={keysOpen} onClose={() => setKeysOpen(false)} />


      <ConflictDialog />
      <GroupDialog
        open={groupIds !== null}
        onClose={() => setGroupIds(null)}
        ids={groupIds ?? []}
      />
      <Presentation
        open={presentOpen}
        onClose={() => setPresentOpen(false)}
        theme={diagramTheme}
      />
      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} theme={diagramTheme} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
        onExport={() => setExportOpen(true)}
        onOpenFolder={() => void pickFolder()}
        onNewDiagram={() => setNewOpen(true)}
        onShowTemplates={() => setTemplatesOpen(true)}
        onShowShortcuts={() => setKeysOpen(true)}
        onUndo={undo}
        onRedo={redo}
        onPresent={() => setPresentOpen(true)}
        onImport={() => setImportOpen(true)}
      />
      <Tour />
      <Toasts />
    </div>
  );
}


const ANNOTATION_KEYS: Record<string, AnnotationKind | null> = {
  v: null,
  n: "note",
  a: "arrow",
  h: "highlight",
  d: "stroke",
};

function isTypingTarget(el: EventTarget | null): boolean {
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) ||
      Boolean(el.closest(".cm-editor")))
  );
}
