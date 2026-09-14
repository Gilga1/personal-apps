import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "../../state/toastStore";

export function ToastStack() {
  const { toasts, dismiss } = useToastStore();

  return (
    <div className="toast-stack" aria-live="polite">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            className={`toast toast-${toast.kind}`}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22 }}
          >
            <div className="toast-body">
              <span>{toast.message}</span>
              {toast.kind !== "progress" && (
                <button
                  type="button"
                  className="toast-close"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss"
                >
                  ×
                </button>
              )}
            </div>
            {toast.kind === "progress" && toast.progress !== undefined && (
              <div className="toast-bar">
                <div
                  className="toast-bar-fill"
                  style={{ width: `${Math.min(100, toast.progress)}%` }}
                />
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
