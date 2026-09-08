import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { Point, Rect } from "../core/model/geometry";
import { rectCenter, snapPoint } from "../core/model/geometry";
import {
  isGraph,
  isPassthrough,
  isSequence,
  nodesIn,
  type GraphScene,
  type SequenceScene,
} from "../core/model/scene";
import { diffScenes, EMPTY_DIFF } from "../core/diff";
import { annotationFromDrag, moveAnnotation } from "../core/annotate";
import { annotationsBounds, renderAnnotation } from "../core/render/annotations";
import type { Annotation, AnnotationKind } from "../core/sidecar/types";
import { applyPins } from "../core/pins";
import type { DiagramTheme } from "../core/theme";
import { useDocumentStore } from "../store/useDocumentStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useWorkspaceStore } from "../store/useWorkspaceStore";
import { separateNodes } from "../core/overlap";
import {
  fitBox,
  pan,
  screenToWorld,
  worldToScreen,
  zoomAt,
  clampZoom,
  IDENTITY,
  MAX_ZOOM,
  MIN_ZOOM,
  type Viewport,
} from "../lib/viewport";
import { AnnotationTools } from "./AnnotationTools";
import { CanvasControls } from "./CanvasControls";
import { Minimap } from "./Minimap";
import {
  ClusterLayer,
  DiffLayer,
  EdgeLayer,
  EdgeSelection,
  GhostLayer,
  NodeLayer,
  SelectionLayer,
  WaypointLayer,
} from "./scene/GraphLayers";
import {
  ActivationLayer,
  FragmentLayer,
  GapGuide,
  GapHandleLayer,
  LifelineLayer,
  MessageLayer,
  NoteLayer,
  ReorderIndicator,
} from "./scene/SequenceLayers";
import { AnnotationLayer, AnnotationSelection, AnnotationShape } from "./scene/AnnotationLayer";
import { ContextMenu, useContextMenu, type MenuItem } from "./ui";

interface PanState {
  pointerId: number;
  startScreen: Point;
  startViewport: Viewport;
}

interface DragState {
  pointerId: number;

  startWorld: Point;

  origins: Map<string, Point>;

  current: Map<string, Point>;
  moved: boolean;
}


interface AnnoDraw {
  pointerId: number;
  kind: AnnotationKind;
  from: Point;
  to: Point;

  path: Point[];

  over: string | null;
}


interface AnnoDrag {
  pointerId: number;
  ids: string[];
  startWorld: Point;
  delta: Point;
  moved: boolean;
}

interface MarqueeState {
  origin: Point;
  current: Point;
  additive: boolean;
}


interface LifelineDrag {
  pointerId: number;
  id: string;

  x: number;
  moved: boolean;
}


interface GapDrag {
  pointerId: number;
  kind: "lifeline" | "message";

  id: string;
  base: number;
  delta: number;

  guide: number;

  origin: number;
  moved: boolean;
}


interface LabelDrag {
  pointerId: number;
  edgeId: string;

  base: Point;
  offset: Point;
  startWorld: Point;
  moved: boolean;
}


interface WaypointDrag {
  pointerId: number;
  edgeId: string;
  index: number;
  points: Point[];
  moved: boolean;
}

