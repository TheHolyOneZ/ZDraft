import { memo } from "react";

import { edgePathD, headArrow, pointAlong, tailArrow } from "../../core/render/edges";
import { nodeTextColors, renderCluster, renderNode } from "../../core/render/node";
import { shapeGeometry } from "../../core/render/shapes";
import { measureText, type TextLine } from "../../core/render/text";
import type { Rect } from "../../core/model/geometry";
import type { GraphEdge, GraphNode, GraphScene } from "../../core/model/scene";
import type { SceneDiff } from "../../core/diff";
import type { DiagramTheme } from "../../core/theme";


const ARROW_SIZE = 11;


const GHOST_GRAB = 14;

function Lines({ lines, color, muted, family }: {
  lines: TextLine[];
  color: string;
  muted: string;
  family: string;
}) {
  return (
    <>
      {lines.map((line, i) => (
        <text
          key={i}
          x={line.x}
          y={line.y}
          textAnchor={line.anchor}
          fontFamily={family}
          fontSize={line.size}
          fontWeight={line.weight}
          fontStyle={line.italic ? "italic" : undefined}
          fill={line.muted ? muted : color}


          style={{ pointerEvents: "none", whiteSpace: "pre" }}
        >
          {line.text}
        </text>
      ))}
    </>
  );
}

export const ClusterLayer = memo(function ClusterLayer({
  scene,
  theme,
  selection,
  draggingIds,
}: {
  scene: GraphScene;
  theme: DiagramTheme;
  selection?: ReadonlySet<string>;
  draggingIds?: ReadonlySet<string>;
}) {
  return (
    <g data-layer="clusters">
      {scene.clusters.map((cluster) => {
        const r = renderCluster(cluster, theme);
        const active = selection?.has(cluster.id) || draggingIds?.has(cluster.id);

        return (
          <g
            key={cluster.id}


            className="node-hit"
            data-cluster={cluster.id}
            data-dragging={draggingIds?.has(cluster.id) ? "true" : undefined}
            transform={`translate(${cluster.rect.x},${cluster.rect.y})`}
          >
            <path
              d={r.path}
              fill={r.fill}
              stroke={active ? theme.accent : r.stroke}
              strokeWidth={theme.strokeWidth * (active ? 1.8 : 1)}
              strokeDasharray="6 4"
            />
            {r.label && (
              <Lines
                lines={[r.label]}
                color={theme.clusterText}
                muted={theme.clusterText}
                family={theme.fontFamily}
              />
            )}
          </g>
        );
      })}
    </g>
  );
});

