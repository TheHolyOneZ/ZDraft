import { memo } from "react";

import { ACTIVATION_STEP, ACTIVATION_WIDTH } from "../../core/sequence/layout";
import { arrowGeometry } from "../../core/render/edges";
import { truncateToWidth } from "../../core/render/text";
import type { Lifeline, Message, SequenceScene } from "../../core/model/scene";
import type { DiagramTheme } from "../../core/theme";


const ARROW_SIZE = 10;
const SELF_LOOP_WIDTH = 44;


export const LifelineLayer = memo(function LifelineLayer({
  scene,
  theme,
  selection,
  dragging,
}: {
  scene: SequenceScene;
  theme: DiagramTheme;
  selection?: ReadonlySet<string>;
  dragging?: string | null;
}) {
  return (
    <g data-layer="lifelines">
      {scene.lifelines.map((line) => {
        const selected = selection?.has(line.id);
        const stroke = selected ? theme.accent : theme.nodeStroke;

        return (
          <g key={line.id} opacity={dragging && dragging !== line.id ? 0.55 : 1}>
            <line
              x1={line.x}
              y1={line.head.y + line.head.h}
              x2={line.x}
              y2={line.bottom}
              stroke={theme.edge}
              strokeWidth={theme.strokeWidth}
              strokeDasharray="6 5"
              opacity={0.7}
              style={{ pointerEvents: "none" }}
            />

            <HeadBox line={line} theme={theme} stroke={stroke} y={line.head.y} />


            <HeadBox line={line} theme={theme} stroke={stroke} y={line.bottom} foot />
          </g>
        );
      })}
    </g>
  );
});

function HeadBox({
  line,
  theme,
  stroke,
  y,
  foot,
}: {
  line: Lifeline;
  theme: DiagramTheme;
  stroke: string;
  y: number;
  foot?: boolean;
}) {
  const { x, w, h } = { x: line.head.x, w: line.head.w, h: line.head.h };
  const label = truncateToWidth(line.label, w - 16, theme.fontSize, 600);

  return (
    <g
      className="node-hit"
      data-lifeline={line.id}
      data-lifeline-foot={foot ? "true" : undefined}
      transform={`translate(${x},${y})`}
    >
      <rect
        width={w}
        height={h}
        rx={theme.cornerRadius}
        fill={theme.nodeFill}
        stroke={stroke}
        strokeWidth={theme.strokeWidth}
      />
      <text
        x={w / 2}
        y={h / 2 + theme.fontSize * 0.36}
        textAnchor="middle"
        fontFamily={theme.fontFamily}
        fontSize={theme.fontSize}
        fontWeight={600}
        fill={theme.nodeText}
        style={{ pointerEvents: "none" }}
      >
        {label}
      </text>
    </g>
  );
}