export function Canvas({ theme }: { theme: DiagramTheme }) {
  const scene = useDocumentStore((s) => s.scene);
  const raw = useDocumentStore((s) => s.raw);
  const layout = useDocumentStore((s) => s.layout);
  const ghosts = useDocumentStore((s) => s.ghosts);
  const selection = useDocumentStore((s) => s.selection);
  const hovered = useDocumentStore((s) => s.hovered);
  const fitToken = useDocumentStore((s) => s.fitToken);
  const select = useDocumentStore((s) => s.select);
  const setHovered = useDocumentStore((s) => s.setHovered);
  const setDragging = useDocumentStore((s) => s.setDragging);
  const pinAt = useDocumentStore((s) => s.pinAt);
  const path = useDocumentStore((s) => s.path);
  const diffMode = useDocumentStore((s) => s.diffMode);
  const headScene = useDocumentStore((s) => s.headScene);
  const headPinned = useDocumentStore((s) => s.headPinned);
  const pins = useDocumentStore((s) => s.layout.pins);
  const annotations = useDocumentStore((s) => s.layout.annotations);
  const annotationSelection = useDocumentStore((s) => s.annotationSelection);
  const annotationTool = useDocumentStore((s) => s.annotationTool);
  const selectAnnotations = useDocumentStore((s) => s.selectAnnotations);
  const addAnnotation = useDocumentStore((s) => s.addAnnotation);
  const removeAnnotations = useDocumentStore((s) => s.removeAnnotations);
  const updateAnnotation = useDocumentStore((s) => s.updateAnnotation);

  const gridSnap = useSettingsStore((s) => s.gridSnap);
  const showGrid = useSettingsStore((s) => s.showGrid);
  const showMinimap = useSettingsStore((s) => s.showMinimap);
  const dimUnrelated = useSettingsStore((s) => s.dimUnrelated);
  const releasePins = useDocumentStore((s) => s.releasePins);
  const selectedEdge = useDocumentStore((s) => s.selectedEdge);
  const selectEdge = useDocumentStore((s) => s.selectEdge);
  const setWaypoints = useDocumentStore((s) => s.setWaypoints);
  const setLabelOffset = useDocumentStore((s) => s.setLabelOffset);
  const setLifelineOrder = useDocumentStore((s) => s.setLifelineOrder);
  const setSequenceGap = useDocumentStore((s) => s.setSequenceGap);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [annoDraw, setAnnoDraw] = useState<AnnoDraw | null>(null);
  const [annoDrag, setAnnoDrag] = useState<AnnoDrag | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const annoDrawRef = useRef<AnnoDraw | null>(null);
  const annoDragRef = useRef<AnnoDrag | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewport, setViewport] = useState<Viewport>(IDENTITY);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [waypointDrag, setWaypointDrag] = useState<WaypointDrag | null>(null);
  const [labelDrag, setLabelDrag] = useState<LabelDrag | null>(null);
  const [lifelineDrag, setLifelineDrag] = useState<LifelineDrag | null>(null);
  const [gapDrag, setGapDrag] = useState<GapDrag | null>(null);

  const panRef = useRef<PanState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const marqueeRef = useRef<MarqueeState | null>(null);
  const waypointRef = useRef<WaypointDrag | null>(null);
  const labelRef = useRef<LabelDrag | null>(null);
  const lifelineRef = useRef<LifelineDrag | null>(null);
  const gapRef = useRef<GapDrag | null>(null);
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;

  const pinned = useMemo(() => new Set(Object.keys(layout.pins ?? {})), [layout.pins]);
  const menu = useContextMenu();
  const [menuTarget, setMenuTarget] = useState<string | null>(null);
  const [menuAnnotation, setMenuAnnotation] = useState<string | null>(null);


  const [menuNode, setMenuNode] = useState<string | null>(null);


  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const box = entry?.contentRect;
      if (box) setSize({ w: box.width, h: box.height });
    });
    observer.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });

    return () => observer.disconnect();
  }, []);


  const fit = useCallback(
    (box?: Rect) => {


      const target = box ?? unionRect(scene?.bounds, annotationsBounds(annotations));
      if (!target || size.w === 0 || target.w <= 0) return;
      setViewport(fitBox(target, size.w, size.h));
    },
    [scene, annotations, size.w, size.h],
  );


  const fittedFor = useRef<number | null>(null);
  const restoredFor = useRef<string | null>(null);

  useEffect(() => {
    if (!scene || size.w === 0 || size.h === 0) return;
    if (fittedFor.current === fitToken) return;
    fittedFor.current = fitToken;

    const remembered = path ? useWorkspaceStore.getState().viewports[path] : undefined;
    if (path && remembered && restoredFor.current !== path) {
      restoredFor.current = path;
      setViewport(remembered);
      return;
    }
    if (path) restoredFor.current = path;

    fit();
  }, [scene, size.w, size.h, fitToken, fit, path]);


  useEffect(() => {
    if (!path || viewport === IDENTITY) return;

    const timer = window.setTimeout(() => {
      useWorkspaceStore.getState().rememberViewport(path, viewport);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [path, viewport]);


  const isTyping = (el: EventTarget | null) =>
    el instanceof HTMLElement &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || !!el.closest(".cm-editor"));

  useEffect(() => {
    const down = (e: KeyboardEvent) => {


      if (e.ctrlKey || e.metaKey) {
        const centre = { x: size.w / 2, y: size.h / 2 };
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setViewport((v) => zoomAt(v, centre, 1.25));
          return;
        }
        if (e.key === "-" || e.key === "_") {
          e.preventDefault();
          setViewport((v) => zoomAt(v, centre, 1 / 1.25));
          return;
        }
        if (e.key === "0") {
          e.preventDefault();
          setViewport((v) => ({ ...v, zoom: clampZoom(1) }));
          return;
        }
      }

      if (isTyping(e.target)) return;

      if (e.code === "Space") {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }


      const deltas: Record<string, Point> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const delta = deltas[e.key];
      if (delta && selection.size > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const current = useDocumentStore.getState().scene;
        if (!current || !isGraph(current)) return;

        const next = new Map<string, Point>();
        for (const node of nodesIn(current, selection)) {
          const c = rectCenter(node.rect);
          next.set(node.id, { x: c.x + delta.x * step, y: c.y + delta.y * step });
        }
        if (next.size === 0) return;

        pinAt(next, 0);
      }
    };

    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    const blur = () => setSpaceHeld(false);

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [selection, pinAt, size.w, size.h]);


  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const at = { x: e.clientX - rect.left, y: e.clientY - rect.top };

      if (e.ctrlKey || e.metaKey) {
        setViewport((v) => zoomAt(v, at, Math.exp(-e.deltaY * 0.0022)));
      } else if (e.shiftKey) {
        setViewport((v) => pan(v, -e.deltaY, 0));
      } else {
        setViewport((v) => pan(v, -e.deltaX, -e.deltaY));
      }
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);


  const localPoint = useCallback((e: { clientX: number; clientY: number }): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  }, []);

  const nodeIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-node]")?.getAttribute("data-node") ?? null;
  };

  const gapIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-gap]")?.getAttribute("data-gap") ?? null;
  };

  const lifelineIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-lifeline]")?.getAttribute("data-lifeline") ?? null;
  };

  const ghostIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-ghost]")?.getAttribute("data-ghost") ?? null;
  };

  const annotationIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-annotation]")?.getAttribute("data-annotation") ?? null;
  };

  const clusterIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-cluster]")?.getAttribute("data-cluster") ?? null;
  };

  const edgeLabelIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;
    return target.closest("[data-edge-label]")?.getAttribute("data-edge-label") ?? null;
  };

  const edgeIdAt = (target: EventTarget | null): string | null => {
    if (!(target instanceof Element)) return null;


    return (
      target.closest("[data-edge]")?.getAttribute("data-edge") ??
      target.closest("[data-message]")?.getAttribute("data-message") ??
      null
    );
  };

  const handleAt = (target: EventTarget | null): { kind: "move" | "add"; index: number } | null => {
    if (!(target instanceof Element)) return null;

    const move = target.closest("[data-waypoint]")?.getAttribute("data-waypoint");
    if (move != null) return { kind: "move", index: Number(move) };

    const add = target.closest("[data-waypoint-add]")?.getAttribute("data-waypoint-add");
    if (add != null) return { kind: "add", index: Number(add) };

    return null;
  };

  const onPointerDown = (e: React.PointerEvent) => {


    const target = e.target instanceof Element ? e.target : null;
    if (!target || !containerRef.current?.contains(target)) return;
    if (target.closest("[data-canvas-ui]")) return;

    const at = localPoint(e);
    const capture = e.currentTarget as Element;

    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      capture.setPointerCapture?.(e.pointerId);
      panRef.current = { pointerId: e.pointerId, startScreen: at, startViewport: viewport };
      return;
    }

    if (e.button !== 0) return;


    if (annotationTool) {
      const world = screenToWorld(viewport, at);
      capture.setPointerCapture?.(e.pointerId);
      const state: AnnoDraw = {
        pointerId: e.pointerId,
        kind: annotationTool,
        from: world,
        to: world,
        path: [world],
        over: nodeIdAt(e.target),
      };
      annoDrawRef.current = state;
      setAnnoDraw(state);
      return;
    }


    const handle = handleAt(e.target);
    if (handle && selectedEdge) {
      const current = (layout.edges?.[selectedEdge]?.waypoints ?? []).map(([x, y]) => ({ x, y }));


      const points =
        handle.kind === "add"
          ? [
              ...current.slice(0, handle.index),
              screenToWorld(viewport, at),
              ...current.slice(handle.index),
            ]
          : current;

      capture.setPointerCapture?.(e.pointerId);
      const state: WaypointDrag = {
        pointerId: e.pointerId,
        edgeId: selectedEdge,
        index: handle.index,
        points,
        moved: handle.kind === "add",
      };
      waypointRef.current = state;
      setWaypointDrag(state);
      return;
    }


    const labelEdgeId = edgeLabelIdAt(e.target);
    if (labelEdgeId && scene && isGraph(scene)) {
      const offset = layout.edges?.[labelEdgeId]?.label_offset;
      capture.setPointerCapture?.(e.pointerId);
      const base: Point = { x: offset?.[0] ?? 0, y: offset?.[1] ?? 0 };
      const state: LabelDrag = {
        pointerId: e.pointerId,
        edgeId: labelEdgeId,
        base,
        offset: base,
        startWorld: screenToWorld(viewport, at),
        moved: false,
      };
      labelRef.current = state;
      setLabelDrag(state);
      selectEdge(labelEdgeId);
      return;
    }


    const ghostId = ghostIdAt(e.target);
    if (ghostId) {
      releasePins([ghostId]);
      return;
    }


    const annoId = annotationIdAt(e.target);
    if (annoId) {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      const ids =
        annotationSelection.has(annoId) && !additive
          ? [...annotationSelection]
          : (selectAnnotations([annoId], additive), [annoId]);

      capture.setPointerCapture?.(e.pointerId);
      const state: AnnoDrag = {
        pointerId: e.pointerId,
        ids,
        startWorld: screenToWorld(viewport, at),
        delta: { x: 0, y: 0 },
        moved: false,
      };
      annoDragRef.current = state;
      setAnnoDrag(state);
      return;
    }


    const gapId = gapIdAt(e.target);
    if (gapId && sequence) {
      capture.setPointerCapture?.(e.pointerId);
      const line = sequence.lifelines.find((l) => l.id === gapId);
      const origin = line?.head.x ?? screenToWorld(viewport, at).x;
      const state: GapDrag = {
        pointerId: e.pointerId,
        kind: "lifeline",
        id: gapId,
        base: layout.sequence?.lifeline_gap?.[gapId] ?? 0,
        delta: 0,
        guide: origin,
        origin,
        moved: false,
      };
      gapRef.current = state;
      setGapDrag(state);
      return;
    }

    const messageId = sequence ? edgeIdAt(e.target) : null;
    if (messageId && sequence) {
      const index = sequence.messages.findIndex((m) => m.id === messageId);
      selectEdge(messageId);


      const previous = index > 0 ? sequence.messages[index - 1] : undefined;
      if (previous) {
        capture.setPointerCapture?.(e.pointerId);
        const origin = sequence.messages[index]!.y;
        const state: GapDrag = {
          pointerId: e.pointerId,
          kind: "message",
          id: previous.id,
          base: layout.sequence?.message_gap?.[previous.id] ?? 0,
          delta: 0,
          guide: origin,
          origin,
          moved: false,
        };
        gapRef.current = state;
        setGapDrag(state);
      }
      return;
    }

    const lifelineId = lifelineIdAt(e.target);
    if (lifelineId && sequence) {
      capture.setPointerCapture?.(e.pointerId);
      const state: LifelineDrag = {
        pointerId: e.pointerId,
        id: lifelineId,
        x: screenToWorld(viewport, at).x,
        moved: false,
      };
      lifelineRef.current = state;
      setLifelineDrag(state);
      select([lifelineId], false);
      return;
    }

    const nodeId = nodeIdAt(e.target);


    const clusterId = nodeId ? null : clusterIdAt(e.target);

    if ((nodeId || clusterId) && scene && isGraph(scene)) {
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;

      let ids: string[];
      if (clusterId) {

        select([clusterId], additive);
        ids = nodesIn(scene, new Set([clusterId])).map((n) => n.id);
      } else {


        ids =
          selection.has(nodeId!) && !additive
            ? [...selection]
            : (select([nodeId!], additive), [nodeId!]);
      }

      const origins = new Map<string, Point>();
      for (const id of ids) {
        const node = scene.nodes.find((n) => n.id === id);
        if (node) origins.set(id, rectCenter(node.rect));
      }


      if (origins.size === 0) return;

      capture.setPointerCapture?.(e.pointerId);
      const state: DragState = {
        pointerId: e.pointerId,
        startWorld: screenToWorld(viewport, at),
        origins,
        current: new Map(origins),
        moved: false,
      };
      dragRef.current = state;
      setDrag(state);
      return;
    }


    const edgeId = edgeIdAt(e.target);
    if (edgeId) {
      selectEdge(edgeId);
      return;
    }

    capture.setPointerCapture?.(e.pointerId);
    const state = { origin: at, current: at, additive: e.shiftKey };
    marqueeRef.current = state;
    setMarquee(state);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const at = localPoint(e);

    const panning = panRef.current;
    if (panning?.pointerId === e.pointerId) {
      setViewport({
        ...panning.startViewport,
        x: panning.startViewport.x + (at.x - panning.startScreen.x),
        y: panning.startViewport.y + (at.y - panning.startScreen.y),
      });
      return;
    }

    const drawing = annoDrawRef.current;
    if (drawing?.pointerId === e.pointerId) {
      const world = screenToWorld(viewportRef.current, at);
      const next: AnnoDraw = {
        ...drawing,
        to: world,


        path: drawing.kind === "stroke" ? [...drawing.path, world] : drawing.path,
      };
      annoDrawRef.current = next;
      setAnnoDraw(next);
      return;
    }

    const movingMark = annoDragRef.current;
    if (movingMark?.pointerId === e.pointerId) {
      const world = screenToWorld(viewportRef.current, at);
      const delta = { x: world.x - movingMark.startWorld.x, y: world.y - movingMark.startWorld.y };
      const next: AnnoDrag = {
        ...movingMark,
        delta,
        moved: movingMark.moved || Math.hypot(delta.x, delta.y) > 2,
      };
      annoDragRef.current = next;
      setAnnoDrag(next);
      return;
    }

    const gap = gapRef.current;
    if (gap?.pointerId === e.pointerId) {
      const world = screenToWorld(viewportRef.current, at);
      const axis = gap.kind === "lifeline" ? world.x : world.y;


      const delta = Math.max(-gap.base, axis - gap.origin);

      const next: GapDrag = { ...gap, delta, guide: gap.origin + delta, moved: true };
      gapRef.current = next;
      setGapDrag(next);
      return;
    }

    const lifeline = lifelineRef.current;
    if (lifeline?.pointerId === e.pointerId) {
      const world = screenToWorld(viewportRef.current, at);
      const next = { ...lifeline, x: world.x, moved: lifeline.moved || true };
      lifelineRef.current = next;
      setLifelineDrag(next);
      return;
    }

    const labelling = labelRef.current;
    if (labelling?.pointerId === e.pointerId) {
      const world = screenToWorld(viewportRef.current, at);
      const dx = world.x - labelling.startWorld.x;
      const dy = world.y - labelling.startWorld.y;
      const next = {
        ...labelling,
        offset: { x: labelling.base.x + dx, y: labelling.base.y + dy },
        moved: labelling.moved || Math.hypot(dx, dy) > 2,
      };
      labelRef.current = next;
      setLabelDrag(next);
      return;
    }

    const waypoint = waypointRef.current;
    if (waypoint?.pointerId === e.pointerId) {
      const world = screenToWorld(viewportRef.current, at);
      const points = [...waypoint.points];
      points[waypoint.index] = e.altKey ? world : snapPoint(world, gridSnap);

      const next = { ...waypoint, points, moved: true };
      waypointRef.current = next;
      setWaypointDrag(next);
      return;
    }

    const dragging = dragRef.current;
    if (dragging?.pointerId === e.pointerId) {
      const world = screenToWorld(viewportRef.current, at);
      const dx = world.x - dragging.startWorld.x;
      const dy = world.y - dragging.startWorld.y;


      const moved = dragging.moved || Math.hypot(dx, dy) > 2;


      const snap = e.altKey ? 0 : gridSnap;

      const current = new Map<string, Point>();
      for (const [id, origin] of dragging.origins) {
        const target = { x: origin.x + dx, y: origin.y + dy };
        current.set(id, snap > 0 ? snapPoint(target, snap) : target);
      }

      const next = { ...dragging, current, moved };
      dragRef.current = next;
      setDrag(next);
      if (moved && !useDocumentStore.getState().dragging) setDragging([...dragging.origins.keys()][0] ?? null);
      return;
    }

    if (marqueeRef.current) {
      const next = { ...marqueeRef.current, current: at };
      marqueeRef.current = next;
      setMarquee(next);
      return;
    }

    setHovered(nodeIdAt(e.target));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (panRef.current?.pointerId === e.pointerId) {
      panRef.current = null;
      return;
    }

    const drawing = annoDrawRef.current;
    if (drawing?.pointerId === e.pointerId) {
      annoDrawRef.current = null;
      setAnnoDraw(null);

      const mark = anchored(
        annotationFromDrag(drawing.kind, drawing.from, drawing.to, drawing.path),
        drawing,
        shown ?? (scene && isGraph(scene) ? scene : null),
      );
      if (mark) {
        mark.color = useDocumentStore.getState().annotationPen;
        const id = addAnnotation(mark);


        if (mark.kind === "note") setEditingNote(id);
      }


      useDocumentStore.getState().setAnnotationTool(null);
      return;
    }

    const movingMark = annoDragRef.current;
    if (movingMark?.pointerId === e.pointerId) {
      annoDragRef.current = null;
      setAnnoDrag(null);

      if (movingMark.moved) {
        for (const id of movingMark.ids) {
          const mark = annotations?.[id];
          if (mark) updateAnnotation(id, moveAnnotation(mark, movingMark.delta.x, movingMark.delta.y));
        }
      }
      return;
    }

    const gap = gapRef.current;
    if (gap?.pointerId === e.pointerId) {
      gapRef.current = null;
      setGapDrag(null);
      if (gap.moved) {
        setSequenceGap(gap.kind, gap.id, Math.round(Math.max(0, gap.base + gap.delta)));
      }
      return;
    }

    const lifeline = lifelineRef.current;
    if (lifeline?.pointerId === e.pointerId) {
      lifelineRef.current = null;
      setLifelineDrag(null);

      if (lifeline.moved && sequence) {
        const order = reorderLifelines(sequence, lifeline.id, lifeline.x);


        if (order) setLifelineOrder(order);
      }
      return;
    }

    const labelling = labelRef.current;
    if (labelling?.pointerId === e.pointerId) {
      labelRef.current = null;
      setLabelDrag(null);
      if (labelling.moved) setLabelOffset(labelling.edgeId, labelling.offset);
      return;
    }

    const waypoint = waypointRef.current;
    if (waypoint?.pointerId === e.pointerId) {
      waypointRef.current = null;
      setWaypointDrag(null);
      if (waypoint.moved) setWaypoints(waypoint.edgeId, waypoint.points);
      return;
    }

    const dragging = dragRef.current;
    if (dragging?.pointerId === e.pointerId) {
      dragRef.current = null;
      setDrag(null);
      setDragging(null);


      if (dragging.moved) pinAt(dragging.current, 0);
      return;
    }

    const box = marqueeRef.current;
    marqueeRef.current = null;
    setMarquee(null);
    if (!box || !scene || !isGraph(scene)) return;

    if (Math.hypot(box.current.x - box.origin.x, box.current.y - box.origin.y) < 3) {
      if (!box.additive) select([], false);
      return;
    }

    const world = marqueeWorldRect(box, viewportRef.current);
    select(
      scene.nodes.filter((n) => rectsIntersect(n.rect, world)).map((n) => n.id),
      box.additive,
    );
  };


  const sequence: SequenceScene | null = scene && isSequence(scene) ? scene : null;

  const shown: GraphScene | null = useMemo(() => {
    const base = scene && isGraph(scene) ? scene : null;
    const nodeMove = drag?.moved ? drag : null;
    const wpMove = waypointDrag?.moved ? waypointDrag : null;
    const labelMove = labelDrag?.moved ? labelDrag : null;
    if ((!nodeMove && !wpMove && !labelMove) || !raw || !isGraph(raw)) return base;

    const pins = { ...(layout.pins ?? {}) };
    for (const [id, at] of nodeMove?.current ?? []) {
      pins[id] = { ...(pins[id] ?? {}), x: at.x, y: at.y };
    }

    const edges = { ...(layout.edges ?? {}) };
    if (wpMove) {
      edges[wpMove.edgeId] = {
        ...edges[wpMove.edgeId],
        waypoints: wpMove.points.map((p) => [p.x, p.y] as [number, number]),
      };
    }
    if (labelMove) {
      edges[labelMove.edgeId] = {
        ...edges[labelMove.edgeId],
        label_offset: [labelMove.offset.x, labelMove.offset.y],
      };
    }

    return applyPins(raw, { ...layout, pins, edges }).scene;
  }, [scene, drag, waypointDrag, labelDrag, raw, layout]);


  const diff = useMemo(() => {
    if (!diffMode || !headScene || !shown) return EMPTY_DIFF;
    return diffScenes(headScene, shown, {
      pinnedBefore: headPinned,
      pinnedAfter: new Set(Object.keys(pins ?? {})),
    });
  }, [diffMode, headScene, shown, headPinned, pins]);

  const highlightedEdges = useMemo(() => {
    if (selectedEdge) return new Set([selectedEdge]);
    if (!shown || selection.size === 0) return new Set<string>();
    return new Set(
      shown.edges.filter((e) => selection.has(e.from) || selection.has(e.to)).map((e) => e.id),
    );
  }, [shown, selection]);


  const shownGhosts = useMemo(() => {
    const out = new Map<string, Rect>();
    if (!raw || !isGraph(raw)) return out;

    const interesting = drag
      ? new Set([...drag.origins.keys(), ...pinned])
      : new Set([...selection].filter((id) => pinned.has(id)));

    for (const id of interesting) {
      const auto = ghosts.get(id) ?? raw.nodes.find((n) => n.id === id)?.rect;
      const now = shown?.nodes.find((n) => n.id === id)?.rect;

      if (auto && now && (Math.abs(auto.x - now.x) > 1 || Math.abs(auto.y - now.y) > 1)) {
        out.set(id, auto);
      }
    }
    return out;
  }, [raw, ghosts, drag, selection, pinned, shown]);


  const movingIds = useMemo(
    () => (annoDrag?.moved ? new Set(annoDrag.ids) : undefined),
    [annoDrag],
  );

  const movingMarks = useMemo(() => {
    if (!movingIds || !annotations) return undefined;
    const out: Record<string, Annotation> = {};
    for (const id of movingIds) {
      const mark = annotations[id];
      if (mark) out[id] = mark;
    }
    return out;
  }, [movingIds, annotations]);


  const drawnPreview = useMemo(() => {
    if (!annoDraw) return null;
    const mark = annotationFromDrag(annoDraw.kind, annoDraw.from, annoDraw.to, annoDraw.path);
    return mark ? renderAnnotation("preview", mark, null, theme) : null;
  }, [annoDraw, theme]);

  const transform = `translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`;
  const draggingIds = drag?.moved ? new Set(drag.origins.keys()) : undefined;

  return (
    <div
      ref={containerRef}
      className={`canvas-surface relative h-full w-full overflow-hidden${showGrid ? " drafting-grid" : ""}`}
      style={{
        ...(showGrid ? null : { background: "var(--canvas-bg)" }),

        ...(annotationTool ? { cursor: "crosshair" } : null),
      }}
      onContextMenu={(e) => {
        const mark = annotationIdAt(e.target);
        setMenuAnnotation(mark);
        setMenuNode(mark && selection.size === 1 ? [...selection][0]! : null);
        if (mark && !annotationSelection.has(mark)) selectAnnotations([mark], false);

        const node = mark ? null : nodeIdAt(e.target);
        setMenuTarget(node);


        if (!node && !mark) {
          const edge = edgeIdAt(e.target);
          if (edge) selectEdge(edge);
        }
        menu.openAt(e);
      }}
      data-space={spaceHeld ? "true" : undefined}
      data-panning={panRef.current ? "true" : undefined}
      onDoubleClick={(e) => {


        const under = document.elementFromPoint(e.clientX, e.clientY);


        const noteId = annotationIdAt(under) ?? annotationIdAt(e.target);
        if (noteId && annotations?.[noteId]?.kind === "note") {
          e.preventDefault();
          setEditingNote(noteId);
          return;
        }


        const labelEdge = edgeLabelIdAt(under) ?? edgeLabelIdAt(e.target);
        if (labelEdge) {
          e.preventDefault();
          setLabelOffset(labelEdge, null);
          return;
        }

        const handle = handleAt(under) ?? handleAt(e.target);
        if (!handle || handle.kind !== "move" || !selectedEdge) return;

        e.preventDefault();
        const points = (layout.edges?.[selectedEdge]?.waypoints ?? []).map(([x, y]) => ({ x, y }));
        points.splice(handle.index, 1);
        setWaypoints(selectedEdge, points);
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={() => setHovered(null)}
    >
      <svg width={size.w} height={size.h} style={{ display: "block", touchAction: "none" }}>
        <g transform={transform}>


          {scene && isPassthrough(scene) && (
            <g
              data-layer="passthrough"
              dangerouslySetInnerHTML={{ __html: scene.svg }}
              style={{ pointerEvents: "none" }}
            />
          )}
          {sequence && (
            <>
              <FragmentLayer scene={sequence} theme={theme} />
              <LifelineLayer
                scene={sequence}
                theme={theme}
                selection={selection}
                dragging={lifelineDrag?.moved ? lifelineDrag.id : null}
              />
              <ActivationLayer scene={sequence} theme={theme} />
              <NoteLayer scene={sequence} theme={theme} />
              <MessageLayer scene={sequence} theme={theme} selected={selectedEdge} />
              <GapHandleLayer
                scene={sequence}
                active={gapDrag?.kind === "lifeline" ? gapDrag.id : null}
              />
              <GapGuide
                scene={sequence}
                x={gapDrag?.kind === "lifeline" && gapDrag.moved ? gapDrag.guide : null}
                y={gapDrag?.kind === "message" && gapDrag.moved ? gapDrag.guide : null}
              />
              <ReorderIndicator
                scene={sequence}
                x={
                  lifelineDrag?.moved
                    ? dropLineFor(sequence, lifelineDrag.id, lifelineDrag.x)
                    : null
                }
              />
            </>
          )}

          {shown && (
            <>
              <ClusterLayer
                scene={shown}
                theme={theme}
                selection={selection}
                draggingIds={draggingIds}
              />
              <GhostLayer ghosts={shownGhosts} scene={shown} theme={theme} />
              <EdgeLayer
                scene={shown}
                theme={theme}
                highlighted={highlightedEdges}
                dimmed={dimUnrelated && (selection.size > 0 || selectedEdge !== null)}
                draggingLabel={labelDrag?.moved ? labelDrag.edgeId : null}
              />
              {diffMode && <DiffLayer diff={diff} theme={theme} />}
              <NodeLayer
                scene={shown}
                theme={theme}
                pins={pinned}
                selection={selection}
                hovered={hovered}
                draggingIds={draggingIds}
              />
              <SelectionLayer scene={shown} selection={selection} />

              <WaypointEditor
                scene={shown}
                edgeId={selectedEdge}
                layout={layout}
                drag={waypointDrag}
              />
            </>
          )}


          <AnnotationLayer
            annotations={annotations}
            scene={shown ?? scene}
            theme={theme}
            hidden={movingIds}
          />
          {annoDrag?.moved && (
            <g transform={`translate(${annoDrag.delta.x},${annoDrag.delta.y})`}>
              <AnnotationLayer annotations={movingMarks} scene={shown ?? scene} theme={theme} />
            </g>
          )}

          {drawnPreview && <AnnotationShape mark={drawnPreview} theme={theme} preview />}

          <AnnotationSelection
            annotations={annotations}
            scene={shown ?? scene}
            theme={theme}
            selection={annotationSelection}
          />
        </g>

        {marquee && <MarqueeRect state={marquee} />}
      </svg>


      {editingNote && annotations?.[editingNote] && (
        <NoteEditor
          key={editingNote}
          mark={annotations[editingNote]}
          viewport={viewport}
          theme={theme}
          onCommit={(text) => {
            updateAnnotation(editingNote, { text: text.trim() || null });
            setEditingNote(null);
          }}
          onCancel={() => setEditingNote(null)}
        />
      )}


      {scene && !isPassthrough(scene) && <AnnotationTools />}

      {scene && isPassthrough(scene) && <PassthroughBanner reason={scene.reason} />}

      {showMinimap && shown && (
        <Minimap
          scene={shown}
          theme={theme}
          viewport={viewport}
          width={size.w}
          height={size.h}
          pins={pinned}
          onJump={(world) =>
            setViewport((v) => ({
              ...v,
              x: size.w / 2 - world.x * v.zoom,
              y: size.h / 2 - world.y * v.zoom,
            }))
          }
        />
      )}

      <ContextMenu
        anchor={menu.anchor}
        onClose={menu.close}
        items={
          menuAnnotation && annotations?.[menuAnnotation]
            ? annotationMenu({
                id: menuAnnotation,
                mark: annotations[menuAnnotation],
                selection: annotationSelection,
                node: menuNode,
                edit: () => setEditingNote(menuAnnotation),
                update: updateAnnotation,
                remove: removeAnnotations,
              })
            : menuItems({
          target: menuTarget,
          selection,
          pinned,
          scene: shown,
          releasePins,
          pinAt,
          select,
          fit: () => fit(),
          edgeId: menuTarget ? null : selectedEdge,
          hasWaypoints: Boolean(
            selectedEdge && (layout.edges?.[selectedEdge]?.waypoints?.length ?? 0) > 0,
          ),
          clearWaypoints: () => selectedEdge && setWaypoints(selectedEdge, []),
        })
        }
      />

      <CanvasControls
        zoom={viewport.zoom}
        onZoomIn={() => setViewport((v) => zoomAt(v, { x: size.w / 2, y: size.h / 2 }, 1.25))}
        onZoomOut={() => setViewport((v) => zoomAt(v, { x: size.w / 2, y: size.h / 2 }, 1 / 1.25))}
        onFit={() => fit()}
        onFitSelection={() => {
          if (!shown || selection.size === 0) return fit();
          const rects = shown.nodes.filter((n) => selection.has(n.id)).map((n) => n.rect);
          if (rects.length) fit(unionOf(rects));
        }}
        onReset={() => setViewport((v) => ({ ...v, zoom: clampZoom(1) }))}
        canZoomIn={viewport.zoom < MAX_ZOOM}
        canZoomOut={viewport.zoom > MIN_ZOOM}
        hasSelection={selection.size > 0}
      />
    </div>
  );
}


function PassthroughBanner({ reason }: { reason: string }) {
  return (
    <div
      className="absolute top-3 left-1/2 max-w-[520px] -translate-x-1/2 rounded-lg px-3 py-2 text-[11px] leading-snug"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-2)",
        color: "var(--text-2)",
      }}
    >
      <span className="font-medium" style={{ color: "var(--text)" }}>
        Read-only.
      </span>{" "}
      {reason}
    </div>
  );
}