export const EdgeShape = memo(function EdgeShape({
  edge,
  theme,
  dimmed,
  highlighted,
  draggingLabel,
}: {
  edge: GraphEdge;
  theme: DiagramTheme;
  dimmed?: boolean;
  highlighted?: boolean;
  draggingLabel?: boolean;
}) {
  const stroke = highlighted ? theme.accent : (edge.style?.stroke ?? theme.edge);
  const width = (edge.style?.strokeWidth ?? theme.strokeWidth) * (highlighted ? 1.6 : 1);

  const head = headArrow(edge.route, edge.arrowEnd, edge.endArrow, ARROW_SIZE);
  const tail = tailArrow(edge.route, edge.arrowStart, edge.startArrow, ARROW_SIZE);
  const d = edgePathD(edge.route);

  return (
    <g opacity={dimmed ? 0.38 : 1} data-edge={edge.id}>


      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        strokeLinecap="round"
        className="edge-hit"
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeDasharray={edge.style?.dashed ? "7 5" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {head && (
        <path
          d={head.path}
          fill={head.filled ? stroke : theme.background}
          stroke={stroke}
          strokeWidth={width}
          strokeLinejoin="round"
        />
      )}
      {tail && (
        <path
          d={tail.path}
          fill={tail.filled ? stroke : theme.background}
          stroke={stroke}
          strokeWidth={width}
          strokeLinejoin="round"
        />
      )}
      {edge.label && (
        <EdgeLabel
          edge={edge}
          theme={theme}
          color={highlighted ? theme.accent : theme.edgeText}
          dragging={draggingLabel}
        />
      )}
    </g>
  );
});

function EdgeLabel({
  edge,
  theme,
  color,
  dragging,
}: {
  edge: GraphEdge;
  theme: DiagramTheme;
  color: string;
  dragging?: boolean;
}) {
  const label = edge.label!;
  const x = label.at.x + (label.offset?.x ?? 0);
  const y = label.at.y + (label.offset?.y ?? 0);
  const size = theme.fontSize - 1;


  const width = measureText(label.text, size, 500) + 5;
  const height = size + 4;

  return (
    <>
    <rect
      x={x - width / 2}
      y={y - height / 2}
      width={width}
      height={height}
      rx={3}
      fill={theme.edgeTextHalo}
      style={{ pointerEvents: "none" }}
    />
    <text
      x={x}
      y={y + size * 0.34}
      textAnchor="middle"
      fontFamily={theme.fontFamily}
      fontSize={size}
      fontWeight={500}
      fill={color}
      stroke={theme.edgeTextHalo}


      strokeWidth={2}
      paintOrder="stroke"
      strokeLinejoin="round"


      className="node-hit"
      data-edge-label={edge.id}
      data-dragging={dragging ? "true" : undefined}
    >
      {label.text}
    </text>
    </>
  );
}

export const EdgeLayer = memo(function EdgeLayer({
  scene,
  theme,
  highlighted,
  dimmed,
  draggingLabel,
}: {
  scene: GraphScene;
  theme: DiagramTheme;
  highlighted?: ReadonlySet<string>;
  dimmed?: boolean;

  draggingLabel?: string | null;
}) {
  return (
    <g data-layer="edges">
      {scene.edges.map((edge) => (
        <EdgeShape
          key={edge.id}
          edge={edge}
          theme={theme}
          highlighted={highlighted?.has(edge.id)}
          dimmed={dimmed && !highlighted?.has(edge.id)}
          draggingLabel={draggingLabel === edge.id}
        />
      ))}
    </g>
  );
});

export const NodeShapeView = memo(function NodeShapeView({
  node,
  theme,
  pinned,
  selected,
  hovered,
  dragging,
}: {
  node: GraphNode;
  theme: DiagramTheme;
  pinned?: boolean;
  selected?: boolean;
  hovered?: boolean;
  dragging?: boolean;
}) {
  const r = renderNode(node, theme);
  const colors = nodeTextColors(node, theme);
  const stroke = selected ? theme.accent : r.stroke;

  return (
    <g
      className="node-hit"
      data-node={node.id}
      data-dragging={dragging ? "true" : undefined}
      transform={`translate(${node.rect.x},${node.rect.y})`}
    >
      <path
        d={r.geometry.path}
        fill={r.fill}
        stroke={stroke}
        strokeWidth={r.strokeWidth * (selected ? 2 : hovered ? 1.5 : 1)}
        strokeDasharray={r.dashed ? "6 4" : undefined}
        strokeLinejoin="round"
      />
      {r.geometry.details.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={r.strokeWidth}
          style={{ pointerEvents: "none" }}
        />
      ))}
      {r.dividers.map((d, i) => (
        <path
          key={`div-${i}`}
          d={d}
          stroke={theme.nodeDivider}
          strokeWidth={1}
          style={{ pointerEvents: "none" }}
        />
      ))}
      <Lines
        lines={r.lines}
        color={colors.text}
        muted={colors.muted}
        family={theme.fontFamily}
      />
      {pinned && <PinBadge node={node} />}
    </g>
  );
});


function PinBadge({ node }: { node: GraphNode }) {
  const { w } = node.rect;

  return (
    <g data-chrome="pin" style={{ pointerEvents: "none" }}>
      <path
        d={`M-3,-3 H${w + 3} V${node.rect.h + 3} H-3 Z`}
        fill="none"
        stroke="var(--pin)"
        strokeWidth={1.5}
        strokeDasharray="4 3"
        opacity={0.9}
        rx={4}
      />
      <circle cx={w} cy={0} r={5.5} fill="var(--pin)" />
      <circle cx={w} cy={0} r={2} fill="var(--canvas-bg)" />
    </g>
  );
}

