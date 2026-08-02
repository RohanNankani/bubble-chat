import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./ai", () => ({
  aiProvider: {
    async *streamResponse() {
      yield { delta: "mock " };
      yield { delta: "response" };
    },
    async generateTitle(firstMessage: string) {
      return firstMessage.slice(0, 20);
    },
  },
}));

import { useStore, getDescendantCount } from "./store";

function reset() {
  useStore.setState({
    conversations: {},
    rootIds: [],
    activeConversationId: null,
    viewMode: "canvas",
    canvasTransform: { x: 0, y: 0, scale: 1 },
    hasSeenOnboarding: false,
    hydrated: true,
  });
  useStore.getState().initializeIfEmpty();
}

describe("store", () => {
  beforeEach(() => {
    reset();
  });

  it("initializes with a single root conversation", () => {
    const state = useStore.getState();
    expect(state.rootIds).toHaveLength(1);
    expect(Object.keys(state.conversations)).toHaveLength(1);
    const rootId = state.rootIds[0];
    expect(state.conversations[rootId].parentId).toBeNull();
    expect(state.conversations[rootId].depth).toBe(0);
  });

  it("does not recreate the root if one already exists", () => {
    const firstRootIds = useStore.getState().rootIds;
    useStore.getState().initializeIfEmpty();
    expect(useStore.getState().rootIds).toEqual(firstRootIds);
    expect(Object.keys(useStore.getState().conversations)).toHaveLength(1);
  });

  it("sends a message and streams a mocked assistant reply", async () => {
    const rootId = useStore.getState().rootIds[0];
    await useStore.getState().sendMessage(rootId, "Hello there");
    const conv = useStore.getState().conversations[rootId];
    expect(conv.messages).toHaveLength(2);
    expect(conv.messages[0]).toMatchObject({ role: "user", content: "Hello there" });
    expect(conv.messages[1]).toMatchObject({ role: "assistant", content: "mock response", status: "done" });
  });

  it("creates a branch as an independent child conversation", async () => {
    const rootId = useStore.getState().rootIds[0];
    await useStore.getState().sendMessage(rootId, "Tell me about oceans");
    const parentMsgId = useStore.getState().conversations[rootId].messages[1].id;

    const childId = await useStore.getState().createBranch({
      parentId: rootId,
      sourceMessageId: parentMsgId,
      sourceText: "oceans cover most of the planet",
      contextSnippet: "oceans cover most of the planet",
      question: "How much of the planet do they cover exactly?",
    });

    const state = useStore.getState();
    const child = state.conversations[childId];
    const parent = state.conversations[rootId];

    expect(child.parentId).toBe(rootId);
    expect(child.rootId).toBe(rootId);
    expect(child.depth).toBe(1);
    expect(parent.childIds).toContain(childId);
    // Child conversation must not leak back into the parent's message list.
    expect(parent.messages.some((m) => m.id === child.messages[0].id)).toBe(false);
    // The visible message is just the question — no baked-in context text.
    expect(child.messages[0].content).toBe("How much of the planet do they cover exactly?");
    expect(state.activeConversationId).toBe(childId);
    expect(state.viewMode).toBe("conversation");
  });

  it("cascades deletion to remove all descendants", async () => {
    const rootId = useStore.getState().rootIds[0];
    await useStore.getState().sendMessage(rootId, "root message");
    const msgId = useStore.getState().conversations[rootId].messages[1].id;

    const childId = await useStore.getState().createBranch({
      parentId: rootId,
      sourceMessageId: msgId,
      sourceText: "text",
      contextSnippet: "text",
      question: "q1",
    });
    const childMsgId = useStore.getState().conversations[childId].messages[1].id;
    const grandchildId = await useStore.getState().createBranch({
      parentId: childId,
      sourceMessageId: childMsgId,
      sourceText: "text2",
      contextSnippet: "text2",
      question: "q2",
    });

    expect(getDescendantCount(useStore.getState().conversations, rootId)).toBe(2);

    useStore.getState().deleteConversation(childId, "cascade");

    const state = useStore.getState();
    expect(state.conversations[childId]).toBeUndefined();
    expect(state.conversations[grandchildId]).toBeUndefined();
    expect(state.conversations[rootId].childIds).not.toContain(childId);
  });

  it("reparents children up to the grandparent when deleting a bubble without cascade", async () => {
    const rootId = useStore.getState().rootIds[0];
    await useStore.getState().sendMessage(rootId, "root message");
    const msgId = useStore.getState().conversations[rootId].messages[1].id;

    const childId = await useStore.getState().createBranch({
      parentId: rootId,
      sourceMessageId: msgId,
      sourceText: "text",
      contextSnippet: "text",
      question: "q1",
    });
    const childMsgId = useStore.getState().conversations[childId].messages[1].id;
    const grandchildId = await useStore.getState().createBranch({
      parentId: childId,
      sourceMessageId: childMsgId,
      sourceText: "text2",
      contextSnippet: "text2",
      question: "q2",
    });

    useStore.getState().deleteConversation(childId, "reparent");

    const state = useStore.getState();
    expect(state.conversations[childId]).toBeUndefined();
    expect(state.conversations[grandchildId]).toBeDefined();
    expect(state.conversations[grandchildId].parentId).toBe(rootId);
    expect(state.conversations[grandchildId].depth).toBe(1);
    expect(state.conversations[rootId].childIds).toContain(grandchildId);
  });

  it("refuses to delete the only remaining root conversation", () => {
    const rootId = useStore.getState().rootIds[0];
    useStore.getState().deleteConversation(rootId, "cascade");
    expect(useStore.getState().conversations[rootId]).toBeDefined();
    expect(useStore.getState().rootIds).toEqual([rootId]);
  });

  it("supports creating multiple independent top-level topics", () => {
    const firstRootId = useStore.getState().rootIds[0];
    const secondRootId = useStore.getState().createNewRoot();

    const state = useStore.getState();
    expect(state.rootIds).toEqual([firstRootId, secondRootId]);
    expect(state.conversations[secondRootId].parentId).toBeNull();
    expect(state.conversations[secondRootId].depth).toBe(0);
    // Distinct positions so the two topics don't overlap on the canvas.
    expect(state.conversations[secondRootId].position).not.toEqual(state.conversations[firstRootId].position);
    // Creating a new topic jumps straight into it.
    expect(state.activeConversationId).toBe(secondRootId);
    expect(state.viewMode).toBe("conversation");
  });

  it("allows deleting a root once another root exists, without touching the survivor", async () => {
    const firstRootId = useStore.getState().rootIds[0];
    const secondRootId = useStore.getState().createNewRoot();

    useStore.getState().deleteConversation(firstRootId, "cascade");

    const state = useStore.getState();
    expect(state.conversations[firstRootId]).toBeUndefined();
    expect(state.rootIds).toEqual([secondRootId]);
    expect(state.conversations[secondRootId]).toBeDefined();
  });

  it("cascades a root deletion to its entire tree, ignoring reparent", async () => {
    const firstRootId = useStore.getState().rootIds[0];
    useStore.getState().createNewRoot(); // ensure deletion of firstRootId is allowed

    await useStore.getState().sendMessage(firstRootId, "root message");
    const msgId = useStore.getState().conversations[firstRootId].messages[1].id;
    const childId = await useStore.getState().createBranch({
      parentId: firstRootId,
      sourceMessageId: msgId,
      sourceText: "text",
      contextSnippet: "text",
      question: "q1",
    });

    // "reparent" is meaningless for a root (nothing to reparent onto) — should still cascade.
    useStore.getState().deleteConversation(firstRootId, "reparent");

    const state = useStore.getState();
    expect(state.conversations[firstRootId]).toBeUndefined();
    expect(state.conversations[childId]).toBeUndefined();
    expect(state.rootIds).not.toContain(firstRootId);
  });

  it("renames a conversation", () => {
    const rootId = useStore.getState().rootIds[0];
    useStore.getState().renameConversation(rootId, "My renamed chat");
    expect(useStore.getState().conversations[rootId].title).toBe("My renamed chat");
  });

  it("ignores blank renames", () => {
    const rootId = useStore.getState().rootIds[0];
    const original = useStore.getState().conversations[rootId].title;
    useStore.getState().renameConversation(rootId, "   ");
    expect(useStore.getState().conversations[rootId].title).toBe(original);
  });
});
