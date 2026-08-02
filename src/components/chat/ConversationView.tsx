"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useStore, getDescendantCount } from "@/lib/store";
import { useToastStore } from "@/lib/toastStore";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { SelectionPopover, type SelectionInfo } from "./SelectionPopover";
import { BranchModal } from "./BranchModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";
import { bubbleColors } from "@/components/canvas/Bubble";

const SUGGESTIONS = [
  "Give me a quick overview to start with",
  "What's the most important thing to know here?",
  "Explain this like I'm new to the topic",
];

export function ConversationView({ conversationId }: { conversationId: string }) {
  const conversation = useStore((s) => s.conversations[conversationId]);
  const conversations = useStore((s) => s.conversations);
  const sendMessage = useStore((s) => s.sendMessage);
  const retryMessage = useStore((s) => s.retryMessage);
  const stopStreaming = useStore((s) => s.stopStreaming);
  const exitToCanvas = useStore((s) => s.exitToCanvas);
  const enterConversation = useStore((s) => s.enterConversation);
  const renameConversation = useStore((s) => s.renameConversation);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const rootIds = useStore((s) => s.rootIds);
  const createBranch = useStore((s) => s.createBranch);
  const pushToast = useToastStore((s) => s.push);

  const listRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [branchSource, setBranchSource] = useState<SelectionInfo | null>(null);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [popConfirmOpen, setPopConfirmOpen] = useState(false);

  const isStreaming = useMemo(
    () => conversation?.messages.some((m) => m.status === "streaming" || m.status === "pending") ?? false,
    [conversation?.messages],
  );

  const lastMessageContent = conversation?.messages.at(-1)?.content;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [conversation?.messages.length, lastMessageContent]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    function handleSelectionEvent() {
      // Ignore selection changes while the branch modal is open — typing in
      // its textarea fires keyup/mouseup on document and would otherwise
      // wipe out the selection the modal is about to submit.
      if (branchModalOpen) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null);
        return;
      }
      const anchorEl = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      const focusEl = sel.focusNode instanceof Element ? sel.focusNode : sel.focusNode?.parentElement;
      const container = listRef.current;
      if (!container || !anchorEl || !focusEl || !container.contains(anchorEl)) {
        setSelection(null);
        return;
      }
      const anchorMsg = anchorEl.closest("[data-message-id]");
      const focusMsg = focusEl.closest("[data-message-id]");
      if (!anchorMsg || !focusMsg || anchorMsg !== focusMsg) {
        setSelection(null);
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelection(null);
        return;
      }
      const rect = sel.getRangeAt(0).getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;
      setSelection({
        text,
        messageId: anchorMsg.getAttribute("data-message-id") ?? "",
        rect: { top: rect.top, left: rect.left, width: rect.width },
      });
    }

    function handlePointerDown(e: MouseEvent) {
      if (popoverRef.current?.contains(e.target as Node)) return;
    }

    document.addEventListener("mouseup", handleSelectionEvent);
    document.addEventListener("keyup", handleSelectionEvent);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mouseup", handleSelectionEvent);
      document.removeEventListener("keyup", handleSelectionEvent);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [branchModalOpen]);

  if (!conversation) return null;

  const ancestors: NonNullable<typeof conversation>[] = [];
  let cursor = conversation.parentId ? conversations[conversation.parentId] : null;
  while (cursor) {
    ancestors.unshift(cursor);
    cursor = cursor.parentId ? conversations[cursor.parentId] : null;
  }

  const [c1, c2] = bubbleColors(conversation.depth);
  const descendantCount = getDescendantCount(conversations, conversation.id);
  const isRoot = conversation.parentId === null;

  function handleAskInBubble() {
    if (!selection) return;
    setBranchSource(selection);
    setBranchModalOpen(true);
  }

  async function handleBranchSubmit(question: string) {
    const source = branchSource;
    if (!source) return;
    setBranchModalOpen(false);
    const sourceMessage = conversation.messages.find((m) => m.id === source.messageId);
    const contextSnippet = sourceMessage?.content ?? source.text;
    clearSelection();
    setBranchSource(null);
    try {
      await createBranch({
        parentId: conversation.id,
        sourceMessageId: source.messageId,
        sourceText: source.text,
        contextSnippet,
        question,
      });
    } catch {
      pushToast("Couldn't create the branch. Please try again.", "error");
    }
  }

  function saveTitle() {
    setEditingTitle(false);
    if (titleDraft.trim()) renameConversation(conversation.id, titleDraft.trim());
  }

  function confirmPop(strategy: string) {
    setPopConfirmOpen(false);
    deleteConversation(conversation.id, strategy as "cascade" | "reparent");
    exitToCanvas();
    pushToast("Bubble popped.", "success");
  }

  return (
    <motion.div
      key={conversation.id}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="flex h-full w-full flex-col"
      style={{ background: "var(--background)" }}
    >
      <header
        className="glass-surface z-20 flex flex-col gap-2 border-b px-4 py-3 sm:px-6"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Tooltip label="Back to canvas (Esc)">
            <button
              type="button"
              onClick={exitToCanvas}
              className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-[var(--background-alt)]"
              style={{ borderColor: "var(--border)" }}
              aria-label="Back to canvas"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
          </Tooltip>

          <span
            className="hidden h-8 w-8 shrink-0 rounded-full sm:block"
            style={{ background: `radial-gradient(circle at 32% 28%, ${c2}, ${c1})` }}
            aria-hidden
          />

          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
              className="focus-ring min-w-0 flex-1 rounded-lg border px-2 py-1 text-sm font-semibold"
              style={{ borderColor: "var(--border)", background: "var(--surface-solid)", color: "var(--foreground)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitleDraft(conversation.title);
                setEditingTitle(true);
              }}
              className="focus-ring min-w-0 flex-1 truncate rounded-lg px-1.5 py-1 text-left text-sm font-semibold hover:bg-[var(--background-alt)]"
              style={{ color: "var(--foreground)" }}
              title="Rename conversation"
            >
              {conversation.title}
            </button>
          )}

          {(!isRoot || rootIds.length > 1) && (
            <Tooltip label={isRoot ? "Pop this topic" : "Pop this bubble"}>
              <button
                type="button"
                onClick={() => setPopConfirmOpen(true)}
                className="focus-ring flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-[var(--danger)] hover:text-white"
                style={{ borderColor: "var(--border)" }}
                aria-label={isRoot ? "Pop this topic" : "Pop this bubble"}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6" />
                </svg>
              </button>
            </Tooltip>
          )}
        </div>

        {(ancestors.length > 0 || conversation.branchQuestion) && (
          <div className="flex flex-wrap items-center gap-1.5 pl-12 text-xs" style={{ color: "var(--foreground-muted)" }}>
            {ancestors.map((a) => (
              <span key={a.id} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => enterConversation(a.id)}
                  className="focus-ring max-w-[140px] truncate rounded-md px-1.5 py-0.5 hover:bg-[var(--background-alt)] hover:underline"
                >
                  {a.title}
                </button>
                <span aria-hidden>›</span>
              </span>
            ))}
            <span className="max-w-[220px] truncate font-medium" style={{ color: "var(--foreground)" }}>
              {conversation.title}
            </span>
          </div>
        )}

        {conversation.sourceText && (
          <div
            className="ml-12 flex items-start gap-2 rounded-lg border-l-2 px-3 py-2 text-xs italic"
            style={{ borderColor: "var(--accent)", background: "var(--background-alt)", color: "var(--foreground-muted)" }}
          >
            <span className="mt-0.5 shrink-0 not-italic">🫧</span>
            <span>Branched from: “{conversation.sourceText}”</span>
          </div>
        )}
      </header>

      <div ref={listRef} className="relative flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {conversation.messages.length === 0 ? (
            <div className="flex flex-col items-center gap-4 pt-16 text-center">
              <span
                className="flex h-16 w-16 items-center justify-center rounded-full text-2xl"
                style={{ background: `radial-gradient(circle at 32% 28%, ${c2}, ${c1})` }}
              >
                💬
              </span>
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
                  {isRoot ? "Start the conversation" : "This bubble is ready"}
                </h2>
                <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--foreground-muted)" }}>
                  Ask anything. You can later highlight any reply to spin off a focused new bubble.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => sendMessage(conversation.id, s)}
                    className="focus-ring rounded-full border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--background-alt)]"
                    style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            conversation.messages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onRetry={m.status === "error" ? () => retryMessage(conversation.id, m.id) : undefined}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="px-4 pb-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          {descendantCount > 0 && (
            <p className="mb-1.5 text-center text-[11px]" style={{ color: "var(--foreground-muted)" }}>
              {descendantCount} branch{descendantCount === 1 ? "" : "es"} grew from this conversation
            </p>
          )}
          <MessageInput
            onSend={(text) => sendMessage(conversation.id, text)}
            onStop={() => stopStreaming(conversation.id)}
            isStreaming={isStreaming}
            placeholder={isRoot ? "Message the assistant…" : "Continue this branch…"}
          />
        </div>
      </div>

      <div ref={popoverRef}>
        <SelectionPopover selection={selection} onAsk={handleAskInBubble} />
      </div>

      <BranchModal
        open={branchModalOpen}
        sourceText={branchSource?.text ?? ""}
        onSubmit={handleBranchSubmit}
        onCancel={() => {
          setBranchModalOpen(false);
          setBranchSource(null);
        }}
      />

      <ConfirmDialog
        open={popConfirmOpen}
        title={`Pop "${conversation.title}"?`}
        description={
          descendantCount > 0
            ? `This bubble has ${descendantCount} descendant conversation${descendantCount === 1 ? "" : "s"}. Choose what should happen to ${descendantCount === 1 ? "it" : "them"}.`
            : "This will permanently delete this conversation."
        }
        options={
          descendantCount > 0
            ? [
                {
                  value: "cascade",
                  label: isRoot ? "Delete this topic and all its branches" : "Delete this bubble and all its branches",
                  description: `Removes ${descendantCount + 1} conversations total.`,
                  tone: "danger",
                },
                ...(isRoot
                  ? []
                  : [{ value: "reparent", label: "Delete only this bubble", description: "Its branches reconnect to its parent instead." }]),
              ]
            : [{ value: "cascade", label: isRoot ? "Delete this topic" : "Delete this bubble", tone: "danger" }]
        }
        onSelect={confirmPop}
        onCancel={() => setPopConfirmOpen(false)}
      />
    </motion.div>
  );
}
