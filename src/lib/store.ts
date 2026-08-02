import { create, type StoreApi } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  CanvasPosition,
  CanvasTransform,
  Conversation,
  Message,
  ViewMode,
} from "@/types";
import { createId } from "./id";
import { computeChildPosition, computeRootPosition } from "./layout";
import { aiProvider } from "./ai";

// --- Debounced localStorage adapter -----------------------------------
// Streaming responses update state many times per second; writing to
// localStorage synchronously on every token would be wasteful. Batch
// writes on a short timer instead.
function createDebouncedStorage(delay = 250): StateStorage {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { key: string; value: string } | null = null;

  return {
    getItem: (key) => {
      if (typeof window === "undefined") return null;
      return window.localStorage.getItem(key);
    },
    setItem: (key, value) => {
      pending = { key, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (pending && typeof window !== "undefined") {
          window.localStorage.setItem(pending.key, pending.value);
        }
        pending = null;
        timer = null;
      }, delay);
    },
    removeItem: (key) => {
      if (typeof window !== "undefined") window.localStorage.removeItem(key);
    },
  };
}

// Abort controllers are not serializable and don't belong in persisted
// state; keep them in a module-level map keyed by conversation id.
const activeStreams = new Map<string, AbortController>();

export type DeleteStrategy = "cascade" | "reparent";

interface AppState {
  conversations: Record<string, Conversation>;
  /** Every independent conversation tree's root id — one per "topic". */
  rootIds: string[];
  activeConversationId: string | null;
  viewMode: ViewMode;
  canvasTransform: CanvasTransform;
  hasSeenOnboarding: boolean;
  hydrated: boolean;

  setHydrated: () => void;
  initializeIfEmpty: () => void;
  createNewRoot: () => string;
  loadDemoTree: () => void;
  resetAll: () => void;

  enterConversation: (id: string) => void;
  exitToCanvas: () => void;
  setCanvasTransform: (t: CanvasTransform) => void;

  renameConversation: (id: string, title: string) => void;
  setConversationPosition: (id: string, x: number, y: number) => void;

  sendMessage: (conversationId: string, text: string) => Promise<void>;
  retryMessage: (conversationId: string, messageId: string) => Promise<void>;
  stopStreaming: (conversationId: string) => void;

  createBranch: (params: {
    parentId: string;
    sourceMessageId: string;
    sourceText: string;
    contextSnippet: string;
    question: string;
  }) => Promise<string>;

  deleteConversation: (id: string, strategy: DeleteStrategy) => void;

  dismissOnboarding: () => void;
}

function now() {
  return Date.now();
}

function makeMessage(role: Message["role"], content: string, status: Message["status"]): Message {
  return { id: createId(), role, content, status, createdAt: now() };
}

function createRootConversation(position: CanvasPosition = { x: 0, y: 0 }): Conversation {
  const id = createId();
  return {
    id,
    parentId: null,
    rootId: id,
    depth: 0,
    title: "New topic",
    sourceText: null,
    sourceContext: null,
    sourceMessageId: null,
    branchQuestion: null,
    createdAt: now(),
    updatedAt: now(),
    position,
    messages: [],
    childIds: [],
  };
}

/**
 * Branch conversations carry their originating highlight as structured
 * fields (sourceText/sourceContext/branchQuestion) rather than baking it
 * into the visible first message, so the user only ever sees the question
 * they actually typed. This reconstructs the model-facing context from
 * those fields for every turn in the conversation, not just the first.
 */
function buildBranchContext(conv: Conversation): string | undefined {
  if (!conv.sourceText) return undefined;
  const snippetPart =
    conv.sourceContext && conv.sourceContext !== conv.sourceText
      ? ` Surrounding context: "${conv.sourceContext}".`
      : "";
  return `The user highlighted this text from a previous conversation: "${conv.sourceText}".${snippetPart} They are asking about it in a fresh, isolated conversation that only contains messages sent here.`;
}

