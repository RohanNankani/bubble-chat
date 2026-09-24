# Bubble — Branching AI Conversations

A branching, bubble-based AI chat application. Every conversation lives as a bubble on a
spatial canvas; highlight any part of a reply to spin off an independent child
conversation, recursively, as deep as you want.

<img width="2549" height="1302" alt="image" src="https://github.com/user-attachments/assets/f1d02974-adf9-4f49-9902-870e5cca2129" />


## Setup

Requires Node.js 20+ and an [Anthropic API key](https://console.anthropic.com/settings/keys).

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app talks to Claude Haiku
(`claude-haiku-4-5`) through a server-side API route — your key stays in
`.env.local` (gitignored) and is never sent to the browser. Without a key set, chats
fail with a clear error/retry state instead of crashing; see
[Swapping in a real AI provider](#swapping-in-a-real-ai-provider) below for the
dependency-free mock provider used during development, which needs no key at all.

### Other scripts

```bash
npm run build      # production build
npm start           # run the production build
npm run lint         # eslint
npm test             # run the unit test suite (vitest)
npm run test:watch   # watch mode
```

## Using the app

- **Root bubble** — click the large bubble on first load to enter the main conversation
  and start chatting.
- **Multiple main topics** — click **"+ New topic"** in the top bar to start a second
  (or third, or Nth) independent conversation tree. Each is its own root bubble, laid
  out side by side on the canvas — so you're not limited to going deep on a single
  subject; branch out into unrelated topics entirely.
- **Branching** — select any text in an assistant (or your own) message to reveal an
  *"Ask in a new bubble"* action. Answering the prompt creates an independent child
  conversation seeded with the selected text and its surrounding context, then jumps you
  straight into it.
- **Canvas** — leave a conversation (back arrow or `Esc`) to zoom out to the bubble
  canvas. Drag to pan, scroll to pan, `Ctrl`/`Cmd` + scroll (or the +/− controls) to zoom.
  Bubble size reflects depth in the tree, not message count; curved connectors show
  parent → child relationships, and the active bubble is highlighted.
- **Popping bubbles** — `Cmd`/`Ctrl`-click a bubble, or use the trash icon inside a
  conversation, to delete it. You always need at least one main topic, so the last
  remaining root bubble can't be deleted (create another topic first). Deleting a
  bubble with descendants prompts you to either delete the whole branch or (for
  non-root bubbles) reparent its children onto its own parent.
- **Search** — `Cmd`/`Ctrl`+K (or the search button) fuzzy-searches conversation titles
  and message content and jumps straight to a result.
- **Rename** — click a conversation's title in its header to rename it inline.
- **Demo data** — use the `⋯` menu → "Load demo tree" to seed a sample three-level
  branching conversation (useful for exploring the canvas without typing).
- **Dark / light mode** — toggle in the top bar; it's remembered across sessions.
- **Persistence** — all conversations and canvas position/zoom are autosaved to
  `localStorage` and restored on refresh. Use `⋯` → "Reset everything" to start over.

## Architecture

```
src/
  app/                    Next.js app router entry (layout, page, global styles)
  components/
    AppShell.tsx           Top-level view switcher (canvas ⇄ conversation), top bar, shortcuts
    canvas/                Bubble canvas: pan/zoom viewport, bubbles, SVG connectors
    chat/                  Conversation view: messages, markdown, streaming, branching UI
    ui/                    Shared primitives: dialogs, tooltips, toasts, theme toggle
    SearchOverlay.tsx      ⌘K conversation search
    Onboarding.tsx         First-run walkthrough
  lib/
    store.ts               Single zustand store: conversation tree, streaming, persistence
    ai/                    AIProvider interface + mock streaming implementation
    layout.ts              Bubble sizing and child-position layout math
    canvas.ts              Pan/zoom scale clamping
    toastStore.ts          Lightweight toast notifications
  types/                  Shared Conversation/Message/etc. types
```

### Data model

Each conversation is stored explicitly with the fields called for by the branching model:
`id`, `parentId`, `rootId`, `depth`, `sourceText`, `sourceMessageId`, `branchQuestion`,
`createdAt`/`updatedAt`, canvas `position`, `messages`, and `childIds`. The whole tree
lives in one `zustand` store (`src/lib/store.ts`), persisted to `localStorage` (debounced,
so rapid token-by-token streaming updates don't thrash disk I/O).

Context flows one direction only: creating a branch seeds the new child's first message
with the selected text (and surrounding message context), but nothing is ever written
back from a child into its parent — parents stay unaware of what happens in their
branches, matching the spec's isolation requirement.

### AI provider architecture

All AI calls go through the `AIProvider` interface in `src/lib/ai/provider.ts`
(`streamResponse`, `generateTitle`). The active implementation is set in one place,
`src/lib/ai/index.ts` — no other file needs to change if you swap it:

```ts
export const aiProvider: AIProvider = anthropicProvider; // swap to change providers
```

- **`anthropicProvider`** (`src/lib/ai/anthropicProvider.ts`, default) — calls
  `claude-haiku-4-5` through two server-side routes (`src/app/api/chat`,
  `src/app/api/title`) using the official `@anthropic-ai/sdk`. `POST /api/chat` streams
  newline-delimited JSON (`{"delta": "..."}` chunks, or `{"error": "..."}` on failure)
  so the client never sees the API key. To use a different model, edit the `MODEL`
  constant in both route files — anywhere in the [Claude model catalog](https://platform.claude.com/docs/en/about-claude/models/overview) works.
- **`mockAIProvider`** (`src/lib/ai/mockProvider.ts`) — a dependency-free, canned
  implementation used during development. It simulates latency, token-by-token
  streaming, and occasional failures (so the error/retry UI is exercisable without a
  backend or API costs). Swap it back into `index.ts` for offline work or demos.

### Notable technical decisions

- **Canvas coordinates are unscaled, signed pixels** relative to the root bubble at
  `(0, 0)`. Bubbles are positioned with plain (possibly negative) `left`/`top`, and the
  whole canvas is panned/zoomed with a single `translate(x, y) scale(s)` on a wrapping
  div — deliberately *not* baking a large positive coordinate offset into every bubble's
  position, since that offset would itself get multiplied by the zoom scale and throw
  bubbles off-screen at any zoom level other than 1.
- **Streaming** uses an `AbortController` per conversation (kept outside persisted
  state, since it isn't serializable) so switching away from or stopping a response mid
  reply is clean.
- **Deletion** supports both cascade (remove a bubble and every descendant) and reparent
  (remove just the one bubble, promoting its children to its parent) — the UI always asks
  which is wanted whenever the target has descendants.

## Testing

`npm test` runs a `vitest` suite covering the bubble-layout math and the core store
behaviors (branch creation/isolation, cascade vs. reparent deletion, root-deletion
guard, renaming). UI flows (branching, canvas pan/zoom, persistence across reload, pop
confirmation, search, dark mode, responsive layout) were additionally verified end-to-end
against a running dev server during development.
