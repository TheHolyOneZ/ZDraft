import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";


export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}


const layers: symbol[] = [];


export function useDismiss(
  open: boolean,
  onDismiss: () => void,
  refs: Array<RefObject<HTMLElement | null>>,
) {
  useEffect(() => {
    if (!open) return;

    const layer = Symbol("dismiss-layer");
    layers.push(layer);
    const isTop = () => layers[layers.length - 1] === layer;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target || !isTop()) return;
      if (refs.some((r) => r.current?.contains(target))) return;
      onDismiss();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !isTop()) return;


      e.stopPropagation();
      onDismiss();
    };


    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      const at = layers.lastIndexOf(layer);
      if (at >= 0) layers.splice(at, 1);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, onDismiss, refs]);
}


export function useReturnFocus(open: boolean) {
  const previous = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previous.current = document.activeElement as HTMLElement | null;
      return;
    }
    previous.current?.focus?.();
  }, [open]);
}

export interface FloatingPosition {
  top: number;
  left: number;

  flipped: boolean;
  minWidth: number;
}


export function useFloatingPosition(
  open: boolean,
  anchorRef: RefObject<HTMLElement | null>,
  panelRef: RefObject<HTMLElement | null>,
  gap = 6,
): FloatingPosition | null {
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const place = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;

      const panel = panelRef.current?.getBoundingClientRect();
      const height = panel?.height ?? 0;
      const width = panel?.width ?? anchor.width;

      const roomBelow = window.innerHeight - anchor.bottom - gap;
      const flipped = height > roomBelow && anchor.top > roomBelow;

      const top = flipped ? Math.max(8, anchor.top - height - gap) : anchor.bottom + gap;
      const left = Math.min(Math.max(8, anchor.left), Math.max(8, window.innerWidth - width - 8));

      setPosition({ top, left, flipped, minWidth: anchor.width });
    };

    place();

    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, panelRef, gap]);

  return position;
}


export function useTypeAhead(labels: string[], onMatch: (index: number) => void) {
  const buffer = useRef("");
  const timer = useRef<number | null>(null);

  return (key: string) => {
    if (key.length !== 1 || key === " ") return false;

    buffer.current += key.toLowerCase();
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      buffer.current = "";
    }, 600);

    const index = labels.findIndex((l) => l.toLowerCase().startsWith(buffer.current));
    if (index >= 0) {
      onMatch(index);
      return true;
    }
    return false;
  };
}
