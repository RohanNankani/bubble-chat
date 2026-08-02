"use client";

import { useEffect, useRef, useState } from "react";

export function MessageInput({
  onSend,
  onStop,
  isStreaming,
  disabled,
  placeholder = "Message…",
}: {
  onSend: (text: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(200, el.scrollHeight)}px`;
  }, [value]);

  function submit() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <div className="glass-surface flex items-end gap-2 rounded-2xl p-2 shadow-lg">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder={placeholder}
        aria-label="Message input"
        className="focus-ring max-h-[200px] flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] outline-none placeholder:opacity-50"
        style={{ color: "var(--foreground)" }}
      />
      {isStreaming ? (
        <button
          type="button"
          onClick={onStop}
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors"
          style={{ background: "var(--background-alt)", color: "var(--foreground)" }}
          aria-label="Stop generating"
          title="Stop generating"
        >
          <span className="h-3 w-3 rounded-[3px]" style={{ background: "var(--foreground)" }} />
        </button>
      ) : (
        <button
          type="button"
          onClick={submit}
          disabled={!value.trim() || disabled}
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-35"
          style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-2))" }}
          aria-label="Send message"
          title="Send message"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
