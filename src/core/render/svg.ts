import type { Rect } from "../model/geometry";
import type { GraphEdge, GraphScene, PassthroughScene, Scene, SequenceScene } from "../model/scene";
import { ACTIVATION_STEP, ACTIVATION_WIDTH } from "../sequence/layout";
import type { DiagramTheme } from "../theme";
import { arrowGeometry, edgePathD, headArrow, tailArrow } from "./edges";
import { nodeTextColors, renderCluster, renderNode } from "./node";
import { measureText, type TextLine } from "./text";
import {
  ANNOTATION_STROKE,
  HIGHLIGHT_OPACITY,
  annotationsBounds,
  renderAnnotations,
} from "./annotations";
import type { Annotation } from "../sidecar/types";


const ARROW_SIZE = 11;

export interface SvgExportOptions {

  padding?: number;

  background?: boolean;


  embedFonts?: string;

  scale?: number;

  title?: string;


  annotations?: Readonly<Record<string, Annotation>>;
}


function union(a: Rect, b: Rect | null): Rect {
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


function annotationElements(
  annotations: Readonly<Record<string, Annotation>> | undefined,
  scene: Scene | null,
  theme: DiagramTheme,
): string {
  const marks = renderAnnotations(annotations, scene, theme);
  if (marks.length === 0) return "";

  const parts: string[] = [];

  for (const mark of marks) {
    const { bounds, color } = mark;
    const inner: string[] = [];

    if (mark.leader) {
      inner.push(
        `<line x1="${n(mark.leader.from.x)}" y1="${n(mark.leader.from.y)}" ` +
          `x2="${n(mark.leader.to.x)}" y2="${n(mark.leader.to.y)}" stroke="${color}" ` +
          `stroke-width="${n(ANNOTATION_STROKE * 0.6)}" stroke-dasharray="5 4" opacity="0.7"/>`,
      );
    }

    if (mark.kind === "highlight" && mark.boxPath) {
      inner.push(
        `<g transform="translate(${n(bounds.x)},${n(bounds.y)})">` +
          `<path d="${mark.boxPath}" fill="${color}" fill-opacity="${HIGHLIGHT_OPACITY}"/>` +
          `<path d="${mark.boxPath}" fill="none" stroke="${color}" ` +
          `stroke-width="${n(ANNOTATION_STROKE * 0.6)}" opacity="0.5"/></g>`,
      );
    }

    if (mark.kind === "note" && mark.boxPath) {
      inner.push(
        `<g transform="translate(${n(bounds.x)},${n(bounds.y)})">` +
          `<path d="${mark.boxPath}" fill="${theme.background}"/>` +
          `<path d="${mark.boxPath}" fill="${color}" fill-opacity="0.14"/>` +
          `<path d="${mark.boxPath}" fill="none" stroke="${color}" stroke-width="1.5"/></g>`,
      );
    }

    for (const line of mark.lines ?? []) {
      inner.push(
        `<text x="${n(line.x)}" y="${n(line.y)}" font-family="${esc(theme.fontFamily)}" ` +
          `font-size="${n(theme.fontSize)}" fill="${theme.nodeText}" ` +
          `xml:space="preserve">${esc(line.text)}</text>`,
      );
    }

    if (mark.linePath) {
      inner.push(
        `<path d="${mark.linePath}" fill="none" stroke="${color}" ` +
          `stroke-width="${n(ANNOTATION_STROKE)}" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }

    if (mark.headPath) inner.push(`<path d="${mark.headPath}" fill="${color}"/>`);

    parts.push(inner.join(""));
  }

  return `<g data-layer="annotations">${parts.join("")}</g>`;
}

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function n(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

function attr(name: string, value: string | number | undefined | null): string {
  return value === undefined || value === null || value === "" ? "" : ` ${name}="${value}"`;
}

function textElement(line: TextLine, color: string, muted: string, family: string): string {
  return (
    `<text x="${n(line.x)}" y="${n(line.y)}" text-anchor="${line.anchor}" ` +
    `font-family="${esc(family)}" font-size="${n(line.size)}" font-weight="${line.weight}"` +
    attr("font-style", line.italic ? "italic" : undefined) +
    ` fill="${line.muted ? muted : color}" xml:space="preserve">${esc(line.text)}</text>`
  );
}

function edgeElement(edge: GraphEdge, theme: DiagramTheme): string {
  const stroke = edge.style?.stroke ?? theme.edge;
  const width = edge.style?.strokeWidth ?? theme.strokeWidth;

  const parts: string[] = [
    `<path d="${edgePathD(edge.route)}" fill="none" stroke="${stroke}" stroke-width="${n(width)}"` +
      attr("stroke-dasharray", edge.style?.dashed ? "7 5" : undefined) +
      ` stroke-linecap="round" stroke-linejoin="round"/>`,
  ];

  for (const arrow of [
    headArrow(edge.route, edge.arrowEnd, edge.endArrow, ARROW_SIZE),
    tailArrow(edge.route, edge.arrowStart, edge.startArrow, ARROW_SIZE),
  ]) {
    if (!arrow) continue;
    parts.push(
      `<path d="${arrow.path}" fill="${arrow.filled ? stroke : theme.background}" ` +
        `stroke="${stroke}" stroke-width="${n(width)}" stroke-linejoin="round"/>`,
    );
  }

  if (edge.label) {
    const size = theme.fontSize - 1;
    const x = edge.label.at.x + (edge.label.offset?.x ?? 0);
    const cy = edge.label.at.y + (edge.label.offset?.y ?? 0);
    const y = cy + size * 0.34;


    const boxW = measureText(edge.label.text, size, 500) + 5;
    const boxH = size + 4;

    parts.push(
      `<rect x="${n(x - boxW / 2)}" y="${n(cy - boxH / 2)}" width="${n(boxW)}" height="${n(boxH)}" ` +
        `rx="3" fill="${theme.edgeTextHalo}"/>`,
      `<text x="${n(x)}" y="${n(y)}" text-anchor="middle" font-family="${esc(theme.fontFamily)}" ` +
        `font-size="${n(size)}" font-weight="500" fill="${theme.edgeText}" ` +
        `stroke="${theme.edgeTextHalo}" stroke-width="2" paint-order="stroke" ` +
        `stroke-linejoin="round" xml:space="preserve">${esc(edge.label.text)}</text>`,
    );
  }

  return parts.join("");
}


export function sceneToSvg(
  scene: Scene,
  theme: DiagramTheme,
  options: SvgExportOptions = {},
): string {
  if (scene.family === "passthrough") return passthroughToSvg(scene, theme, options);
  if (scene.family === "sequence") return sequenceToSvg(scene, theme, options);
  return graphToSvg(scene, theme, options);
}


function passthroughToSvg(
  scene: PassthroughScene,
  theme: DiagramTheme,
  options: SvgExportOptions = {},
): string {
  const { padding = 16, background = true, scale = 1, title } = options;

  const box = {
    x: scene.bounds.x - padding,
    y: scene.bounds.y - padding,
    w: Math.max(scene.bounds.w + padding * 2, 1),
    h: Math.max(scene.bounds.h + padding * 2, 1),
  };

  const parts: string[] = [];
  if (title) parts.push(`<title>${esc(title)}</title>`);
  if (background) {
    parts.push(
      `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" fill="${theme.background}"/>`,
    );
  }
  parts.push(scene.svg);

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="${n(box.x)} ${n(box.y)} ${n(box.w)} ${n(box.h)}" ` +
    `width="${n(box.w * scale)}" height="${n(box.h * scale)}">` +
    parts.join("") +
    `</svg>`
  );
}

function graphToSvg(
  scene: GraphScene,
  theme: DiagramTheme,
  options: SvgExportOptions = {},
): string {
  const { padding = 16, background = true, embedFonts, scale = 1, title, annotations } = options;

  const bounds: Rect = union(scene.bounds, annotationsBounds(annotations));
  const box = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: Math.max(bounds.w + padding * 2, 1),
    h: Math.max(bounds.h + padding * 2, 1),
  };

  const parts: string[] = [];

  if (title) parts.push(`<title>${esc(title)}</title>`);
  if (embedFonts) parts.push(`<style>${embedFonts}</style>`);
  if (background) {
    parts.push(
      `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" fill="${theme.background}"/>`,
    );
  }


  for (const cluster of scene.clusters) {
    const r = renderCluster(cluster, theme);
    const inner = [
      `<path d="${r.path}" fill="${r.fill}" stroke="${r.stroke}" ` +
        `stroke-width="${n(theme.strokeWidth)}" stroke-dasharray="6 4"/>`,
      r.label ? textElement(r.label, theme.clusterText, theme.clusterText, theme.fontFamily) : "",
    ].join("");
    parts.push(`<g transform="translate(${n(cluster.rect.x)},${n(cluster.rect.y)})">${inner}</g>`);
  }

  for (const edge of scene.edges) parts.push(edgeElement(edge, theme));

  for (const node of scene.nodes) {
    const r = renderNode(node, theme);
    const colors = nodeTextColors(node, theme);

    const inner = [
      `<path d="${r.geometry.path}" fill="${r.fill}" stroke="${r.stroke}" ` +
        `stroke-width="${n(r.strokeWidth)}"` +
        attr("stroke-dasharray", r.dashed ? "6 4" : undefined) +
        ` stroke-linejoin="round"/>`,
      ...r.geometry.details.map(
        (d) => `<path d="${d}" fill="none" stroke="${r.stroke}" stroke-width="${n(r.strokeWidth)}"/>`,
      ),
      ...r.dividers.map(
        (d) => `<path d="${d}" stroke="${theme.nodeDivider}" stroke-width="1"/>`,
      ),
      ...r.lines.map((line) => textElement(line, colors.text, colors.muted, theme.fontFamily)),
    ].join("");

    parts.push(`<g transform="translate(${n(node.rect.x)},${n(node.rect.y)})">${inner}</g>`);
  }

  parts.push(annotationElements(annotations, scene, theme));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${n(box.x)} ${n(box.y)} ${n(box.w)} ${n(box.h)}" ` +
    `width="${n(box.w * scale)}" height="${n(box.h * scale)}">` +
    parts.join("") +
    `</svg>`
  );
}


