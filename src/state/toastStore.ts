import { create } from "zustand";

export type ToastKind = "info" | "success" | "error" | "progress";

export interface Toast {
  id: string;
  message: string;
  kind: ToastKind;
  progress?: number;
}

interface ToastState {
  toasts: Toast[];
  push: (message: string, kind?: ToastKind, progress?: number) => string;
  update: (id: string, message: string, kind?: ToastKind, progress?: number) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, kind = "info", progress) => {
    const id = `toast-${++counter}`;
    set((state) => ({
      toasts: [...state.toasts, { id, message, kind, progress }],
    }));
    return id;
  },
  update: (id, message, kind, progress) => {
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id
          ? {
              ...t,
              message,
              kind: kind ?? t.kind,
              progress: progress ?? t.progress,
            }
          : t,
      ),
    }));
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));
