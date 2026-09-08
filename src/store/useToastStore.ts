import { create } from "zustand";

export type ToastKind = "info" | "success" | "warning" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;

  body?: string;
  action?: { label: string; run(): void };

  timeout?: number;
}

interface ToastState {
  toasts: Toast[];
  push(toast: Omit<Toast, "id">): number;
  dismiss(id: number): void;
  clear(): void;
}

let nextId = 1;

export const useToastStore = create<ToastState>()((set, get) => ({
  toasts: [],

  push: (toast) => {
    const id = nextId++;


    const timeout = toast.timeout ?? (toast.kind === "error" ? 0 : 4200);

    set((s) => ({ toasts: [...s.toasts, { ...toast, id }] }));
    if (timeout > 0) {
      window.setTimeout(() => get().dismiss(id), timeout);
    }
    return id;
  },

  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));


export const toast = {
  info: (title: string, body?: string) => useToastStore.getState().push({ kind: "info", title, body }),
  success: (title: string, body?: string) =>
    useToastStore.getState().push({ kind: "success", title, body }),
  warning: (title: string, body?: string) =>
    useToastStore.getState().push({ kind: "warning", title, body }),
  error: (title: string, body?: string, action?: Toast["action"]) =>
    useToastStore.getState().push({ kind: "error", title, body, action }),
};
