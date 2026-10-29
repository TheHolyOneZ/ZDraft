import { create } from "zustand";

export interface ConfirmChoice<T extends string = string> {
  id: T;
  label: string;
  variant?: "primary" | "ghost" | "danger";
}

export interface ConfirmRequest<T extends string = string> {
  title: string;
  body?: string;
  choices: readonly ConfirmChoice<T>[];

  dismiss: T;
}

interface Pending extends ConfirmRequest {
  resolve(choice: string): void;
}

interface ConfirmState {
  pending: Pending | null;
  ask<T extends string>(request: ConfirmRequest<T>): Promise<T>;
  answer(choice: string): void;
}

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  pending: null,

  ask: (request) =>
    new Promise((resolve) => {
      get().pending?.resolve(get().pending!.dismiss);
      set({ pending: { ...request, resolve: resolve as (choice: string) => void } });
    }),

  answer: (choice) => {
    const pending = get().pending;
    if (!pending) return;
    set({ pending: null });
    pending.resolve(choice);
  },
}));

export const confirm = <T extends string>(request: ConfirmRequest<T>): Promise<T> =>
  useConfirmStore.getState().ask(request);
