"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

const STEPS = [
  {
    icon: "🫧",
    title: "Every conversation is a bubble",
    body: "You start with one big bubble — your main conversation. Click it to jump in and start chatting with the assistant.",
  },
  {
    icon: "✨",
    title: "Highlight to branch",
    body: "Select any part of a reply and choose “Ask in a new bubble” to spin up a focused, independent conversation about just that piece.",
  },
  {
    icon: "🌳",
    title: "Zoom out to see the tree",
    body: "Leave a conversation to reveal the whole map. Bubbles shrink as they get deeper — branches of branches, as far as you want to go.",
  },
  {
    icon: "💥",
    title: "Pop what you don't need",
    body: "Cmd/Ctrl-click a bubble (or use its menu) to pop it. You'll always be asked what to do with any of its branches first.",
  },
];

export function Onboarding({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-title"
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            className="glass-surface relative z-10 w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl"
          >
            <span className="text-4xl">{current.icon}</span>
            <h2 id="onboarding-title" className="mt-3 text-lg font-semibold" style={{ color: "var(--foreground)" }}>
              {current.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
              {current.body}
            </p>

            <div className="mt-5 flex items-center justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <span
                  key={i}
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: i === step ? 18 : 6,
                    background: i === step ? "var(--accent)" : "var(--border)",
                  }}
                />
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={onDone}
                className="focus-ring rounded-xl px-3 py-2 text-sm font-medium transition-colors hover:bg-[var(--background-alt)]"
                style={{ color: "var(--foreground-muted)" }}
              >
                Skip
              </button>
              <button
                type="button"
                onClick={() => (isLast ? onDone() : setStep((s) => s + 1))}
                className="focus-ring rounded-xl px-4 py-2 text-sm font-semibold text-white"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
              >
                {isLast ? "Start exploring" : "Next"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
