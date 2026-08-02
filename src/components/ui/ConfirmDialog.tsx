"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

export interface ConfirmDialogOption {
  label: string;
  description?: string;
  value: string;
  tone?: "default" | "danger";
}

export function ConfirmDialog({
  open,
  title,
  description,
  options,
  cancelLabel = "Cancel",
  onSelect,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  options: ConfirmDialogOption[];
  cancelLabel?: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 8 }}
            transition={{ type: "spring", stiffness: 340, damping: 28 }}
            className="glass-surface relative z-10 w-full max-w-sm rounded-2xl p-5 shadow-2xl"
          >
            <h2 id="confirm-dialog-title" className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              {title}
            </h2>
            {description && (
              <p className="mt-1.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
                {description}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {options.map((opt, i) => (
                <button
                  key={opt.value}
                  ref={i === 0 ? firstButtonRef : undefined}
                  type="button"
                  onClick={() => onSelect(opt.value)}
                  className={`focus-ring rounded-xl border px-3.5 py-2.5 text-left text-sm font-medium transition-colors ${
                    opt.tone === "danger"
                      ? "border-transparent"
                      : "hover:bg-[var(--background-alt)]"
                  }`}
                  style={
                    opt.tone === "danger"
                      ? { background: "var(--danger)", color: "white" }
                      : { borderColor: "var(--border)", color: "var(--foreground)" }
                  }
                >
                  {opt.label}
                  {opt.description && (
                    <span
                      className="mt-0.5 block text-xs font-normal"
                      style={{ color: opt.tone === "danger" ? "rgba(255,255,255,0.85)" : "var(--foreground-muted)" }}
                    >
                      {opt.description}
                    </span>
                  )}
                </button>
              ))}
              <button
                type="button"
                onClick={onCancel}
                className="focus-ring mt-1 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--background-alt)]"
                style={{ color: "var(--foreground-muted)" }}
              >
                {cancelLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
