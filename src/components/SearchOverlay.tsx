"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { bubbleColors } from "@/components/canvas/Bubble";

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const conversations = useStore((s) => s.conversations);
  const enterConversation = useStore((s) => s.enterConversation);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const results = useMemo(() => {
    const list = Object.values(conversations);
    const q = query.trim().toLowerCase();
    const filtered = q
      ? list.filter(
          (c) =>
            c.title.toLowerCase().includes(q) ||
            c.messages.some((m) => m.content.toLowerCase().includes(q)) ||
            c.sourceText?.toLowerCase().includes(q),
        )
      : list;
    return filtered.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
  }, [conversations, query]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-start justify-center p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Search conversations"
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className="glass-surface relative z-10 w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl"
          >
            <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" style={{ color: "var(--foreground-muted)" }}>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") onClose();
                  if (e.key === "Enter" && results[0]) {
                    enterConversation(results[0].id);
                    onClose();
                  }
                }}
                placeholder="Search conversations…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:opacity-50"
                style={{ color: "var(--foreground)" }}
              />
              <kbd
                className="rounded border px-1.5 py-0.5 text-[10px]"
                style={{ borderColor: "var(--border)", color: "var(--foreground-muted)" }}
              >
                Esc
              </kbd>
            </div>
            <div className="max-h-[50vh] overflow-y-auto p-2">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm" style={{ color: "var(--foreground-muted)" }}>
                  No conversations match “{query}”.
                </p>
              ) : (
                results.map((c) => {
                  const [c1, c2] = bubbleColors(c.depth);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        enterConversation(c.id);
                        onClose();
                      }}
                      className="focus-ring flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--background-alt)]"
                    >
                      <span
                        className="h-7 w-7 shrink-0 rounded-full"
                        style={{ background: `radial-gradient(circle at 32% 28%, ${c2}, ${c1})` }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium" style={{ color: "var(--foreground)" }}>
                          {c.title}
                        </span>
                        <span className="block truncate text-xs" style={{ color: "var(--foreground-muted)" }}>
                          {c.messages.length} message{c.messages.length === 1 ? "" : "s"}
                          {c.depth > 0 ? ` · depth ${c.depth}` : " · root"}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
