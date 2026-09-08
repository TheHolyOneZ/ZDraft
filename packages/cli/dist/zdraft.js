#!/usr/bin/env node

// src/index.ts
import { mkdir, writeFile } from "node:fs/promises";
import { basename as basename2, join as join3, relative } from "node:path";

// ../../src/core/theme/index.ts
var UI_FONT = "Inter, 'Inter Variable', 'Segoe UI', system-ui, sans-serif";
var MONO_FONT = "'JetBrains Mono', 'JetBrains Mono Variable', ui-monospace, monospace";
var DEFAULT_FONT_SIZE = 13;
var BASE = {
  strokeWidth: 1.5,
  cornerRadius: 8,
  fontFamily: UI_FONT,
  monoFamily: MONO_FONT,
  fontSize: DEFAULT_FONT_SIZE
};
var blueprint = {
  ...BASE,
  id: "blueprint",
  label: "Blueprint",
  note: "Deep blue, cyan hairlines. The signature look.",
  background: "#0B1D33",
  nodeFill: "#12314F",
  nodeStroke: "#8AF0FF",
  nodeText: "#EAF3FB",
  nodeTextMuted: "#9DBCD8",
  nodeDivider: "rgba(138, 240, 255, 0.28)",
  edge: "#67E8F9",
  edgeText: "#CFEDFA",
  edgeTextHalo: "#0B1D33",
  clusterFill: "rgba(103, 232, 249, 0.06)",
  clusterStroke: "rgba(103, 232, 249, 0.35)",
  clusterText: "#9DBCD8",
  accent: "#38BDF8",
  series: ["#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#A78BFA", "#FB923C", "#2DD4BF", "#F87171"]
};
var paper = {
  ...BASE,
  id: "paper",
  label: "Paper",
  note: "Warm white and graphite. Reads well printed.",
  background: "#FAF9F6",
  nodeFill: "#FFFFFF",
  nodeStroke: "#3F3B33",
  nodeText: "#26241F",
  nodeTextMuted: "#63605A",
  nodeDivider: "rgba(63, 59, 51, 0.22)",
  edge: "#5C564A",
  edgeText: "#3F3B33",
  edgeTextHalo: "#FAF9F6",
  clusterFill: "rgba(90, 84, 72, 0.05)",
  clusterStroke: "rgba(90, 84, 72, 0.3)",
  clusterText: "#63605A",
  accent: "#0369A1",
  series: ["#0369A1", "#15803D", "#A16207", "#BE185D", "#6D28D9", "#C2410C", "#0F766E", "#B91C1C"]
};
var slate = {
  ...BASE,
  id: "slate",
  label: "Slate",
  note: "Neutral greys. Gets out of the way.",
  background: "#0F1115",
  nodeFill: "#1D212A",
  nodeStroke: "#8494A8",
  nodeText: "#E6E9EF",
  nodeTextMuted: "#98A1B2",
  nodeDivider: "rgba(132, 148, 168, 0.28)",
  edge: "#94A3B8",
  edgeText: "#CBD5E1",
  edgeTextHalo: "#0F1115",
  clusterFill: "rgba(148, 163, 184, 0.06)",
  clusterStroke: "rgba(148, 163, 184, 0.3)",
  clusterText: "#98A1B2",
  accent: "#38BDF8",
  series: ["#60A5FA", "#4ADE80", "#FBBF24", "#F472B6", "#C084FC", "#FB923C", "#2DD4BF", "#F87171"]
};
var pastel = {
  ...BASE,
  id: "pastel",
  label: "Pastel",
  note: "Soft fills, gentle contrast. Good on a projector.",
  background: "#FBFAF8",
  nodeFill: "#EEF4FB",
  nodeStroke: "#7C93AC",
  nodeText: "#2C3A47",
  nodeTextMuted: "#5C6E7E",
  nodeDivider: "rgba(124, 147, 172, 0.3)",
  edge: "#8497A8",
  edgeText: "#4A5A68",
  edgeTextHalo: "#FBFAF8",
  clusterFill: "rgba(124, 147, 172, 0.08)",
  clusterStroke: "rgba(124, 147, 172, 0.38)",
  clusterText: "#5C6E7E",
  accent: "#5B8DBE",
  series: ["#AECBEB", "#B7E4C7", "#FBE7A1", "#F7C8D8", "#D6C9F0", "#FAD7B0", "#A8DCD5", "#F2B8B5"]
};
var mono = {
  ...BASE,
  id: "mono",
  label: "Mono",
  note: "Black and white only. Nothing is encoded in colour.",
  background: "#FFFFFF",
  nodeFill: "#FFFFFF",
  nodeStroke: "#000000",
  nodeText: "#000000",
  nodeTextMuted: "#3A3A3A",
  nodeDivider: "#000000",
  edge: "#000000",
  edgeText: "#000000",
  edgeTextHalo: "#FFFFFF",
  clusterFill: "rgba(0, 0, 0, 0.03)",
  clusterStroke: "#000000",
  clusterText: "#000000",
  accent: "#000000",
  // Greys, not hues: the categorical channel still works in one ink.
  series: ["#FFFFFF", "#E4E4E4", "#C9C9C9", "#AEAEAE", "#939393", "#787878", "#5D5D5D", "#424242"],
  strokeWidth: 1.75,
  printSafe: true
};
var neon = {
  ...BASE,
  id: "neon",
  label: "Neon",
  note: "Near-black with vivid strokes. Built for dark slides.",
  background: "#0A0A0F",
  nodeFill: "#15151F",
  nodeStroke: "#F0ABFC",
  nodeText: "#F5F3FF",
  nodeTextMuted: "#C4B5FD",
  nodeDivider: "rgba(240, 171, 252, 0.3)",
  edge: "#22D3EE",
  edgeText: "#A5F3FC",
  edgeTextHalo: "#0A0A0F",
  clusterFill: "rgba(168, 85, 247, 0.08)",
  clusterStroke: "rgba(240, 171, 252, 0.4)",
  clusterText: "#C4B5FD",
  accent: "#22D3EE",
  series: ["#22D3EE", "#A3E635", "#FACC15", "#F0ABFC", "#818CF8", "#FB923C", "#2DD4BF", "#FB7185"]
};
var DIAGRAM_THEMES = [
  blueprint,
  paper,
  slate,
  pastel,
  mono,
  neon
];
var DEFAULT_DIAGRAM_THEME = "blueprint";
var BY_ID = new Map(DIAGRAM_THEMES.map((t) => [t.id, t]));
function themeByName(name) {
  if (!name) return BY_ID.get(DEFAULT_DIAGRAM_THEME);
  return BY_ID.get(name.toLowerCase()) ?? BY_ID.get(DEFAULT_DIAGRAM_THEME);
}
function seriesColor(theme, key) {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = hash * 31 + key.charCodeAt(i) | 0;
  }
  return theme.series[Math.abs(hash) % theme.series.length];
}

// src/render.ts
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

