import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WorkspaceState {

  root: string | null;

  version: number;

  recent: string[];


  lastFile: string | null;


  viewports: Record<string, { x: number; y: number; zoom: number }>;

  setRoot(path: string): void;
  setLastFile(path: string | null): void;
  rememberViewport(path: string, viewport: { x: number; y: number; zoom: number }): void;
  refresh(): void;
  forget(path: string): void;


  closeRoot(): void;
}

const MAX_RECENT = 8;
const MAX_VIEWPORTS = 40;

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      root: null,
      version: 0,
      recent: [],
      lastFile: null,
      viewports: {},

      setRoot: (root) =>
        set((s) => ({
          root,
          version: s.version + 1,
          recent: [root, ...s.recent.filter((p) => p !== root)].slice(0, MAX_RECENT),
        })),

      setLastFile: (lastFile) => set({ lastFile }),

      rememberViewport: (path, viewport) =>
        set((s) => {
          const viewports = { ...s.viewports, [path]: viewport };


          const keys = Object.keys(viewports);
          if (keys.length > MAX_VIEWPORTS) {
            for (const key of keys.slice(0, keys.length - MAX_VIEWPORTS)) delete viewports[key];
          }
          return { viewports };
        }),

      refresh: () => set((s) => ({ version: s.version + 1 })),

      forget: (path) => set((s) => ({ recent: s.recent.filter((p) => p !== path) })),

      closeRoot: () =>
        set((s) => ({
          root: null,
          version: s.version + 1,
          recent: s.recent.filter((p) => p !== s.root),

          lastFile: null,
        })),
    }),
    {
      name: "zdraft.workspace",


      partialize: (s) => ({
        root: s.root,
        recent: s.recent,
        lastFile: s.lastFile,
        viewports: s.viewports,
      }),
    },
  ),
);
