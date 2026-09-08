import { create } from "zustand";
import { persist } from "zustand/middleware";

import { DEFAULT_DIAGRAM_THEME } from "../core/theme";

export type AppTheme = "drafting" | "blueprint" | "paper" | "contrast";

export const APP_THEMES: Array<{ id: AppTheme; label: string; note: string }> = [
  { id: "drafting", label: "Drafting", note: "Near-black with a cold cast. The default." },
  { id: "blueprint", label: "Blueprint", note: "Deep blue, cyan hairlines." },
  { id: "paper", label: "Paper", note: "Warm white and graphite." },
  { id: "contrast", label: "Contrast", note: "Maximum legibility." },
];


export type SplitMode = "vertical" | "horizontal" | "canvas";

interface SettingsState {
  appTheme: AppTheme;

  diagramTheme: string;
  splitMode: SplitMode;
  sidebarOpen: boolean;
  zenMode: boolean;

  splitRatio: number;
  gridSnap: number;
  autoRender: boolean;

  animateLayout: boolean;
  showGrid: boolean;
  showMinimap: boolean;

  dimUnrelated: boolean;
  editorWrap: boolean;
  lineNumbers: boolean;


  plantumlJar: string;


  diagnosticsHeight: number;

  setAppTheme(theme: AppTheme): void;
  setPlantumlJar(path: string): void;
  setDiagnosticsHeight(px: number): void;
  setDiagramTheme(id: string): void;
  cycleSplit(): void;
  setSplitMode(mode: SplitMode): void;
  toggleSidebar(): void;
  toggleZen(): void;
  setSplitRatio(ratio: number): void;
  setGridSnap(size: number): void;
  set<K extends keyof SettingsToggles>(key: K, value: SettingsToggles[K]): void;
  reset(): void;
}


type SettingsToggles = Pick<
  SettingsState,
  | "autoRender"
  | "animateLayout"
  | "showGrid"
  | "showMinimap"
  | "dimUnrelated"
  | "editorWrap"
  | "lineNumbers"
>;

const SPLIT_ORDER: SplitMode[] = ["vertical", "horizontal", "canvas"];


const DEFAULTS = {
  appTheme: "drafting",
  diagramTheme: DEFAULT_DIAGRAM_THEME,
  splitMode: "vertical",
  sidebarOpen: true,
  zenMode: false,
  splitRatio: 0.42,
  gridSnap: 8,
  autoRender: true,
  animateLayout: true,
  showGrid: true,
  showMinimap: true,
  dimUnrelated: true,
  editorWrap: true,
  lineNumbers: true,
  plantumlJar: "",
  diagnosticsHeight: 96,
} as const satisfies Partial<SettingsState>;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appTheme: "drafting",
      diagramTheme: DEFAULT_DIAGRAM_THEME,
      splitMode: "vertical",
      sidebarOpen: true,
      zenMode: false,
      splitRatio: 0.42,

      gridSnap: 8,
      autoRender: true,
      animateLayout: true,
      showGrid: true,
      showMinimap: true,
      dimUnrelated: true,
      editorWrap: true,
      lineNumbers: true,
      plantumlJar: "",
      diagnosticsHeight: 96,

      setAppTheme: (appTheme) => set({ appTheme }),
      setPlantumlJar: (plantumlJar) => set({ plantumlJar }),


      setDiagnosticsHeight: (px) =>
        set({ diagnosticsHeight: Math.round(Math.min(520, Math.max(28, px))) }),
      setDiagramTheme: (diagramTheme) => set({ diagramTheme }),
      setSplitMode: (splitMode) => set({ splitMode }),
      cycleSplit: () =>
        set((s) => ({
          splitMode: SPLIT_ORDER[(SPLIT_ORDER.indexOf(s.splitMode) + 1) % SPLIT_ORDER.length]!,
        })),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleZen: () => set((s) => ({ zenMode: !s.zenMode })),
      setSplitRatio: (ratio) => set({ splitRatio: Math.min(0.8, Math.max(0.2, ratio)) }),
      setGridSnap: (gridSnap) => set({ gridSnap }),
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set(DEFAULTS),
    }),
    { name: "zdraft.settings" },
  ),
);
