import { create } from "zustand";
import { persist } from "zustand/middleware";


interface TourState {
  seen: boolean;
  running: boolean;

  step: number;

  start(): void;

  end(): void;
  go(step: number): void;
}

export const useTourStore = create<TourState>()(
  persist(
    (set) => ({
      seen: false,
      running: false,
      step: 0,

      start: () => set({ running: true, step: 0 }),
      end: () => set({ running: false, seen: true, step: 0 }),
      go: (step) => set({ step: Math.max(0, step) }),
    }),
    {
      name: "zdraft.tour",
      partialize: (s) => ({ seen: s.seen }),
    },
  ),
);
