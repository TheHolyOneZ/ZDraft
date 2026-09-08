import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { annotationBounds } from "../core/annotate";
import { annotationsBounds } from "../core/render/annotations";
import { revealSteps, sceneAtStep } from "../core/present";
import type { Rect } from "../core/model/geometry";
import { isGraph, isPassthrough, isSequence, type Scene } from "../core/model/scene";
import type { Annotation } from "../core/sidecar/types";
import type { DiagramTheme } from "../core/theme";
import { appWindow } from "../lib/tauri";
import { useDocumentStore } from "../store/useDocumentStore";
import { AnnotationLayer } from "./scene/AnnotationLayer";
import { ClusterLayer, EdgeLayer, NodeLayer } from "./scene/GraphLayers";
import {
  ActivationLayer,
  FragmentLayer,
  LifelineLayer,
  MessageLayer,
  NoteLayer,
} from "./scene/SequenceLayers";
import { usePrefersReducedMotion } from "./ui";


export function Presentation({
  open,
  onClose,
  theme,
}: {
  open: boolean;
  onClose(): void;
  theme: DiagramTheme;
}) {
  const scene = useDocumentStore((s) => s.scene);
  const name = useDocumentStore((s) => s.name);
  const blocks = useDocumentStore((s) => s.blocks);
  const activeBlock = useDocumentStore((s) => s.activeBlock);
  const selectBlock = useDocumentStore((s) => s.selectBlock);
  const annotations = useDocumentStore((s) => s.layout.annotations);
  const reduced = usePrefersReducedMotion();

  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [chrome, setChrome] = useState(true);

  const steps = useMemo(() => revealSteps(scene), [scene]);


  const covers = useMemo(() => coverage(annotations, scene), [annotations, scene]);
  const last = Math.max(steps.length - 1, 0);


  const at = blocks.findIndex((b) => b.id === activeBlock);
  const deck = blocks.length > 1 && at >= 0;


  const landing = useRef<"start" | "end" | null>(null);

  const next = useCallback(() => {
    if (index < last) return setIndex((i) => i + 1);
    if (deck && at < blocks.length - 1) {
      landing.current = "start";
      selectBlock(blocks[at + 1]!.id);
    }
  }, [index, last, deck, at, blocks, selectBlock]);

  const back = useCallback(() => {
    if (index > 0) return setIndex((i) => i - 1);
    if (deck && at > 0) {


      landing.current = "end";
      selectBlock(blocks[at - 1]!.id);
    }
  }, [index, deck, at, blocks, selectBlock]);

  useEffect(() => {
    if (!landing.current) return;
    setIndex(landing.current === "end" ? Math.max(steps.length - 1, 0) : 0);
    landing.current = null;
  }, [steps]);


  const settled = useRef(0);
  const shownAt = Math.min(settled.current, index);

  useEffect(() => {
    settled.current = index;
  }, [index]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const exit = useCallback(() => {


    setFullscreen((on) => {
      if (on) void appWindow()?.setFullscreen(false);
      return false;
    });
    onClose();
  }, [onClose]);

  const toggleFullscreen = useCallback(() => {
    setFullscreen((on) => {
      void appWindow()?.setFullscreen(!on);
      return !on;
    });
  }, []);


  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      const key = e.key;
      const forward = key === "ArrowRight" || key === " " || key === "PageDown" || key === "Enter";
      const backward = key === "ArrowLeft" || key === "PageUp" || key === "Backspace";

      if (forward) next();
      else if (backward) back();
      else if (key === "Home") setIndex(0);
      else if (key === "End") setIndex(last);
      else if (key === "Escape") exit();
      else if (key.toLowerCase() === "f") toggleFullscreen();
      else return;

      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, last, exit, toggleFullscreen, next, back]);


  useEffect(() => {
    if (!open) return;
    let timer = 0;

    const wake = () => {
      setChrome(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setChrome(false), 2600);
    };

    wake();
    window.addEventListener("pointermove", wake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", wake);
    };
  }, [open]);

  if (!open || !scene) return null;


  const box = withMarks(scene.bounds, annotationsBounds(annotations));
  const pad = Math.max(40, Math.max(box.w, box.h) * 0.06);
  const viewBox = `${box.x - pad} ${box.y - pad} ${box.w + pad * 2} ${box.h + pad * 2}`;

  return createPortal(
    <div
      className="fixed inset-0 z-[500] flex flex-col"
      style={{ background: theme.background, cursor: chrome ? "default" : "none" }}
      onClick={(e) => (e.shiftKey ? back() : next())}
      onContextMenu={(e) => {


        e.preventDefault();
        back();
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", flex: 1, minHeight: 0 }}
      >
        <Stage
          scene={sceneAtStep(scene, steps, shownAt)}
          theme={theme}
          annotations={annotations}
          covers={covers}
        />
        <motion.g
          key={index}
          initial={reduced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <Stage
            scene={sceneAtStep(scene, steps, index)}
            theme={theme}
            annotations={annotations}
            covers={covers}
          />
        </motion.g>
      </svg>

      <AnimatePresence>
        {chrome && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: reduced ? 0.1 : 0.18 }}
            className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4"
          >
            <div
              className="pointer-events-auto flex max-w-[min(720px,90vw)] items-center gap-3 rounded-xl px-3 py-2"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Step
                icon={<ChevronLeft size={16} strokeWidth={2} />}
                label="Previous"
                disabled={index === 0 && !(deck && at > 0)}
                onClick={back}
              />

              <div className="flex min-w-0 flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="tnum shrink-0 text-[11px]" style={{ color: "var(--text-3)" }}>
                    {steps.length === 0 ? "1 / 1" : `${index + 1} / ${steps.length}`}
                  </span>
                  <span className="truncate text-[13px]" style={{ color: "var(--text)" }}>
                    {steps[index]?.title ?? name}
                  </span>
                  {deck && (
                    <span
                      className="shrink-0 truncate text-[11px]"
                      style={{ color: "var(--text-3)" }}
                    >
                      {activeBlock} · {at + 1} of {blocks.length}
                    </span>
                  )}
                </div>
                <Progress index={index} count={Math.max(steps.length, 1)} />
              </div>

              <Step
                icon={<ChevronRight size={16} strokeWidth={2} />}
                label="Next"
                disabled={index >= last && !(deck && at < blocks.length - 1)}
                onClick={next}
              />

              <div className="mx-0.5 h-5 w-px shrink-0" style={{ background: "var(--border)" }} />

              <Step
                icon={
                  fullscreen ? (
                    <Minimize2 size={15} strokeWidth={1.75} />
                  ) : (
                    <Maximize2 size={15} strokeWidth={1.75} />
                  )
                }
                label={fullscreen ? "Leave fullscreen — F" : "Fullscreen — F"}
                onClick={toggleFullscreen}
              />
              <Step
                icon={<X size={15} strokeWidth={1.75} />}
                label="Stop presenting — Esc"
                onClick={exit}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}


function withMarks(scene: Rect, marks: Rect | null): Rect {
  if (!marks) return scene;

  const x = Math.min(scene.x, marks.x);
  const y = Math.min(scene.y, marks.y);
  return {
    x,
    y,
    w: Math.max(scene.x + scene.w, marks.x + marks.w) - x,
    h: Math.max(scene.y + scene.h, marks.y + marks.h) - y,
  };
}


function coverage(
  annotations: Readonly<Record<string, Annotation>> | undefined,
  scene: Scene | null,
): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  if (!annotations || !scene || !isGraph(scene)) return out;

  for (const [id, mark] of Object.entries(annotations)) {
    const box = annotationBounds(mark);
    const over = new Set<string>();

    for (const node of scene.nodes) {
      if (
        box.x < node.rect.x + node.rect.w &&
        box.x + box.w > node.rect.x &&
        box.y < node.rect.y + node.rect.h &&
        box.y + box.h > node.rect.y
      ) {
        over.add(node.id);
      }
    }

    out.set(id, over);
  }

  return out;
}

function Stage({
  scene,
  theme,
  annotations,
  covers,
}: {
  scene: Scene;
  theme: DiagramTheme;
  annotations?: Readonly<Record<string, Annotation>>;
  covers: Map<string, Set<string>>;
}) {


  const shown = useMemo(() => {
    if (!annotations) return undefined;
    const here = new Set(isGraph(scene) ? scene.nodes.map((node) => node.id) : []);

    return Object.fromEntries(
      Object.entries(annotations).filter(([id, mark]) => {
        if (mark.anchor) return here.has(mark.anchor);

        const over = covers.get(id);
        if (!over || over.size === 0) return true;
        return [...over].some((node) => here.has(node));
      }),
    );
  }, [annotations, scene, covers]);

  if (isPassthrough(scene)) {
    return <g dangerouslySetInnerHTML={{ __html: scene.svg }} />;
  }

  if (isSequence(scene)) {
    return (
      <>
        <FragmentLayer scene={scene} theme={theme} />
        <LifelineLayer scene={scene} theme={theme} />
        <ActivationLayer scene={scene} theme={theme} />
        <NoteLayer scene={scene} theme={theme} />
        <MessageLayer scene={scene} theme={theme} selected={null} />
        <AnnotationLayer annotations={shown} scene={scene} theme={theme} />
      </>
    );
  }

  if (!isGraph(scene)) return null;

  return (
    <>
      <ClusterLayer scene={scene} theme={theme} />
      <EdgeLayer scene={scene} theme={theme} />
      <NodeLayer scene={scene} theme={theme} />
      <AnnotationLayer annotations={shown} scene={scene} theme={theme} />
    </>
  );
}


function Progress({ index, count }: { index: number; count: number }) {
  return (
    <div className="h-[3px] w-[280px] max-w-full overflow-hidden rounded-full" style={{ background: "var(--control)" }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: "var(--accent)" }}
        animate={{ width: `${((index + 1) / count) * 100}%` }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </div>
  );
}

function Step({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick(): void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`focus-ring inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
        disabled ? "cursor-not-allowed opacity-30" : "cursor-pointer"
      }`}
      style={{ background: "var(--control)", color: "var(--text-2)" }}
    >
      {icon}
    </button>
  );
}
