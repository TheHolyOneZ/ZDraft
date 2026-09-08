import { create } from "zustand";

import type { Layout } from "../core/sidecar/types";


export type HistoryEntry =
  | {
      kind: "source";

      label: string;
    }
  | {
      kind: "layout";
      label: string;
      before: Layout;
      after: Layout;
    };


const LIMIT = 200;

interface HistoryState {
  past: HistoryEntry[];
  future: HistoryEntry[];


  applying: boolean;

  record(entry: HistoryEntry): void;

  takeUndo(): HistoryEntry | null;
  takeRedo(): HistoryEntry | null;

  withApplying<T>(run: () => T): T;
  clear(): void;

  canUndo(): boolean;
  canRedo(): boolean;

  nextUndoLabel(): string | null;
  nextRedoLabel(): string | null;
}

export const useHistoryStore = create<HistoryState>()((set, get) => ({
  past: [],
  future: [],
  applying: false,

  record: (entry) => {
    if (get().applying) return;

    set((s) => ({
      past: [...s.past, entry].slice(-LIMIT),

      future: [],
    }));
  },

  takeUndo: () => {
    const { past, future } = get();
    const entry = past[past.length - 1];
    if (!entry) return null;

    set({ past: past.slice(0, -1), future: [...future, entry] });
    return entry;
  },

  takeRedo: () => {
    const { past, future } = get();
    const entry = future[future.length - 1];
    if (!entry) return null;

    set({ past: [...past, entry], future: future.slice(0, -1) });
    return entry;
  },

  withApplying: (run) => {
    set({ applying: true });
    try {
      return run();
    } finally {
      set({ applying: false });
    }
  },


  clear: () => set({ past: [], future: [], applying: false }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  nextUndoLabel: () => get().past[get().past.length - 1]?.label ?? null,
  nextRedoLabel: () => get().future[get().future.length - 1]?.label ?? null,
}));
