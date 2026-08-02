"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore, getDescendantCount } from "@/lib/store";
import { useToastStore } from "@/lib/toastStore";
import { clampScale } from "@/lib/canvas";
import { Bubble } from "./Bubble";
import { ConnectorLines } from "./ConnectorLines";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";

export function BubbleCanvas() {
  const conversations = useStore((s) => s.conversations);
  const rootIds = useStore((s) => s.rootIds);
  const activeConversationId = useStore((s) => s.activeConversationId);
  const canvasTransform = useStore((s) => s.canvasTransform);
  const setCanvasTransform = useStore((s) => s.setCanvasTransform);
  const enterConversation = useStore((s) => s.enterConversation);
  const deleteConversation = useStore((s) => s.deleteConversation);
  const pushToast = useToastStore((s) => s.push);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panState = useRef<{ x: number; y: number; startTx: number; startTy: number } | null>(null);
  const [popTargetId, setPopTargetId] = useState<string | null>(null);
  const [poppingId, setPoppingId] = useState<string | null>(null);

  const conversationList = Object.values(conversations);

  // {0,0,1} is the sentinel "uncentered" transform — set on first load and
  // again by resetAll/loadDemoTree. Whenever we see it, re-center the view
  // on the root bubble rather than only doing this once per mount.
  const isUncentered =
    canvasTransform.x === 0 && canvasTransform.y === 0 && canvasTransform.scale === 1;

  useEffect(() => {
    if (!isUncentered || rootIds.length === 0 || !viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    setCanvasTransform({ x: rect.width / 2, y: rect.height / 2, scale: 1 });
  }, [isUncentered, rootIds.length, setCanvasTransform]);

  // React attaches wheel listeners as passive by default, so preventDefault()
  // inside a synthetic onWheel handler silently no-ops (and warns). Attach a
  // native, non-passive listener instead so we can block page scroll/zoom.
  const transformRef = useRef(canvasTransform);
  useEffect(() => {
    transformRef.current = canvasTransform;
  }, [canvasTransform]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = el!.getBoundingClientRect();
      const t = transformRef.current;

      if (e.ctrlKey || e.metaKey) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldX = (mouseX - t.x) / t.scale;
        const worldY = (mouseY - t.y) / t.scale;
        const nextScale = clampScale(t.scale * (1 - e.deltaY * 0.0035));
        setCanvasTransform({
          x: mouseX - worldX * nextScale,
          y: mouseY - worldY * nextScale,
          scale: nextScale,
        });
      } else {
        setCanvasTransform({
          x: t.x - e.deltaX,
          y: t.y - e.deltaY,
          scale: t.scale,
        });
      }
    }

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setCanvasTransform]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button")) return;
      setIsPanning(true);
      panState.current = {
        x: e.clientX,
        y: e.clientY,
        startTx: canvasTransform.x,
        startTy: canvasTransform.y,
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [canvasTransform],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning || !panState.current) return;
      const dx = e.clientX - panState.current.x;
      const dy = e.clientY - panState.current.y;
      setCanvasTransform({
        x: panState.current.startTx + dx,
        y: panState.current.startTy + dy,
        scale: canvasTransform.scale,
      });
    },
    [isPanning, canvasTransform.scale, setCanvasTransform],
  );

  const endPan = useCallback(() => {
    setIsPanning(false);
    panState.current = null;
  }, []);

  function zoomBy(factor: number) {
    const rect = viewportRef.current?.getBoundingClientRect();
    const cx = rect ? rect.width / 2 : 0;
    const cy = rect ? rect.height / 2 : 0;
    const worldX = (cx - canvasTransform.x) / canvasTransform.scale;
    const worldY = (cy - canvasTransform.y) / canvasTransform.scale;
    const nextScale = clampScale(canvasTransform.scale * factor);
    setCanvasTransform({
      x: cx - worldX * nextScale,
      y: cy - worldY * nextScale,
      scale: nextScale,
    });
  }

  function resetView() {
    const rect = viewportRef.current?.getBoundingClientRect();
    setCanvasTransform({ x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2, scale: 1 });
  }

  function handlePopRequest(id: string) {
    if (conversations[id]?.parentId === null && rootIds.length <= 1) {
      pushToast("You need at least one main topic — create another before deleting this one.", "error");
      return;
    }
    setPopTargetId(id);
  }

  function confirmPop(strategy: string) {
    if (!popTargetId) return;
    const id = popTargetId;
    setPopTargetId(null);
    setPoppingId(id);
    setTimeout(() => {
      deleteConversation(id, strategy as "cascade" | "reparent");
      setPoppingId(null);
      pushToast("Bubble popped.", "success");
    }, 380);
  }

  const popTarget = popTargetId ? conversations[popTargetId] : null;
  const descendantCount = popTargetId ? getDescendantCount(conversations, popTargetId) : 0;

  return (
    <div
      ref={viewportRef}
      className="canvas-dotted-bg relative h-full w-full touch-none overflow-hidden"
      style={{
        backgroundSize: `${28 * canvasTransform.scale}px ${28 * canvasTransform.scale}px`,
        backgroundPosition: `${canvasTransform.x}px ${canvasTransform.y}px`,
        cursor: isPanning ? "grabbing" : "grab",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
      role="application"
      aria-label="Conversation bubble canvas. Drag to pan, scroll to pan, ctrl-scroll to zoom."
    >
      <div
        className="absolute"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${canvasTransform.x}px, ${canvasTransform.y}px) scale(${canvasTransform.scale})`,
          transformOrigin: "0 0",
        }}
      >
        <ConnectorLines conversations={conversations} activeId={activeConversationId} />
        {conversationList.map((conv) => (
          <Bubble
            key={conv.id}
            conversation={conv}
            isActive={conv.id === activeConversationId}
            isPopping={conv.id === poppingId}
            onEnter={() => enterConversation(conv.id)}
            onPopRequest={() => handlePopRequest(conv.id)}
          />
        ))}
      </div>

      {conversationList.length === 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-[62%] flex justify-center">
          <p
            className="animate-fade-in-up text-sm"
            style={{ color: "var(--foreground-muted)" }}
          >
            Click the bubble to start chatting — highlight any reply to branch off a new one.
          </p>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-5 right-5 flex flex-col items-end gap-2">
        <div className="glass-surface pointer-events-auto flex flex-col overflow-hidden rounded-xl shadow-lg">
          <Tooltip label="Zoom in" side="left">
            <button
              type="button"
              onClick={() => zoomBy(1.25)}
              className="focus-ring flex h-9 w-9 items-center justify-center text-lg hover:bg-[var(--background-alt)]"
              aria-label="Zoom in"
            >
              +
            </button>
          </Tooltip>
          <div style={{ borderTop: "1px solid var(--border)" }} />
          <Tooltip label="Zoom out" side="left">
            <button
              type="button"
              onClick={() => zoomBy(0.8)}
              className="focus-ring flex h-9 w-9 items-center justify-center text-lg hover:bg-[var(--background-alt)]"
              aria-label="Zoom out"
            >
              −
            </button>
          </Tooltip>
          <div style={{ borderTop: "1px solid var(--border)" }} />
          <Tooltip label="Reset view" side="left">
            <button
              type="button"
              onClick={resetView}
              className="focus-ring flex h-9 w-9 items-center justify-center text-xs hover:bg-[var(--background-alt)]"
              aria-label="Reset view"
            >
              ⤾
            </button>
          </Tooltip>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(popTarget)}
        title={`Pop "${popTarget?.title ?? ""}"?`}
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
                  label: popTarget?.parentId === null ? "Delete this topic and all its branches" : "Delete this bubble and all its branches",
                  description: `Removes ${descendantCount + 1} conversations total.`,
                  tone: "danger",
                },
                ...(popTarget?.parentId === null
                  ? []
                  : [
                      {
                        value: "reparent",
                        label: "Delete only this bubble",
                        description: "Its branches reconnect to its parent instead.",
                      },
                    ]),
              ]
            : [
                {
                  value: "cascade",
                  label: popTarget?.parentId === null ? "Delete this topic" : "Delete this bubble",
                  tone: "danger",
                },
              ]
        }
        onSelect={confirmPop}
        onCancel={() => setPopTargetId(null)}
      />
    </div>
  );
}