export const FragmentLayer = memo(function FragmentLayer({
  scene,
  theme,
}: {
  scene: SequenceScene;
  theme: DiagramTheme;
}) {
  return (
    <g data-layer="fragments" style={{ pointerEvents: "none" }}>
      {scene.fragments.map((fragment) => {
        const { x, y, w, h } = fragment.rect;
        const tagWidth = Math.max(46, fragment.kind.length * 8 + 20);

        return (
          <g key={fragment.id}>
            <rect
              x={x}
              y={y}
              width={w}
              height={h}
              fill={theme.clusterFill}
              stroke={theme.clusterStroke}
              strokeWidth={theme.strokeWidth}
              rx={4}
            />


            <path
              d={`M${x},${y} h${tagWidth} l-10,18 h${-tagWidth + 10} Z`}
              fill={theme.clusterStroke}
              opacity={0.35}
            />
            <text
              x={x + 8}
              y={y + 13}
              fontFamily={theme.fontFamily}
              fontSize={theme.fontSize - 2}
              fontWeight={600}
              fill={theme.clusterText}
            >
              {fragment.kind}
            </text>
            {fragment.label && (
              <text
                x={x + tagWidth + 8}
                y={y + 14}
                fontFamily={theme.fontFamily}
                fontSize={theme.fontSize - 2}
                fill={theme.nodeTextMuted}
              >
                [{fragment.label}]
              </text>
            )}

            {fragment.dividers.map((dy, i) => (
              <g key={i}>
                <line
                  x1={x}
                  y1={dy}
                  x2={x + w}
                  y2={dy}
                  stroke={theme.clusterStroke}
                  strokeWidth={1}
                  strokeDasharray="5 4"
                />
                <text
                  x={x + 10}
                  y={dy + 14}
                  fontFamily={theme.fontFamily}
                  fontSize={theme.fontSize - 2}
                  fill={theme.nodeTextMuted}
                >
                  [{fragment.sectionLabels[i] ?? ""}]
                </text>
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
});


export const ActivationLayer = memo(function ActivationLayer({
  scene,
  theme,
}: {
  scene: SequenceScene;
  theme: DiagramTheme;
}) {
  const xOf = new Map(scene.lifelines.map((l) => [l.id, l.x]));

  return (
    <g data-layer="activations" style={{ pointerEvents: "none" }}>
      {scene.activations.map((bar, i) => {
        const x = xOf.get(bar.lifeline);
        if (x === undefined) return null;

        return (
          <rect
            key={i}
            x={x - ACTIVATION_WIDTH / 2 + bar.depth * ACTIVATION_STEP}
            y={bar.top}
            width={ACTIVATION_WIDTH}
            height={Math.max(bar.bottom - bar.top, 4)}
            fill={theme.accent}
            stroke={theme.nodeStroke}
            strokeWidth={1}
            opacity={0.85}
            rx={1.5}
          />
        );
      })}
    </g>
  );
});

export const NoteLayer = memo(function NoteLayer({
  scene,
  theme,
}: {
  scene: SequenceScene;
  theme: DiagramTheme;
}) {
  return (
    <g data-layer="notes" style={{ pointerEvents: "none" }}>
      {scene.notes.map((note) => {
        const { x, y, w, h } = note.rect;
        const fold = 10;
        const lines = note.text.split("\n");

        return (
          <g key={note.id}>
            <path
              d={`M${x},${y} H${x + w - fold} L${x + w},${y + fold} V${y + h} H${x} Z`}
              fill={theme.clusterFill}
              stroke={theme.clusterStroke}
              strokeWidth={theme.strokeWidth}
            />
            <path
              d={`M${x + w - fold},${y} V${y + fold} H${x + w}`}
              fill="none"
              stroke={theme.clusterStroke}
              strokeWidth={1}
            />
            {lines.map((text, i) => (
              <text
                key={i}
                x={x + w / 2}
                y={y + 10 + (i + 0.8) * theme.fontSize * 1.4}
                textAnchor="middle"
                fontFamily={theme.fontFamily}
                fontSize={theme.fontSize - 1}
                fill={theme.nodeText}
              >
                {text}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
});

export const MessageLayer = memo(function MessageLayer({
  scene,
  theme,
  selected,
}: {
  scene: SequenceScene;
  theme: DiagramTheme;
  selected?: string | null;
}) {
  const xOf = new Map(scene.lifelines.map((l) => [l.id, l.x]));

  return (
    <g data-layer="messages">
      {scene.messages.map((message) => {
        const from = xOf.get(message.from);
        const to = xOf.get(message.to);
        if (from === undefined || to === undefined) return null;

        return (
          <MessageShape
            key={message.id}
            message={message}
            fromX={from}
            toX={to}
            theme={theme}
            highlighted={selected === message.id}
          />
        );
      })}
    </g>
  );
});

function MessageShape({
  message,
  fromX,
  toX,
  theme,
  highlighted,
}: {
  message: Message;
  fromX: number;
  toX: number;
  theme: DiagramTheme;
  highlighted?: boolean;
}) {
  const stroke = highlighted ? theme.accent : theme.edge;
  const width = theme.strokeWidth * (highlighted ? 1.7 : 1);
  const dashed = message.kind === "reply";

  const selfLoop = message.kind === "self";
  const d = selfLoop
    ?
      `M${fromX},${message.y} h${SELF_LOOP_WIDTH} v26 h${-SELF_LOOP_WIDTH}`
    : `M${fromX},${message.y} H${toX}`;

  const tip = selfLoop ? { x: fromX, y: message.y + 26 } : { x: toX, y: message.y };
  const anchor = selfLoop
    ? { x: fromX + SELF_LOOP_WIDTH, y: message.y + 26 }
    : { x: fromX, y: message.y };


  const kind = message.kind === "destroy" ? "cross" : message.kind === "async" ? "open" : "arrow";
  const head = arrowGeometry(kind, tip, anchor, ARROW_SIZE);

  const labelX = selfLoop ? fromX + SELF_LOOP_WIDTH + 8 : (fromX + toX) / 2;
  const labelAnchor = selfLoop ? "start" : "middle";

  return (
    <g data-message={message.id}>
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
        strokeDasharray={dashed ? "6 4" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {head && (
        <path
          d={head.path}
          fill={head.filled ? stroke : "none"}
          stroke={stroke}
          strokeWidth={width}
          strokeLinejoin="round"
        />
      )}
      {message.label && (
        <text
          x={labelX}
          y={message.y - 7}
          textAnchor={labelAnchor}
          fontFamily={theme.fontFamily}
          fontSize={theme.fontSize - 1}
          fontWeight={500}
          fill={highlighted ? theme.accent : theme.edgeText}
          stroke={theme.edgeTextHalo}
          strokeWidth={3.5}
          paintOrder="stroke"
          strokeLinejoin="round"
          style={{ pointerEvents: "none" }}
        >
          {message.label}
        </text>
      )}
    </g>
  );
}


export const ReorderIndicator = memo(function ReorderIndicator({
  scene,
  x,
}: {
  scene: SequenceScene;
  x: number | null;
}) {
  if (x === null) return null;

  return (
    <line
      x1={x}
      y1={scene.bounds.y}
      x2={x}
      y2={scene.bounds.y + scene.bounds.h}
      stroke="var(--pin)"
      strokeWidth={2}
      strokeDasharray="6 4"
      style={{ pointerEvents: "none" }}
    />
  );
});


export const GapHandleLayer = memo(function GapHandleLayer({
  scene,
  active,
}: {
  scene: SequenceScene;

  active?: string | null;
}) {
  if (scene.lifelines.length < 2) return null;

  const top = scene.lifelines[0]!.head.y;
  const height = scene.lifelines[0]!.head.h;

  return (
    <g data-chrome="gap-handles">
      {scene.lifelines.slice(1).map((line, i) => {
        const previous = scene.lifelines[i]!;
        const x = (previous.head.x + previous.head.w + line.head.x) / 2;
        const lit = active === line.id;

        return (
          <g key={line.id} data-gap={line.id} style={{ cursor: "col-resize" }}>


            <rect x={x - 8} y={top} width={16} height={height} fill="transparent" />
            <rect
              x={x - 1.5}
              y={top + 6}
              width={3}
              height={height - 12}
              rx={1.5}
              fill={lit ? "var(--pin)" : "var(--text-3)"}
              opacity={lit ? 1 : 0.35}
              style={{ pointerEvents: "none" }}
            />
          </g>
        );
      })}
    </g>
  );
});


export const GapGuide = memo(function GapGuide({
  scene,
  x,
  y,
}: {
  scene: SequenceScene;
  x?: number | null;
  y?: number | null;
}) {
  const b = scene.bounds;

  return (
    <g data-chrome="gap-guide" style={{ pointerEvents: "none" }}>
      {x != null && (
        <line x1={x} y1={b.y} x2={x} y2={b.y + b.h} stroke="var(--pin)" strokeWidth={2} strokeDasharray="6 4" />
      )}
      {y != null && (
        <line x1={b.x} y1={y} x2={b.x + b.w} y2={y} stroke="var(--pin)" strokeWidth={2} strokeDasharray="6 4" />
      )}
    </g>
  );
});
