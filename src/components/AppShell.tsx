"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { BubbleCanvas } from "@/components/canvas/BubbleCanvas";
import { ConversationView } from "@/components/chat/ConversationView";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { ToastHost } from "@/components/ui/ToastHost";
import { SearchOverlay } from "@/components/SearchOverlay";
import { Onboarding } from "@/components/Onboarding";
import { Tooltip } from "@/components/ui/Tooltip";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToastStore } from "@/lib/toastStore";

export function AppShell() {
  const hydrated = useStore((s) => s.hydrated);
  const viewMode = useStore((s) => s.viewMode);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const rootIds = useStore((s) => s.rootIds);
  const conversations = useStore((s) => s.conversations);
  const initializeIfEmpty = useStore((s) => s.initializeIfEmpty);
  const createNewRoot = useStore((s) => s.createNewRoot);
  const loadDemoTree = useStore((s) => s.loadDemoTree);
  const resetAll = useStore((s) => s.resetAll);
  const exitToCanvas = useStore((s) => s.exitToCanvas);
  const hasSeenOnboarding = useStore((s) => s.hasSeenOnboarding);
  const dismissOnboarding = useStore((s) => s.dismissOnboarding);
  const pushToast = useToastStore((s) => s.push);

  const [searchOpen, setSearchOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (hydrated) initializeIfEmpty();
  }, [hydrated, initializeIfEmpty]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const typing = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (viewMode === "conversation") {
          exitToCanvas();
        }
        return;
      }
      if (!typing && e.key === "/") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewMode, exitToCanvas, searchOpen]);

  const conversationCount = Object.keys(conversations).length;
  const showConversation = viewMode === "conversation" && activeConversationId && conversations[activeConversationId];

  return (
    <div className="relative h-dvh w-full overflow-hidden" style={{ background: "var(--background)" }}>
      <div className="absolute inset-0">
        <motion.div
          animate={{
            opacity: viewMode === "canvas" ? 1 : 0,
            scale: viewMode === "canvas" ? 1 : 1.05,
          }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          style={{ pointerEvents: viewMode === "canvas" ? "auto" : "none" }}
          className="absolute inset-0"
        >
          {rootIds.length > 0 && <BubbleCanvas />}
        </motion.div>

        {showConversation && (
          <div className="absolute inset-0 z-30">
            <ConversationView conversationId={activeConversationId} />
          </div>
        )}
      </div>

      {viewMode === "canvas" && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between gap-3 p-4 sm:p-5">
          <div className="pointer-events-auto flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full text-base"
              style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
              aria-hidden
            >
              🫧
            </span>
            <div className="glass-surface hidden rounded-full px-3 py-1.5 text-xs font-medium sm:block" style={{ color: "var(--foreground-muted)" }}>
              {conversationCount} bubble{conversationCount === 1 ? "" : "s"}
            </div>
          </div>

          <div className="pointer-events-auto flex items-center gap-2">
            <Tooltip label="Start a new main topic">
              <button
                type="button"
                onClick={() => createNewRoot()}
                className="focus-ring flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
                style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New topic
              </button>
            </Tooltip>

            <Tooltip label="Search conversations (⌘K)">
              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className="focus-ring flex h-9 items-center gap-2 rounded-full border px-3.5 text-xs font-medium transition-colors hover:bg-[var(--background-alt)]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                Search
                <kbd className="hidden text-[10px] opacity-60 sm:inline">⌘K</kbd>
              </button>
            </Tooltip>

            <div className="relative">
              <Tooltip label="More options">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="focus-ring flex h-9 w-9 items-center justify-center rounded-full border transition-colors hover:bg-[var(--background-alt)]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  aria-label="More options"
                  aria-expanded={menuOpen}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                    <circle cx="12" cy="5" r="1.2" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
                    <circle cx="12" cy="19" r="1.2" fill="currentColor" stroke="none" />
                  </svg>
                </button>
              </Tooltip>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div
                    className="glass-surface absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl py-1.5 shadow-xl"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        loadDemoTree();
                        pushToast("Loaded a sample branching conversation.", "success");
                      }}
                      className="focus-ring flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-[var(--background-alt)]"
                      style={{ color: "var(--foreground)" }}
                    >
                      🌱 Load demo tree
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        useStore.setState({ hasSeenOnboarding: false });
                      }}
                      className="focus-ring flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-[var(--background-alt)]"
                      style={{ color: "var(--foreground)" }}
                    >
                      💡 Replay onboarding
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setResetConfirmOpen(true);
                      }}
                      className="focus-ring flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm hover:bg-[var(--background-alt)]"
                      style={{ color: "var(--danger)" }}
                    >
                      🗑️ Reset everything
                    </button>
                  </div>
                </>
              )}
            </div>

            <ThemeToggle />
          </div>
        </div>
      )}

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      <Onboarding open={hydrated && !hasSeenOnboarding} onDone={dismissOnboarding} />
      <ToastHost />

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset everything?"
        description="This permanently deletes every conversation and bubble, and starts fresh with a single root bubble."
        options={[{ value: "confirm", label: "Reset everything", tone: "danger" }]}
        onSelect={() => {
          setResetConfirmOpen(false);
          resetAll();
          pushToast("Everything has been reset.", "success");
        }}
        onCancel={() => setResetConfirmOpen(false)}
      />
    </div>
  );
}