export const NodeLayer = memo(function NodeLayer({
  scene,
  theme,
  pins,
  selection,
  hovered,
  draggingIds,
}: {
  scene: GraphScene;
  theme: DiagramTheme;
  pins?: ReadonlySet<string>;
  selection?: ReadonlySet<string>;
  hovered?: string | null;
  draggingIds?: ReadonlySet<string>;
}) {
  return (
    <g data-layer="nodes">
      {scene.nodes.map((node) => (
        <NodeShapeView
          key={node.id}
          node={node}
          theme={theme}
          pinned={pins?.has(node.id)}
          selected={selection?.has(node.id)}
          hovered={hovered === node.id}
          dragging={draggingIds?.has(node.id)}
        />
      ))}
    </g>
  );
});


export const GhostLayer = memo(function GhostLayer({
  ghosts,
  scene,
  theme,
}: {
  ghosts: ReadonlyMap<string, Rect>;
  scene: GraphScene;
  theme: DiagramTheme;
}) {
  if (ghosts.size === 0) return null;

  return (
    <g data-chrome="ghosts" style={{ pointerEvents: "none" }}>
      {[...ghosts].map(([id, auto]) => {
        const node = scene.nodes.find((n) => n.id === id);
        const now = node?.rect;
        const from = { x: auto.x + auto.w / 2, y: auto.y + auto.h / 2 };
        const to = now ? { x: now.x + now.w / 2, y: now.y + now.h / 2 } : null;
        const outline = shapeGeometry(
          node?.shape ?? "rect",
          { x: 0, y: 0, w: auto.w, h: auto.h },
          theme.cornerRadius,
        ).path;

        return (
          <g key={id}>
            {to && (
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="var(--pin)"
                strokeWidth={1}
                strokeDasharray="2 5"
                opacity={0.5}
              />
            )}
            <g transform={`translate(${auto.x},${auto.y})`}>
              <path
                d={outline}
                fill="none"
                stroke="var(--pin)"
                strokeWidth={1.25}
                strokeDasharray="5 4"
                opacity={0.45}
                style={{ pointerEvents: "none" }}
              />


              <path
                d={outline}
                fill="none"
                stroke="transparent"
                strokeWidth={GHOST_GRAB}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                data-ghost={id}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
});


export const SelectionLayer = memo(function SelectionLayer({
  scene,
  selection,
}: {
  scene: GraphScene;
  selection: ReadonlySet<string>;
}) {
  if (selection.size === 0) return null;

  const selected = scene.nodes.filter((n) => selection.has(n.id));

  return (
    <g data-chrome="selection" style={{ pointerEvents: "none" }}>
      {selected.map((node) => {
        const { x, y, w, h } = node.rect;
        const pad = 3;
        return (
          <g key={node.id}>
            <rect
              x={x - pad}
              y={y - pad}
              width={w + pad * 2}
              height={h + pad * 2}
              rx={6}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={2}
              opacity={0.9}
            />
            {[
              [x - pad, y - pad],
              [x + w + pad, y - pad],
              [x - pad, y + h + pad],
              [x + w + pad, y + h + pad],
            ].map(([hx, hy], i) => (
              <rect
                key={i}
                x={hx! - 2.5}
                y={hy! - 2.5}
                width={5}
                height={5}
                fill="var(--accent)"
                stroke="var(--canvas-bg)"
                strokeWidth={1}
              />
            ))}
          </g>
        );
      })}


      {selected.length > 1 && <SelectionBounds rects={selected.map((n) => n.rect)} />}
    </g>
  );
});

function SelectionBounds({ rects }: { rects: Rect[] }) {
  const minX = Math.min(...rects.map((r) => r.x));
  const minY = Math.min(...rects.map((r) => r.y));
  const maxX = Math.max(...rects.map((r) => r.x + r.w));
  const maxY = Math.max(...rects.map((r) => r.y + r.h));
  const pad = 10;

  return (
    <rect
      x={minX - pad}
      y={minY - pad}
      width={maxX - minX + pad * 2}
      height={maxY - minY + pad * 2}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1}
      strokeDasharray="5 4"
      opacity={0.55}
    />
  );
}


export const WaypointLayer = memo(function WaypointLayer({
  edge,
  waypoints,
  active,
}: {
  edge: GraphEdge;

  waypoints: readonly { x: number; y: number }[];

  active?: number | null;
}) {
  const points = edge.route.points;
  if (points.length < 2) return null;

  const candidates: Array<{ x: number; y: number; after: number }> = [];

  if (waypoints.length === 0) {


    candidates.push({ ...pointAlong(edge.route, 0.5), after: 0 });
  } else {


    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1]!;
      const b = points[i]!;
      if (Math.hypot(b.x - a.x, b.y - a.y) < 28) continue;
      candidates.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, after: i - 1 });
    }
  }

  return (
    <g data-chrome="waypoints">
      {candidates.map((c, i) => (
        <circle
          key={`add-${i}`}
          cx={c.x}
          cy={c.y}
          r={4}
          fill="var(--canvas-bg)"
          stroke="var(--accent)"
          strokeWidth={1.5}
          opacity={0.7}
          style={{ cursor: "copy" }}
          data-waypoint-add={c.after}
        />
      ))}

      {waypoints.map((w, i) => (
        <circle
          key={`wp-${i}`}
          cx={w.x}
          cy={w.y}
          r={active === i ? 6 : 5}
          fill="var(--accent)"
          stroke="var(--canvas-bg)"
          strokeWidth={1.5}
          style={{ cursor: "grab" }}
          data-waypoint={i}
        />
      ))}
    </g>
  );
});


