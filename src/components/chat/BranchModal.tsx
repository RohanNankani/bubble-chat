"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export function BranchModal({
  open,
  sourceText,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  sourceText: string;
  onSubmit: (question: string) => void;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestion("");
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  function submit() {
    const trimmed = question.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="branch-modal-title"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            className="glass-surface relative z-10 w-full max-w-md rounded-2xl p-5 shadow-2xl"
          >
            <h2 id="branch-modal-title" className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
              Ask in a new bubble
            </h2>
            <p className="mt-1 text-xs" style={{ color: "var(--foreground-muted)" }}>
              This creates an independent conversation focused on the text you selected.
            </p>

            <blockquote
              className="mt-3 max-h-24 overflow-y-auto rounded-lg border-l-2 px-3 py-2 text-sm italic"
              style={{ borderColor: "var(--accent)", background: "var(--background-alt)", color: "var(--foreground-muted)" }}
            >
              “{sourceText}”
            </blockquote>

            <textarea
              ref={inputRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder="What do you want to know about this?"
              rows={3}
              className="focus-ring mt-3 w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none"
              style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--foreground)" }}
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="focus-ring rounded-xl px-3.5 py-2 text-sm font-medium transition-colors hover:bg-[var(--background-alt)]"
                style={{ color: "var(--foreground-muted)" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!question.trim()}
                className="focus-ring rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
              >
                Create bubble
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
