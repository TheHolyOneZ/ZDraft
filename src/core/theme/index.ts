

export interface DiagramTheme {
  id: string;
  label: string;

  note: string;

  background: string;

  nodeFill: string;
  nodeStroke: string;
  nodeText: string;

  nodeTextMuted: string;

  nodeDivider: string;

  edge: string;
  edgeText: string;

  edgeTextHalo: string;

  clusterFill: string;
  clusterStroke: string;
  clusterText: string;

  accent: string;


  series: string[];

  strokeWidth: number;
  cornerRadius: number;
  fontFamily: string;
  monoFamily: string;
  fontSize: number;


  printSafe?: boolean;
}

const UI_FONT = "Inter, 'Inter Variable', 'Segoe UI', system-ui, sans-serif";
const MONO_FONT = "'JetBrains Mono', 'JetBrains Mono Variable', ui-monospace, monospace";


export const DEFAULT_FONT_SIZE = 13;

const BASE = {
  strokeWidth: 1.5,
  cornerRadius: 8,
  fontFamily: UI_FONT,
  monoFamily: MONO_FONT,
  fontSize: DEFAULT_FONT_SIZE,
} as const;


const blueprint: DiagramTheme = {
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
  series: ["#38BDF8", "#34D399", "#FBBF24", "#F472B6", "#A78BFA", "#FB923C", "#2DD4BF", "#F87171"],
};


const paper: DiagramTheme = {
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
  series: ["#0369A1", "#15803D", "#A16207", "#BE185D", "#6D28D9", "#C2410C", "#0F766E", "#B91C1C"],
};


const slate: DiagramTheme = {
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
  series: ["#60A5FA", "#4ADE80", "#FBBF24", "#F472B6", "#C084FC", "#FB923C", "#2DD4BF", "#F87171"],
};


const pastel: DiagramTheme = {
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
  series: ["#AECBEB", "#B7E4C7", "#FBE7A1", "#F7C8D8", "#D6C9F0", "#FAD7B0", "#A8DCD5", "#F2B8B5"],
};


const mono: DiagramTheme = {
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

  series: ["#FFFFFF", "#E4E4E4", "#C9C9C9", "#AEAEAE", "#939393", "#787878", "#5D5D5D", "#424242"],
  strokeWidth: 1.75,
  printSafe: true,
};


const neon: DiagramTheme = {
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
  series: ["#22D3EE", "#A3E635", "#FACC15", "#F0ABFC", "#818CF8", "#FB923C", "#2DD4BF", "#FB7185"],
};

export const DIAGRAM_THEMES: readonly DiagramTheme[] = [
  blueprint,
  paper,
  slate,
  pastel,
  mono,
  neon,
];

export const DEFAULT_DIAGRAM_THEME = "blueprint";

const BY_ID = new Map(DIAGRAM_THEMES.map((t) => [t.id, t]));


export function themeByName(name: string | undefined | null): DiagramTheme {
  if (!name) return BY_ID.get(DEFAULT_DIAGRAM_THEME)!;
  return BY_ID.get(name.toLowerCase()) ?? BY_ID.get(DEFAULT_DIAGRAM_THEME)!;
}

export function isKnownTheme(name: string): boolean {
  return BY_ID.has(name.toLowerCase());
}


export function seriesColor(theme: DiagramTheme, key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return theme.series[Math.abs(hash) % theme.series.length]!;
}
