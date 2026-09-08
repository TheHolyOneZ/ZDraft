import { memo } from "react";

import { HIGHLIGHT_GRAB } from "../../core/annotate";
import {
  ANNOTATION_STROKE,
  HIGHLIGHT_OPACITY,
  renderAnnotations,
  type AnnotationRender,
} from "../../core/render/annotations";
import type { Annotation } from "../../core/sidecar/types";
import type { Scene } from "../../core/model/scene";
import type { DiagramTheme } from "../../core/theme";


export const AnnotationLayer = memo(function AnnotationLayer({
  annotations,
  scene,
  theme,
  hidden,
}: {
  annotations: Readonly<Record<string, Annotation>> | undefined;
  scene: Scene | null;
  theme: DiagramTheme;

  hidden?: ReadonlySet<string>;
}) {
  const marks = renderAnnotations(annotations, scene, theme);
  if (marks.length === 0) return null;

  return (
    <g data-layer="annotations">
      {marks.map((mark) =>
        hidden?.has(mark.id) ? null : (
          <AnnotationShape key={mark.id} mark={mark} theme={theme} />
        ),
      )}
    </g>
  );
});

export const AnnotationShape = memo(function AnnotationShape({
  mark,
  theme,
  preview,
}: {
  mark: AnnotationRender;
  theme: DiagramTheme;

  preview?: boolean;
}) {
  const { bounds, color } = mark;

  return (
    <g
      data-annotation={preview ? undefined : mark.id}
      opacity={preview ? 0.75 : 1}
      style={preview ? { pointerEvents: "none" } : undefined}
    >
      {mark.leader && (
        <line
          x1={mark.leader.from.x}
          y1={mark.leader.from.y}
          x2={mark.leader.to.x}
          y2={mark.leader.to.y}
          stroke={color}
          strokeWidth={ANNOTATION_STROKE * 0.6}
          strokeDasharray="5 4"
          opacity={0.7}
          style={{ pointerEvents: "none" }}
        />
      )}

      {mark.kind === "highlight" && mark.boxPath && (
        <g transform={`translate(${bounds.x},${bounds.y})`}>


          <path
            d={mark.boxPath}
            fill={color}
            fillOpacity={HIGHLIGHT_OPACITY}
            stroke="none"
            style={{ pointerEvents: "none" }}
          />
          <path
            d={mark.boxPath}
            fill="none"
            stroke={color}
            strokeWidth={ANNOTATION_STROKE * 0.6}
            opacity={0.5}
            style={{ pointerEvents: "none" }}
          />

          {!preview && (
            <path
              d={mark.boxPath}
              fill="none"
              stroke="transparent"
              strokeWidth={HIGHLIGHT_GRAB * 2}
            />
          )}
        </g>
      )}

      {mark.kind === "note" && mark.boxPath && (
        <g transform={`translate(${bounds.x},${bounds.y})`}>


          <path d={mark.boxPath} fill={theme.background} />
          <path d={mark.boxPath} fill={color} fillOpacity={0.14} />
          <path d={mark.boxPath} fill="none" stroke={color} strokeWidth={1.5} />
        </g>
      )}

      {mark.lines?.map((line, i) => (
        <text
          key={i}
          x={line.x}
          y={line.y}
          fontFamily={theme.fontFamily}
          fontSize={theme.fontSize}
          fill={theme.nodeText}
          xmlSpace="preserve"
          style={{ pointerEvents: "none" }}
        >
          {line.text}
        </text>
      ))}

      {mark.linePath && (
        <path
          d={mark.linePath}
          fill="none"
          stroke={color}
          strokeWidth={ANNOTATION_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {mark.headPath && <path d={mark.headPath} fill={color} />}
    </g>
  );
});


export const AnnotationSelection = memo(function AnnotationSelection({
  annotations,
  scene,
  theme,
  selection,
}: {
  annotations: Readonly<Record<string, Annotation>> | undefined;
  scene: Scene | null;
  theme: DiagramTheme;
  selection: ReadonlySet<string>;
}) {
  if (selection.size === 0) return null;

  const marks = renderAnnotations(annotations, scene, theme).filter((m) => selection.has(m.id));
  if (marks.length === 0) return null;

  return (
    <g data-chrome="annotation-selection" style={{ pointerEvents: "none" }}>
      {marks.map((mark) => (
        <rect
          key={mark.id}
          x={mark.bounds.x - 5}
          y={mark.bounds.y - 5}
          width={mark.bounds.w + 10}
          height={mark.bounds.h + 10}
          rx={6}
          fill="none"
          stroke={mark.color}
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
      ))}
    </g>
  );
});
