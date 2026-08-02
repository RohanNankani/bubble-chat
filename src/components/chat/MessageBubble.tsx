"use client";

import { motion } from "framer-motion";
import type { Message } from "@/types";
import { Markdown } from "./Markdown";

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--foreground-muted)" }}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export function MessageBubble({
  message,
  onRetry,
}: {
  message: Message;
  onRetry?: () => void;
}) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: "easeOut" }}
      data-message-id={message.id}
      data-role={message.role}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[min(680px,88%)] rounded-2xl px-4 py-3 text-[15px] ${
          isUser ? "rounded-br-md" : "rounded-bl-md"
        }`}
        style={
          isUser
            ? {
                background: "linear-gradient(135deg, var(--accent), var(--accent-2))",
                color: "white",
              }
            : {
                background: "var(--surface-solid)",
                border: "1px solid var(--border)",
                color: "var(--foreground)",
              }
        }
      >
        {message.status === "pending" && !message.content ? (
          <TypingDots />
        ) : message.status === "error" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {message.errorMessage ?? "Something went wrong generating a response."}
            </p>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-[var(--background-alt)]"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <path d="M21 3v6h-6" />
                </svg>
                Retry
              </button>
            )}
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
        ) : (
          <>
            <Markdown content={message.content} />
            {message.status === "streaming" && (
              <span
                className="ml-0.5 inline-block h-4 w-[2px] animate-pulse align-middle"
                style={{ background: "var(--accent)" }}
              />
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}