function reorderLifelines(
  scene: SequenceScene,
  id: string,
  x: number,
): string[] | null {
  const others = scene.lifelines.filter((l) => l.id !== id);
  const index = others.filter((l) => l.x < x).length;

  const current = scene.lifelines.map((l) => l.id);
  const next = others.map((l) => l.id);
  next.splice(index, 0, id);

  return next.join("\u0000") === current.join("\u0000") ? null : next;
}


function dropLineFor(scene: SequenceScene, id: string, x: number): number | null {
  const others = scene.lifelines.filter((l) => l.id !== id);
  const index = others.filter((l) => l.x < x).length;

  const before = others[index - 1];
  const after = others[index];
  if (!before) return after ? after.head.x - 14 : null;
  if (!after) return before.head.x + before.head.w + 14;
  return (before.head.x + before.head.w + after.head.x) / 2;
}

function WaypointEditor({
  scene,
  edgeId,
  layout,
  drag,
}: {
  scene: GraphScene;
  edgeId: string | null;
  layout: { edges?: Record<string, { waypoints?: Array<[number, number]> }> };
  drag: WaypointDrag | null;
}) {
  if (!edgeId) return null;

  const edge = scene.edges.find((candidate) => candidate.id === edgeId);
  if (!edge) return null;

  const stored = (layout.edges?.[edgeId]?.waypoints ?? []).map(([x, y]) => ({ x, y }));
  const live = drag?.edgeId === edgeId && drag.moved ? drag.points : stored;

  return (
    <>
      <EdgeSelection edge={edge} />
      <WaypointLayer
        edge={edge}
        waypoints={live}
        active={drag?.edgeId === edgeId ? drag.index : null}
      />
    </>
  );
}