// ../../src/core/model/geometry.ts
function rectCenter(r2) {
  return { x: r2.x + r2.w / 2, y: r2.y + r2.h / 2 };
}
function rectFromCenter(cx, cy, w, h) {
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
function rectContains(r2, p) {
  return p.x >= r2.x && p.x <= r2.x + r2.w && p.y >= r2.y && p.y <= r2.y + r2.h;
}
function rectAtCenter(r2, p) {
  return { x: p.x - r2.w / 2, y: p.y - r2.h / 2, w: r2.w, h: r2.h };
}
function unionRects(rects) {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r2 of rects) {
    if (r2.x < minX) minX = r2.x;
    if (r2.y < minY) minY = r2.y;
    if (r2.x + r2.w > maxX) maxX = r2.x + r2.w;
    if (r2.y + r2.h > maxY) maxY = r2.y + r2.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function boundaryPoint(r2, toward, shape = "rect") {
  const c = rectCenter(r2);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const a = r2.w / 2;
  const b = r2.h / 2;
  if (a <= 0 || b <= 0) return c;
  let t;
  switch (shape) {
    case "ellipse": {
      t = 1 / Math.hypot(dx / a, dy / b);
      break;
    }
    case "diamond": {
      t = 1 / (Math.abs(dx) / a + Math.abs(dy) / b);
      break;
    }
    default: {
      const tx = dx === 0 ? Infinity : a / Math.abs(dx);
      const ty = dy === 0 ? Infinity : b / Math.abs(dy);
      t = Math.min(tx, ty);
      break;
    }
  }
  return { x: c.x + dx * t, y: c.y + dy * t };
}
function segmentIntersectsRect(a, b, r2) {
  if (rectContains(r2, a) || rectContains(r2, b)) return true;
  let tMin = 0;
  let tMax = 1;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const clip = (delta, origin, lo, hi) => {
    if (delta === 0) return origin > lo && origin < hi;
    let t0 = (lo - origin) / delta;
    let t1 = (hi - origin) / delta;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tMin = Math.max(tMin, t0);
    tMax = Math.min(tMax, t1);
    return tMin < tMax;
  };
  if (!clip(dx, a.x, r2.x, r2.x + r2.w)) return false;
  if (!clip(dy, a.y, r2.y, r2.y + r2.h)) return false;
  return tMin < tMax;
}
function simplifyPolyline(points2, epsilon = 0.5) {
  if (points2.length <= 2) return [...points2];
  const out = [points2[0]];
  for (let i = 1; i < points2.length - 1; i++) {
    const prev = out[out.length - 1];
    const here = points2[i];
    const next = points2[i + 1];
    const cross = (here.x - prev.x) * (next.y - prev.y) - (here.y - prev.y) * (next.x - prev.x);
    if (Math.abs(cross) > epsilon) out.push(here);
  }
  out.push(points2[points2.length - 1]);
  return out;
}

// ../../src/core/model/scene.ts
function isGraph(scene) {
  return scene.family === "graph";
}
function edgeId(from, to, ordinal = 0) {
  return ordinal === 0 ? `${from}->${to}` : `${from}->${to}#${ordinal}`;
}

// ../../src/core/locate/d2.ts
var RESERVED = /* @__PURE__ */ new Set([
  "shape",
  "label",
  "icon",
  "style",
  "near",
  "direction",
  "constraint",
  "width",
  "height",
  "top",
  "left",
  "link",
  "tooltip",
  "class",
  "classes",
  "grid-rows",
  "grid-columns",
  "grid-gap",
  "vertical-gap",
  "horizontal-gap",
  "source-arrowhead",
  "target-arrowhead",
  "layers",
  "scenarios",
  "steps",
  "vars"
]);
var ARROWS = ["<->", "-->", "->", "<-", "--"];
function locateD2(source) {
  const nodes = /* @__PURE__ */ new Map();
  const edges = /* @__PURE__ */ new Map();
  const pairSeen = /* @__PURE__ */ new Map();
  const scope = [];
  const declare = (path, range) => {
    if (!nodes.has(path)) nodes.set(path, range);
  };
  for (const statement of scan(source)) {
    if (statement === "close") {
      scope.pop();
      continue;
    }
    const resolved = statement.keys.map((k) => ({ ...k, path: absolute(scope, k.path) }));
    const prefix = scope.length > 0 ? scope.join(".") + "." : "";
    if (statement.arrows.length > 0 && resolved.length >= 2) {
      for (const key of resolved) declare(key.path, key.range);
      for (let i = 0; i + 1 < resolved.length; i += 1) {
        const arrow = statement.arrows[i] ?? "->";
        const [from, to] = orient(arrow, resolved[i].path, resolved[i + 1].path);
        const pair = `${from}->${to}`;
        const ordinal = pairSeen.get(pair) ?? 0;
        pairSeen.set(pair, ordinal + 1);
        edges.set(edgeId(from, to, ordinal), statement.range);
      }
    } else if (resolved.length === 1) {
      const key = resolved[0];
      const last = key.path.slice(key.path.lastIndexOf(".") + 1);
      if (!RESERVED.has(last)) declare(key.path, key.range);
      if (statement.opensBlock && !RESERVED.has(last)) scope.push(key.path.slice(prefix.length));
      else if (statement.opensBlock) scope.push(last);
    } else if (statement.opensBlock) {
      scope.push("");
    }
  }
  return { nodes, edges };
}
function absolute(scope, path) {
  let up = 0;
  let rest = path;
  while (rest === "_" || rest.startsWith("_.")) {
    up += 1;
    if (rest === "_") {
      rest = "";
      break;
    }
    rest = rest.slice(2);
  }
  const base = up > 0 ? scope.slice(0, Math.max(0, scope.length - up)) : scope;
  const prefix = base.length > 0 ? base.join(".") + "." : "";
  return rest === "" ? base.join(".") : prefix + rest;
}
function orient(arrow, a, b) {
  return arrow === "<-" ? [b, a] : [a, b];
}
function* scan(source) {
  let i = 0;
  const n4 = source.length;
  let keys = [];
  let arrows = [];
  let start = 0;
  let pending = null;
  const flushKey = () => {
    if (!pending) return;
    const lead = pending.text.length - pending.text.trimStart().length;
    const trail = pending.text.length - pending.text.trimEnd().length;
    const text = pending.text.trim();
    if (text !== "") {
      keys.push({ path: text, range: { from: pending.from + lead, to: pending.to - trail } });
    }
    pending = null;
  };
  const emit = function* (end, opensBlock) {
    flushKey();
    if (keys.length > 0) {
      yield { keys, arrows, range: { from: start, to: end }, opensBlock };
    }
    keys = [];
    arrows = [];
  };
  const reset = (at) => {
    start = at;
  };
  while (i < n4) {
    const ch = source[i];
    if (ch === "#" && pending === null) {
      while (i < n4 && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/" && pending === null) {
      while (i < n4 && source[i] !== "\n") i += 1;
      continue;
    }
    if ((ch === '"' || ch === "'") && pending === null) {
      const from = i;
      i += 1;
      while (i < n4 && source[i] !== ch) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      pending = { text: source.slice(from + 1, Math.max(from + 1, i - 1)), from, to: i };
      continue;
    }
    if (ch === "\n" || ch === ";") {
      yield* emit(i, false);
      i += 1;
      reset(i);
      continue;
    }
    if (ch === "{") {
      yield* emit(i, true);
      i += 1;
      reset(i);
      continue;
    }
    if (ch === "}") {
      yield* emit(i, false);
      yield "close";
      i += 1;
      reset(i);
      continue;
    }
    if (ch === ":") {
      flushKey();
      i += 1;
      while (i < n4 && (source[i] === " " || source[i] === "	")) i += 1;
      if (source[i] === "|") {
        let bars = 0;
        while (source[i + bars] === "|") bars += 1;
        const close = "|".repeat(bars);
        const at = source.indexOf(close, i + bars);
        i = at === -1 ? n4 : at + bars;
        continue;
      }
      if (source[i] === "{") continue;
      while (i < n4 && source[i] !== "\n" && source[i] !== ";" && source[i] !== "}") i += 1;
      continue;
    }
    const arrow = ARROWS.find((a) => source.startsWith(a, i));
    if (arrow) {
      flushKey();
      arrows.push(arrow);
      i += arrow.length;
      continue;
    }
    if (/\s/.test(ch)) {
      if (pending) pending.text += ch;
      i += 1;
      if (pending) pending.to = i;
      continue;
    }
    if (pending === null) pending = { text: ch, from: i, to: i + 1 };
    else {
      pending.text += ch;
      pending.to = i + 1;
    }
    i += 1;
  }
  yield* emit(n4, false);
}

// ../../src/core/locate/types.ts
function lineColumnAt(source, offset) {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

// ../../src/core/render/text.ts
var NARROW = new Set("ijlt.,:;|!'`()[]{}/\\ \uFFFC".split(""));
var WIDE = new Set("mwMW@%".split(""));
var CAPS = /[A-Z]/;
var DIGIT = /[0-9]/;
var RATIO = {
  narrow: 0.3,
  wide: 0.88,
  caps: 0.66,
  digit: 0.56,
  space: 0.26,
  other: 0.53
};
function charRatio(ch) {
  if (ch === " ") return RATIO.space;
  if (NARROW.has(ch)) return RATIO.narrow;
  if (WIDE.has(ch)) return RATIO.wide;
  if (CAPS.test(ch)) return RATIO.caps;
  if (DIGIT.test(ch)) return RATIO.digit;
  if (ch.codePointAt(0) > 11904) return 1;
  return RATIO.other;
}
function measureText(text, fontSize, weight = 400) {
  let em = 0;
  for (const ch of text) em += charRatio(ch);
  return em * fontSize * (weight >= 600 ? 1.03 : 1);
}
function wrapText(text, maxWidth, fontSize, weight = 400, maxLines = 8) {
  const lines = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (word === "") continue;
      const candidate = current + word;
      if (measureText(candidate, fontSize, weight) <= maxWidth || current === "") {
        if (current === "" && measureText(word, fontSize, weight) > maxWidth) {
          let chunk = "";
          for (const ch of word) {
            if (measureText(chunk + ch, fontSize, weight) > maxWidth && chunk !== "") {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
          continue;
        }
        current = candidate;
      } else {
        lines.push(current.trimEnd());
        current = word.trimStart();
      }
    }
    if (current.trim() !== "" || lines.length === 0) lines.push(current.trimEnd());
  }
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = truncateToWidth(kept[maxLines - 1] + "\u2026", maxWidth, fontSize, weight);
  return kept;
}
function truncateToWidth(text, maxWidth, fontSize, weight = 400) {
  if (measureText(text, fontSize, weight) <= maxWidth) return text;
  let out = "";
  for (const ch of text) {
    if (measureText(out + ch + "\u2026", fontSize, weight) > maxWidth) break;
    out += ch;
  }
  return out.trimEnd() + "\u2026";
}
var LINE_HEIGHT = 1.32;
function centeredLines(lines, box, size, weight = 500) {
  const lineHeight = size * LINE_HEIGHT;
  const blockHeight = lines.length * lineHeight;
  const firstBaseline = box.y + box.h / 2 - blockHeight / 2 + size * 0.82;
  return lines.map((text, i) => ({
    text,
    x: box.x + box.w / 2,
    y: firstBaseline + i * lineHeight,
    anchor: "middle",
    size,
    weight
  }));
}
function fitLabel(text, box, baseSize, weight = 500, minScale = 0.78, maxLines = 6) {
  const floor = baseSize * minScale;
  if (!text.includes("\n")) {
    const width = measureText(text, baseSize, weight);
    if (width <= box.w) return { lines: [text], size: baseSize };
    const scaled = baseSize * (box.w / width);
    if (scaled >= floor) return { lines: [text], size: scaled };
  }
  let size = baseSize;
  for (let attempt = 0; attempt < 4; attempt++) {
    const lines = wrapText(text, box.w, size, weight, maxLines);
    const fitsHeight = lines.length * size * LINE_HEIGHT <= box.h + 2;
    const fitsWidth = lines.every((l) => measureText(l, size, weight) <= box.w + 0.5);
    if (fitsHeight && fitsWidth) return { lines, size };
    const next = size * 0.9;
    if (next < floor) break;
    size = next;
  }
  return { lines: wrapText(text, box.w, size, weight, maxLines), size };
}

// ../../src/core/render/shapes.ts
function n(v) {
  return Number.isFinite(v) ? String(Math.round(v * 1e3) / 1e3) : "0";
}
function poly(points2) {
  return points2.map(([x, y], i) => `${i === 0 ? "M" : "L"}${n(x)},${n(y)}`).join(" ") + " Z";
}
function roundedRectPath(r2, radius) {
  const rad = Math.max(0, Math.min(radius, r2.w / 2, r2.h / 2));
  const { x, y, w, h } = r2;
  if (rad === 0) {
    return poly([
      [x, y],
      [x + w, y],
      [x + w, y + h],
      [x, y + h]
    ]);
  }
  return [
    `M${n(x + rad)},${n(y)}`,
    `H${n(x + w - rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x + w)},${n(y + rad)}`,
    `V${n(y + h - rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x + w - rad)},${n(y + h)}`,
    `H${n(x + rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x)},${n(y + h - rad)}`,
    `V${n(y + rad)}`,
    `A${n(rad)},${n(rad)} 0 0 1 ${n(x + rad)},${n(y)}`,
    "Z"
  ].join(" ");
}
function ellipsePath(r2) {
  const rx = r2.w / 2;
  const ry = r2.h / 2;
  const cx = r2.x + rx;
  const cy = r2.y + ry;
  return [
    `M${n(cx - rx)},${n(cy)}`,
    `A${n(rx)},${n(ry)} 0 1 0 ${n(cx + rx)},${n(cy)}`,
    `A${n(rx)},${n(ry)} 0 1 0 ${n(cx - rx)},${n(cy)}`,
    "Z"
  ].join(" ");
}
function shapeGeometry(shape, r2, cornerRadius) {
  const { x, y, w, h } = r2;
  const right = x + w;
  const bottom = y + h;
  const midX = x + w / 2;
  const midY = y + h / 2;
  const rect = (radius) => ({
    path: roundedRectPath(r2, radius),
    details: [],
    boundary: "rect",
    textInset: { x: 8, y: 5 }
  });
  switch (shape) {
    case "rect":
      return rect(cornerRadius);
    case "round":
      return rect(Math.min(cornerRadius * 2.5, h / 2));
    case "stadium":
      return rect(h / 2);
    case "circle": {
      const d = Math.min(w, h);
      const box = { x: midX - d / 2, y: midY - d / 2, w: d, h: d };
      return {
        path: ellipsePath(box),
        details: [],
        boundary: "ellipse",
        textInset: { x: d * 0.15, y: d * 0.15 }
      };
    }
    case "ellipse":
      return {
        path: ellipsePath(r2),
        details: [],
        // An ellipse's text box is its inscribed rectangle, which is narrower
        // than the bounding box by a factor of √2 on each axis.
        boundary: "ellipse",
        textInset: { x: w * 0.146, y: h * 0.146 }
      };
    case "diamond":
      return {
        path: poly([
          [midX, y],
          [right, midY],
          [midX, bottom],
          [x, midY]
        ]),
        details: [],
        boundary: "diamond",
        textInset: { x: w * 0.25, y: h * 0.25 }
      };
    case "hexagon": {
      const cut = Math.min(w * 0.16, h * 0.5);
      return {
        path: poly([
          [x + cut, y],
          [right - cut, y],
          [right, midY],
          [right - cut, bottom],
          [x + cut, bottom],
          [x, midY]
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: cut + 6, y: 6 }
      };
    }
    case "parallelogram": {
      const skew = Math.min(w * 0.18, h * 0.8);
      return {
        path: poly([
          [x + skew, y],
          [right, y],
          [right - skew, bottom],
          [x, bottom]
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: skew + 6, y: 6 }
      };
    }
    case "trapezoid": {
      const inset = Math.min(w * 0.18, h * 0.8);
      return {
        path: poly([
          [x + inset, y],
          [right - inset, y],
          [right, bottom],
          [x, bottom]
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: inset + 6, y: 6 }
      };
    }
    case "cylinder": {
      const ry = Math.min(h * 0.16, w * 0.35);
      return {
        path: [
          `M${n(x)},${n(y + ry)}`,
          `A${n(w / 2)},${n(ry)} 0 0 1 ${n(right)},${n(y + ry)}`,
          `V${n(bottom - ry)}`,
          `A${n(w / 2)},${n(ry)} 0 0 1 ${n(x)},${n(bottom - ry)}`,
          "Z"
        ].join(" "),
        details: [
          `M${n(x)},${n(y + ry)} A${n(w / 2)},${n(ry)} 0 0 0 ${n(right)},${n(y + ry)}`
        ],
        boundary: "rect",
        textInset: { x: 8, y: ry + 5 }
      };
    }
    case "note": {
      const fold = Math.min(w * 0.2, h * 0.42, 22);
      return {
        path: poly([
          [x, y],
          [right - fold, y],
          [right, y + fold],
          [right, bottom],
          [x, bottom]
        ]),
        details: [`M${n(right - fold)},${n(y)} V${n(y + fold)} H${n(right)}`],
        boundary: "rect",
        textInset: { x: 8, y: 7 }
      };
    }
    case "folder": {
      const tab = Math.min(h * 0.22, 16);
      const tabW = Math.min(w * 0.4, 60);
      return {
        path: poly([
          [x, y + tab],
          [x + tabW, y + tab],
          [x + tabW + tab, y],
          [right, y],
          [right, bottom],
          [x, bottom]
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: 8, y: tab + 5 },
        textBox: { x: 8, y: tab + 5, w: Math.max(w - 16, 4), h: Math.max(h - tab - 10, 4) }
      };
    }
    case "doc": {
      const wave = Math.min(h * 0.18, 16);
      return {
        path: [
          `M${n(x)},${n(y)}`,
          `H${n(right)}`,
          `V${n(bottom - wave)}`,
          `C${n(right - w / 4)},${n(bottom)} ${n(x + w / 4)},${n(bottom - wave * 2)} ${n(x)},${n(bottom - wave)}`,
          "Z"
        ].join(" "),
        details: [],
        boundary: "rect",
        textInset: { x: 8, y: 5 }
      };
    }
    case "subroutine": {
      const bar = Math.min(w * 0.08, 12);
      return {
        path: roundedRectPath(r2, 0),
        details: [
          `M${n(x + bar)},${n(y)} V${n(bottom)}`,
          `M${n(right - bar)},${n(y)} V${n(bottom)}`
        ],
        boundary: "rect",
        textInset: { x: bar + 8, y: 6 }
      };
    }
    case "person": {
      const strip = Math.min(h * 0.32, 22);
      const figure = Math.max(h - strip, 8);
      const head = Math.min(w * 0.3, figure * 0.34, 14);
      const cx = x + w / 2;
      const bodyTop = y + head * 2 + 2;
      const bodyBottom = y + figure;
      const shoulder = Math.min(w * 0.34, 20);
      return {
        path: [
          `M${n(cx - shoulder)},${n(bodyBottom)}`,
          `V${n(bodyTop)}`,
          `A${n(shoulder)},${n(shoulder)} 0 0 1 ${n(cx + shoulder)},${n(bodyTop)}`,
          `V${n(bodyBottom)}`,
          "Z"
        ].join(" "),
        details: [
          `M${n(cx + head)},${n(y + head)} A${n(head)},${n(head)} 0 1 1 ${n(cx - head)},${n(y + head)} A${n(head)},${n(head)} 0 1 1 ${n(cx + head)},${n(y + head)} Z`
        ],
        boundary: "rect",
        textInset: { x: 2, y: 2 },
        textBox: { x: 1, y: y + figure, w: Math.max(w - 2, 4), h: Math.max(strip, 4) }
      };
    }
    case "cloud": {
      const rx = w / 2;
      const ry = h / 2;
      return {
        path: [
          `M${n(x + rx * 0.5)},${n(bottom)}`,
          `A${n(rx * 0.34)},${n(ry * 0.4)} 0 0 1 ${n(x + rx * 0.2)},${n(y + ry * 1.1)}`,
          `A${n(rx * 0.4)},${n(ry * 0.5)} 0 0 1 ${n(x + rx * 0.62)},${n(y + ry * 0.42)}`,
          `A${n(rx * 0.44)},${n(ry * 0.52)} 0 0 1 ${n(x + rx * 1.42)},${n(y + ry * 0.38)}`,
          `A${n(rx * 0.4)},${n(ry * 0.5)} 0 0 1 ${n(x + w - rx * 0.16)},${n(y + ry * 1.12)}`,
          `A${n(rx * 0.34)},${n(ry * 0.4)} 0 0 1 ${n(x + w - rx * 0.5)},${n(bottom)}`,
          "Z"
        ].join(" "),
        details: [],
        boundary: "ellipse",
        textInset: { x: w * 0.16, y: h * 0.28 }
      };
    }
    case "step": {
      const notch = Math.min(w * 0.16, 20);
      return {
        path: poly([
          [x, y],
          [right - notch, y],
          [right, midY],
          [right - notch, bottom],
          [x, bottom],
          [x + notch, midY]
        ]),
        details: [],
        boundary: "rect",
        textInset: { x: notch + 6, y: 5 }
      };
    }
    case "page": {
      const step = Math.min(w * 0.05, h * 0.09, 7);
      const face = { x, y: y + step * 2, w: w - step * 2, h: h - step * 2 };
      return {
        path: roundedRectPath(face, 0),
        details: [
          `M${n(x + step)},${n(y + step)} H${n(right - step)} V${n(bottom - step)}`,
          `M${n(x + step * 2)},${n(y)} H${n(right)} V${n(bottom - step * 2)}`
        ],
        boundary: "rect",
        textInset: { x: 8, y: step * 2 + 5 }
      };
    }
    case "package": {
      const tab = Math.min(h * 0.2, 14);
      const tabW = Math.min(w * 0.42, 64);
      return {
        path: poly([
          [x, y],
          [x + tabW, y],
          [x + tabW, y + tab],
          [right, y + tab],
          [right, bottom],
          [x, bottom]
        ]),
        details: [`M${n(x)},${n(y + tab)} H${n(x + tabW)}`],
        boundary: "rect",
        textInset: { x: 8, y: tab + 5 },
        textBox: { x: 8, y: tab + 5, w: Math.max(w - 16, 4), h: Math.max(h - tab - 10, 4) }
      };
    }
    case "callout": {
      const tail = Math.min(h * 0.2, 14);
      const tailX = x + Math.min(w * 0.3, 40);
      const radius = Math.min(cornerRadius * 2, 10, (h - tail) / 2);
      const bodyBottom = bottom - tail;
      return {
        path: [
          `M${n(x + radius)},${n(y)}`,
          `H${n(right - radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(right)},${n(y + radius)}`,
          `V${n(bodyBottom - radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(right - radius)},${n(bodyBottom)}`,
          `H${n(tailX + tail)}`,
          `L${n(tailX)},${n(bottom)}`,
          `L${n(tailX)},${n(bodyBottom)}`,
          `H${n(x + radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(x)},${n(bodyBottom - radius)}`,
          `V${n(y + radius)}`,
          `A${n(radius)},${n(radius)} 0 0 1 ${n(x + radius)},${n(y)}`,
          "Z"
        ].join(" "),
        details: [],
        boundary: "rect",
        textInset: { x: 8, y: 5 },
        // The tail is not somewhere text can live.
        textBox: { x: 8, y: 5, w: Math.max(w - 16, 4), h: Math.max(bodyBottom - y - 10, 4) }
      };
    }
    case "queue": {
      const rx = Math.min(w * 0.12, 16);
      return {
        path: [
          `M${n(x + rx)},${n(y)}`,
          `H${n(right - rx)}`,
          `A${n(rx)},${n(h / 2)} 0 0 1 ${n(right - rx)},${n(bottom)}`,
          `H${n(x + rx)}`,
          `A${n(rx)},${n(h / 2)} 0 0 1 ${n(x + rx)},${n(y)}`,
          "Z"
        ].join(" "),
        details: [`M${n(right - rx)},${n(y)} A${n(rx)},${n(h / 2)} 0 0 0 ${n(right - rx)},${n(bottom)}`],
        boundary: "rect",
        textInset: { x: rx + 6, y: 5 }
      };
    }
    case "stored": {
      const rx = Math.min(w * 0.12, 16);
      return {
        path: [
          `M${n(x + rx)},${n(y)}`,
          `H${n(right)}`,
          `A${n(rx)},${n(h / 2)} 0 0 0 ${n(right)},${n(bottom)}`,
          `H${n(x + rx)}`,
          `A${n(rx)},${n(h / 2)} 0 0 1 ${n(x + rx)},${n(y)}`,
          "Z"
        ].join(" "),
        details: [],
        boundary: "rect",
        textInset: { x: rx + 6, y: 5 }
      };
    }
    case "triangle": {
      return {
        path: poly([
          [midX, y],
          [right, bottom],
          [x, bottom]
        ]),
        details: [],
        boundary: "rect",
        // A triangle's usable width is only the lower half of it.
        textInset: { x: w * 0.24, y: h * 0.42 }
      };
    }
    case "text": {
      return {
        path: roundedRectPath(r2, 0),
        details: [],
        boundary: "rect",
        textInset: { x: 2, y: 2 }
      };
    }
    default:
      return rect(cornerRadius);
  }
}
function personRect(rect, label, fontSize) {
  const labelW = measureText(label, fontSize, 500) + 10;
  const strip = fontSize + 10;
  const w = Math.max(rect.w, labelW);
  return { x: rect.x - (w - rect.w) / 2, y: rect.y, w, h: rect.h + strip };
}
function isUnpainted(shape) {
  return shape === "text";
}
function boundaryFor(shape) {
  switch (shape) {
    case "circle":
    case "ellipse":
    case "cloud":
      return "ellipse";
    case "diamond":
      return "diamond";
    default:
      return "rect";
  }
}

// ../../src/core/engines/types.ts
function fingerprint(kind, label, ordinal) {
  return `${kind}:${label.trim().replace(/\s+/g, " ")}:${ordinal}`;
}
function makeFingerprinter() {
  const seen = /* @__PURE__ */ new Map();
  return (kind, label) => {
    const key = `${kind}:${label.trim().replace(/\s+/g, " ")}`;
    const n4 = seen.get(key) ?? 0;
    seen.set(key, n4 + 1);
    return fingerprint(kind, label, n4);
  };
}

// ../../src/core/engines/d2.ts
var instance = null;
async function loadD2() {
  if (!instance) {
    instance = import("@terrastruct/d2").then((m) => new m.D2());
  }
  return instance;
}
var SHAPE_MAP = {
  rectangle: "rect",
  square: "rect",
  page: "page",
  parallelogram: "parallelogram",
  document: "doc",
  cylinder: "cylinder",
  queue: "queue",
  package: "package",
  step: "step",
  callout: "callout",
  stored_data: "stored",
  person: "person",
  diamond: "diamond",
  oval: "ellipse",
  circle: "circle",
  hexagon: "hexagon",
  cloud: "cloud",
  text: "text",
  code: "rect",
  class: "rect",
  sql_table: "rect",
  image: "rect",
  sequence_diagram: "rect"
};
var ARROW_MAP = {
  none: "none",
  arrow: "arrow",
  triangle: "arrow",
  "unfilled-triangle": "open",
  diamond: "odiamond",
  "filled-diamond": "diamond",
  circle: "odot",
  "filled-circle": "dot",
  box: "odot",
  "filled-box": "dot",
  line: "open",
  // Crow's-foot notation, which ZDraft does not draw natively. An open head is
  // the honest approximation: it says "this end is not a plain arrow" without
  // pretending to a cardinality it cannot show.
  "cf-one": "open",
  "cf-many": "open",
  "cf-one-required": "open",
  "cf-many-required": "open"
};
function mapArrow(name) {
  return ARROW_MAP[name ?? "none"] ?? "arrow";
}
function visibilityMark(visibility) {
  switch (visibility) {
    case "private":
      return "-";
    case "protected":
      return "#";
    default:
      return "+";
  }
}
function bodyFor(shape) {
  const label = shape.label || shape.id.slice(shape.id.lastIndexOf(".") + 1);
  if (shape.type === "class") {
    const sections = [];
    const fields = (shape.fields ?? []).map(
      (f) => `${visibilityMark(f.visibility)}${f.name}${f.type ? `: ${f.type}` : ""}`
    );
    const methods = (shape.methods ?? []).map(
      (m) => `${visibilityMark(m.visibility)}${m.name}${m.return ? `: ${m.return}` : ""}`
    );
    if (fields.length > 0) sections.push({ items: fields });
    if (methods.length > 0) sections.push({ items: methods });
    return { kind: "compartments", title: label, sections };
  }
  if (shape.type === "sql_table") {
    const items = (shape.columns ?? []).map((c) => {
      const marks = (c.constraint ?? []).map((k) => k === "primary_key" ? "PK" : k === "foreign_key" ? "FK" : k.toUpperCase()).join(" ");
      const type = c.type?.label ? `: ${c.type.label}` : "";
      return `${marks ? `${marks} ` : ""}${c.name?.label ?? ""}${type}`;
    });
    return {
      kind: "compartments",
      title: label,
      stereotype: "table",
      sections: items.length > 0 ? [{ items }] : []
    };
  }
  return { kind: "label", text: label };
}
function explicitColor(value) {
  if (!value) return void 0;
  if (/^(N|B|AA|AB)\d+$/.test(value)) return void 0;
  return value;
}
function styleOf(shape) {
  const fill = "fill" in shape ? explicitColor(shape.fill) : void 0;
  const stroke = explicitColor(shape.stroke);
  const dashed = (shape.strokeDash ?? 0) > 0;
  const className = "classes" in shape ? shape.classes?.[0] : void 0;
  if (!fill && !stroke && !dashed && !className) return void 0;
  return { fill, stroke, dashed: dashed || void 0, className };
}
function rectOf(shape, label) {
  const base = { x: shape.pos.x, y: shape.pos.y, w: shape.width, h: shape.height };
  return shape.type === "person" ? personRect(base, label, DEFAULT_FONT_SIZE) : base;
}
function containerIds(shapes) {
  const ids = new Set(shapes.map((s) => s.id));
  const containers = /* @__PURE__ */ new Set();
  for (const shape of shapes) {
    const cut = shape.id.lastIndexOf(".");
    if (cut < 0) continue;
    const parent = shape.id.slice(0, cut);
    if (ids.has(parent)) containers.add(parent);
  }
  return containers;
}
function parentOf(id, containers) {
  const cut = id.lastIndexOf(".");
  if (cut < 0) return void 0;
  const parent = id.slice(0, cut);
  return containers.has(parent) ? parent : void 0;
}
function sceneFromD2(diagram, source) {
  const locate = locateD2(source);
  const fp = makeFingerprinter();
  const shapes = diagram.shapes ?? [];
  const containers = containerIds(shapes);
  const nodes = [];
  const clusters = [];
  for (const shape of shapes) {
    if (/-lifeline-end-\d+$/.test(shape.id)) continue;
    const parent = parentOf(shape.id, containers);
    const label = shape.label || shape.id.slice(shape.id.lastIndexOf(".") + 1);
    if (containers.has(shape.id)) {
      clusters.push({
        id: shape.id,
        label: label || void 0,
        rect: rectOf(shape, label),
        parent,
        style: styleOf(shape),
        sourceRange: locate.nodes.get(shape.id)
      });
      continue;
    }
    nodes.push({
      id: shape.id,
      body: bodyFor(shape),
      shape: SHAPE_MAP[shape.type] ?? "rect",
      rect: rectOf(shape, label),
      fingerprint: fp(shape.type || "shape", label),
      parent,
      style: styleOf(shape),
      sourceRange: locate.nodes.get(shape.id)
    });
  }
  const edges = [];
  const pairSeen = /* @__PURE__ */ new Map();
  for (const connection of diagram.connections ?? []) {
    if (/-lifeline-end-\d+$/.test(connection.dst)) continue;
    const points2 = (connection.route ?? []).map((p) => ({ x: p.x, y: p.y }));
    if (points2.length < 2) continue;
    const pair = `${connection.src}->${connection.dst}`;
    const ordinal = pairSeen.get(pair) ?? 0;
    pairSeen.set(pair, ordinal + 1);
    const id = edgeId(connection.src, connection.dst, ordinal);
    const spline = connection.isCurve !== false && points2.length >= 4 && points2.length % 3 === 1;
    edges.push({
      id,
      from: connection.src,
      to: connection.dst,
      route: spline ? { kind: "spline", points: points2 } : { kind: "poly", points: points2 },
      arrowStart: points2[0],
      arrowEnd: points2[points2.length - 1],
      startArrow: mapArrow(connection.srcArrow),
      endArrow: mapArrow(connection.dstArrow),
      label: connection.label ? { text: connection.label, at: labelPoint(points2, connection.labelPercentage) } : void 0,
      style: styleOf(connection),
      sourceRange: locate.edges.get(id)
    });
  }
  return {
    family: "graph",
    engine: "d2",
    diagramType: "d2",
    direction: detectDirection(source),
    nodes,
    edges,
    clusters,
    bounds: boundsOf(nodes, clusters, edges)
  };
}
function labelPoint(points2, percentage) {
  const t = percentage && percentage > 0 && percentage <= 1 ? percentage : 0.5;
  let total = 0;
  for (let i = 1; i < points2.length; i += 1) {
    total += Math.hypot(points2[i].x - points2[i - 1].x, points2[i].y - points2[i - 1].y);
  }
  if (total === 0) return points2[0] ?? { x: 0, y: 0 };
  let walked = 0;
  const want = total * t;
  for (let i = 1; i < points2.length; i += 1) {
    const a = points2[i - 1];
    const b = points2[i];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (walked + length >= want) {
      const along = length === 0 ? 0 : (want - walked) / length;
      return { x: a.x + (b.x - a.x) * along, y: a.y + (b.y - a.y) * along };
    }
    walked += length;
  }
  return points2[points2.length - 1];
}
function boundsOf(nodes, clusters, edges) {
  const rects = [...nodes.map((n4) => n4.rect), ...clusters.map((c) => c.rect)];
  for (const edge of edges) {
    for (const p of edge.route.points) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const box = unionRects(rects);
  const pad = 12;
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}
function detectDirection(source) {
  const match = /^\s*direction\s*:\s*(right|left|down|up)\b/m.exec(source);
  switch (match?.[1]) {
    case "right":
      return "LR";
    case "left":
      return "RL";
    case "up":
      return "BT";
    default:
      return "TB";
  }
}
function diagnosticsFromD2Error(err, source) {
  const raw = err instanceof Error ? err.message : String(err);
  const parsed = parseD2Errors(raw);
  if (parsed.length === 0) {
    return [{ severity: "error", message: cleanMessage(raw) }];
  }
  const starts = lineStarts(source);
  return parsed.map(({ message, at }) => {
    const range = at ? toRange(starts, source.length, at) : void 0;
    const where2 = range ? lineColumnAt(source, range.from) : void 0;
    return {
      severity: "error",
      message: cleanMessage(message),
      range,
      line: where2?.line,
      column: where2?.column
    };
  });
}
function lineStarts(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) {
    if (source[i] === "\n") starts.push(i + 1);
  }
  return starts;
}
function toRange(starts, length, at) {
  const offset = (line, column) => Math.min(length, (starts[Math.min(line, starts.length - 1)] ?? 0) + column);
  const from = offset(at.fromLine, at.fromCol);
  return { from, to: Math.max(from, offset(at.toLine, at.toCol)) };
}
function parseD2Errors(raw) {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  let list;
  try {
    list = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.filter((e) => typeof e?.errmsg === "string").map((e) => ({ message: e.errmsg, at: parsePosition(e.range) }));
}
function parsePosition(range) {
  if (!range) return void 0;
  const match = /(\d+):(\d+):\d+-(\d+):(\d+):\d+$/.exec(range);
  if (!match) return void 0;
  return {
    fromLine: Number(match[1]),
    fromCol: Number(match[2]),
    toLine: Number(match[3]),
    toCol: Number(match[4])
  };
}
function cleanMessage(message) {
  return message.replace(/^[^:]*:\d+:\d+:\s*/, "").trim() || message.trim();
}
function emptyScene() {
  return {
    family: "graph",
    engine: "d2",
    diagramType: "d2",
    direction: "TB",
    nodes: [],
    edges: [],
    clusters: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 }
  };
}
var d2Adapter = {
  id: "d2",
  label: "D2",
  extensions: [".d2"],
  /* D2 has one renderer for everything it draws. Its `shape: sequence_diagram`
     is laid out by D2 itself as boxes and arrows, so it arrives here as a
     graph — which is what it is, geometrically. */
  detectFamily() {
    return "graph";
  },
  async layout(source, opts = {}) {
    const d2 = await loadD2();
    let compiled;
    try {
      compiled = await d2.compile(source, {
        // ELK is the better router for anything with containers; dagre is
        // faster and is what D2 itself defaults to.
        layout: opts.layoutProgram === "elk" ? "elk" : "dagre",
        pad: 0
      });
    } catch (err) {
      return { scene: emptyScene(), diagnostics: diagnosticsFromD2Error(err, source) };
    }
    const scene = sceneFromD2(compiled.diagram, source);
    const diagnostics = [];
    if (scene.nodes.length === 0 && scene.clusters.length === 0) {
      diagnostics.push({ severity: "info", message: "This diagram has no shapes yet." });
    }
    return { scene, diagnostics };
  },
  locate(source) {
    return locateD2(source);
  }
};

// ../../src/core/engines/graphviz.ts
import { Graphviz } from "@hpcc-js/wasm-graphviz";

// ../../src/core/locate/dot.ts
var KEYWORDS = /* @__PURE__ */ new Set(["graph", "digraph", "subgraph", "node", "edge", "strict"]);
var ID_START = /[A-Za-z_-￿]/;
var ID_CHAR = /[A-Za-z0-9_-￿]/;
function tokenizeDot(source) {
  const tokens = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "#") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === '"') {
      const from = i;
      i++;
      while (i < source.length) {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === '"') {
          i++;
          break;
        }
        i++;
      }
      tokens.push({ kind: "id", value: source.slice(from + 1, i - 1), from, to: i });
      continue;
    }
    if (ch === "<") {
      const from = i;
      let depth = 0;
      while (i < source.length) {
        if (source[i] === "<") depth++;
        else if (source[i] === ">") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        i++;
      }
      tokens.push({ kind: "id", value: source.slice(from, i), from, to: i });
      continue;
    }
    if (ch === "-" && (source[i + 1] === ">" || source[i + 1] === "-")) {
      tokens.push({ kind: "edgeop", value: source.slice(i, i + 2), from: i, to: i + 2 });
      i += 2;
      continue;
    }
    if (/[0-9]/.test(ch) || ch === "." && /[0-9]/.test(source[i + 1] ?? "")) {
      const from = i;
      while (i < source.length && /[0-9.]/.test(source[i])) i++;
      tokens.push({ kind: "id", value: source.slice(from, i), from, to: i });
      continue;
    }
    if (ID_START.test(ch)) {
      const from = i;
      while (i < source.length && ID_CHAR.test(source[i])) i++;
      tokens.push({ kind: "id", value: source.slice(from, i), from, to: i });
      continue;
    }
    tokens.push({ kind: "punct", value: ch, from: i, to: i + 1 });
    i++;
  }
  return tokens;
}
function skipAttrList(tokens, start) {
  let depth = 0;
  let i = start;
  let end = tokens[start]?.to ?? 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    if (tok.value === "[") depth++;
    if (tok.value === "]") {
      depth--;
      end = tok.to;
      if (depth === 0) return { next: i + 1, end };
    }
    i++;
  }
  return { next: i, end };
}
function locateDot(source) {
  const tokens = tokenizeDot(source);
  const nodes = /* @__PURE__ */ new Map();
  const edges = /* @__PURE__ */ new Map();
  const pairSeen = /* @__PURE__ */ new Map();
  const declare = (name, from, to) => {
    if (!nodes.has(name)) nodes.set(name, { from, to });
  };
  const skipPorts = (i2) => {
    while (tokens[i2]?.value === ":" && tokens[i2 + 1]?.kind === "id") i2 += 2;
    return i2;
  };
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t.kind === "punct" && t.value === "[") {
      i = skipAttrList(tokens, i).next;
      continue;
    }
    if (t.kind !== "id") {
      i++;
      continue;
    }
    const lower = t.value.toLowerCase();
    if (lower === "subgraph") {
      const next = tokens[i + 1];
      if (next?.kind === "id") {
        declare(next.value, next.from, next.to);
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (KEYWORDS.has(lower)) {
      if ((lower === "graph" || lower === "digraph") && tokens[i + 1]?.kind === "id") {
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (tokens[i + 1]?.value === "=") {
      i += 3;
      continue;
    }
    const statementFrom = t.from;
    let prev = t;
    declare(prev.value, prev.from, prev.to);
    i = skipPorts(i + 1);
    let sawEdge = false;
    const chain = [];
    while (tokens[i]?.kind === "edgeop") {
      const target = tokens[i + 1];
      if (!target || target.kind !== "id" && target.value !== "{") {
        i++;
        break;
      }
      sawEdge = true;
      if (target.value === "{") {
        i += 2;
        const fanned = [];
        while (i < tokens.length && tokens[i].value !== "}") {
          const tok = tokens[i];
          if (tok.kind === "id") {
            declare(tok.value, tok.from, tok.to);
            fanned.push(tok);
          }
          i++;
        }
        i++;
        for (const f of fanned) chain.push({ from: prev.value, to: f.value });
        break;
      }
      declare(target.value, target.from, target.to);
      chain.push({ from: prev.value, to: target.value });
      prev = target;
      i = skipPorts(i + 2);
    }
    let statementTo = prev.to;
    if (tokens[i]?.value === "[") {
      const skipped = skipAttrList(tokens, i);
      statementTo = skipped.end;
      i = skipped.next;
    }
    if (sawEdge) {
      for (const link of chain) {
        const key = `${link.from}->${link.to}`;
        const ordinal = pairSeen.get(key) ?? 0;
        pairSeen.set(key, ordinal + 1);
        edges.set(edgeId(link.from, link.to, ordinal), { from: statementFrom, to: statementTo });
      }
    } else {
      const existing = nodes.get(t.value);
      if (existing && existing.from === statementFrom && statementTo > existing.to) {
        nodes.set(t.value, { from: statementFrom, to: statementTo });
      }
    }
  }
  return { nodes, edges };
}

// ../../src/core/edit/types.ts
function spliceAll(source, edits) {
  const ordered = [...edits].sort((a, b) => a.range.from - b.range.from);
  let out = source;
  let shift = 0;
  const changed = [];
  for (const edit of ordered) {
    const from = edit.range.from + shift;
    const to = edit.range.to + shift;
    out = out.slice(0, from) + edit.text + out.slice(to);
    changed.push({ from, to: from + edit.text.length });
    shift += edit.text.length - (edit.range.to - edit.range.from);
  }
  return { source: out, changed };
}

// ../../src/core/edit/dot.ts
var KEYWORDS2 = /* @__PURE__ */ new Set(["graph", "digraph", "subgraph", "node", "edge", "strict"]);
var ID_VALUED = /* @__PURE__ */ new Set(["ltail", "lhead", "root"]);
var SHAPE_WORDS = {
  rect: "box",
  round: "box",
  stadium: "box",
  circle: "circle",
  ellipse: "ellipse",
  diamond: "diamond",
  hexagon: "hexagon",
  parallelogram: "parallelogram",
  trapezoid: "trapezium",
  cylinder: "cylinder",
  note: "note",
  folder: "folder",
  doc: "note",
  subroutine: "component",
  triangle: "triangle",
  step: "house",
  package: "box3d",
  text: "plaintext"
};
var SHAPES = Object.keys(SHAPE_WORDS);
function idOccurrences(source, id) {
  const tokens = tokenizeDot(source);
  const out = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind !== "id" || token.value !== id) continue;
    if (KEYWORDS2.has(token.value.toLowerCase())) continue;
    const before = tokens[i - 1];
    if (before?.value === "=") {
      const name = tokens[i - 2];
      if (!name || !ID_VALUED.has(name.value.toLowerCase())) continue;
    }
    const after = tokens[i + 1];
    if (after?.value === "=" && insideAttrList(tokens, i)) continue;
    out.push({ from: token.from, to: token.to });
  }
  return out;
}
function insideAttrList(tokens, index) {
  let depth = 0;
  for (let i = index; i >= 0; i -= 1) {
    const value = tokens[i].value;
    if (value === "]") depth += 1;
    if (value === "[") {
      if (depth === 0) return true;
      depth -= 1;
    }
  }
  return false;
}
function attrListOf(source, id) {
  const tokens = tokenizeDot(source);
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind !== "id" || token.value !== id) continue;
    if (KEYWORDS2.has(token.value.toLowerCase())) continue;
    const next = tokens[i + 1];
    if (next?.value !== "[") continue;
    const previous = tokens[i - 1];
    if (previous?.kind === "edgeop") continue;
    let depth = 0;
    for (let j = i + 1; j < tokens.length; j += 1) {
      if (tokens[j].value === "[") depth += 1;
      if (tokens[j].value === "]") {
        depth -= 1;
        if (depth === 0) {
          return {
            open: next.to,
            close: tokens[j].from,
            declaration: { from: token.from, to: token.to }
          };
        }
      }
    }
  }
  return null;
}
function attributeIn(source, open, close, name) {
  const tokens = tokenizeDot(source.slice(open, close));
  for (let i = 0; i < tokens.length; i += 1) {
    if (tokens[i].kind !== "id" || tokens[i].value.toLowerCase() !== name) continue;
    if (tokens[i + 1]?.value !== "=") continue;
    const value = tokens[i + 2];
    if (!value) return null;
    return { value: { from: open + value.from, to: open + value.to } };
  }
  return null;
}
function asId(value) {
  return /^[A-Za-z_\u0080-\uffff][A-Za-z0-9_\u0080-\uffff]*$/.test(value) ? value : `"${value.replace(/(["\\])/g, "\\$1")}"`;
}
function quoted(value) {
  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
}
function insertAttribute(source, id, text) {
  const list = attrListOf(source, id);
  if (list) {
    const body = source.slice(list.open, list.close).trim();
    return {
      range: { from: list.open, to: list.close },
      text: body === "" ? text : `${body}, ${text}`
    };
  }
  const occurrences = idOccurrences(source, id);
  const first = occurrences[0];
  if (!first) return null;
  return { range: { from: first.to, to: first.to }, text: ` [${text}]` };
}
function indentAt(source, at) {
  const lineStart = source.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? "";
}
function freeClusterName(source, title) {
  const base = `cluster_${title.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_|_$/g, "") || "group"}`;
  if (!new RegExp(`\\b${base}\\b`).test(source)) return base;
  for (let n4 = 2; ; n4 += 1) {
    const candidate = `${base}_${n4}`;
    if (!new RegExp(`\\b${candidate}\\b`).test(source)) return candidate;
  }
}
var DOT_KNOBS = [
  {
    id: "rankdir",
    label: "Direction",
    note: "Which way the ranks run. The single biggest change to how a graph reads.",
    kind: "choice",
    fallback: "TB",
    choices: [
      { value: "TB", label: "Top to bottom" },
      { value: "LR", label: "Left to right" },
      { value: "BT", label: "Bottom to top" },
      { value: "RL", label: "Right to left" }
    ]
  },
  {
    id: "nodesep",
    label: "Node gap",
    note: "Inches between nodes on the same rank.",
    kind: "number",
    fallback: "0.25",
    min: 0.05,
    max: 3,
    step: 0.05
  },
  {
    id: "ranksep",
    label: "Rank gap",
    note: "Inches between one rank and the next.",
    kind: "number",
    fallback: "0.5",
    min: 0.05,
    max: 4,
    step: 0.05
  },
  {
    id: "splines",
    label: "Edges",
    note: "How edges are drawn. Orthogonal suits architecture; curved suits state machines.",
    kind: "choice",
    fallback: "spline",
    choices: [
      { value: "spline", label: "Splines" },
      { value: "ortho", label: "Orthogonal" },
      { value: "polyline", label: "Polyline" },
      { value: "curved", label: "Curved" },
      { value: "line", label: "Straight" }
    ]
  },
  {
    id: "concentrate",
    label: "Merge edges",
    note: "Draws parallel edges as one where it can. Tidies a hub with a dozen arrows into it.",
    kind: "choice",
    fallback: "false",
    choices: [
      { value: "false", label: "No" },
      { value: "true", label: "Yes" }
    ]
  }
];
function graphAttribute(source, name) {
  const tokens = tokenizeDot(source);
  let depth = 0;
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token.kind === "punct" && token.value === "{") depth += 1;
    else if (token.kind === "punct" && token.value === "}") depth -= 1;
    if (depth !== 1 || token.kind !== "id") continue;
    if (token.value.toLowerCase() !== name) continue;
    if (insideAttrList(tokens, i)) continue;
    const equals = tokens[i + 1];
    const value = tokens[i + 2];
    if (equals?.kind !== "punct" || equals.value !== "=" || !value) continue;
    return {
      value: { from: value.from, to: value.to },
      whole: { from: token.from, to: value.to }
    };
  }
  return null;
}
var dotTuner = {
  knobs: DOT_KNOBS,
  read(source) {
    const out = {};
    for (const knob of DOT_KNOBS) {
      const found = graphAttribute(source, knob.id);
      if (found) out[knob.id] = unquote(source.slice(found.value.from, found.value.to));
    }
    return out;
  },
  set(source, knob, value) {
    const spec = DOT_KNOBS.find((k) => k.id === knob);
    if (!spec) return null;
    const existing = graphAttribute(source, knob);
    const text = asId(value);
    if (value === spec.fallback) {
      if (!existing) return { source, changed: [], label: `Set ${knob}` };
      const line = lineAround(source, existing.whole);
      const { source: out2, changed: changed2 } = spliceAll(source, [{ range: line, text: "" }]);
      return { source: out2, changed: changed2, label: `Reset ${knob}` };
    }
    if (existing) {
      const { source: out2, changed: changed2 } = spliceAll(source, [
        { range: existing.value, text }
      ]);
      return { source: out2, changed: changed2, label: `Set ${knob} to ${value}` };
    }
    const open = source.indexOf("{");
    if (open < 0) return null;
    const indent = indentAt(source, source.indexOf("\n", open) + 1) || "  ";
    const { source: out, changed } = spliceAll(source, [
      { range: { from: open + 1, to: open + 1 }, text: `
${indent}${knob}=${text};` }
    ]);
    return { source: out, changed, label: `Set ${knob} to ${value}` };
  }
};
function lineAround(source, range) {
  let from = range.from;
  while (from > 0 && source[from - 1] !== "\n") {
    if (!/\s/.test(source[from - 1])) return { from: range.from, to: semicolonAfter(source, range.to) };
    from -= 1;
  }
  let to = semicolonAfter(source, range.to);
  while (to < source.length && source[to] !== "\n" && /\s/.test(source[to])) to += 1;
  if (source[to] === "\n") to += 1;
  return { from, to };
}
function semicolonAfter(source, at) {
  let to = at;
  while (to < source.length && /[ \t]/.test(source[to])) to += 1;
  return source[to] === ";" ? to + 1 : at;
}
function unquote(value) {
  const trimmed = value.trim();
  return trimmed.startsWith('"') && trimmed.endsWith('"') ? trimmed.slice(1, -1).replace(/\\"/g, '"') : trimmed;
}
var dotEditor = {
  shapes: SHAPES,
  tuning: dotTuner,
  idProblem(name) {
    const trimmed = name.trim();
    if (trimmed === "") return "A name is needed.";
    if (KEYWORDS2.has(trimmed.toLowerCase())) return `\u201C${trimmed}\u201D is a DOT keyword.`;
    if (/[{}[\];,=]/.test(trimmed)) return "A DOT id cannot contain { } [ ] ; , or =.";
    if (/^[0-9]/.test(trimmed)) return "A DOT id cannot start with a digit.";
    return null;
  },
  rename(source, id, next) {
    const trimmed = next.trim();
    if (trimmed === "" || trimmed === id) return null;
    const occurrences = idOccurrences(source, id);
    if (occurrences.length === 0) return null;
    const text = asId(trimmed);
    const { source: out, changed } = spliceAll(
      source,
      occurrences.map((range) => ({ range, text }))
    );
    return { source: out, changed, label: `Rename ${id} to ${trimmed}` };
  },
  setLabel(source, id, next) {
    const list = attrListOf(source, id);
    if (list) {
      const existing = attributeIn(source, list.open, list.close, "label");
      if (existing) {
        const { source: out2, changed: changed2 } = spliceAll(source, [
          { range: existing.value, text: quoted(next) }
        ]);
        return { source: out2, changed: changed2, label: `Relabel ${id}` };
      }
    }
    const insert = insertAttribute(source, id, `label=${quoted(next)}`);
    if (!insert) return null;
    const { source: out, changed } = spliceAll(source, [insert]);
    return { source: out, changed, label: `Relabel ${id}` };
  },
  group(source, ids, title) {
    if (ids.length === 0) return null;
    const close = source.lastIndexOf("}");
    if (close < 0) return null;
    const name = freeClusterName(source, title);
    const indent = indentAt(source, close) + "  ";
    const inner = ids.map((id) => `${indent}  ${asId(id)};`).join("\n");
    const block = `
${indent}subgraph ${name} {
${indent}  label=${quoted(title)};
${inner}
${indent}}
`;
    const { source: out, changed } = spliceAll(source, [
      { range: { from: close, to: close }, text: block }
    ]);
    return { source: out, changed, label: `Group ${ids.length} nodes` };
  },
  setShape(source, id, next) {
    const word = SHAPE_WORDS[next];
    if (!word) return null;
    const list = attrListOf(source, id);
    if (list) {
      const existing = attributeIn(source, list.open, list.close, "shape");
      if (existing) {
        const { source: out2, changed: changed2 } = spliceAll(source, [
          { range: existing.value, text: word }
        ]);
        return { source: out2, changed: changed2, label: `Reshape ${id}` };
      }
    }
    const insert = insertAttribute(source, id, `shape=${word}`);
    if (!insert) return null;
    const { source: out, changed } = spliceAll(source, [insert]);
    return { source: out, changed, label: `Reshape ${id}` };
  }
};

// ../../src/core/engines/graphviz.ts
var graphvizPromise = null;
function loadGraphviz() {
  graphvizPromise ??= Graphviz.load();
  return graphvizPromise;
}
var POINTS_PER_INCH = 72;
function parseNumbers(s) {
  if (!s) return [];
  return s.split(",").map((v) => Number(v.trim())).filter((v) => Number.isFinite(v));
}
function makeFlip(bb) {
  const [, y0 = 0, , y1 = 0] = bb;
  const sum = y0 + y1;
  return (y) => sum - y;
}
function parsePoint(token, flip) {
  const [x, y] = token.split(",").map(Number);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y: flip(y) };
}
function parseEdgePos(pos, flip) {
  const points2 = [];
  let arrowStart;
  let arrowEnd;
  for (const token of (pos ?? "").trim().split(/\s+/).filter(Boolean)) {
    if (token.startsWith("e,")) {
      arrowEnd = parsePoint(token.slice(2), flip) ?? void 0;
    } else if (token.startsWith("s,")) {
      arrowStart = parsePoint(token.slice(2), flip) ?? void 0;
    } else {
      const p = parsePoint(token, flip);
      if (p) points2.push(p);
    }
  }
  const kind = points2.length >= 4 && (points2.length - 1) % 3 === 0 ? "spline" : "poly";
  return { route: { kind, points: points2 }, arrowStart, arrowEnd };
}
function resolveLabel(raw, name) {
  if (raw === void 0) return name;
  return raw.replace(/\\N/g, name).replace(/\\G/g, "").replace(/\\[lrn]/g, "\n").replace(/\\"/g, '"').trim();
}
var SHAPE_MAP2 = {
  box: "rect",
  rect: "rect",
  rectangle: "rect",
  square: "rect",
  polygon: "rect",
  ellipse: "ellipse",
  oval: "ellipse",
  circle: "circle",
  doublecircle: "circle",
  point: "circle",
  egg: "ellipse",
  triangle: "diamond",
  diamond: "diamond",
  mdiamond: "diamond",
  msquare: "rect",
  hexagon: "hexagon",
  octagon: "hexagon",
  parallelogram: "parallelogram",
  trapezium: "trapezoid",
  invtrapezium: "trapezoid",
  house: "hexagon",
  cylinder: "cylinder",
  note: "note",
  folder: "folder",
  tab: "folder",
  component: "subroutine",
  box3d: "subroutine",
  plaintext: "rect",
  plain: "rect",
  none: "rect",
  record: "rect",
  mrecord: "round"
};
function mapShape(shape) {
  if (!shape) return "ellipse";
  return SHAPE_MAP2[shape.toLowerCase()] ?? "rect";
}
function parseRecordLabel(raw) {
  let body = raw.trim();
  if (body.startsWith("{") && body.endsWith("}")) {
    body = body.slice(1, -1);
  }
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "\\") {
      current += ch + (body[i + 1] ?? "");
      i++;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (ch === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  parts.push(current);
  const clean = (s) => s.replace(/[{}]/g, "").split(/\\[lrn]/).map((line) => line.replace(/<[^>]*>/g, "").trim()).filter(Boolean);
  const [first, ...rest] = parts;
  const titleLines = clean(first ?? "");
  return {
    kind: "compartments",
    title: titleLines.join(" ") || "",
    sections: rest.map((p) => ({ items: clean(p) })).filter((s) => s.items.length > 0)
  };
}
function mapArrow2(name, fallback) {
  if (!name) return fallback;
  switch (name.toLowerCase()) {
    case "none":
      return "none";
    case "normal":
    case "vee":
      return "arrow";
    case "open":
    case "halfopen":
      return "open";
    case "dot":
      return "dot";
    case "odot":
      return "odot";
    case "diamond":
      return "diamond";
    case "odiamond":
      return "odiamond";
    case "tee":
    case "crow":
      return "cross";
    default:
      return fallback;
  }
}
function styleOf2(o) {
  const styles = (o.style ?? "").split(",").map((s) => s.trim().toLowerCase());
  const style = {
    fill: o.fillcolor,
    stroke: o.color,
    text: o.fontcolor,
    strokeWidth: o.penwidth ? Number(o.penwidth) : void 0,
    dashed: styles.includes("dashed") || styles.includes("dotted"),
    className: o.class
  };
  return Object.values(style).some((v) => v !== void 0 && v !== false) ? style : void 0;
}
function diagnosticFromError(err, source) {
  const message = err instanceof Error ? err.message : String(err);
  const lineMatch = /line\s+(\d+)/i.exec(message);
  const line = lineMatch ? Number(lineMatch[1]) : void 0;
  return {
    severity: "error",
    message: message.replace(/^Error:\s*/, "").trim() || "Graphviz could not lay out this diagram.",
    line: line && line > 0 ? line : void 0,
    column: line ? lineColumnAt(source, 0).column : void 0
  };
}
function directionOf(rankdir) {
  switch ((rankdir ?? "TB").toUpperCase()) {
    case "LR":
      return "LR";
    case "RL":
      return "RL";
    case "BT":
      return "BT";
    default:
      return "TB";
  }
}
function sceneFromGraphvizJson(raw, source) {
  const bb = parseNumbers(raw.bb);
  const [x0 = 0, , x1 = 0] = bb;
  const flip = makeFlip(bb);
  const bounds = {
    x: x0,
    y: 0,
    w: Math.max(x1 - x0, 0),
    h: Math.max((bb[3] ?? 0) - (bb[1] ?? 0), 0)
  };
  const objects = raw.objects ?? [];
  const byGvid = /* @__PURE__ */ new Map();
  for (const o of objects) byGvid.set(o._gvid, o);
  const fp = makeFingerprinter();
  const nodes = [];
  const clusters = [];
  const locate = locateDot(source);
  for (const o of objects) {
    if (o.bb !== void 0 && o.pos === void 0) {
      const cb = parseNumbers(o.bb);
      const [cx0 = 0, cy0 = 0, cx1 = 0, cy1 = 0] = cb;
      clusters.push({
        id: o.name,
        label: o.label ? resolveLabel(o.label, o.name) : void 0,
        rect: { x: cx0, y: flip(cy1), w: cx1 - cx0, h: cy1 - cy0 },
        style: styleOf2(o),
        sourceRange: locate.nodes.get(o.name)
      });
      continue;
    }
    if (o.pos === void 0) continue;
    const [cx = 0, cy = 0] = parseNumbers(o.pos);
    const w = Number(o.width ?? 0) * POINTS_PER_INCH;
    const h = Number(o.height ?? 0) * POINTS_PER_INCH;
    const shapeName = (o.shape ?? "").toLowerCase();
    const label = resolveLabel(o.label, o.name);
    const body = shapeName === "record" || shapeName === "mrecord" ? parseRecordLabel(o.label ?? o.name) : { kind: "label", text: label };
    nodes.push({
      id: o.name,
      body,
      shape: mapShape(o.shape),
      rect: rectFromCenter(cx, flip(cy), w, h),
      fingerprint: fp(shapeName || "node", label),
      style: styleOf2(o),
      sourceRange: locate.nodes.get(o.name)
    });
  }
  const clusterByName = new Map(clusters.map((c) => [c.id, c]));
  for (const o of objects) {
    if (!o.subgraphs) continue;
    for (const gvid of o.subgraphs) {
      const child = byGvid.get(gvid);
      const cluster = child && clusterByName.get(child.name);
      if (cluster) cluster.parent = o.name;
    }
  }
  const depths = /* @__PURE__ */ new Map();
  for (const cluster of clusters) {
    let depth = 0;
    let parent = cluster.parent;
    while (parent && depth <= clusters.length) {
      depth += 1;
      parent = clusterByName.get(parent)?.parent;
    }
    depths.set(cluster.id, depth);
  }
  const nodeByName = new Map(nodes.map((n4) => [n4.id, n4]));
  const claimedAt = /* @__PURE__ */ new Map();
  for (const o of objects) {
    if (!o.nodes || !clusterByName.has(o.name)) continue;
    const depth = depths.get(o.name) ?? 0;
    for (const gvid of o.nodes) {
      const member = byGvid.get(gvid);
      const node = member && nodeByName.get(member.name);
      if (!node) continue;
      if (node.parent !== void 0 && (claimedAt.get(node.id) ?? -1) >= depth) continue;
      node.parent = o.name;
      claimedAt.set(node.id, depth);
    }
  }
  const edges = [];
  const pairSeen = /* @__PURE__ */ new Map();
  const sortedEdges = [...raw.edges ?? []].sort((a, b) => a._gvid - b._gvid);
  for (const e of sortedEdges) {
    const tail = byGvid.get(e.tail);
    const head = byGvid.get(e.head);
    if (!tail || !head) continue;
    const pairKey = `${tail.name}->${head.name}`;
    const ordinal = pairSeen.get(pairKey) ?? 0;
    pairSeen.set(pairKey, ordinal + 1);
    const { route, arrowStart, arrowEnd } = parseEdgePos(e.pos, flip);
    const id = edgeId(tail.name, head.name, ordinal);
    const labelText = e.label ? resolveLabel(e.label, "") : "";
    const [lx, ly] = parseNumbers(e.lp);
    const bidirectional = e.dir === "both";
    edges.push({
      id,
      from: tail.name,
      to: head.name,
      route,
      arrowStart,
      arrowEnd,
      startArrow: mapArrow2(e.arrowtail, bidirectional ? "arrow" : "none"),
      endArrow: mapArrow2(e.arrowhead, e.dir === "none" ? "none" : "arrow"),
      label: labelText && lx !== void 0 && ly !== void 0 ? { text: labelText, at: { x: lx, y: flip(ly) } } : void 0,
      style: styleOf2(e),
      sourceRange: locate.edges.get(id)
    });
  }
  return {
    family: "graph",
    engine: "graphviz",
    diagramType: raw.directed === false ? "graph" : "digraph",
    direction: directionOf(raw.rankdir),
    nodes,
    edges,
    clusters,
    bounds
  };
}
var graphvizAdapter = {
  id: "graphviz",
  label: "Graphviz",
  extensions: [".dot", ".gv"],
  // DOT describes a graph and nothing else; there is no family to detect.
  detectFamily() {
    return "graph";
  },
  async layout(source, opts = {}) {
    const graphviz = await loadGraphviz();
    const program = opts.layoutProgram ?? "dot";
    let raw;
    try {
      raw = JSON.parse(graphviz.layout(source, "json", program));
    } catch (err) {
      return {
        scene: emptyScene2(),
        diagnostics: [diagnosticFromError(err, source)]
      };
    }
    const scene = sceneFromGraphvizJson(raw, source);
    const diagnostics = [];
    const stray = contentAfterFirstGraph(source);
    if (stray) {
      diagnostics.push({
        severity: "warning",
        message: "Graphviz reads only the first graph in a file, so everything from here down is ignored. `dot` on the command line rejects a file like this outright.",
        range: stray,
        line: lineColumnAt(source, stray.from).line,
        fix: { kind: "goto", range: stray }
      });
    }
    if (scene.nodes.length === 0) {
      diagnostics.push({
        severity: "info",
        message: "This graph has no nodes yet."
      });
    }
    return { scene, diagnostics };
  },
  locate(source) {
    return locateDot(source);
  },
  edit: dotEditor
};
function contentAfterFirstGraph(source) {
  const tokens = tokenizeDot(source);
  let depth = 0;
  let opened = false;
  for (let i = 0; i < tokens.length; i += 1) {
    const value = tokens[i].value;
    if (value === "{") {
      depth += 1;
      opened = true;
    } else if (value === "}") {
      depth -= 1;
      if (opened && depth === 0) {
        const next = tokens[i + 1];
        if (!next) return null;
        return { from: next.from, to: source.length };
      }
    }
  }
  return null;
}
function emptyScene2() {
  return {
    family: "graph",
    engine: "graphviz",
    diagramType: "digraph",
    direction: "TB",
    nodes: [],
    edges: [],
    clusters: [],
    bounds: { x: 0, y: 0, w: 0, h: 0 }
  };
}

// ../../src/core/markdown/index.ts
var FENCE_ENGINES = {
  mermaid: "mermaid",
  mmd: "mermaid",
  dot: "graphviz",
  graphviz: "graphviz",
  gv: "graphviz",
  d2: "d2",
  plantuml: "plantuml",
  puml: "plantuml",
  uml: "plantuml"
};
var MARKER = /^[ \t]*<!--\s*zdraft:\s*([^\s>-][^>]*?)\s*-->[ \t]*$/;
function isMarkdown(name) {
  return /\.(md|markdown|mdx)$/i.test(name);
}
function parseMarkdownBlocks(source) {
  const lines = splitLines(source);
  const blocks = [];
  const ordinals = /* @__PURE__ */ new Map();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const fence = openingFence(line.text);
    if (!fence) {
      i += 1;
      continue;
    }
    const engine = FENCE_ENGINES[fence.info.split(/\s+/)[0]?.toLowerCase() ?? ""];
    if (!engine) {
      i = closeOf(lines, i, fence) + 1;
      continue;
    }
    const close = closeOf(lines, i, fence);
    const bodyFrom = i + 1 < lines.length ? lines[i + 1].offset : line.offset + line.text.length;
    const bodyTo = close < lines.length ? lines[close].offset : source.length;
    const above = i > 0 ? lines[i - 1] : null;
    const name = above ? MARKER.exec(above.text)?.[1]?.trim() : void 0;
    const ordinal = ordinals.get(engine) ?? 0;
    ordinals.set(engine, ordinal + 1);
    blocks.push({
      id: name && name !== "" ? name : `${engine}:${ordinal}`,
      marked: Boolean(name),
      engine,
      info: fence.info,
      // The trailing newline before the closing fence is not part of the
      // diagram, and keeping it would make every round trip grow the file.
      source: trimTrailingNewline(source.slice(bodyFrom, bodyTo)),
      body: { from: bodyFrom, to: bodyTo },
      whole: {
        from: line.offset,
        to: close < lines.length ? lines[close].offset + lines[close].text.length : source.length
      },
      markerAt: line.offset,
      markerRange: name !== void 0 && above ? { from: above.offset, to: above.offset + above.text.length + 1 } : void 0,
      line: i + 1
    });
    i = close + 1;
  }
  return blocks;
}
function openingFence(text) {
  const match = /^( {0,3})(`{3,}|~{3,})(.*)$/.exec(text);
  if (!match) return null;
  const marker = match[2];
  const info = match[3].trim();
  if (marker.startsWith("`") && info.includes("`")) return null;
  return { marker, info, indent: match[1].length };
}
function closeOf(lines, open, fence) {
  const char = fence.marker[0];
  for (let i = open + 1; i < lines.length; i += 1) {
    const match = /^( {0,3})(`{3,}|~{3,})[ \t]*$/.exec(lines[i].text);
    if (!match) continue;
    if (match[2][0] === char && match[2].length >= fence.marker.length) return i;
  }
  return lines.length;
}
function splitLines(source) {
  const out = [];
  let offset = 0;
  for (const text of source.split("\n")) {
    out.push({ text, offset });
    offset += text.length + 1;
  }
  return out;
}
function trimTrailingNewline(text) {
  return text.endsWith("\n") ? text.slice(0, -1) : text;
}

