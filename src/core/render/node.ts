import type { Rect } from "../model/geometry";
import type { Cluster, GraphNode } from "../model/scene";
import { seriesColor, type DiagramTheme } from "../theme";
import { isUnpainted, shapeGeometry, type ShapeGeometry } from "./shapes";
import {
  centeredLines,
  fitLabel,
  LINE_HEIGHT,
  truncateToWidth,
  wrapText,
  type TextLine,
} from "./text";


export interface NodeRender {
  geometry: ShapeGeometry;
  lines: TextLine[];

  dividers: string[];
  fill: string;
  stroke: string;
  strokeWidth: number;
  dashed: boolean;
}


const PAD_X = 10;
const PAD_Y = 7;

function resolveFill(node: GraphNode, theme: DiagramTheme): string {
  const explicit = node.style?.fill;
  if (explicit) return explicit;


  if (node.style?.className) return seriesColor(theme, node.style.className);
  return theme.nodeFill;
}


export function renderNode(node: GraphNode, theme: DiagramTheme): NodeRender {
  const local: Rect = { x: 0, y: 0, w: node.rect.w, h: node.rect.h };
  const geometry = shapeGeometry(node.shape, local, theme.cornerRadius);
  const inset = geometry.textInset;


  const inner: Rect = geometry.textBox ?? {
    x: inset.x,
    y: inset.y,
    w: Math.max(local.w - inset.x * 2, 4),
    h: Math.max(local.h - inset.y * 2, 4),
  };

  const lines: TextLine[] = [];
  const dividers: string[] = [];

  if (node.body.kind === "label") {
    const fitted = fitLabel(node.body.text, inner, theme.fontSize, 500);
    lines.push(...centeredLines(fitted.lines, inner, fitted.size, 500));
  } else {


    const titleSize = theme.fontSize + 1;
    const rowSize = theme.fontSize - 1;
    let y = inner.y;

    if (node.body.stereotype) {
      const size = theme.fontSize - 2;
      y += size * LINE_HEIGHT;
      lines.push({
        text: `«${node.body.stereotype}»`,
        x: inner.x + inner.w / 2,
        y: y - size * 0.3,
        anchor: "middle",
        size,
        weight: 400,
        muted: true,
        italic: true,
      });
    }

    const titleLines = wrapText(node.body.title, inner.w, titleSize, 600, 2);
    for (const text of titleLines) {
      y += titleSize * LINE_HEIGHT;
      lines.push({
        text,
        x: inner.x + inner.w / 2,
        y: y - titleSize * 0.3,
        anchor: "middle",
        size: titleSize,
        weight: 600,
      });
    }

    for (const section of node.body.sections) {
      y += PAD_Y;
      dividers.push(`M0,${round(y)} H${round(local.w)}`);
      y += PAD_Y - 2;

      for (const item of section.items) {
        y += rowSize * LINE_HEIGHT;
        lines.push({


          text: truncateToWidth(item, inner.w, rowSize, 400),
          x: inner.x,
          y: y - rowSize * 0.3,
          anchor: "start",
          size: rowSize,
          weight: 400,
          muted: true,
        });
      }
    }
  }


  const bare = isUnpainted(node.shape);

  return {
    geometry,
    lines,
    dividers,
    fill: bare ? (node.style?.fill ?? "none") : resolveFill(node, theme),
    stroke: bare ? (node.style?.stroke ?? "none") : (node.style?.stroke ?? theme.nodeStroke),
    strokeWidth: node.style?.strokeWidth ?? theme.strokeWidth,
    dashed: node.style?.dashed ?? false,
  };
}


export function nodeTextColors(
  node: GraphNode,
  theme: DiagramTheme,
): { text: string; muted: string } {
  const text = node.style?.text ?? theme.nodeText;
  return { text, muted: node.style?.text ?? theme.nodeTextMuted };
}

export interface ClusterRender {
  path: string;
  label?: TextLine;
  fill: string;
  stroke: string;
}


export function renderCluster(cluster: Cluster, theme: DiagramTheme): ClusterRender {
  const size = theme.fontSize - 1;

  const local: Rect = { x: 0, y: 0, w: cluster.rect.w, h: cluster.rect.h };

  return {
    path: shapeGeometry("rect", local, theme.cornerRadius).path,
    fill: cluster.style?.fill ?? theme.clusterFill,
    stroke: cluster.style?.stroke ?? theme.clusterStroke,
    label: cluster.label
      ? {
          text: truncateToWidth(cluster.label, local.w - PAD_X * 2, size, 600),
          x: PAD_X,
          y: size + PAD_Y,
          anchor: "start",
          size,
          weight: 600,
          muted: true,
        }
      : undefined,
  };
}

function round(v: number): number {
  return Math.round(v * 1000) / 1000;
}