function MarqueeRect({ state }: { state: MarqueeState }) {
  return (
    <rect
      x={Math.min(state.origin.x, state.current.x)}
      y={Math.min(state.origin.y, state.current.y)}
      width={Math.abs(state.current.x - state.origin.x)}
      height={Math.abs(state.current.y - state.origin.y)}
      fill="var(--accent-soft)"
      stroke="var(--accent)"
      strokeWidth={1}
      strokeDasharray="4 3"
      style={{ pointerEvents: "none" }}
    />
  );
}

function marqueeWorldRect(state: MarqueeState, v: Viewport): Rect {
  const a = screenToWorld(v, state.origin);
  const b = screenToWorld(v, state.current);
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x),
    h: Math.abs(b.y - a.y),
  };
}

function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function unionOf(rects: Rect[]): Rect {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}


function unionRect(a: Rect | undefined, b: Rect | null): Rect | undefined {
  if (!a) return b ?? undefined;
  if (!b) return a;

  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}


function annotationMenu({
  id,
  mark,
  selection,
  node,
  edit,
  update,
  remove,
}: {
  id: string;
  mark: Annotation;
  selection: ReadonlySet<string>;

  node: string | null;
  edit(): void;
  update(id: string, patch: Partial<Annotation>): void;
  remove(ids: string[]): void;
}): MenuItem[] {
  const acting = selection.has(id) ? [...selection] : [id];

  const items: MenuItem[] = [];

  if (mark.kind === "note") {
    items.push({ id: "edit", label: "Edit the text", onSelect: edit });
  }

  if (mark.anchor) {
    items.push({
      id: "detach",
      label: `Stop pointing at ${mark.anchor}`,
      onSelect: () => update(id, { anchor: null }),
    });
  } else if (node) {
    items.push({
      id: "attach",
      label: `Point at ${node}`,
      onSelect: () => update(id, { anchor: node }),
    });
  }

  if (items.length > 0) items.push({ id: "sep", label: "", separator: true });

  items.push({
    id: "delete",
    label: acting.length > 1 ? `Delete ${acting.length} marks` : "Delete",
    shortcut: "Del",
    danger: true,
    onSelect: () => remove(acting),
  });

  return items;
}