// ../../src/core/route/orthogonal.ts
var DEFAULT_CELL = 12;
var CLEARANCE = 6;
function buildGrid(bounds, obstacles, cell = DEFAULT_CELL, clearance = CLEARANCE) {
  const origin = { x: bounds.x - cell, y: bounds.y - cell };
  const cols = Math.max(1, Math.ceil((bounds.w + cell * 2) / cell) + 1);
  const rows = Math.max(1, Math.ceil((bounds.h + cell * 2) / cell) + 1);
  const blocked = new Uint8Array(cols * rows);
  for (const rect of obstacles) {
    const x0 = Math.floor((rect.x - clearance - origin.x) / cell);
    const y0 = Math.floor((rect.y - clearance - origin.y) / cell);
    const x1 = Math.ceil((rect.x + rect.w + clearance - origin.x) / cell);
    const y1 = Math.ceil((rect.y + rect.h + clearance - origin.y) / cell);
    for (let y = Math.max(0, y0); y < Math.min(rows, y1); y++) {
      for (let x = Math.max(0, x0); x < Math.min(cols, x1); x++) {
        blocked[y * cols + x] = 1;
      }
    }
  }
  return { cell, origin, cols, rows, blocked };
}
function setRectBlocked(grid, rect, value, clearance = CLEARANCE) {
  const x0 = Math.floor((rect.x - clearance - grid.origin.x) / grid.cell);
  const y0 = Math.floor((rect.y - clearance - grid.origin.y) / grid.cell);
  const x1 = Math.ceil((rect.x + rect.w + clearance - grid.origin.x) / grid.cell);
  const y1 = Math.ceil((rect.y + rect.h + clearance - grid.origin.y) / grid.cell);
  for (let y = Math.max(0, y0); y < Math.min(grid.rows, y1); y++) {
    for (let x = Math.max(0, x0); x < Math.min(grid.cols, x1); x++) {
      grid.blocked[y * grid.cols + x] = value;
    }
  }
}
function toCell(grid, p) {
  return {
    x: Math.round((p.x - grid.origin.x) / grid.cell),
    y: Math.round((p.y - grid.origin.y) / grid.cell)
  };
}
function toWorld(grid, x, y) {
  return { x: grid.origin.x + x * grid.cell, y: grid.origin.y + y * grid.cell };
}
function inside(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.cols && y < grid.rows;
}
function clearAround(grid, p, radius = 1) {
  const c = toCell(grid, p);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (inside(grid, x, y)) grid.blocked[y * grid.cols + x] = 0;
    }
  }
}
var TURN_PENALTY = 3;
function hasLineOfSight(grid, a, b) {
  const span = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(1, Math.ceil(span / grid.cell * 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const c = toCell(grid, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    if (!inside(grid, c.x, c.y)) return false;
    if (grid.blocked[c.y * grid.cols + c.x]) return false;
  }
  return true;
}
function pullString(grid, path) {
  if (path.length <= 2) return [...path];
  const out = [path[0]];
  let i = 0;
  while (i < path.length - 1) {
    let furthest = i + 1;
    for (let j = path.length - 1; j > i + 1; j--) {
      if (hasLineOfSight(grid, path[i], path[j])) {
        furthest = j;
        break;
      }
    }
    out.push(path[furthest]);
    i = furthest;
  }
  return out;
}
function routeOrthogonal(grid, from, to, maxExpansions = 2e4) {
  clearAround(grid, from);
  clearAround(grid, to);
  const start = toCell(grid, from);
  const goal = toCell(grid, to);
  if (!inside(grid, start.x, start.y) || !inside(grid, goal.x, goal.y)) return null;
  const { cols, rows, blocked } = grid;
  const size = cols * rows;
  const stateCount = size * 5;
  const gScore = new Float64Array(stateCount).fill(Infinity);
  const cameFrom = new Int32Array(stateCount).fill(-1);
  const closed = new Uint8Array(stateCount);
  const DIRS = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 }
  ];
  const heuristic = (x, y) => Math.abs(x - goal.x) + Math.abs(y - goal.y);
  const stateOf = (x, y, dir) => (y * cols + x) * 5 + dir;
  const startState = stateOf(start.x, start.y, 4);
  gScore[startState] = 0;
  const heap = [{ f: heuristic(start.x, start.y), state: startState }];
  const push2 = (f, state) => {
    heap.push({ f, state });
    let i = heap.length - 1;
    while (i > 0) {
      const parent = i - 1 >> 1;
      if (heap[parent].f <= heap[i].f) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      let i = 0;
      for (; ; ) {
        const l = i * 2 + 1;
        const r2 = l + 1;
        let smallest = i;
        if (l < heap.length && heap[l].f < heap[smallest].f) smallest = l;
        if (r2 < heap.length && heap[r2].f < heap[smallest].f) smallest = r2;
        if (smallest === i) break;
        [heap[smallest], heap[i]] = [heap[i], heap[smallest]];
        i = smallest;
      }
    }
    return top;
  };
  let expansions = 0;
  let goalState = -1;
  while (heap.length > 0) {
    if (++expansions > maxExpansions) return null;
    const { state } = pop();
    if (closed[state]) continue;
    closed[state] = 1;
    const cellIndex = Math.floor(state / 5);
    const dir = state % 5;
    const x = cellIndex % cols;
    const y = Math.floor(cellIndex / cols);
    if (x === goal.x && y === goal.y) {
      goalState = state;
      break;
    }
    for (let d = 0; d < 4; d++) {
      const nx = x + DIRS[d].dx;
      const ny = y + DIRS[d].dy;
      if (!inside(grid, nx, ny) || blocked[ny * cols + nx]) continue;
      const next = stateOf(nx, ny, d);
      if (closed[next]) continue;
      const turn = dir !== 4 && dir !== d ? TURN_PENALTY : 0;
      const tentative = gScore[state] + 1 + turn;
      if (tentative >= gScore[next]) continue;
      gScore[next] = tentative;
      cameFrom[next] = state;
      push2(tentative + heuristic(nx, ny), next);
    }
  }
  if (goalState < 0) return null;
  const cells = [];
  for (let s = goalState; s >= 0; s = cameFrom[s]) {
    const cellIndex = Math.floor(s / 5);
    cells.push(toWorld(grid, cellIndex % cols, Math.floor(cellIndex / cols)));
    if (cameFrom[s] === -1) break;
  }
  cells.reverse();
  const path = [from, ...cells.slice(1, -1), to];
  return simplifyPolyline(pullString(grid, path));
}

