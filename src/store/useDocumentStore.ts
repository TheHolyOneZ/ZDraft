import { create } from "zustand";

import { d2Adapter } from "../core/engines/d2";
import { graphvizAdapter } from "../core/engines/graphviz";
import { mermaidAdapter } from "../core/engines/mermaid";
import { plantumlAdapter } from "../core/engines/plantuml";
import type { EngineAdapter } from "../core/engines/types";
import type { Point } from "../core/model/geometry";
import { rectCenter, snapPoint } from "../core/model/geometry";
import { detectEol, toLf, withEol, type Eol } from "../core/eol";
import type { Diagnostic, EngineId, NodeShape, Scene } from "../core/model/scene";
import { isGraph, nodesIn } from "../core/model/scene";
import { applyPins, migratePin, pinFor, withoutPins, withPin, type OrphanPin } from "../core/pins";
import { overlapDiagnostics } from "../core/overlap";
import {
  isMarkdown,
  parseMarkdownBlocks,
  withBlockSource,
  withMarker,
  type MarkdownBlock,
} from "../core/markdown";
import {
  DEFAULT_ANNOTATION_COLOR,
  nextAnnotationId,
  retargetAnnotations,
} from "../core/annotate";
import type { Annotation, AnnotationKind, Conflict, Layout, Sidecar } from "../core/sidecar/types";
import type { GitStatus } from "../lib/tauri";
import { themeByName } from "../core/theme";
import { api, isTauri } from "../lib/tauri";
import { useHistoryStore } from "./useHistoryStore";
import { useSettingsStore } from "./useSettingsStore";
import { useWorkspaceStore } from "./useWorkspaceStore";
import { joinPath } from "../lib/path";

const ADAPTERS: Partial<Record<EngineId, EngineAdapter>> = {
  graphviz: graphvizAdapter,
  mermaid: mermaidAdapter,
  d2: d2Adapter,
  plantuml: plantumlAdapter,
};

export function adapterFor(engine: EngineId): EngineAdapter {
  return ADAPTERS[engine] ?? graphvizAdapter;
}


const LAYOUT_DEBOUNCE_MS = 150;

const SAVE_DEBOUNCE_MS = 400;

export interface DocumentState {
  path: string | null;
  name: string;
  engine: EngineId;
  source: string;


  eol: Eol;

  dirty: boolean;


  raw: Scene | null;

  scene: Scene | null;
  ghosts: ReadonlyMap<string, { x: number; y: number; w: number; h: number }>;
  orphans: OrphanPin[];
  diagnostics: Diagnostic[];

  layout: Layout;

  fitToken: number;


  blocks: MarkdownBlock[];

  activeBlock: string | null;

  sidecar: Sidecar;


  headScene: Scene | null;

  headPinned: ReadonlySet<string>;

  git: GitStatus | null;

  diffMode: boolean;


  setDiffMode(on: boolean): Promise<void>;


  selectBlock(id: string): void;


  markBlock(id: string, name: string): boolean;

  selection: ReadonlySet<string>;

  selectedEdge: string | null;


  annotationSelection: ReadonlySet<string>;

  annotationTool: AnnotationKind | null;


  annotationPen: string;
  setAnnotationTool(tool: AnnotationKind | null): void;
  setAnnotationPen(color: string): void;
  selectAnnotations(ids: string[], additive: boolean): void;

  addAnnotation(mark: Annotation): string;
  updateAnnotation(id: string, patch: Partial<Annotation>): void;
  removeAnnotations(ids: string[]): void;
  hovered: string | null;

  dragging: string | null;


  setSource(source: string, force?: boolean): void;

  setEngine(engine: EngineId): void;
  openSample(name: string, source: string, engine?: EngineId): void;
  openFile(path: string): Promise<void>;


  createFile(dir: string, fileName: string, source: string, engine: EngineId): Promise<string>;


