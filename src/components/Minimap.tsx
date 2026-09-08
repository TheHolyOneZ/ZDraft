import { useMemo } from "react";

import type { Rect } from "../core/model/geometry";
import type { GraphScene } from "../core/model/scene";
import type { DiagramTheme } from "../core/theme";
import { screenToWorld, type Viewport } from "../lib/viewport";


const SIZE = { w: 168, h: 116 };
const PAD = 6;

export function Minimap({
  scene,
  theme,
  viewport,
  width,
  height,
  pins,
  onJump,
}: {
  scene: GraphScene;
  theme: DiagramTheme;
  viewport: Viewport;
  width: number;
  height: number;
  pins: ReadonlySet<string>;
  onJump(world: { x: number; y: number }): void;
}) {
  const bounds = scene.bounds;

  const scale = useMemo(() => {
    if (bounds.w <= 0 || bounds.h <= 0) return 0;
    return Math.min((SIZE.w - PAD * 2) / bounds.w, (SIZE.h - PAD * 2) / bounds.h);
  }, [bounds]);


  const view = useMemo<Rect>(() => {
    const topLeft = screenToWorld(viewport, { x: 0, y: 0 });
    const bottomRight = screenToWorld(viewport, { x: width, y: height });
    return {
      x: topLeft.x,
      y: topLeft.y,
      w: bottomRight.x - topLeft.x,
      h: bottomRight.y - topLeft.y,
    };
  }, [viewport, width, height]);


  const covered = view.w >= bounds.w && view.h >= bounds.h;
  if (scale <= 0 || covered || scene.nodes.length < 8) return null;

  const offsetX = PAD + (SIZE.w - PAD * 2 - bounds.w * scale) / 2;
  const offsetY = PAD + (SIZE.h - PAD * 2 - bounds.h * scale) / 2;
  const toMap = (r: Rect) => ({
    x: offsetX + (r.x - bounds.x) * scale,
    y: offsetY + (r.y - bounds.y) * scale,
    w: Math.max(r.w * scale, 1.5),
    h: Math.max(r.h * scale, 1.5),
  });

  const jump = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    onJump({
      x: bounds.x + (e.clientX - box.left - offsetX) / scale,
      y: bounds.y + (e.clientY - box.top - offsetY) / scale,
    });
  };

  const viewBox = toMap(view);

  return (
    <svg
      width={SIZE.w}
      height={SIZE.h}
      className="absolute right-3 bottom-14 cursor-pointer rounded-lg"
      data-canvas-ui
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-2)",
        opacity: 0.85,
      }}
      onPointerDown={jump}
      onPointerMove={(e) => e.buttons === 1 && jump(e)}
      aria-label="Diagram overview"
    >
      {scene.clusters.map((c) => {
        const r = toMap(c.rect);
        return (
          <rect
            key={c.id}
            {...r}
            rx={2}
            fill="none"
            stroke={theme.clusterStroke}
            strokeWidth={0.75}
            strokeDasharray="2 2"
          />
        );
      })}

      {scene.nodes.map((node) => {
        const r = toMap(node.rect);
        return (
          <rect
            key={node.id}
            {...r}
            rx={1.5}


            fill={pins.has(node.id) ? "var(--pin)" : theme.nodeStroke}
            opacity={pins.has(node.id) ? 0.95 : 0.6}
          />
        );
      })}

      <rect
        x={viewBox.x}
        y={viewBox.y}
        width={viewBox.w}
        height={viewBox.h}
        fill="var(--accent-soft)"
        stroke="var(--accent)"
        strokeWidth={1}
        rx={2}
      />
    </svg>
  );
}