// ../../src/core/route/index.ts
var SELF_LOOP_RADIUS = 34;
function directRoute(from, fromShape, to, toShape, waypoints = []) {
  const fromCenter = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
  const toCenter = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
  const firstTarget = waypoints[0] ?? toCenter;
  const lastTarget = waypoints[waypoints.length - 1] ?? fromCenter;
  const start = boundaryPoint(from, firstTarget, fromShape);
  const end = boundaryPoint(to, lastTarget, toShape);
  const points2 = [start, ...waypoints, end];
  return { route: { kind: "poly", points: points2 }, arrowEnd: end, arrowStart: start };
}
function selfLoopRoute(rect) {
  const r2 = SELF_LOOP_RADIUS;
  const start = { x: rect.x + rect.w * 0.68, y: rect.y };
  const end = { x: rect.x + rect.w, y: rect.y + rect.h * 0.32 };
  return {
    route: {
      kind: "spline",
      points: [
        start,
        { x: start.x, y: start.y - r2 },
        { x: end.x + r2, y: end.y - r2 },
        end
      ]
    },
    arrowStart: start,
    arrowEnd: end
  };
}
function rerouteEdges(edges, ctx) {
  const obstacles = [...ctx.nodes.values()].map((n4) => n4.rect);
  const movedRects = [...ctx.moved].map((id) => ctx.nodes.get(id)?.rect).filter((r2) => r2 !== void 0);
  let grid = null;
  const gridFor = () => {
    if (!ctx.bounds) return null;
    grid ??= buildGrid(ctx.bounds, obstacles);
    return grid;
  };
  return edges.map((edge) => {
    const manual = ctx.waypoints?.get(edge.id);
    const touched = ctx.moved.has(edge.from) || ctx.moved.has(edge.to) || manual !== void 0 || // A node dragged on top of this edge is reason enough to redraw it, even
    // though neither of its own endpoints moved.
    crossesAny(edge, movedRects, ctx.moved);
    if (!touched) return edge;
    const from = ctx.nodes.get(edge.from);
    const to = ctx.nodes.get(edge.to);
    if (!from || !to) return edge;
    let routed = edge.from === edge.to ? selfLoopRoute(from.rect) : directRoute(
      from.rect,
      boundaryFor(from.shape),
      to.rect,
      boundaryFor(to.shape),
      manual ?? []
    );
    if (edge.from !== edge.to && !manual?.length) {
      const blockers = [...ctx.nodes.values()].filter(
        (n4) => n4.id !== edge.from && n4.id !== edge.to
      );
      const start = routed.arrowStart;
      const end = routed.arrowEnd;
      if (blockers.some((n4) => segmentIntersectsRect(start, end, n4.rect))) {
        const g = gridFor();
        if (g) {
          setRectBlocked(g, from.rect, 0);
          setRectBlocked(g, to.rect, 0);
          const path = routeOrthogonal(g, start, end);
          setRectBlocked(g, from.rect, 1);
          setRectBlocked(g, to.rect, 1);
          if (path && path.length >= 2) {
            routed = {
              route: { kind: "poly", points: path },
              arrowStart: path[0],
              arrowEnd: path[path.length - 1]
            };
          }
        }
      }
    }
    return {
      ...edge,
      route: routed.route,
      arrowStart: routed.arrowStart,
      arrowEnd: routed.arrowEnd,
      rerouted: true,
      label: edge.label ? { ...edge.label, at: labelAnchor(routed.route) } : void 0
    };
  });
}
function labelAnchor(route) {
  const pts = route.points;
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1) return pts[0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distance(pts[i - 1], pts[i]);
  let remaining = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const seg = distance(a, b);
    if (remaining <= seg || i === pts.length - 1) {
      const t = seg === 0 ? 0 : remaining / seg;
      return {
        x: a.x + (b.x - a.x) * t,
        // Lift the label clear of the line it sits on.
        y: a.y + (b.y - a.y) * t - 8
      };
    }
    remaining -= seg;
  }
  return pts[pts.length - 1];
}
function crossesAny(edge, rects, moved) {
  if (rects.length === 0) return false;
  if (moved.has(edge.from) || moved.has(edge.to)) return false;
  const points2 = edge.route.points;
  for (let i = 1; i < points2.length; i++) {
    for (const rect of rects) {
      if (segmentIntersectsRect(points2[i - 1], points2[i], rect)) return true;
    }
  }
  return false;
}