  createImported(
    dir: string,
    fileName: string,
    source: string,
    layout: Layout,
  ): Promise<string>;
  saveSource(): Promise<void>;

  select(ids: string[], additive: boolean): void;
  selectEdge(id: string | null): void;
  setHovered(id: string | null): void;
  setDragging(id: string | null): void;


  stale: boolean;


  sourceOrigin: "file" | "edit";


  renameRequest: string | null;
  requestRename(id: string | null): void;


  conflict: Conflict | null;

  resolveConflict(sidecar: Sidecar): Promise<void>;


  pinAt(positions: ReadonlyMap<string, Point>, snap?: number): void;


  togglePins(ids: readonly string[]): void;


  restoreLayout(layout: Layout): void;
  releasePins(ids: readonly string[]): void;
  releaseAllPins(): void;

  setWaypoints(edgeId: string, points: readonly Point[]): void;

  setLabelOffset(edgeId: string, offset: Point | null): void;

  setLifelineOrder(ids: readonly string[]): void;

  setSequenceGap(kind: "lifeline" | "message", id: string, gap: number): void;


  editNode(id: string, change: NodeChange): boolean;


  tuneLayout(knob: string, value: string): boolean;


  groupNodes(ids: readonly string[], title: string): boolean;

  migrateOrphan(from: string, to: string): void;
  dropOrphans(ids: readonly string[]): void;
  setDiagramTheme(name: string | null): void;
}


function editScope(state: DocumentState): {
  source: string;
  block: MarkdownBlock | null;
  write(next: string): string;
} {
  const block = state.blocks.find((b) => b.id === state.activeBlock) ?? null;

  return block
    ? {
        source: block.source,
        block,
        write: (next) => withBlockSource(state.source, block, next),
      }
    : { source: state.source, block: null, write: (next) => next };
}


function layoutOf(sidecar: Sidecar): Layout {
  const { version: _version, blocks: _blocks, ...layout } = sidecar;
  return layout;
}


export type NodeChange =
  | { kind: "rename"; to: string }
  | { kind: "label"; text: string }
  | { kind: "shape"; shape: NodeShape };

let layoutTimer: number | null = null;
let saveTimer: number | null = null;
let layoutRun = 0;

