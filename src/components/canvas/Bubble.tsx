"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { Conversation } from "@/types";
import { bubbleSizeForDepth } from "@/lib/layout";

const DEPTH_COLORS: [string, string][] = [
  ["#7c6bff", "#5b8ef7"],
  ["#5b8ef7", "#4fc3e8"],
  ["#4fc3e8", "#3fb28f"],
  ["#3fb28f", "#f2c14e"],
  ["#f2c14e", "#f2895e"],
  ["#f2895e", "#ec6c9a"],
  ["#ec6c9a", "#7c6bff"],
];

export function bubbleColors(depth: number): [string, string] {
  return DEPTH_COLORS[depth % DEPTH_COLORS.length];
}

export function Bubble({
  conversation,
  isActive,
  isPopping,
  onEnter,
  onPopRequest,
}: {
  conversation: Conversation;
  isActive: boolean;
  isPopping: boolean;
  onEnter: () => void;
  onPopRequest: (withModifier: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const size = bubbleSizeForDepth(conversation.depth);
  const [c1, c2] = bubbleColors(conversation.depth);
  // Centered directly via left/top (offset by half the bubble size) rather
  // than a translate(-50%,-50%) style shorthand — framer-motion only
  // recognizes specific transform keys (x, y, scale, ...) in `style`, so an
  // arbitrary "translateX" property is silently dropped from the computed
  // CSS transform, leaving bubbles pinned to their top-left corner.
  //
  // Positions are plain (possibly negative) pixel offsets from the world
  // origin — position:absolute supports negative left/top natively, so
  // there's no need to bake in a large positive offset "just in case".
  const left = conversation.position.x - size / 2;
  const top = conversation.position.y - size / 2;
  const isRoot = conversation.parentId === null;
  const isEmpty = conversation.messages.length === 0;

  const lastAssistant = [...conversation.messages].reverse().find((m) => m.role === "assistant" && m.content);
  const preview = isEmpty
    ? "Tap to start chatting"
    : lastAssistant?.content?.slice(0, 90) ?? "…";

  return (
    <motion.button
      type="button"
      className="group absolute flex items-center justify-center rounded-full text-left focus-ring"
      style={{
        left,
        top,
        width: size,
        height: size,
        zIndex: isActive ? 30 : hovered ? 20 : 10,
      }}
      initial={false}
      animate={{
        scale: isPopping ? 0 : hovered ? 1.045 : 1,
        opacity: isPopping ? 0 : 1,
      }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          e.stopPropagation();
          onPopRequest(true);
          return;
        }
        onEnter();
      }}
      aria-label={`${isRoot ? "Main topic" : "Conversation"}: ${conversation.title}. ${
        conversation.messages.length
      } messages. Press to open, or Cmd/Ctrl-click to delete.`}
      title={conversation.title}
    >
      <span
        className={`pointer-events-none absolute inset-0 rounded-full transition-shadow duration-300 ${
          isActive ? "animate-float" : ""
        }`}
        style={{
          background: `radial-gradient(circle at 32% 28%, ${c2}, ${c1} 68%)`,
          boxShadow: isActive
            ? `0 0 0 4px color-mix(in srgb, ${c1} 45%, transparent), 0 18px 45px -12px hsl(var(--shadow-color) / 0.55)`
            : `0 12px 32px -14px hsl(var(--shadow-color) / 0.45)`,
        }}
      />
      <span
        className="pointer-events-none absolute inset-[3px] rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle at 30% 22%, rgba(255,255,255,0.55), transparent 55%)",
        }}
      />
      <span className="relative flex flex-col items-center justify-center gap-1 px-[14%] text-center">
        <span
          className="font-semibold leading-tight text-white drop-shadow-sm"
          style={{
            fontSize: Math.max(11, Math.min(18, size * 0.086)),
            display: "-webkit-box",
            WebkitLineClamp: size > 140 ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {conversation.title}
        </span>
        {size > 110 && (
          <span
            className="leading-snug text-white/80"
            style={{
              fontSize: Math.max(9, Math.min(12.5, size * 0.05)),
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {preview}
          </span>
        )}
        {conversation.childIds.length > 0 && size > 80 && (
          <span className="mt-0.5 rounded-full bg-white/25 px-2 py-0.5 text-[10px] font-medium text-white">
            {conversation.childIds.length} branch{conversation.childIds.length === 1 ? "" : "es"}
          </span>
        )}
      </span>
    </motion.button>
  );
}