export function githubReadySource(source: string): string {
  return source;
}


const SEQ_ARROW = 10;
const SELF_LOOP_WIDTH = 44;


export function sequenceToSvg(
  scene: SequenceScene,
  theme: DiagramTheme,
  options: SvgExportOptions = {},
): string {
  const { padding = 16, background = true, embedFonts, scale = 1, title, annotations } = options;

  const bounds = union(scene.bounds, annotationsBounds(annotations));
  const box = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: Math.max(bounds.w + padding * 2, 1),
    h: Math.max(bounds.h + padding * 2, 1),
  };

  const parts: string[] = [];
  if (title) parts.push(`<title>${esc(title)}</title>`);
  if (embedFonts) parts.push(`<style>${embedFonts}</style>`);
  if (background) {
    parts.push(
      `<rect x="${n(box.x)}" y="${n(box.y)}" width="${n(box.w)}" height="${n(box.h)}" fill="${theme.background}"/>`,
    );
  }

  const text = (
    content: string,
    x: number,
    y: number,
    size: number,
    weight: number,
    fill: string,
    anchor: "start" | "middle" | "end" = "middle",
  ) =>
    `<text x="${n(x)}" y="${n(y)}" text-anchor="${anchor}" font-family="${esc(theme.fontFamily)}" ` +
    `font-size="${n(size)}" font-weight="${weight}" fill="${fill}" xml:space="preserve">${esc(content)}</text>`;


  for (const fragment of scene.fragments) {
    const { x, y, w, h } = fragment.rect;
    const tagWidth = Math.max(46, fragment.kind.length * 8 + 20);

    parts.push(
      `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="4" ` +
        `fill="${theme.clusterFill}" stroke="${theme.clusterStroke}" stroke-width="${n(theme.strokeWidth)}"/>`,
      `<path d="M${n(x)},${n(y)} h${n(tagWidth)} l-10,18 h${n(-tagWidth + 10)} Z" fill="${theme.clusterStroke}" opacity="0.35"/>`,
      text(fragment.kind, x + 8, y + 13, theme.fontSize - 2, 600, theme.clusterText, "start"),
    );
    if (fragment.label) {
      parts.push(
        text(`[${fragment.label}]`, x + tagWidth + 8, y + 14, theme.fontSize - 2, 400, theme.nodeTextMuted, "start"),
      );
    }
    fragment.dividers.forEach((dy, i) => {
      parts.push(
        `<line x1="${n(x)}" y1="${n(dy)}" x2="${n(x + w)}" y2="${n(dy)}" stroke="${theme.clusterStroke}" stroke-width="1" stroke-dasharray="5 4"/>`,
        text(`[${fragment.sectionLabels[i] ?? ""}]`, x + 10, dy + 14, theme.fontSize - 2, 400, theme.nodeTextMuted, "start"),
      );
    });
  }

  for (const line of scene.lifelines) {
    parts.push(
      `<line x1="${n(line.x)}" y1="${n(line.head.y + line.head.h)}" x2="${n(line.x)}" y2="${n(line.bottom)}" ` +
        `stroke="${theme.edge}" stroke-width="${n(theme.strokeWidth)}" stroke-dasharray="6 5" opacity="0.7"/>`,
    );

    for (const y of [line.head.y, line.bottom]) {
      parts.push(
        `<rect x="${n(line.head.x)}" y="${n(y)}" width="${n(line.head.w)}" height="${n(line.head.h)}" ` +
          `rx="${n(theme.cornerRadius)}" fill="${theme.nodeFill}" stroke="${theme.nodeStroke}" stroke-width="${n(theme.strokeWidth)}"/>`,
        text(line.label, line.x, y + line.head.h / 2 + theme.fontSize * 0.36, theme.fontSize, 600, theme.nodeText),
      );
    }
  }

  const xOf = new Map(scene.lifelines.map((l) => [l.id, l.x]));

  for (const bar of scene.activations) {
    const x = xOf.get(bar.lifeline);
    if (x === undefined) continue;
    parts.push(
      `<rect x="${n(x - ACTIVATION_WIDTH / 2 + bar.depth * ACTIVATION_STEP)}" y="${n(bar.top)}" ` +
        `width="${n(ACTIVATION_WIDTH)}" height="${n(Math.max(bar.bottom - bar.top, 4))}" rx="1.5" ` +
        `fill="${theme.accent}" stroke="${theme.nodeStroke}" stroke-width="1" opacity="0.85"/>`,
    );
  }

  for (const note of scene.notes) {
    const { x, y, w, h } = note.rect;
    const fold = 10;
    parts.push(
      `<path d="M${n(x)},${n(y)} H${n(x + w - fold)} L${n(x + w)},${n(y + fold)} V${n(y + h)} H${n(x)} Z" ` +
        `fill="${theme.clusterFill}" stroke="${theme.clusterStroke}" stroke-width="${n(theme.strokeWidth)}"/>`,
      `<path d="M${n(x + w - fold)},${n(y)} V${n(y + fold)} H${n(x + w)}" fill="none" stroke="${theme.clusterStroke}" stroke-width="1"/>`,
    );
    note.text.split("\n").forEach((row, i) => {
      parts.push(text(row, x + w / 2, y + 10 + (i + 0.8) * theme.fontSize * 1.4, theme.fontSize - 1, 400, theme.nodeText));
    });
  }

  for (const message of scene.messages) {
    const from = xOf.get(message.from);
    const to = xOf.get(message.to);
    if (from === undefined || to === undefined) continue;

    const selfLoop = message.kind === "self";
    const d = selfLoop
      ? `M${n(from)},${n(message.y)} h${SELF_LOOP_WIDTH} v26 h${-SELF_LOOP_WIDTH}`
      : `M${n(from)},${n(message.y)} H${n(to)}`;

    const tip = selfLoop ? { x: from, y: message.y + 26 } : { x: to, y: message.y };
    const anchor = selfLoop ? { x: from + SELF_LOOP_WIDTH, y: message.y + 26 } : { x: from, y: message.y };
    const kind = message.kind === "destroy" ? "cross" : message.kind === "async" ? "open" : "arrow";
    const head = arrowGeometry(kind, tip, anchor, SEQ_ARROW);

    parts.push(
      `<path d="${d}" fill="none" stroke="${theme.edge}" stroke-width="${n(theme.strokeWidth)}"` +
        (message.kind === "reply" ? ' stroke-dasharray="6 4"' : "") +
        ` stroke-linecap="round" stroke-linejoin="round"/>`,
    );
    if (head) {
      parts.push(
        `<path d="${head.path}" fill="${head.filled ? theme.edge : "none"}" stroke="${theme.edge}" ` +
          `stroke-width="${n(theme.strokeWidth)}" stroke-linejoin="round"/>`,
      );
    }
    if (message.label) {
      const lx = selfLoop ? from + SELF_LOOP_WIDTH + 8 : (from + to) / 2;
      parts.push(
        `<text x="${n(lx)}" y="${n(message.y - 7)}" text-anchor="${selfLoop ? "start" : "middle"}" ` +
          `font-family="${esc(theme.fontFamily)}" font-size="${n(theme.fontSize - 1)}" font-weight="500" ` +
          `fill="${theme.edgeText}" stroke="${theme.edgeTextHalo}" stroke-width="3.5" paint-order="stroke" ` +
          `stroke-linejoin="round" xml:space="preserve">${esc(message.label)}</text>`,
      );
    }
  }

  parts.push(annotationElements(annotations, scene, theme));

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(box.x)} ${n(box.y)} ${n(box.w)} ${n(box.h)}" ` +
    `width="${n(box.w * scale)}" height="${n(box.h * scale)}">` +
    parts.join("") +
    `</svg>`
  );
}
