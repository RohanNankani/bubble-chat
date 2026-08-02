"use client";

import { AnimatePresence, motion } from "framer-motion";

export interface SelectionInfo {
  text: string;
  messageId: string;
  rect: { top: number; left: number; width: number };
}

export function SelectionPopover({
  selection,
  onAsk,
}: {
  selection: SelectionInfo | null;
  onAsk: () => void;
}) {
  return (
    <AnimatePresence>
      {selection && (
        <motion.div
          initial={{ opacity: 0, y: 6, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 420, damping: 28 }}
          className="glass-surface fixed z-50 flex items-center gap-1.5 rounded-full px-1.5 py-1.5 shadow-xl"
          style={{
            top: selection.rect.top,
            left: selection.rect.left + selection.rect.width / 2,
            transform: "translate(-50%, calc(-100% - 10px))",
          }}
        >
          <button
            type="button"
            onMouseDown={(e) => {
              // Prevent this click from clearing the text selection before we read it.
              e.preventDefault();
            }}
            onClick={onAsk}
            className="focus-ring flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
            style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 16v.01M12 8a2.5 2.5 0 0 1 2 4c-.6.6-1 .9-1.4 1.4-.35.4-.6.85-.6 1.6" />
            </svg>
            Ask in a new bubble
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