export const useDocumentStore = create<DocumentState>()((set, get) => {

  const relayout = (source: string) => {
    if (layoutTimer !== null) window.clearTimeout(layoutTimer);

    layoutTimer = window.setTimeout(() => {
      const run = ++layoutRun;
      set({ stale: false });
      const adapter = adapterFor(get().engine);


      const theme = themeByName(
        get().layout.theme?.name ?? useSettingsStore.getState().diagramTheme,
      );

      void adapter
        .layout(source, { theme, sequenceHints: get().layout.sequence })
        .then((result) => {

          if (run !== layoutRun) return;

          const hasError = result.diagnostics.some((d) => d.severity === "error");


          const raw = hasError ? get().raw : result.scene;

          set({ raw });
          reapply(result.diagnostics);
        });
    }, LAYOUT_DEBOUNCE_MS);
  };


  const reapply = (engineDiagnostics: Diagnostic[] = []) => {
    const { raw, layout } = get();
    if (!raw || !isGraph(raw)) {

      set({ scene: raw, diagnostics: engineDiagnostics, ghosts: new Map(), orphans: [] });
      return;
    }

    const applied = applyPins(raw, layout);

    set({
      scene: applied.scene,
      ghosts: applied.ghosts,
      orphans: applied.orphans,
      diagnostics: [
        ...engineDiagnostics,
        ...applied.diagnostics,
        ...overlapDiagnostics(applied.scene),
      ],
    });
  };


  const scheduleSave = () => {


    if (get().conflict) return;

    if (saveTimer !== null) window.clearTimeout(saveTimer);

    saveTimer = window.setTimeout(() => {
      const { path, layout, activeBlock, sidecar: current } = get();
      if (!path || !isTauri()) return;


      const sidecar: Sidecar = activeBlock
        ? {
            ...current,
            version: 1,
            blocks: { ...current.blocks, [activeBlock]: layout },
          }
        : { version: 1, ...layout, blocks: current.blocks };
      void api.writeLayout(path, sidecar).catch(() => {


        set((s) => ({
          diagnostics: [
            ...s.diagnostics,
            {
              severity: "error",
              message: "Could not save layout pins beside this diagram.",
            },
          ],
        }));
      });
    }, SAVE_DEBOUNCE_MS);
  };


  const mutateLayout = (next: Layout, label = "layout change") => {
    const previous = get().layout;
    if (previous === next) return;

    useHistoryStore.getState().record({ kind: "layout", label, before: previous, after: next });
    set({ layout: next });


    if (get().raw?.family === "sequence" && previous.sequence !== next.sequence) {
      relayout(get().source);
    } else {
      reapply(get().diagnostics.filter((d) => d.severity === "error" && d.line !== undefined));
    }
    scheduleSave();
  };

  return {
    path: null,
    name: "untitled",
    engine: "graphviz",
    source: "",
    eol: "\n",
    dirty: false,

    raw: null,
    scene: null,
    ghosts: new Map(),
    orphans: [],
    diagnostics: [],

    layout: {},
    fitToken: 0,

    blocks: [],
    activeBlock: null,
    sidecar: { version: 1, blocks: {} },

    headScene: null,
    headPinned: new Set(),
    git: null,
    diffMode: false,

    selection: new Set(),
    selectedEdge: null,
    annotationSelection: new Set(),
    annotationTool: null,
    annotationPen: DEFAULT_ANNOTATION_COLOR,
    hovered: null,
    dragging: null,
    stale: false,
    sourceOrigin: "file",
    renameRequest: null,
    conflict: null,

    setSource: (source, force = false) => {
      const changed = source !== get().source;
      set({ source, dirty: changed ? get().path !== null : get().dirty });


      let engineSource = source;
      if (get().blocks.length > 0 || isMarkdown(get().name)) {
        const blocks = parseMarkdownBlocks(source);
        const active =
          blocks.find((b) => b.id === get().activeBlock) ?? blocks[0] ?? null;

        set({
          blocks,
          activeBlock: active?.id ?? null,
          engine: active?.engine ?? get().engine,
        });
        engineSource = active?.source ?? "";
      }


      if (force || useSettingsStore.getState().autoRender) relayout(engineSource);
      else set({ stale: true });
    },

    setEngine: (engine) => {
      set({ engine, raw: null, scene: null });
      relayout(get().source);
    },

    openSample: (name, source, engine = "graphviz") => {
      useHistoryStore.getState().clear();
      set({
        path: null,
        name,
        engine,
        source,
        sourceOrigin: "file",
        blocks: [],
        activeBlock: null,
        diffMode: false,
        headScene: null,
        headPinned: new Set(),
        git: null,
        sidecar: { version: 1, blocks: {} },
        conflict: null,
        layout: {},
        dirty: false,
        selection: new Set(),
        annotationSelection: new Set(),
        selectedEdge: null,
        raw: null,
        scene: null,
        ghosts: new Map(),
        orphans: [],
        diagnostics: [],
        fitToken: get().fitToken + 1,
      });
      relayout(source);
    },

    openFile: async (path) => {
      const file = await api.readFile(path);


      useHistoryStore.getState().clear();
      const state = await api.readLayout(path);
      const read = state.status === "ok" ? state.sidecar : { version: 1 };

      const sidecar: Sidecar = { ...read, blocks: read.blocks ?? {} };
      const conflict = state.status === "conflict" ? state.conflict : null;

      useWorkspaceStore.getState().setLastFile(file.path);


      const text = toLf(file.text);

      const blocks = isMarkdown(file.name) ? parseMarkdownBlocks(text) : [];
      const active = blocks[0] ?? null;

      set({
        path: file.path,
        name: file.name,
        engine: active ? active.engine : ((file.engine as EngineId) ?? "graphviz"),
        source: text,
        eol: detectEol(file.text),
        sourceOrigin: "file",
        blocks,
        activeBlock: active?.id ?? null,
        diffMode: false,
        headScene: null,
        headPinned: new Set(),
        git: null,
        sidecar,
        layout: active ? (sidecar.blocks![active.id] ?? {}) : layoutOf(sidecar),
        conflict,
        dirty: false,
        selection: new Set(),
        annotationSelection: new Set(),
        selectedEdge: null,


        raw: null,
        scene: null,
        ghosts: new Map(),
        orphans: [],
        diagnostics: [],
        fitToken: get().fitToken + 1,
      });
      relayout(active ? active.source : text);
    },

    createFile: async (dir, fileName, source, engine) => {
      const path = joinPath(dir, fileName);
      useHistoryStore.getState().clear();

      if (await api.pathExists(path)) {
        throw new Error(`${fileName} already exists in this folder.`);
      }

      await api.writeFile(path, source);
      useWorkspaceStore.getState().setLastFile(path);

      set({
        path,
        name: fileName,
        engine,
        source,
        sourceOrigin: "file",


        blocks: [],
        activeBlock: null,
        diffMode: false,
        headScene: null,
        headPinned: new Set(),
        git: null,
        sidecar: { version: 1, blocks: {} },
        conflict: null,

        layout: {},
        dirty: false,
        selection: new Set(),
        annotationSelection: new Set(),
        selectedEdge: null,
        raw: null,
        scene: null,
        ghosts: new Map(),
        orphans: [],
        diagnostics: [],
        fitToken: get().fitToken + 1,
      });
      relayout(source);

      return path;
    },

    createImported: async (dir, fileName, source, layout) => {
      const path = await get().createFile(dir, fileName, source, "mermaid");

      const sidecar: Sidecar = { version: 1, ...layout, blocks: {} };
      await api.writeLayout(path, sidecar);
      set({ layout, sidecar });


      relayout(source);
      return path;
    },

    saveSource: async () => {
      const { path, source, eol } = get();
      if (!path) return;

      await api.writeFile(path, withEol(source, eol));
      set({ dirty: false });
    },

    selectEdge: (selectedEdge) =>
      set({ selectedEdge, selection: new Set(), annotationSelection: new Set() }),

    select: (ids, additive) =>
      set((s) => {


        if (!additive) {
          return { selection: new Set(ids), selectedEdge: null, annotationSelection: new Set() };
        }
        const next = new Set(s.selection);
        for (const id of ids) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return { selection: next };
      }),

    setAnnotationTool: (annotationTool) =>


      set({ annotationTool, selection: new Set(), selectedEdge: null }),

    setAnnotationPen: (annotationPen) => {
      set({ annotationPen });

      const { layout, annotationSelection } = get();
      if (annotationSelection.size === 0) return;

      const annotations = { ...(layout.annotations ?? {}) };
      for (const id of annotationSelection) {
        const mark = annotations[id];
        if (mark) annotations[id] = { ...mark, color: annotationPen };
      }
      mutateLayout({ ...layout, annotations }, "Recolour an annotation");
    },

    selectAnnotations: (ids, additive) =>
      set((s) => {
        if (!additive) {
          return { annotationSelection: new Set(ids), selection: new Set(), selectedEdge: null };
        }
        const next = new Set(s.annotationSelection);
        for (const id of ids) {
          if (next.has(id)) next.delete(id);
          else next.add(id);
        }
        return { annotationSelection: next };
      }),

    addAnnotation: (mark) => {
      const { layout } = get();
      const annotations = { ...(layout.annotations ?? {}) };
      const id = nextAnnotationId(annotations);
      annotations[id] = mark;

      mutateLayout({ ...layout, annotations }, `Add a ${mark.kind}`);
      set({ annotationSelection: new Set([id]), selection: new Set(), selectedEdge: null });
      return id;
    },

    updateAnnotation: (id, patch) => {
      const { layout } = get();
      const existing = layout.annotations?.[id];
      if (!existing) return;

      mutateLayout(
        { ...layout, annotations: { ...layout.annotations, [id]: { ...existing, ...patch } } },
        patch.at ? "Move an annotation" : "Edit an annotation",
      );
    },

    removeAnnotations: (ids) => {
      const { layout } = get();
      const annotations = { ...(layout.annotations ?? {}) };
      let removed = 0;
      for (const id of ids) {
        if (annotations[id]) removed += 1;
        delete annotations[id];
      }
      if (removed === 0) return;

      mutateLayout(
        { ...layout, annotations },
        removed === 1 ? "Delete an annotation" : `Delete ${removed} annotations`,
      );
      set((s) => {
        const next = new Set(s.annotationSelection);
        for (const id of ids) next.delete(id);
        return { annotationSelection: next };
      });
    },

    setHovered: (hovered) => set({ hovered }),
    setDragging: (dragging) => set({ dragging }),

    pinAt: (positions, snapSize = 0) => {
      const { raw, layout } = get();
      if (!raw || !isGraph(raw)) return;

      let next = layout;
      for (const [id, at] of positions) {
        const node = raw.nodes.find((n) => n.id === id);
        if (!node) continue;
        next = withPin(next, id, pinFor(node, snapSize > 0 ? snapPoint(at, snapSize) : at));
      }

      mutateLayout(next, positions.size === 1 ? "Move a node" : `Move ${positions.size} nodes`);
    },

    releasePins: (ids) =>
      mutateLayout(
        withoutPins(get().layout, ids),
        ids.length === 1 ? "Release a pin" : `Release ${ids.length} pins`,
      ),

    releaseAllPins: () => mutateLayout({ ...get().layout, pins: {} }, "Release every pin"),

    togglePins: (ids) => {
      const { layout, scene } = get();
      if (ids.length === 0 || !scene || !isGraph(scene)) return;


      const nodes = nodesIn(scene, new Set(ids));
      if (nodes.length === 0) return;

      const pinned = nodes.filter((n) => layout.pins?.[n.id]);
      if (pinned.length === nodes.length) {
        get().releasePins(nodes.map((n) => n.id));
        return;
      }


      const positions = new Map<string, Point>();
      for (const node of nodes) positions.set(node.id, rectCenter(node.rect));
      get().pinAt(positions, 0);
    },

    restoreLayout: (layout) => {
      useHistoryStore.getState().withApplying(() => mutateLayout(layout, "restore"));


      const marks = layout.annotations ?? {};
      set((s) => {
        const kept = [...s.annotationSelection].filter((id) => marks[id]);
        return kept.length === s.annotationSelection.size
          ? {}
          : { annotationSelection: new Set(kept) };
      });
    },

    setLifelineOrder: (ids) => {
      const sequence = { ...get().layout.sequence, lifeline_order: [...ids] };
      mutateLayout(
        { ...get().layout, sequence },
        ids.length === 0 ? "Restore the declared column order" : "Reorder a column",
      );
    },

    setSequenceGap: (kind, id, gap) => {
      const key = kind === "lifeline" ? "lifeline_gap" : "message_gap";
      const gaps = { ...(get().layout.sequence?.[key] ?? {}) };


      if (gap === 0) delete gaps[id];
      else gaps[id] = gap;

      const sequence = { ...get().layout.sequence, [key]: gaps };
      mutateLayout({ ...get().layout, sequence }, "Change spacing");
    },

    setWaypoints: (edgeId, points) => {
      const edges = { ...get().layout.edges };
      const existing = edges[edgeId];

      if (points.length === 0) {


        if (existing?.label_offset) edges[edgeId] = { ...existing, waypoints: [] };
        else delete edges[edgeId];
      } else {
        edges[edgeId] = {
          ...existing,
          waypoints: points.map((p) => [Math.round(p.x), Math.round(p.y)] as [number, number]),
        };
      }

      mutateLayout(
        { ...get().layout, edges },
        points.length === 0 ? "Drop the bends" : "Move a bend",
      );
    },

    setLabelOffset: (edgeId, offset) => {
      const edges = { ...get().layout.edges };
      const existing = edges[edgeId];


      if (!offset || (Math.round(offset.x) === 0 && Math.round(offset.y) === 0)) {
        if (existing?.waypoints?.length) edges[edgeId] = { ...existing, label_offset: null };
        else delete edges[edgeId];
      } else {
        edges[edgeId] = {
          ...existing,
          label_offset: [Math.round(offset.x), Math.round(offset.y)],
        };
      }

      mutateLayout({ ...get().layout, edges }, offset ? "Move a label" : "Reset a label");
    },

    setDiffMode: async (on) => {
      if (!on) {
        set({ diffMode: false });
        return;
      }

      const { path, engine, activeBlock, name } = get();
      if (!path || !isTauri()) return;

      const git = await api.gitStatus(path).catch(() => null);
      set({ git });
      if (!git?.tracked) {
        set({ diffMode: true, headScene: null, headPinned: new Set() });
        return;
      }


      const [source, sidecarText] = await Promise.all([
        api.gitHeadBlob(path).catch(() => null),
        api.gitHeadBlob(`${path}.zlayout.toml`).catch(() => null),
      ]);

      if (source === null) {
        set({ diffMode: true, headScene: null, headPinned: new Set() });
        return;
      }

      let headLayout: Layout = {};
      if (sidecarText) {
        const parsed = await api.parseLayout(sidecarText).catch(() => null);
        if (parsed) {
          headLayout = activeBlock ? (parsed.blocks?.[activeBlock] ?? {}) : layoutOf(parsed);
        }
      }


      const blockSource = activeBlock
        ? (parseMarkdownBlocks(source).find((b) => b.id === activeBlock)?.source ?? null)
        : source;

      if (blockSource === null) {
        set({ diffMode: true, headScene: null, headPinned: new Set() });
        return;
      }

      const theme = themeByName(
        get().layout.theme?.name ?? useSettingsStore.getState().diagramTheme,
      );
      const result = await adapterFor(engine)
        .layout(blockSource, { theme, sequenceHints: headLayout.sequence })
        .catch(() => null);

      const raw = result?.scene ?? null;
      const headScene =
        raw && isGraph(raw) ? applyPins(raw, headLayout).scene : raw;

      set({
        diffMode: true,
        headScene,
        headPinned: new Set(Object.keys(headLayout.pins ?? {})),
        git: { ...git, head: git.head ?? name },
      });
    },

    selectBlock: (id) => {
      const { blocks, sidecar, activeBlock, layout } = get();
      const block = blocks.find((b) => b.id === id);
      if (!block || id === activeBlock) return;


      const carried: Record<string, Layout> = activeBlock
        ? { ...sidecar.blocks, [activeBlock]: layout }
        : { ...sidecar.blocks };

      useHistoryStore.getState().clear();
      set({
        sidecar: { ...sidecar, blocks: carried },
        activeBlock: id,
        engine: block.engine,
        layout: carried[id] ?? {},
        raw: null,
        scene: null,
        selection: new Set(),
        annotationSelection: new Set(),
        selectedEdge: null,
        fitToken: get().fitToken + 1,
      });
      relayout(block.source);
    },

    markBlock: (id, name) => {
      const { blocks, source, sidecar, activeBlock, layout } = get();
      const block = blocks.find((b) => b.id === id);
      if (!block) return false;

      const marked = withMarker(source, block, name);
      if (!marked) return false;


      const carried: Record<string, Layout> = { ...sidecar.blocks };
      const existing = id === activeBlock ? layout : carried[id];
      delete carried[id];
      if (existing) carried[marked.id] = existing;

      const next = parseMarkdownBlocks(marked.source);

      set({
        source: marked.source,
        sourceOrigin: "edit",
        dirty: get().path !== null,
        blocks: next,
        sidecar: { ...sidecar, blocks: carried },
        activeBlock: activeBlock === id ? marked.id : activeBlock,
      });

      scheduleSave();
      if (get().path) void get().saveSource();
      return true;
    },

    requestRename: (renameRequest) => set({ renameRequest }),

    resolveConflict: async (sidecar) => {
      const path = get().path;
      if (!path) return;

      await api.writeLayout(path, sidecar);
      set({ conflict: null, layout: sidecar });
      useHistoryStore.getState().clear();
      reapply([]);
    },

    tuneLayout: (knob, value) => {
      const { engine } = get();
      const tuner = adapterFor(engine).edit?.tuning;
      if (!tuner) return false;

      const scope = editScope(get());
      const edit = tuner.set(scope.source, knob, value);
      if (!edit) return false;


      if (edit.source === scope.source) return true;

      const document = scope.write(edit.source);
      set({
        source: document,
        sourceOrigin: "edit",
        dirty: get().path !== null,
        ...(scope.block ? { blocks: parseMarkdownBlocks(document) } : {}),
      });
      relayout(edit.source);


      if (get().path) void get().saveSource();
      return true;
    },

    editNode: (id, change) => {
      const { engine, layout } = get();
      const editor = adapterFor(engine).edit;
      if (!editor) return false;


      const scope = editScope(get());
      const source = scope.source;

      const edit =
        change.kind === "rename"
          ? editor.rename(source, id, change.to)
          : change.kind === "label"
            ? editor.setLabel(source, id, change.text)
            : editor.setShape(source, id, change.shape);

      if (!edit) return false;


      if (change.kind === "rename") {
        const annotations = retargetAnnotations(layout.annotations, id, change.to);
        const migrated = layout.pins?.[id] ? migratePin(layout, id, change.to) : layout;

        if (migrated !== layout || annotations !== layout.annotations) {
          useHistoryStore
            .getState()
            .withApplying(() => mutateLayout({ ...migrated, annotations }, edit.label));
        }
      }

      const document = scope.write(edit.source);
      set({
        source: document,
        sourceOrigin: "edit",
        dirty: get().path !== null,
        ...(scope.block ? { blocks: parseMarkdownBlocks(document) } : {}),
      });
      relayout(edit.source);

      if (change.kind === "rename") set({ selection: new Set([change.to]) });


      if (get().path) void get().saveSource();

      return true;
    },

    groupNodes: (ids, title) => {
      const scope = editScope(get());
      const edit = adapterFor(get().engine).edit?.group?.(scope.source, ids, title);
      if (!edit) return false;

      const document = scope.write(edit.source);
      set({
        source: document,
        sourceOrigin: "edit",
        dirty: get().path !== null,
        ...(scope.block ? { blocks: parseMarkdownBlocks(document) } : {}),
      });
      relayout(edit.source);
      if (get().path) void get().saveSource();
      return true;
    },

    migrateOrphan: (from, to) =>
      mutateLayout(migratePin(get().layout, from, to), "Migrate a pin"),

    dropOrphans: (ids) =>
      mutateLayout(withoutPins(get().layout, ids), ids.length === 1 ? "Drop an orphan" : "Drop orphans"),

    setDiagramTheme: (name) => {
      mutateLayout({ ...get().layout, theme: name ? { name } : null }, "Change the theme");


      const raw = get().raw;
      if (raw && raw.family === "passthrough") relayout(get().source);
    },
  };
});


export function nodeCenter(state: DocumentState, id: string): Point | null {
  const scene = state.scene;
  if (!scene || !isGraph(scene)) return null;
  const node = scene.nodes.find((n) => n.id === id);
  return node ? rectCenter(node.rect) : null;
}
