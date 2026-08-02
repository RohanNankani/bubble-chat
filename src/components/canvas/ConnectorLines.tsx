"use client";

import type { Conversation } from "@/types";
import { bubbleSizeForDepth } from "@/lib/layout";
import { bubbleColors } from "./Bubble";

export function ConnectorLines({
  conversations,
  activeId,
}: {
  conversations: Record<string, Conversation>;
  activeId: string | null;
}) {
  const links = Object.values(conversations).flatMap((conv) => {
    if (!conv.parentId) return [];
    const parent = conversations[conv.parentId];
    if (!parent) return [];
    return [{ parent, child: conv }];
  });

  return (
    <svg
      className="pointer-events-none absolute"
      style={{ left: 0, top: 0, width: 1, height: 1, overflow: "visible" }}
      aria-hidden
    >
      <defs>
        {links.map(({ parent, child }) => {
          const [, c2] = bubbleColors(child.depth);
          return (
            <linearGradient
              key={`grad-${child.id}`}
              id={`link-grad-${child.id}`}
              gradientUnits="userSpaceOnUse"
              x1={parent.position.x}
              y1={parent.position.y}
              x2={child.position.x}
              y2={child.position.y}
            >
              <stop offset="0%" stopColor={c2} stopOpacity="0.15" />
              <stop offset="100%" stopColor={c2} stopOpacity="0.65" />
            </linearGradient>
          );
        })}
      </defs>
      {links.map(({ parent, child }) => {
        const isHighlighted = activeId === child.id || activeId === parent.id;
        const x1 = parent.position.x;
        const y1 = parent.position.y;
        const x2 = child.position.x;
        const y2 = child.position.y;
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
        const parentRadius = bubbleSizeForDepth(parent.depth) / 2 - 4;
        const childRadius = bubbleSizeForDepth(child.depth) / 2 - 4;
        const angle = Math.atan2(y2 - y1, x2 - x1);
        const sx = x1 + Math.cos(angle) * parentRadius;
        const sy = y1 + Math.sin(angle) * parentRadius;
        const ex = x2 - Math.cos(angle) * childRadius;
        const ey = y2 - Math.sin(angle) * childRadius;

        return (
          <path
            key={child.id}
            d={`M ${sx} ${sy} Q ${midX} ${midY} ${ex} ${ey}`}
            fill="none"
            stroke={`url(#link-grad-${child.id})`}
            strokeWidth={isHighlighted ? 3 : 2}
            strokeLinecap="round"
            opacity={isHighlighted ? 1 : 0.7}
          />
        );
      })}
    </svg>
  );
}