export const EdgeSelection = memo(function EdgeSelection({ edge }: { edge: GraphEdge }) {
  return (
    <path
      d={edgePathD(edge.route)}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={9}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={0.22}
      style={{ pointerEvents: "none" }}
    />
  );
});


export const DiffLayer = memo(function DiffLayer({
  diff,
  theme,
}: {
  diff: SceneDiff;
  theme: DiagramTheme;
}) {
  if (diff.identical) return null;

  return (
    <g data-chrome="diff" style={{ pointerEvents: "none" }}>
      {diff.edges.map((edge) => (
        <path
          key={`e:${edge.id}`}
          d={edgePathD({ kind: "poly", points: edge.points })}
          fill="none"
          stroke={edge.change === "added" ? DIFF_ADDED : DIFF_REMOVED}
          strokeWidth={theme.strokeWidth * 3}
          strokeLinecap="round"
          opacity={edge.change === "added" ? 0.45 : 0.35}
          strokeDasharray={edge.change === "removed" ? "7 5" : undefined}
        />
      ))}

      {diff.nodes.map((node) => {
        const box = node.rect ?? node.was;
        if (!box) return null;

        const colour =
          node.change === "added"
            ? DIFF_ADDED
            : node.change === "removed"
              ? DIFF_REMOVED
              : node.change === "moved"
                ? DIFF_MOVED
                : DIFF_CHANGED;

        const outline = shapeGeometry(
          "rect",
          { x: -4, y: -4, w: box.w + 8, h: box.h + 8 },
          theme.cornerRadius + 3,
        ).path;

        return (
          <g key={`n:${node.id}`}>


            {node.change === "moved" && node.was && node.rect && (
              <>
                <line
                  x1={node.was.x + node.was.w / 2}
                  y1={node.was.y + node.was.h / 2}
                  x2={node.rect.x + node.rect.w / 2}
                  y2={node.rect.y + node.rect.h / 2}
                  stroke={DIFF_MOVED}
                  strokeWidth={theme.strokeWidth}
                  strokeDasharray="4 4"
                  opacity={0.6}
                />
                <g transform={`translate(${node.was.x},${node.was.y})`}>
                  <path
                    d={shapeGeometry("rect", { x: 0, y: 0, w: node.was.w, h: node.was.h }, theme.cornerRadius).path}
                    fill="none"
                    stroke={DIFF_MOVED}
                    strokeWidth={theme.strokeWidth}
                    strokeDasharray="4 4"
                    opacity={0.55}
                  />
                </g>
              </>
            )}

            <g transform={`translate(${box.x},${box.y})`}>
              <path
                d={outline}
                fill={node.change === "removed" ? "none" : colour}
                fillOpacity={0.12}
                stroke={colour}
                strokeWidth={2}
                strokeDasharray={node.change === "removed" ? "6 4" : undefined}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
});


const DIFF_ADDED = "#4ade80";
const DIFF_REMOVED = "#f87171";
const DIFF_CHANGED = "#c084fc";


export const DIFF_MOVED = "#fbbf24";