async function runStream(
  get: StoreApi<AppState>["getState"],
  set: StoreApi<AppState>["setState"],
  conversationId: string,
  assistantMessageId: string,
  context?: string,
) {
  const controller = new AbortController();
  activeStreams.set(conversationId, controller);

  const patchMessage = (patch: Partial<Message>) => {
    set((state) => {
      const conv = state.conversations[conversationId];
      if (!conv) return {};
      const messages = conv.messages.map((m) =>
        m.id === assistantMessageId ? { ...m, ...patch } : m,
      );
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: { ...conv, messages, updatedAt: now() },
        },
      };
    });
  };

  try {
    const conv = get().conversations[conversationId];
    const history = (conv?.messages ?? [])
      .filter((m) => m.id !== assistantMessageId && m.status !== "error")
      .map((m) => ({ role: m.role, content: m.content }));

    let accumulated = "";
    for await (const chunk of aiProvider.streamResponse(history, {
      signal: controller.signal,
      context,
    })) {
      if (controller.signal.aborted) break;
      accumulated += chunk.delta;
      patchMessage({ content: accumulated, status: "streaming" });
    }
    if (!controller.signal.aborted) {
      patchMessage({ content: accumulated, status: "done" });

      // Auto-title the conversation from the first exchange, if untitled.
      const state = get();
      const current = state.conversations[conversationId];
      if (current && current.messages.length <= 2 && !current.branchQuestion) {
        const firstUser = current.messages.find((m) => m.role === "user");
        if (firstUser) {
          aiProvider.generateTitle(firstUser.content).then((title) => {
            const latest = get().conversations[conversationId];
            if (latest && latest.title === "New topic") {
              set((s) => ({
                conversations: {
                  ...s.conversations,
                  [conversationId]: { ...latest, title },
                },
              }));
            }
          });
        }
      }
    }
  } catch (err) {
    if (!controller.signal.aborted) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      patchMessage({ status: "error", errorMessage: message });
    }
  } finally {
    activeStreams.delete(conversationId);
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      conversations: {},
      rootIds: [],
      activeConversationId: null,
      viewMode: "canvas",
      canvasTransform: { x: 0, y: 0, scale: 1 },
      hasSeenOnboarding: false,
      hydrated: false,

      setHydrated: () => set({ hydrated: true }),

      initializeIfEmpty: () => {
        const state = get();
        const validRootIds = state.rootIds.filter((id) => state.conversations[id]);
        if (validRootIds.length > 0) {
          if (validRootIds.length !== state.rootIds.length) set({ rootIds: validRootIds });
          return;
        }

        // Migration path: earlier versions persisted a single `rootId` string
        // instead of `rootIds`. Rather than orphaning that data, adopt any
        // already-persisted top-level conversations (parentId === null) as
        // roots before falling back to creating a brand new one.
        const discoveredRootIds = Object.values(state.conversations)
          .filter((c) => c.parentId === null)
          .map((c) => c.id);
        if (discoveredRootIds.length > 0) {
          set({ rootIds: discoveredRootIds });
          return;
        }

        const root = createRootConversation();
        set({
          conversations: { [root.id]: root },
          rootIds: [root.id],
          activeConversationId: null,
          viewMode: "canvas",
          canvasTransform: { x: 0, y: 0, scale: 1 },
        });
      },

      createNewRoot: () => {
        const state = get();
        const root = createRootConversation(computeRootPosition(state.rootIds.length));
        set((s) => ({
          conversations: { ...s.conversations, [root.id]: root },
          rootIds: [...s.rootIds, root.id],
          activeConversationId: root.id,
          viewMode: "conversation",
        }));
        return root.id;
      },

      loadDemoTree: () => {
        const state = get();
        const root = createRootConversation(computeRootPosition(state.rootIds.length));
        root.title = "Planning a trip to Japan";
        root.messages = [
          makeMessage("user", "I'm planning a two-week trip to Japan in the spring. Where should I go?", "done"),
          makeMessage(
            "assistant",
            [
              "Spring is a great time to visit — cherry blossoms typically peak from late **March to early April**, though it varies by region and year.",
              "",
              "For a two-week trip, a popular route is:",
              "",
              "1. **Tokyo** (4 days) — Shinjuku, Shibuya, Asakusa, and a day trip to Nikko or Kamakura.",
              "2. **Hakone** (1-2 days) — hot springs and views of Mt. Fuji.",
              "3. **Kyoto** (4 days) — temples, Fushimi Inari, Arashiyama bamboo grove.",
              "4. **Osaka** (2 days) — food culture and Dotonbori.",
              "5. **Hiroshima & Miyajima** (2 days) — history and the floating torii gate.",
              "",
              "The Japan Rail Pass is worth it if you're covering this much ground by shinkansen.",
            ].join("\n"),
            "done",
          ),
        ];
        root.updatedAt = now();

        const childId = createId();
        const child: Conversation = {
          id: childId,
          parentId: root.id,
          rootId: root.id,
          depth: 1,
          title: "Japan Rail Pass details",
          sourceText: "The Japan Rail Pass is worth it if you're covering this much ground by shinkansen.",
          sourceContext: null,
          sourceMessageId: root.messages[1].id,
          branchQuestion: "Is it actually worth it for a 2-week trip, cost-wise?",
          createdAt: now(),
          updatedAt: now(),
          position: computeChildPosition(root.position, 0, null, 0, 1),
          childIds: [],
          messages: [
            makeMessage("user", "Is it actually worth it for a 2-week trip, cost-wise?", "done"),
            makeMessage(
              "assistant",
              [
                "For your route (Tokyo → Hakone → Kyoto → Osaka → Hiroshima → back to Tokyo), a 14-day Ordinary JR Pass tends to pay for itself.",
                "",
                "- Tokyo → Kyoto round trip alone covers a large chunk of the pass cost.",
                "- Add Hiroshima and the Hakone-area JR lines and you're well past break-even.",
                "",
                "If you're doing a lighter itinerary (just Tokyo and Kyoto, for example), point-to-point tickets might actually be cheaper — worth comparing both ways on a fare calculator before committing.",
              ].join("\n"),
              "done",
            ),
          ],
        };
        root.childIds = [childId];

        const grandchildId = createId();
        const grandchild: Conversation = {
          id: grandchildId,
          parentId: childId,
          rootId: root.id,
          depth: 2,
          title: "Ordering the pass early",
          sourceText: "a 14-day Ordinary JR Pass",
          sourceContext: null,
          sourceMessageId: child.messages[1].id,
          branchQuestion: "Should I order the exchange voucher before I leave home?",
          createdAt: now(),
          updatedAt: now(),
          position: computeChildPosition(child.position, 1, root.position, 0, 1),
          childIds: [],
          messages: [
            makeMessage("user", "Should I order the exchange voucher before I leave home?", "done"),
            makeMessage(
              "assistant",
              "Yes — order the exchange voucher online before you travel, then swap it for the physical pass at a JR office once you land. You can also activate JR passes digitally now in some regions, which skips the physical exchange step entirely.",
              "done",
            ),
          ],
        };
        child.childIds = [grandchildId];

        set((s) => ({
          conversations: {
            ...s.conversations,
            [root.id]: root,
            [childId]: child,
            [grandchildId]: grandchild,
          },
          rootIds: [...s.rootIds, root.id],
          activeConversationId: null,
          viewMode: "canvas",
          hasSeenOnboarding: true,
        }));
      },

      resetAll: () => {
        activeStreams.forEach((c) => c.abort());
        activeStreams.clear();
        const root = createRootConversation();
        set({
          conversations: { [root.id]: root },
          rootIds: [root.id],
          activeConversationId: null,
          viewMode: "canvas",
          canvasTransform: { x: 0, y: 0, scale: 1 },
        });
      },

      enterConversation: (id) => {
        if (!get().conversations[id]) return;
        set({ activeConversationId: id, viewMode: "conversation" });
      },

      exitToCanvas: () => {
        set({ viewMode: "canvas" });
      },

      setCanvasTransform: (t) => set({ canvasTransform: t }),

      renameConversation: (id, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((state) => {
          const conv = state.conversations[id];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [id]: { ...conv, title: trimmed, updatedAt: now() },
            },
          };
        });
      },

      setConversationPosition: (id, x, y) => {
        set((state) => {
          const conv = state.conversations[id];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [id]: { ...conv, position: { x, y } },
            },
          };
        });
      },

      sendMessage: async (conversationId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const userMessage = makeMessage("user", trimmed, "done");
        const assistantMessage = makeMessage("assistant", "", "pending");

        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          return {
            conversations: {
              ...state.conversations,
              [conversationId]: {
                ...conv,
                messages: [...conv.messages, userMessage, assistantMessage],
                updatedAt: now(),
              },
            },
          };
        });

        const convAfterSend = get().conversations[conversationId];
        await runStream(
          get,
          set,
          conversationId,
          assistantMessage.id,
          convAfterSend ? buildBranchContext(convAfterSend) : undefined,
        );
      },

      retryMessage: async (conversationId, messageId) => {
        const conv = get().conversations[conversationId];
        if (!conv) return;
        const idx = conv.messages.findIndex((m) => m.id === messageId);
        if (idx === -1) return;

        set((state) => {
          const c = state.conversations[conversationId];
          if (!c) return state;
          const messages = c.messages.map((m) =>
            m.id === messageId ? { ...m, content: "", status: "pending" as const, errorMessage: undefined } : m,
          );
          return {
            conversations: { ...state.conversations, [conversationId]: { ...c, messages } },
          };
        });

        await runStream(get, set, conversationId, messageId, buildBranchContext(conv));
      },

      stopStreaming: (conversationId) => {
        const controller = activeStreams.get(conversationId);
        controller?.abort();
        activeStreams.delete(conversationId);
        set((state) => {
          const conv = state.conversations[conversationId];
          if (!conv) return state;
          const messages = conv.messages.map((m) =>
            m.status === "streaming" || m.status === "pending"
              ? { ...m, status: (m.content ? "done" : "error") as Message["status"], errorMessage: m.content ? undefined : "Stopped before a response was generated." }
              : m,
          );
          return { conversations: { ...state.conversations, [conversationId]: { ...conv, messages } } };
        });
      },

      createBranch: async ({ parentId, sourceMessageId, sourceText, contextSnippet, question }) => {
        const state = get();
        const parent = state.conversations[parentId];
        if (!parent) throw new Error("Parent conversation not found");

        const grandparent = parent.parentId ? state.conversations[parent.parentId] : null;
        const siblingCount = parent.childIds.length + 1;
        const position = computeChildPosition(
          parent.position,
          parent.depth,
          grandparent?.position ?? null,
          parent.childIds.length,
          siblingCount,
        );

        const id = createId();
        // Only the question itself is shown in the chat — the highlighted text
        // and surrounding context are stored as structured fields and passed to
        // the model out-of-band (see buildBranchContext), not baked into the
        // visible message.
        const openingMessage = makeMessage("user", question, "done");
        const assistantMessage = makeMessage("assistant", "", "pending");

        const child: Conversation = {
          id,
          parentId,
          rootId: parent.rootId,
          depth: parent.depth + 1,
          title: question.length > 48 ? `${question.slice(0, 48)}…` : question,
          sourceText,
          sourceContext: contextSnippet && contextSnippet !== sourceText ? contextSnippet : null,
          sourceMessageId,
          branchQuestion: question,
          createdAt: now(),
          updatedAt: now(),
          position,
          messages: [openingMessage, assistantMessage],
          childIds: [],
        };

        set((s) => ({
          conversations: {
            ...s.conversations,
            [id]: child,
            [parentId]: { ...parent, childIds: [...parent.childIds, id] },
          },
          activeConversationId: id,
          viewMode: "conversation",
        }));

        await runStream(get, set, id, assistantMessage.id, buildBranchContext(child));
        return id;
      },

      deleteConversation: (id, strategy) => {
        const state = get();
        const target = state.conversations[id];
        if (!target) return;

        const isRoot = target.parentId === null;
        // Always keep at least one top-level topic around.
        if (isRoot && state.rootIds.length <= 1) return;
        // Roots have no parent to reparent onto — always cascade for them.
        const effectiveStrategy: DeleteStrategy = isRoot ? "cascade" : strategy;

        activeStreams.get(id)?.abort();
        activeStreams.delete(id);

        const conversations = { ...state.conversations };

        const collectDescendants = (nodeId: string): string[] => {
          const node = conversations[nodeId];
          if (!node) return [];
          return node.childIds.flatMap((childId) => [childId, ...collectDescendants(childId)]);
        };

        if (effectiveStrategy === "cascade") {
          const toRemove = [id, ...collectDescendants(id)];
          toRemove.forEach((rid) => {
            activeStreams.get(rid)?.abort();
            activeStreams.delete(rid);
            delete conversations[rid];
          });
          const parent = target.parentId ? conversations[target.parentId] : null;
          if (parent) {
            conversations[parent.id] = {
              ...parent,
              childIds: parent.childIds.filter((cid) => cid !== id),
            };
          }
        } else {
          // Reparent: children move up to the deleted bubble's parent.
          const parentId = target.parentId!;
          const parent = conversations[parentId];
          const childIds = target.childIds;

          const reflowDepth = (nodeId: string, depth: number) => {
            const node = conversations[nodeId];
            if (!node) return;
            conversations[nodeId] = { ...node, depth };
            node.childIds.forEach((cid) => reflowDepth(cid, depth + 1));
          };

          childIds.forEach((cid) => {
            const node = conversations[cid];
            if (!node) return;
            conversations[cid] = { ...node, parentId };
            reflowDepth(cid, parent.depth + 1);
          });

          conversations[parentId] = {
            ...parent,
            childIds: [...parent.childIds.filter((cid) => cid !== id), ...childIds],
          };

          delete conversations[id];
        }

        const rootIds = isRoot ? state.rootIds.filter((rid) => rid !== id) : state.rootIds;

        const activeStillExists = state.activeConversationId
          ? Boolean(conversations[state.activeConversationId])
          : true;

        set({
          conversations,
          rootIds,
          activeConversationId: activeStillExists ? state.activeConversationId : null,
          viewMode: activeStillExists ? state.viewMode : "canvas",
        });
      },

      dismissOnboarding: () => set({ hasSeenOnboarding: true }),
    }),
    {
      name: "bubble-chat-storage",
      storage: createJSONStorage(() => createDebouncedStorage(250)),
      partialize: (state) => ({
        conversations: state.conversations,
        rootIds: state.rootIds,
        activeConversationId: state.activeConversationId,
        viewMode: state.viewMode,
        canvasTransform: state.canvasTransform,
        hasSeenOnboarding: state.hasSeenOnboarding,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

export function getDescendantCount(conversations: Record<string, Conversation>, id: string): number {
  const node = conversations[id];
  if (!node) return 0;
  return node.childIds.reduce((sum, cid) => sum + 1 + getDescendantCount(conversations, cid), 0);
}
