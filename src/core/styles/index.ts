import type { Cluster, GraphNode, GraphScene, NodeStyle } from "../model/scene";
import type { Layout, StyleHint } from "../sidecar/types";

export type Styles = NonNullable<Layout["styles"]>;

export function resolveStyle(
  id: string,
  parentOf: (id: string) => string | undefined,
  styles: Styles,
): StyleHint {
  let fill: string | undefined;
  let outline: string | undefined;
  const seen = new Set<string>();

  for (let at: string | undefined = id; at !== undefined && !seen.has(at); at = parentOf(at)) {
    seen.add(at);
    const own = styles[at];
    fill ??= own?.fill ?? undefined;
    outline ??= own?.outline ?? undefined;
    if (fill !== undefined && outline !== undefined) break;
  }

  return { fill, outline };
}

function merge(existing: NodeStyle | undefined, hint: StyleHint): NodeStyle | undefined {
  if (!hint.fill && !hint.outline) return existing;
  return {
    ...existing,
    ...(hint.fill ? { fill: hint.fill } : {}),
    ...(hint.outline ? { stroke: hint.outline } : {}),
  };
}

export function applyStyles(scene: GraphScene, styles: Layout["styles"]): GraphScene {
  if (!styles || Object.keys(styles).length === 0) return scene;

  const clusterParent = new Map(scene.clusters.map((c) => [c.id, c.parent]));
  const nodeParent = new Map(scene.nodes.map((n) => [n.id, n.parent]));
  const parentOf = (id: string) =>
    nodeParent.has(id) ? nodeParent.get(id) : clusterParent.get(id);

  const clusters: Cluster[] = scene.clusters.map((cluster) => {
    const style = merge(cluster.style, resolveStyle(cluster.id, parentOf, styles));
    return style === cluster.style ? cluster : { ...cluster, style };
  });

  const nodes: GraphNode[] = scene.nodes.map((node) => {
    const style = merge(node.style, resolveStyle(node.id, parentOf, styles));
    return style === node.style ? node : { ...node, style };
  });

  return { ...scene, nodes, clusters };
}

export function withStyle(
  styles: Layout["styles"],
  id: string,
  patch: Partial<StyleHint>,
): Styles {
  const next: Styles = { ...(styles ?? {}) };
  const merged: StyleHint = { ...next[id], ...patch };

  if (!merged.fill) delete merged.fill;
  if (!merged.outline) delete merged.outline;

  if (merged.fill || merged.outline) next[id] = merged;
  else delete next[id];
  return next;
}

export function retargetStyles(styles: Layout["styles"], from: string, to: string): Layout["styles"] {
  if (!styles?.[from]) return styles;
  const next: Styles = { ...styles, [to]: styles[from]! };
  delete next[from];
  return next;
}

export function toHex(color: string): string | null {
  const text = color.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)?.[1];
  if (hex) return "#" + (hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex).toLowerCase();

  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(text);
  if (!rgb) return null;
  return "#" + rgb.slice(1, 4).map((v) => Math.min(255, Number(v)).toString(16).padStart(2, "0")).join("");
}

function channels(color: string): [number, number, number] | null {
  const alpha = /^rgba\([^)]*,\s*([\d.]+)\s*\)$/i.exec(color.trim())?.[1];
  if (alpha !== undefined && Number(alpha) < 0.6) return null;

  const hex = toHex(color);
  if (!hex) return null;
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
}

function luminance(color: string): number | null {
  const rgb = channels(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export function readableOn(fill: string, preferred: string): string {
  const ratio = contrastRatio(fill, preferred);
  if (ratio === null || ratio >= 3) return preferred;

  const dark = "#0b0f14";
  const light = "#f8fafc";
  return (contrastRatio(fill, dark) ?? 0) >= (contrastRatio(fill, light) ?? 0) ? dark : light;
}