// ../../src/core/pins/index.ts
var DRIFT_FACTOR = 3;
function applyPins(scene, layout) {
  const pins = layout?.pins ?? {};
  const pinIds = Object.keys(pins);
  if (pinIds.length === 0 && !layout?.edges) {
    return { scene, ghosts: /* @__PURE__ */ new Map(), orphans: [], diagnostics: [] };
  }
  const ghosts = /* @__PURE__ */ new Map();
  const moved = /* @__PURE__ */ new Set();
  const diagnostics = [];
  const byId = new Map(scene.nodes.map((n4) => [n4.id, n4]));
  const nodes = scene.nodes.map((node) => {
    const pin = pins[node.id];
    if (!pin) return node;
    const auto = node.rect;
    const target = { x: pin.x, y: pin.y };
    const rect = rectAtCenter(auto, target);
    ghosts.set(node.id, auto);
    moved.add(node.id);
    const when = pin.auto;
    if (when) {
      const now = rectCenter(auto);
      const gap = Math.hypot(now.x - when[0], now.y - when[1]);
      const diagonal = Math.hypot(auto.w, auto.h);
      if (gap > diagonal * DRIFT_FACTOR) {
        diagnostics.push({
          severity: "info",
          message: `Auto-layout has moved \u201C${node.id}\u201D a long way since it was pinned. The pin still holds, but it may be fighting the new layout.`,
          nodes: [node.id],
          range: node.sourceRange,
          fix: { kind: "release-pins", nodes: [node.id] }
        });
      }
    }
    return { ...node, rect };
  });
  const orphans = [];
  const unpinnedByFingerprint = /* @__PURE__ */ new Map();
  for (const node of scene.nodes) {
    if (pins[node.id]) continue;
    const list = unpinnedByFingerprint.get(node.fingerprint) ?? [];
    list.push(node.id);
    unpinnedByFingerprint.set(node.fingerprint, list);
  }
  for (const id of pinIds) {
    if (byId.has(id)) continue;
    const pin = pins[id];
    const candidates = pin.fingerprint ? unpinnedByFingerprint.get(pin.fingerprint) : void 0;
    const migrateTo = candidates?.length === 1 ? candidates[0] : void 0;
    orphans.push({ id, pin, migrateTo });
  }
  if (orphans.length > 0) {
    const renamed = orphans.filter((o) => o.migrateTo);
    diagnostics.push({
      severity: "warning",
      message: renamed.length > 0 ? `${orphans.length} pinned node${orphans.length === 1 ? "" : "s"} no longer exist; ${renamed.length} look${renamed.length === 1 ? "s" : ""} renamed.` : `${orphans.length} pinned node${orphans.length === 1 ? " no longer exists" : "s no longer exist"} in this diagram.`
    });
  }
  const waypoints = /* @__PURE__ */ new Map();
  for (const [id, hint] of Object.entries(layout?.edges ?? {})) {
    if (hint.waypoints?.length) {
      waypoints.set(
        id,
        hint.waypoints.map(([x, y]) => ({ x, y }))
      );
    }
  }
  const clusters = refitClusters(scene, nodes, moved);
  const nodeMap = new Map(nodes.map((n4) => [n4.id, n4]));
  let edges = rerouteEdges(scene.edges, {
    nodes: nodeMap,
    moved,
    waypoints,
    // Obstacle avoidance needs somewhere to build its grid. The engine's own
    // bounds are the right extent: a pin can push a node outside them, and
    // `boundsOf` below widens the scene afterwards.
    bounds: scene.bounds
  });
  edges = edges.map((edge) => {
    const offset = layout?.edges?.[edge.id]?.label_offset;
    if (!offset || !edge.label) return edge;
    return { ...edge, label: { ...edge.label, offset: { x: offset[0], y: offset[1] } } };
  });
  return {
    scene: { ...scene, nodes, clusters, edges, bounds: boundsOf2(nodes, clusters, scene, edges) },
    ghosts,
    orphans,
    diagnostics
  };
}
function refitClusters(scene, nodes, moved) {
  if (scene.clusters.length === 0 || moved.size === 0) return [...scene.clusters];
  const autoNodes = new Map(scene.nodes.map((n4) => [n4.id, n4]));
  const pinnedNodes = new Map(nodes.map((n4) => [n4.id, n4]));
  const membersOf = /* @__PURE__ */ new Map();
  const childrenOf = /* @__PURE__ */ new Map();
  for (const node of scene.nodes) {
    if (!node.parent) continue;
    push(membersOf, node.parent, node.id);
  }
  for (const cluster of scene.clusters) {
    if (!cluster.parent) continue;
    push(childrenOf, cluster.parent, cluster.id);
  }
  const byId = new Map(scene.clusters.map((c) => [c.id, c]));
  const ordered = [...scene.clusters].sort((a, b) => depthOf(b, byId) - depthOf(a, byId));
  const result = new Map(scene.clusters.map((c) => [c.id, c]));
  for (const cluster of ordered) {
    const members = membersOf.get(cluster.id) ?? [];
    const children = childrenOf.get(cluster.id) ?? [];
    const auto = [];
    const next = [];
    let touched = false;
    for (const id of members) {
      const a = autoNodes.get(id);
      const n4 = pinnedNodes.get(id);
      if (!a || !n4) continue;
      auto.push(a.rect);
      next.push(n4.rect);
      if (moved.has(id)) touched = true;
    }
    for (const id of children) {
      const a = byId.get(id);
      const n4 = result.get(id);
      if (!a || !n4) continue;
      auto.push(a.rect);
      next.push(n4.rect);
      if (a.rect !== n4.rect) touched = true;
    }
    if (!touched || next.length === 0) continue;
    const before = unionRects(auto);
    const after = unionRects(next);
    result.set(cluster.id, {
      ...cluster,
      rect: {
        x: after.x - (before.x - cluster.rect.x),
        y: after.y - (before.y - cluster.rect.y),
        w: after.w + (cluster.rect.w - before.w),
        h: after.h + (cluster.rect.h - before.h)
      }
    });
  }
  return scene.clusters.map((c) => result.get(c.id) ?? c);
}
function push(map, key, value) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
function depthOf(cluster, byId) {
  let depth = 0;
  let parent = cluster.parent;
  while (parent && depth <= byId.size) {
    depth += 1;
    parent = byId.get(parent)?.parent;
  }
  return depth;
}
function boundsOf2(nodes, clusters, scene, edges) {
  const rects = [...nodes.map((n4) => n4.rect), ...clusters.map((c) => c.rect)];
  for (const edge of edges) {
    for (const p of edge.route.points) rects.push({ x: p.x, y: p.y, w: 0, h: 0 });
    if (edge.arrowEnd) rects.push({ x: edge.arrowEnd.x, y: edge.arrowEnd.y, w: 0, h: 0 });
  }
  if (rects.length === 0) return scene.bounds;
  const box = unionRects(rects);
  const pad = 12;
  return { x: box.x - pad, y: box.y - pad, w: box.w + pad * 2, h: box.h + pad * 2 };
}