function anchored(
  mark: Annotation | null,
  drawing: AnnoDraw,
  scene: GraphScene | null,
): Annotation | null {
  if (!mark || mark.kind !== "note" || !drawing.over || !scene) return mark;

  const node = scene.nodes.find((n) => n.id === drawing.over);
  if (!node) return mark;

  const dragged = Math.hypot(drawing.to.x - drawing.from.x, drawing.to.y - drawing.from.y) >= 6;
  if (dragged) return { ...mark, anchor: node.id };

  const [w, h] = mark.size ?? [190, 68];
  return {
    ...mark,
    anchor: node.id,
    at: [
      Math.round(node.rect.x + node.rect.w + 36),
      Math.round(node.rect.y + node.rect.h / 2 - h / 2),
    ],
    size: [w, h],
  };
}


function NoteEditor({
  mark,
  viewport,
  theme,
  onCommit,
  onCancel,
}: {
  mark: Annotation;
  viewport: Viewport;
  theme: DiagramTheme;
  onCommit(text: string): void;
  onCancel(): void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [text, setText] = useState(mark.text ?? "");

  useEffect(() => {
    const field = ref.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  const at = worldToScreen(viewport, { x: mark.at[0], y: mark.at[1] });
  const [w, h] = mark.size ?? [190, 68];

  return (
    <textarea
      ref={ref}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {


        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          onCommit(text);
        }
      }}
      placeholder="What is worth saying here?"
      className="absolute resize-none outline-none"
      style={{
        left: at.x,
        top: at.y,
        width: w * viewport.zoom,
        height: h * viewport.zoom,
        padding: 10 * viewport.zoom,

        fontSize: theme.fontSize * viewport.zoom,
        lineHeight: 1.35,
        fontFamily: theme.fontFamily,
        color: theme.nodeText,
        background: theme.background,
        border: `${Math.max(1.5 * viewport.zoom, 1)}px solid var(--accent)`,
        borderRadius: theme.cornerRadius * viewport.zoom,
      }}
    />
  );
}


function menuItems({
  target,
  selection,
  pinned,
  scene,
  releasePins,
  pinAt,
  select,
  fit,
  edgeId,
  hasWaypoints,
  clearWaypoints,
}: {
  target: string | null;
  selection: ReadonlySet<string>;
  pinned: ReadonlySet<string>;
  scene: GraphScene | null;
  releasePins(ids: string[]): void;
  pinAt(positions: ReadonlyMap<string, Point>, snap?: number): void;
  select(ids: string[], additive: boolean): void;
  fit(): void;
  edgeId: string | null;
  hasWaypoints: boolean;
  clearWaypoints(): void;
}): MenuItem[] {

  if (!target && edgeId) {
    return [
      {
        id: "clear-route",
        label: "Clear manual routing",
        disabled: !hasWaypoints,
        danger: true,
        onSelect: clearWaypoints,
      },
      { id: "sep", label: "", separator: true },
      {
        id: "select-ends",
        label: "Select both ends",
        disabled: !scene,
        onSelect: () => {
          const edge = scene?.edges.find((candidate) => candidate.id === edgeId);
          if (edge) select([edge.from, edge.to], false);
        },
      },
    ];
  }


  const acting = target && selection.has(target) ? [...selection] : target ? [target] : [];
  const actingPinned = acting.filter((id) => pinned.has(id));

  if (acting.length === 0) {
    return [
      { id: "fit", label: "Fit to view", shortcut: "Ctrl+Shift+F", onSelect: fit },
      { id: "sep", label: "", separator: true },
      {
        id: "select-all",
        label: "Select all nodes",
        onSelect: () => scene && select(scene.nodes.map((n) => n.id), false),
      },
      {
        id: "release-all",
        label: `Release all pins${pinned.size ? ` (${pinned.size})` : ""}`,
        disabled: pinned.size === 0,
        danger: true,
        onSelect: () => releasePins([...pinned]),
      },
    ];
  }

  return [
    {
      id: "release",
      label: acting.length > 1 ? `Release ${actingPinned.length} pins` : "Release pin",
      shortcut: "P",
      disabled: actingPinned.length === 0,
      onSelect: () => releasePins(actingPinned),
    },
    {
      id: "separate",
      label: "Separate from neighbours",
      disabled: !scene,
      onSelect: () => scene && pinAt(separateNodes(scene, acting), 0),
    },
    { id: "sep", label: "", separator: true },
    {
      id: "select-connected",
      label: "Select connected nodes",
      disabled: !scene,
      onSelect: () => {
        if (!scene) return;
        const ids = new Set(acting);
        for (const edge of scene.edges) {
          if (ids.has(edge.from)) ids.add(edge.to);
          else if (ids.has(edge.to)) ids.add(edge.from);
        }
        select([...ids], false);
      },
    },
  ];
}