// ../../src/core/sequence/layout.ts
var ACTIVATION_WIDTH = 10;
var ACTIVATION_STEP = 5;

// ../../src/core/render/edges.ts
function n2(v) {
  return Number.isFinite(v) ? String(Math.round(v * 1e3) / 1e3) : "0";
}
function edgePathD(route) {
  const pts = route.points;
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M${n2(pts[0].x)},${n2(pts[0].y)}`;
  if (route.kind === "spline" && pts.length >= 4 && (pts.length - 1) % 3 === 0) {
    let d = `M${n2(pts[0].x)},${n2(pts[0].y)}`;
    for (let i = 1; i < pts.length; i += 3) {
      const c1 = pts[i];
      const c2 = pts[i + 1];
      const end = pts[i + 2];
      d += ` C${n2(c1.x)},${n2(c1.y)} ${n2(c2.x)},${n2(c2.y)} ${n2(end.x)},${n2(end.y)}`;
    }
    return d;
  }
  return pts.map((p, i) => `${i === 0 ? "M" : "L"}${n2(p.x)},${n2(p.y)}`).join(" ");
}
function routeTail(route) {
  return route.points[route.points.length - 1];
}
function routeHead(route) {
  return route.points[0];
}
function anchorAwayFrom(points2, tip, fromEnd) {
  const ordered = fromEnd ? [...points2].reverse() : [...points2];
  for (const p of ordered) {
    if (distance(p, tip) > 0.5) return p;
  }
  return void 0;
}
function arrowGeometry(kind, tip, from, size) {
  if (kind === "none") return null;
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return null;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  const half = size * 0.31;
  const baseX = tip.x - ux * size;
  const baseY = tip.y - uy * size;
  switch (kind) {
    case "arrow":
    case "open": {
      const a = { x: baseX + px * half, y: baseY + py * half };
      const b = { x: baseX - px * half, y: baseY - py * half };
      return {
        path: `M${n2(tip.x)},${n2(tip.y)} L${n2(a.x)},${n2(a.y)} L${n2(b.x)},${n2(b.y)} Z`,
        filled: kind === "arrow"
      };
    }
    case "dot":
    case "odot": {
      const r2 = size * 0.34;
      const cx = tip.x - ux * r2;
      const cy = tip.y - uy * r2;
      return {
        path: `M${n2(cx - r2)},${n2(cy)} a${n2(r2)},${n2(r2)} 0 1 0 ${n2(r2 * 2)},0 a${n2(r2)},${n2(r2)} 0 1 0 ${n2(-r2 * 2)},0 Z`,
        filled: kind === "dot"
      };
    }
    case "diamond":
    case "odiamond": {
      const midX = tip.x - ux * (size / 2);
      const midY = tip.y - uy * (size / 2);
      return {
        path: [
          `M${n2(tip.x)},${n2(tip.y)}`,
          `L${n2(midX + px * half)},${n2(midY + py * half)}`,
          `L${n2(baseX)},${n2(baseY)}`,
          `L${n2(midX - px * half)},${n2(midY - py * half)}`,
          "Z"
        ].join(" "),
        filled: kind === "diamond"
      };
    }
    case "cross": {
      const a = { x: tip.x + px * half, y: tip.y + py * half };
      const b = { x: tip.x - px * half, y: tip.y - py * half };
      return { path: `M${n2(a.x)},${n2(a.y)} L${n2(b.x)},${n2(b.y)}`, filled: false };
    }
    default:
      return null;
  }
}
function headArrow(route, tip, kind, size) {
  const actualTip = tip ?? routeTail(route);
  if (!actualTip) return null;
  const from = anchorAwayFrom(route.points, actualTip, true);
  if (!from) return null;
  return arrowGeometry(kind, actualTip, from, size);
}
function tailArrow(route, tip, kind, size) {
  const actualTip = tip ?? routeHead(route);
  if (!actualTip) return null;
  const from = anchorAwayFrom(route.points, actualTip, false);
  if (!from) return null;
  return arrowGeometry(kind, actualTip, from, size);
}

// ../../src/core/render/node.ts
var PAD_X = 10;
var PAD_Y = 7;
function resolveFill(node, theme) {
  const explicit = node.style?.fill;
  if (explicit) return explicit;
  if (node.style?.className) return seriesColor(theme, node.style.className);
  return theme.nodeFill;
}
function renderNode(node, theme) {
  const local = { x: 0, y: 0, w: node.rect.w, h: node.rect.h };
  const geometry = shapeGeometry(node.shape, local, theme.cornerRadius);
  const inset = geometry.textInset;
  const inner = geometry.textBox ?? {
    x: inset.x,
    y: inset.y,
    w: Math.max(local.w - inset.x * 2, 4),
    h: Math.max(local.h - inset.y * 2, 4)
  };
  const lines = [];
  const dividers = [];
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
        text: `\xAB${node.body.stereotype}\xBB`,
        x: inner.x + inner.w / 2,
        y: y - size * 0.3,
        anchor: "middle",
        size,
        weight: 400,
        muted: true,
        italic: true
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
        weight: 600
      });
    }
    for (const section of node.body.sections) {
      y += PAD_Y;
      dividers.push(`M0,${round(y)} H${round(local.w)}`);
      y += PAD_Y - 2;
      for (const item of section.items) {
        y += rowSize * LINE_HEIGHT;
        lines.push({
          // Rows are left-aligned and clipped rather than wrapped: a method
          // signature broken across two lines is harder to read than one that
          // ends in an ellipsis.
          text: truncateToWidth(item, inner.w, rowSize, 400),
          x: inner.x,
          y: y - rowSize * 0.3,
          anchor: "start",
          size: rowSize,
          weight: 400,
          muted: true
        });
      }
    }
  }
  const bare = isUnpainted(node.shape);
  return {
    geometry,
    lines,
    dividers,
    fill: bare ? node.style?.fill ?? "none" : resolveFill(node, theme),
    stroke: bare ? node.style?.stroke ?? "none" : node.style?.stroke ?? theme.nodeStroke,
    strokeWidth: node.style?.strokeWidth ?? theme.strokeWidth,
    dashed: node.style?.dashed ?? false
  };
}
function nodeTextColors(node, theme) {
  const text = node.style?.text ?? theme.nodeText;
  return { text, muted: node.style?.text ?? theme.nodeTextMuted };
}
function renderCluster(cluster, theme) {
  const size = theme.fontSize - 1;
  const local = { x: 0, y: 0, w: cluster.rect.w, h: cluster.rect.h };
  return {
    path: shapeGeometry("rect", local, theme.cornerRadius).path,
    fill: cluster.style?.fill ?? theme.clusterFill,
    stroke: cluster.style?.stroke ?? theme.clusterStroke,
    label: cluster.label ? {
      text: truncateToWidth(cluster.label, local.w - PAD_X * 2, size, 600),
      x: PAD_X,
      y: size + PAD_Y,
      anchor: "start",
      size,
      weight: 600,
      muted: true
    } : void 0
  };
}
function round(v) {
  return Math.round(v * 1e3) / 1e3;
}

// ../../src/core/annotate/index.ts
var ANNOTATION_COLORS = [
  { id: "rose", label: "Rose", value: "#f43f5e" },
  { id: "sky", label: "Sky", value: "#0ea5e9" },
  { id: "emerald", label: "Emerald", value: "#10b981" },
  { id: "violet", label: "Violet", value: "#8b5cf6" },
  { id: "slate", label: "Slate", value: "#64748b" }
];
function annotationColor(name) {
  return ANNOTATION_COLORS.find((c) => c.id === name)?.value ?? ANNOTATION_COLORS[0].value;
}
function annotationBounds(mark) {
  const [x, y] = mark.at;
  if (mark.size) {
    return { x, y, w: mark.size[0], h: mark.size[1] };
  }
  const points2 = mark.points ?? [];
  if (points2.length === 0) return { x, y, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [px, py] of points2) {
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }
  return { x: x + minX, y: y + minY, w: maxX - minX, h: maxY - minY };
}
function annotationPath(mark) {
  const [x, y] = mark.at;
  return (mark.points ?? []).map(([px, py]) => ({ x: x + px, y: y + py }));
}
function byCreation(a, b) {
  const n4 = (id) => Number.parseInt(id.replace(/^\D+/, ""), 10);
  const [x, y] = [n4(a), n4(b)];
  if (Number.isNaN(x) || Number.isNaN(y)) return a.localeCompare(b);
  return x - y || a.localeCompare(b);
}
function leaderLine(mark, target) {
  const note = annotationBounds(mark);
  if (overlaps(note, target)) return null;
  const a = rectCenter(note);
  const b = rectCenter(target);
  return { from: clipToRect(a, b, note), to: clipToRect(b, a, target) };
}
function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function clipToRect(centre, toward, rect) {
  const dx = toward.x - centre.x;
  const dy = toward.y - centre.y;
  if (dx === 0 && dy === 0) return centre;
  const halfW = rect.w / 2;
  const halfH = rect.h / 2;
  const scale = Math.min(
    dx === 0 ? Infinity : halfW / Math.abs(dx),
    dy === 0 ? Infinity : halfH / Math.abs(dy)
  );
  return { x: centre.x + dx * scale, y: centre.y + dy * scale };
}

// ../../src/core/render/annotations.ts
var NOTE_PAD = 10;
var ARROW_SIZE = 13;
var ANNOTATION_STROKE = 2.5;
var HIGHLIGHT_OPACITY = 0.16;
function renderAnnotations(annotations, scene, theme) {
  if (!annotations) return [];
  const graph = scene && isGraph(scene) ? scene : null;
  return Object.keys(annotations).sort(byCreation).map((id) => renderAnnotation(id, annotations[id], graph, theme));
}
function renderAnnotation(id, mark, scene, theme) {
  const color = annotationColor(mark.color);
  const bounds = annotationBounds(mark);
  const base = { id, kind: mark.kind, color, bounds };
  switch (mark.kind) {
    case "highlight":
      return {
        ...base,
        boxPath: shapeGeometry("rect", { x: 0, y: 0, w: bounds.w, h: bounds.h }, 4).path
      };
    case "note":
      return {
        ...base,
        boxPath: shapeGeometry(
          "rect",
          { x: 0, y: 0, w: bounds.w, h: bounds.h },
          theme.cornerRadius
        ).path,
        lines: noteLines(mark, bounds, theme),
        leader: leaderFor(mark, bounds, scene) ?? void 0
      };
    case "arrow": {
      const path = annotationPath(mark);
      const tip = path[path.length - 1];
      const from = path[path.length - 2];
      return {
        ...base,
        linePath: polyline(path),
        headPath: tip && from ? arrowGeometry("arrow", tip, from, ARROW_SIZE)?.path ?? void 0 : void 0
      };
    }
    case "stroke":
      return { ...base, linePath: smoothed(annotationPath(mark)) };
  }
}
function noteLines(mark, bounds, theme) {
  const text = mark.text?.trim();
  if (!text) return [];
  const size = theme.fontSize;
  const lineHeight = size * 1.35;
  const width = Math.max(bounds.w - NOTE_PAD * 2, 20);
  const maxLines = Math.max(1, Math.floor((bounds.h - NOTE_PAD * 2) / lineHeight));
  return wrapText(text, width, size, 400, maxLines).map((line, i) => ({
    text: line,
    x: bounds.x + NOTE_PAD,
    y: bounds.y + NOTE_PAD + size * 0.85 + i * lineHeight
  }));
}
function leaderFor(mark, bounds, scene) {
  if (!mark.anchor || !scene) return null;
  const node = scene.nodes.find((n4) => n4.id === mark.anchor);
  if (!node) return null;
  return leaderLine({ ...mark, at: [bounds.x, bounds.y] }, node.rect);
}
function polyline(points2) {
  if (points2.length === 0) return "";
  return points2.map((p, i) => `${i === 0 ? "M" : "L"}${r(p.x)},${r(p.y)}`).join(" ");
}
function smoothed(points2) {
  if (points2.length < 3) return polyline(points2);
  const first = points2[0];
  const parts = [`M${r(first.x)},${r(first.y)}`];
  for (let i = 1; i < points2.length - 1; i += 1) {
    const p = points2[i];
    const next = points2[i + 1];
    parts.push(
      `Q${r(p.x)},${r(p.y)} ${r((p.x + next.x) / 2)},${r((p.y + next.y) / 2)}`
    );
  }
  const last = points2[points2.length - 1];
  parts.push(`L${r(last.x)},${r(last.y)}`);
  return parts.join(" ");
}
function r(v) {
  return Math.round(v * 100) / 100;
}
function annotationsBounds(annotations) {
  const marks = Object.values(annotations ?? {});
  if (marks.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const mark of marks) {
    const box = annotationBounds(mark);
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

// ../../src/core/render/svg.ts
var ARROW_SIZE2 = 11;
function union(a, b) {
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y
  };
}
function annotationElements(annotations, scene, theme) {
  const marks = renderAnnotations(annotations, scene, theme);
  if (marks.length === 0) return "";
  const parts = [];
  for (const mark of marks) {
    const { bounds, color } = mark;
    const inner = [];
    if (mark.leader) {
      inner.push(
        `<line x1="${n3(mark.leader.from.x)}" y1="${n3(mark.leader.from.y)}" x2="${n3(mark.leader.to.x)}" y2="${n3(mark.leader.to.y)}" stroke="${color}" stroke-width="${n3(ANNOTATION_STROKE * 0.6)}" stroke-dasharray="5 4" opacity="0.7"/>`
      );
    }
    if (mark.kind === "highlight" && mark.boxPath) {
      inner.push(
        `<g transform="translate(${n3(bounds.x)},${n3(bounds.y)})"><path d="${mark.boxPath}" fill="${color}" fill-opacity="${HIGHLIGHT_OPACITY}"/><path d="${mark.boxPath}" fill="none" stroke="${color}" stroke-width="${n3(ANNOTATION_STROKE * 0.6)}" opacity="0.5"/></g>`
      );
    }
    if (mark.kind === "note" && mark.boxPath) {
      inner.push(
        `<g transform="translate(${n3(bounds.x)},${n3(bounds.y)})"><path d="${mark.boxPath}" fill="${theme.background}"/><path d="${mark.boxPath}" fill="${color}" fill-opacity="0.14"/><path d="${mark.boxPath}" fill="none" stroke="${color}" stroke-width="1.5"/></g>`
      );
    }
    for (const line of mark.lines ?? []) {
      inner.push(
        `<text x="${n3(line.x)}" y="${n3(line.y)}" font-family="${esc(theme.fontFamily)}" font-size="${n3(theme.fontSize)}" fill="${theme.nodeText}" xml:space="preserve">${esc(line.text)}</text>`
      );
    }
    if (mark.linePath) {
      inner.push(
        `<path d="${mark.linePath}" fill="none" stroke="${color}" stroke-width="${n3(ANNOTATION_STROKE)}" stroke-linecap="round" stroke-linejoin="round"/>`
      );
    }
    if (mark.headPath) inner.push(`<path d="${mark.headPath}" fill="${color}"/>`);
    parts.push(inner.join(""));
  }
  return `<g data-layer="annotations">${parts.join("")}</g>`;
}
function esc(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function n3(v) {
  return String(Math.round(v * 1e3) / 1e3);
}
function attr(name, value) {
  return value === void 0 || value === null || value === "" ? "" : ` ${name}="${value}"`;
}
function textElement(line, color, muted, family) {
  return `<text x="${n3(line.x)}" y="${n3(line.y)}" text-anchor="${line.anchor}" font-family="${esc(family)}" font-size="${n3(line.size)}" font-weight="${line.weight}"` + attr("font-style", line.italic ? "italic" : void 0) + ` fill="${line.muted ? muted : color}" xml:space="preserve">${esc(line.text)}</text>`;
}
function edgeElement(edge, theme) {
  const stroke = edge.style?.stroke ?? theme.edge;
  const width = edge.style?.strokeWidth ?? theme.strokeWidth;
  const parts = [
    `<path d="${edgePathD(edge.route)}" fill="none" stroke="${stroke}" stroke-width="${n3(width)}"` + attr("stroke-dasharray", edge.style?.dashed ? "7 5" : void 0) + ` stroke-linecap="round" stroke-linejoin="round"/>`
  ];
  for (const arrow of [
    headArrow(edge.route, edge.arrowEnd, edge.endArrow, ARROW_SIZE2),
    tailArrow(edge.route, edge.arrowStart, edge.startArrow, ARROW_SIZE2)
  ]) {
    if (!arrow) continue;
    parts.push(
      `<path d="${arrow.path}" fill="${arrow.filled ? stroke : theme.background}" stroke="${stroke}" stroke-width="${n3(width)}" stroke-linejoin="round"/>`
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
      `<rect x="${n3(x - boxW / 2)}" y="${n3(cy - boxH / 2)}" width="${n3(boxW)}" height="${n3(boxH)}" rx="3" fill="${theme.edgeTextHalo}"/>`,
      `<text x="${n3(x)}" y="${n3(y)}" text-anchor="middle" font-family="${esc(theme.fontFamily)}" font-size="${n3(size)}" font-weight="500" fill="${theme.edgeText}" stroke="${theme.edgeTextHalo}" stroke-width="2" paint-order="stroke" stroke-linejoin="round" xml:space="preserve">${esc(edge.label.text)}</text>`
    );
  }
  return parts.join("");
}
function sceneToSvg(scene, theme, options = {}) {
  if (scene.family === "passthrough") return passthroughToSvg(scene, theme, options);
  if (scene.family === "sequence") return sequenceToSvg(scene, theme, options);
  return graphToSvg(scene, theme, options);
}
function passthroughToSvg(scene, theme, options = {}) {
  const { padding = 16, background = true, scale = 1, title } = options;
  const box = {
    x: scene.bounds.x - padding,
    y: scene.bounds.y - padding,
    w: Math.max(scene.bounds.w + padding * 2, 1),
    h: Math.max(scene.bounds.h + padding * 2, 1)
  };
  const parts = [];
  if (title) parts.push(`<title>${esc(title)}</title>`);
  if (background) {
    parts.push(
      `<rect x="${n3(box.x)}" y="${n3(box.y)}" width="${n3(box.w)}" height="${n3(box.h)}" fill="${theme.background}"/>`
    );
  }
  parts.push(scene.svg);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${n3(box.x)} ${n3(box.y)} ${n3(box.w)} ${n3(box.h)}" width="${n3(box.w * scale)}" height="${n3(box.h * scale)}">` + parts.join("") + `</svg>`;
}
function graphToSvg(scene, theme, options = {}) {
  const { padding = 16, background = true, embedFonts, scale = 1, title, annotations } = options;
  const bounds = union(scene.bounds, annotationsBounds(annotations));
  const box = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: Math.max(bounds.w + padding * 2, 1),
    h: Math.max(bounds.h + padding * 2, 1)
  };
  const parts = [];
  if (title) parts.push(`<title>${esc(title)}</title>`);
  if (embedFonts) parts.push(`<style>${embedFonts}</style>`);
  if (background) {
    parts.push(
      `<rect x="${n3(box.x)}" y="${n3(box.y)}" width="${n3(box.w)}" height="${n3(box.h)}" fill="${theme.background}"/>`
    );
  }
  for (const cluster of scene.clusters) {
    const r2 = renderCluster(cluster, theme);
    const inner = [
      `<path d="${r2.path}" fill="${r2.fill}" stroke="${r2.stroke}" stroke-width="${n3(theme.strokeWidth)}" stroke-dasharray="6 4"/>`,
      r2.label ? textElement(r2.label, theme.clusterText, theme.clusterText, theme.fontFamily) : ""
    ].join("");
    parts.push(`<g transform="translate(${n3(cluster.rect.x)},${n3(cluster.rect.y)})">${inner}</g>`);
  }
  for (const edge of scene.edges) parts.push(edgeElement(edge, theme));
  for (const node of scene.nodes) {
    const r2 = renderNode(node, theme);
    const colors = nodeTextColors(node, theme);
    const inner = [
      `<path d="${r2.geometry.path}" fill="${r2.fill}" stroke="${r2.stroke}" stroke-width="${n3(r2.strokeWidth)}"` + attr("stroke-dasharray", r2.dashed ? "6 4" : void 0) + ` stroke-linejoin="round"/>`,
      ...r2.geometry.details.map(
        (d) => `<path d="${d}" fill="none" stroke="${r2.stroke}" stroke-width="${n3(r2.strokeWidth)}"/>`
      ),
      ...r2.dividers.map(
        (d) => `<path d="${d}" stroke="${theme.nodeDivider}" stroke-width="1"/>`
      ),
      ...r2.lines.map((line) => textElement(line, colors.text, colors.muted, theme.fontFamily))
    ].join("");
    parts.push(`<g transform="translate(${n3(node.rect.x)},${n3(node.rect.y)})">${inner}</g>`);
  }
  parts.push(annotationElements(annotations, scene, theme));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n3(box.x)} ${n3(box.y)} ${n3(box.w)} ${n3(box.h)}" width="${n3(box.w * scale)}" height="${n3(box.h * scale)}">` + parts.join("") + `</svg>`;
}
var SEQ_ARROW = 10;
var SELF_LOOP_WIDTH = 44;
function sequenceToSvg(scene, theme, options = {}) {
  const { padding = 16, background = true, embedFonts, scale = 1, title, annotations } = options;
  const bounds = union(scene.bounds, annotationsBounds(annotations));
  const box = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    w: Math.max(bounds.w + padding * 2, 1),
    h: Math.max(bounds.h + padding * 2, 1)
  };
  const parts = [];
  if (title) parts.push(`<title>${esc(title)}</title>`);
  if (embedFonts) parts.push(`<style>${embedFonts}</style>`);
  if (background) {
    parts.push(
      `<rect x="${n3(box.x)}" y="${n3(box.y)}" width="${n3(box.w)}" height="${n3(box.h)}" fill="${theme.background}"/>`
    );
  }
  const text = (content, x, y, size, weight, fill, anchor = "middle") => `<text x="${n3(x)}" y="${n3(y)}" text-anchor="${anchor}" font-family="${esc(theme.fontFamily)}" font-size="${n3(size)}" font-weight="${weight}" fill="${fill}" xml:space="preserve">${esc(content)}</text>`;
  for (const fragment of scene.fragments) {
    const { x, y, w, h } = fragment.rect;
    const tagWidth = Math.max(46, fragment.kind.length * 8 + 20);
    parts.push(
      `<rect x="${n3(x)}" y="${n3(y)}" width="${n3(w)}" height="${n3(h)}" rx="4" fill="${theme.clusterFill}" stroke="${theme.clusterStroke}" stroke-width="${n3(theme.strokeWidth)}"/>`,
      `<path d="M${n3(x)},${n3(y)} h${n3(tagWidth)} l-10,18 h${n3(-tagWidth + 10)} Z" fill="${theme.clusterStroke}" opacity="0.35"/>`,
      text(fragment.kind, x + 8, y + 13, theme.fontSize - 2, 600, theme.clusterText, "start")
    );
    if (fragment.label) {
      parts.push(
        text(`[${fragment.label}]`, x + tagWidth + 8, y + 14, theme.fontSize - 2, 400, theme.nodeTextMuted, "start")
      );
    }
    fragment.dividers.forEach((dy, i) => {
      parts.push(
        `<line x1="${n3(x)}" y1="${n3(dy)}" x2="${n3(x + w)}" y2="${n3(dy)}" stroke="${theme.clusterStroke}" stroke-width="1" stroke-dasharray="5 4"/>`,
        text(`[${fragment.sectionLabels[i] ?? ""}]`, x + 10, dy + 14, theme.fontSize - 2, 400, theme.nodeTextMuted, "start")
      );
    });
  }
  for (const line of scene.lifelines) {
    parts.push(
      `<line x1="${n3(line.x)}" y1="${n3(line.head.y + line.head.h)}" x2="${n3(line.x)}" y2="${n3(line.bottom)}" stroke="${theme.edge}" stroke-width="${n3(theme.strokeWidth)}" stroke-dasharray="6 5" opacity="0.7"/>`
    );
    for (const y of [line.head.y, line.bottom]) {
      parts.push(
        `<rect x="${n3(line.head.x)}" y="${n3(y)}" width="${n3(line.head.w)}" height="${n3(line.head.h)}" rx="${n3(theme.cornerRadius)}" fill="${theme.nodeFill}" stroke="${theme.nodeStroke}" stroke-width="${n3(theme.strokeWidth)}"/>`,
        text(line.label, line.x, y + line.head.h / 2 + theme.fontSize * 0.36, theme.fontSize, 600, theme.nodeText)
      );
    }
  }
  const xOf = new Map(scene.lifelines.map((l) => [l.id, l.x]));
  for (const bar of scene.activations) {
    const x = xOf.get(bar.lifeline);
    if (x === void 0) continue;
    parts.push(
      `<rect x="${n3(x - ACTIVATION_WIDTH / 2 + bar.depth * ACTIVATION_STEP)}" y="${n3(bar.top)}" width="${n3(ACTIVATION_WIDTH)}" height="${n3(Math.max(bar.bottom - bar.top, 4))}" rx="1.5" fill="${theme.accent}" stroke="${theme.nodeStroke}" stroke-width="1" opacity="0.85"/>`
    );
  }
  for (const note of scene.notes) {
    const { x, y, w, h } = note.rect;
    const fold = 10;
    parts.push(
      `<path d="M${n3(x)},${n3(y)} H${n3(x + w - fold)} L${n3(x + w)},${n3(y + fold)} V${n3(y + h)} H${n3(x)} Z" fill="${theme.clusterFill}" stroke="${theme.clusterStroke}" stroke-width="${n3(theme.strokeWidth)}"/>`,
      `<path d="M${n3(x + w - fold)},${n3(y)} V${n3(y + fold)} H${n3(x + w)}" fill="none" stroke="${theme.clusterStroke}" stroke-width="1"/>`
    );
    note.text.split("\n").forEach((row, i) => {
      parts.push(text(row, x + w / 2, y + 10 + (i + 0.8) * theme.fontSize * 1.4, theme.fontSize - 1, 400, theme.nodeText));
    });
  }
  for (const message of scene.messages) {
    const from = xOf.get(message.from);
    const to = xOf.get(message.to);
    if (from === void 0 || to === void 0) continue;
    const selfLoop = message.kind === "self";
    const d = selfLoop ? `M${n3(from)},${n3(message.y)} h${SELF_LOOP_WIDTH} v26 h${-SELF_LOOP_WIDTH}` : `M${n3(from)},${n3(message.y)} H${n3(to)}`;
    const tip = selfLoop ? { x: from, y: message.y + 26 } : { x: to, y: message.y };
    const anchor = selfLoop ? { x: from + SELF_LOOP_WIDTH, y: message.y + 26 } : { x: from, y: message.y };
    const kind = message.kind === "destroy" ? "cross" : message.kind === "async" ? "open" : "arrow";
    const head = arrowGeometry(kind, tip, anchor, SEQ_ARROW);
    parts.push(
      `<path d="${d}" fill="none" stroke="${theme.edge}" stroke-width="${n3(theme.strokeWidth)}"` + (message.kind === "reply" ? ' stroke-dasharray="6 4"' : "") + ` stroke-linecap="round" stroke-linejoin="round"/>`
    );
    if (head) {
      parts.push(
        `<path d="${head.path}" fill="${head.filled ? theme.edge : "none"}" stroke="${theme.edge}" stroke-width="${n3(theme.strokeWidth)}" stroke-linejoin="round"/>`
      );
    }
    if (message.label) {
      const lx = selfLoop ? from + SELF_LOOP_WIDTH + 8 : (from + to) / 2;
      parts.push(
        `<text x="${n3(lx)}" y="${n3(message.y - 7)}" text-anchor="${selfLoop ? "start" : "middle"}" font-family="${esc(theme.fontFamily)}" font-size="${n3(theme.fontSize - 1)}" font-weight="500" fill="${theme.edgeText}" stroke="${theme.edgeTextHalo}" stroke-width="3.5" paint-order="stroke" stroke-linejoin="round" xml:space="preserve">${esc(message.label)}</text>`
      );
    }
  }
  parts.push(annotationElements(annotations, scene, theme));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n3(box.x)} ${n3(box.y)} ${n3(box.w)} ${n3(box.h)}" width="${n3(box.w * scale)}" height="${n3(box.h * scale)}">` + parts.join("") + `</svg>`;
}

// ../../src/core/sidecar/read.ts
import { parse as parseToml } from "smol-toml";
var SidecarError = class extends Error {
  constructor(message, remedy) {
    super(message);
    this.remedy = remedy;
    this.name = "SidecarError";
  }
  remedy;
};
var CONFLICT = /^<{7} |^={7}$|^>{7} /m;
function parseSidecar(text) {
  if (CONFLICT.test(text)) {
    throw new SidecarError(
      "This layout file has an unresolved merge conflict in it.",
      "Open the diagram in ZDraft to resolve it, or fix the markers by hand."
    );
  }
  let raw;
  try {
    raw = parseToml(text);
  } catch (e) {
    throw new SidecarError(
      `This layout file is not valid TOML: ${e.message}`,
      "Delete it to go back to pure auto-layout \u2014 nothing else depends on it."
    );
  }
  const table = asTable(raw);
  return {
    version: num(table.version) ?? 1,
    ...readLayout(table),
    blocks: Object.fromEntries(
      Object.entries(asTable(table.blocks)).map(([id, value]) => [id, readLayout(asTable(value))])
    )
  };
}
function readLayout(table) {
  return {
    engine: str(table.engine) ?? null,
    theme: readTheme(table.theme),
    pins: mapValues(asTable(table.pins), readPin),
    edges: mapValues(asTable(table.edges), readEdge),
    sequence: readSequence(table.sequence),
    annotations: mapValues(asTable(table.annotations), readAnnotation)
  };
}
function readTheme(value) {
  const name = str(asTable(value).name);
  return name ? { name } : null;
}
function readPin(value) {
  const table = asTable(value);
  const x = num(table.x);
  const y = num(table.y);
  if (x === null || y === null) return null;
  return {
    x,
    y,
    fingerprint: str(table.fingerprint) ?? null,
    auto: point(table.auto)
  };
}
function readEdge(value) {
  const table = asTable(value);
  const waypoints = points(table.waypoints);
  const offset = point(table.label_offset);
  if (waypoints.length === 0 && !offset) return null;
  return { waypoints, label_offset: offset };
}
function readSequence(value) {
  const table = asTable(value);
  const order = Array.isArray(table.lifeline_order) ? table.lifeline_order.filter((id) => typeof id === "string") : [];
  const lifelineGap = numbers(table.lifeline_gap);
  const messageGap = numbers(table.message_gap);
  if (order.length === 0 && !Object.keys(lifelineGap).length && !Object.keys(messageGap).length) {
    return null;
  }
  return { lifeline_order: order, lifeline_gap: lifelineGap, message_gap: messageGap };
}
var KINDS = /* @__PURE__ */ new Set(["note", "arrow", "highlight", "stroke"]);
function readAnnotation(value) {
  const table = asTable(value);
  const kind = str(table.kind);
  const at = point(table.at);
  if (!kind || !KINDS.has(kind) || !at) return null;
  return {
    kind,
    at,
    size: point(table.size),
    points: points(table.points),
    text: str(table.text) ?? null,
    color: str(table.color) ?? null,
    anchor: str(table.anchor) ?? null
  };
}
function asTable(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
function num(value) {
  const parsed = typeof value === "bigint" ? Number(value) : value;
  return typeof parsed === "number" && Number.isFinite(parsed) ? parsed : null;
}
function str(value) {
  return typeof value === "string" ? value : null;
}
function point(value) {
  if (!Array.isArray(value) || value.length < 2) return null;
  const x = num(value[0]);
  const y = num(value[1]);
  return x === null || y === null ? null : [x, y];
}
function points(value) {
  if (!Array.isArray(value)) return [];
  return value.map(point).filter((p) => p !== null);
}
function numbers(value) {
  const out = {};
  for (const [key, raw] of Object.entries(asTable(value))) {
    const parsed = num(raw);
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}
function mapValues(table, read) {
  const out = {};
  for (const [key, value] of Object.entries(table)) {
    const parsed = read(value);
    if (parsed !== null) out[key] = parsed;
  }
  return out;
}

// src/render.ts
var ADAPTERS = {
  graphviz: graphvizAdapter,
  d2: d2Adapter
};
var BY_EXTENSION = {
  ".dot": "graphviz",
  ".gv": "graphviz",
  ".d2": "d2",
  ".mmd": "mermaid",
  ".mermaid": "mermaid",
  ".puml": "plantuml",
  ".plantuml": "plantuml",
  ".iuml": "plantuml"
};
var RenderError = class extends Error {
  constructor(message, remedy) {
    super(message);
    this.remedy = remedy;
    this.name = "RenderError";
  }
  remedy;
};
function engineFor(path) {
  const dot = path.lastIndexOf(".");
  return dot < 0 ? null : BY_EXTENSION[path.slice(dot).toLowerCase()] ?? null;
}
function sidecarPathFor(path) {
  return join(dirname(path), `${basename(path)}.zlayout.toml`);
}
async function renderFile(path, options) {
  const text = await readFile(path, "utf8");
  const sidecar = options.ignorePins ? null : await readSidecar(path);
  const stem = basename(path).replace(/\.[^.]+$/, "");
  if (isMarkdown(path)) {
    const blocks = parseMarkdownBlocks(text);
    if (blocks.length === 0) {
      throw new RenderError(
        `${path} has no diagrams in it.`,
        "Fence them as ```mermaid, ```dot or ```d2 \u2014 ZDraft reads the same fences GitHub does."
      );
    }
    const out = [];
    for (const block of blocks) {
      out.push(
        await renderOne(
          block.source,
          block.engine,
          sidecar?.blocks?.[block.id] ?? null,
          `${path}#${block.id}`,
          `${stem}-${block.id}`,
          options
        )
      );
    }
    return out;
  }
  const engine = engineFor(path);
  if (!engine) {
    throw new RenderError(
      `ZDraft does not know what ${basename(path)} is.`,
      `Name it .dot, .d2, .mmd, .puml or .md \u2014 the extension is what picks the engine.`
    );
  }
  return [await renderOne(text, engine, layoutOf(sidecar), path, stem, options)];
}
async function renderOne(source, engine, layout, from, name, options) {
  const adapter = ADAPTERS[engine];
  if (!adapter) {
    throw new RenderError(
      `The CLI cannot render ${engine} yet.`,
      engine === "mermaid" ? "Mermaid needs a browser to measure its text, and gets it wrong without one. Export from ZDraft, or write the diagram in Graphviz or D2 \u2014 both render here exactly as they do in the app." : "PlantUML needs a JVM the CLI does not drive yet. Export it from ZDraft instead."
    );
  }
  const theme = themeByName(layout?.theme?.name ?? options.theme);
  const result = await adapter.layout(source, {
    theme,
    layoutProgram: options.layoutProgram,
    sequenceHints: layout?.sequence ?? void 0
  });
  const applied = apply(result.scene, layout);
  return {
    source: from,
    name,
    svg: sceneToSvg(applied.scene, theme, {
      padding: options.padding,
      background: options.background,
      title: name,
      annotations: layout?.annotations
    }),
    diagnostics: [...result.diagnostics, ...applied.diagnostics],
    orphans: applied.orphans,
    pinned: applied.pinned
  };
}
function apply(scene, layout) {
  if (!layout || !isGraph(scene)) {
    return { scene, diagnostics: [], orphans: [], pinned: 0 };
  }
  const applied = applyPins(scene, layout);
  return {
    scene: applied.scene,
    diagnostics: applied.diagnostics,
    orphans: applied.orphans.map((o) => o.id),
    pinned: Object.keys(layout.pins ?? {}).length - applied.orphans.length
  };
}
async function readSidecar(path) {
  let text;
  try {
    text = await readFile(sidecarPathFor(path), "utf8");
  } catch {
    return null;
  }
  return parseSidecar(text);
}
function layoutOf(sidecar) {
  if (!sidecar) return null;
  const { version: _version, blocks: _blocks, ...layout } = sidecar;
  return layout;
}

// src/watch.ts
import { watch as fsWatch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join as join2, resolve } from "node:path";
var EXTENSIONS = /* @__PURE__ */ new Set([".dot", ".gv", ".d2", ".md", ".markdown"]);
var SKIP = /* @__PURE__ */ new Set(["node_modules", ".git", "target", "dist", "build", ".next"]);
async function expand(paths) {
  const out = /* @__PURE__ */ new Set();
  for (const path of paths) {
    const info = await stat(path).catch(() => null);
    if (!info) continue;
    if (info.isFile()) {
      out.add(path);
      continue;
    }
    if (info.isDirectory()) for (const found of await walk(path)) out.add(found);
  }
  return [...out].sort();
}
async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.name.startsWith(".") || SKIP.has(entry.name)) continue;
    const path = join2(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(path));
      continue;
    }
    if (path.endsWith(".zlayout.toml")) continue;
    const dot = entry.name.lastIndexOf(".");
    if (dot >= 0 && EXTENSIONS.has(entry.name.slice(dot).toLowerCase())) out.push(path);
  }
  return out;
}
async function watch(paths, onChange, debounceMs = 80) {
  const files = await expand(paths);
  const roots = await watchRoots(paths);
  const owners = /* @__PURE__ */ new Map();
  for (const file of files) owners.set(resolve(sidecarPathFor(file)), file);
  const pending = /* @__PURE__ */ new Map();
  let running = Promise.resolve();
  const queue = (path) => {
    clearTimeout(pending.get(path));
    pending.set(
      path,
      setTimeout(() => {
        pending.delete(path);
        running = running.then(() => onChange(path)).catch((e) => {
          console.error(e.stack ?? e.message);
        });
      }, debounceMs)
    );
  };
  const watchers = roots.map(
    (root) => fsWatch(root, { recursive: true }, (_event, name) => {
      if (!name) return;
      const full = resolve(root, name.toString());
      const owner = owners.get(full);
      if (owner) return queue(owner);
      if (full.endsWith(".zlayout.toml")) return;
      if (engineFor(full) || /\.(md|markdown)$/i.test(full)) queue(full);
    })
  );
  await new Promise((resolveWatch) => {
    const stop = () => {
      for (const watcher of watchers) watcher.close();
      for (const timer of pending.values()) clearTimeout(timer);
      resolveWatch();
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
}
async function watchRoots(paths) {
  const roots = /* @__PURE__ */ new Set();
  for (const path of paths) {
    const info = await stat(path).catch(() => null);
    if (!info) continue;
    roots.add(resolve(info.isDirectory() ? path : join2(path, "..")));
  }
  return [...roots];
}

// src/index.ts
var USAGE = `zdraft \u2014 render ZDraft diagrams, layout pins and all

  zdraft render <paths...> [options]
  zdraft watch  <paths...> [options]

A path may be a file or a folder; folders are walked for .dot, .gv, .d2 and .md.

Options
  -o, --out <dir>      Where the SVGs go. Default: beside each source file.
      --theme <name>   Diagram theme. A file's own theme wins over this.
      --padding <n>    Space around the diagram, in diagram units. Default 16.
      --no-background  Transparent, for dropping onto a slide.
      --no-pins        Ignore the sidecars and render pure auto-layout.
      --layout <prog>  Graphviz program: dot, neato, fdp, circo, twopi.
      --strict         Treat warnings as failures. For CI.
  -q, --quiet          Print nothing but errors.
  -h, --help           This.

Themes: ${DIAGRAM_THEMES.map((t) => t.id).join(", ")}
`;
var UsageError = class extends Error {
};
function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (command !== "render" && command !== "watch") {
    throw new UsageError(
      command ? `Unknown command \u201C${command}\u201D.` : "Say what to do: render, or watch."
    );
  }
  const args = {
    command,
    paths: [],
    out: null,
    strict: false,
    quiet: false,
    options: { theme: "blueprint", ignorePins: false, padding: 16, background: true }
  };
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    const value = () => {
      const next = rest[i + 1];
      if (next === void 0 || next.startsWith("-")) {
        throw new UsageError(`${arg} needs a value.`);
      }
      i += 1;
      return next;
    };
    switch (arg) {
      case "-o":
      case "--out":
        args.out = value();
        break;
      case "--theme": {
        const name = value();
        if (!DIAGRAM_THEMES.some((t) => t.id === name)) {
          throw new UsageError(
            `No theme called \u201C${name}\u201D. Try: ${DIAGRAM_THEMES.map((t) => t.id).join(", ")}.`
          );
        }
        args.options.theme = name;
        break;
      }
      case "--padding": {
        const padding = Number(value());
        if (!Number.isFinite(padding) || padding < 0) {
          throw new UsageError("--padding needs a number that is not negative.");
        }
        args.options.padding = padding;
        break;
      }
      case "--layout":
        args.options.layoutProgram = value();
        break;
      case "--no-background":
        args.options.background = false;
        break;
      case "--no-pins":
        args.options.ignorePins = true;
        break;
      case "--strict":
        args.strict = true;
        break;
      case "-q":
      case "--quiet":
        args.quiet = true;
        break;
      default:
        if (arg.startsWith("-")) throw new UsageError(`Unknown option \u201C${arg}\u201D.`);
        args.paths.push(arg);
    }
  }
  if (args.paths.length === 0) throw new UsageError("Say which files to render.");
  return args;
}
async function renderOne2(path, args, log) {
  const outcome = { written: 0, errors: 0, warnings: 0 };
  let results;
  try {
    results = await renderFile(path, args.options);
  } catch (e) {
    const error = e;
    console.error(`\u2717 ${path}
  ${error.message}`);
    if (error.remedy) console.error(`  ${error.remedy}`);
    return { ...outcome, errors: 1 };
  }
  for (const result of results) {
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    const warnings = result.diagnostics.filter((d) => d.severity === "warning");
    outcome.errors += errors.length;
    outcome.warnings += warnings.length;
    for (const d of errors) console.error(`\u2717 ${result.source}${where(d)}: ${d.message}`);
    for (const d of warnings) console.error(`! ${result.source}${where(d)}: ${d.message}`);
    for (const id of result.orphans) {
      console.error(
        `! ${result.source}: the sidecar pins \u201C${id}\u201D, which this diagram no longer has.`
      );
      outcome.warnings += 1;
    }
    if (errors.length > 0) continue;
    const dir = args.out ?? join3(path, "..");
    await mkdir(dir, { recursive: true });
    const file = join3(dir, `${result.name}.svg`);
    await writeFile(file, result.svg, "utf8");
    outcome.written += 1;
    log(
      `\u2192 ${relative(process.cwd(), file)}` + (result.pinned > 0 ? `  (${result.pinned} pinned)` : "")
    );
  }
  return outcome;
}
function where(d) {
  if (d.line === void 0) return "";
  return d.column === void 0 ? `:${d.line}` : `:${d.line}:${d.column}`;
}
async function main(argv) {
  if (argv.length === 0 || argv.includes("-h") || argv.includes("--help")) {
    console.log(USAGE);
    return 0;
  }
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(`${e.message}
`);
    console.error(USAGE);
    return 2;
  }
  const log = args.quiet ? () => {
  } : (line) => console.log(line);
  const files = await expand(args.paths);
  if (files.length === 0) {
    console.error("Nothing to render: no .dot, .gv, .d2 or .md files in what you named.");
    return 1;
  }
  const run = async (paths) => {
    const total = { written: 0, errors: 0, warnings: 0 };
    for (const path of paths) {
      const one = await renderOne2(path, args, log);
      total.written += one.written;
      total.errors += one.errors;
      total.warnings += one.warnings;
    }
    return total;
  };
  const first = await run(files);
  if (args.command === "watch") {
    log(`
Watching ${files.length} ${files.length === 1 ? "file" : "files"}. Ctrl+C to stop.`);
    await watch(args.paths, async (changed) => {
      log(`
${(/* @__PURE__ */ new Date()).toLocaleTimeString()}  ${basename2(changed)}`);
      await run([changed]);
    });
    return 0;
  }
  if (!args.quiet) {
    const parts = [`${first.written} written`];
    if (first.errors) parts.push(`${first.errors} failed`);
    if (first.warnings) parts.push(`${first.warnings} warned`);
    console.log(`
${parts.join(", ")}.`);
  }
  if (first.errors > 0) return 1;
  return args.strict && first.warnings > 0 ? 1 : 0;
}

// src/main.ts
main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => {
    console.error(e.stack ?? e.message);
    process.exit(70);
  }
);
