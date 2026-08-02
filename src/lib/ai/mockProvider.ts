import type { AIMessage, AIProvider, StreamChunk } from "./provider";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const OPENERS = [
  "Good question.",
  "Let's dig into that.",
  "Here's how I'd think about it.",
  "Interesting angle.",
  "Sure — here's a breakdown.",
];

function codeSample(topic: string) {
  return [
    "```ts",
    `// A quick illustration related to "${topic}"`,
    "function explore(topic: string) {",
    "  const insights = analyze(topic);",
    "  return insights.map((i) => i.summary);",
    "}",
    "```",
  ].join("\n");
}

function buildMockAnswer(userMessage: string, context?: string): string {
  const opener = OPENERS[Math.floor(Math.random() * OPENERS.length)];
  const topic = context?.trim() || userMessage.trim();
  const shortTopic = topic.length > 80 ? `${topic.slice(0, 80)}…` : topic;

  const paragraphs: string[] = [];
  paragraphs.push(`${opener} ${context ? `Focusing specifically on **"${shortTopic}"**, here's a closer look.` : ""}`.trim());

  paragraphs.push(
    [
      `${shortTopic ? `Regarding "${shortTopic}"` : "Here"}, there are a few things worth noting:`,
      "",
      "- It connects to a broader pattern worth tracking over time.",
      "- There are trade-offs between simplicity and flexibility here.",
      "- A concrete example usually clarifies the idea faster than more prose.",
    ].join("\n"),
  );

  if (Math.random() > 0.4) {
    paragraphs.push(codeSample(shortTopic || "this topic"));
  }

  paragraphs.push(
    "Let me know if you'd like to branch into a related sub-topic — you can highlight any part of this response and ask a focused follow-up in its own bubble.",
  );

  return paragraphs.join("\n\n");
}

class MockAIProvider implements AIProvider {
  async *streamResponse(
    messages: AIMessage[],
    options: { signal?: AbortSignal; context?: string } = {},
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const userText = lastUser?.content ?? "";

    // Simulate network latency before the first token.
    await sleep(350 + Math.random() * 450);
    if (options.signal?.aborted) return;

    // Small chance of a simulated failure to exercise error/retry states,
    // unless the user explicitly asks to force one (useful for QA/demo).
    const forceError = /force ?error/i.test(userText);
    const randomFailure = !forceError && Math.random() < 0.06;
    if (forceError || randomFailure) {
      throw new Error(
        forceError
          ? "Simulated failure (requested)."
          : "The model provider timed out. Please try again.",
      );
    }

    const fullText = buildMockAnswer(userText, options.context);
    const words = fullText.split(/(\s+)/);

    let buffer = "";
    for (const word of words) {
      if (options.signal?.aborted) return;
      buffer += word;
      // Stream in small chunks of 1-3 "words" for a natural cadence.
      if (buffer.length > 0 && Math.random() > 0.55) {
        yield { delta: buffer };
        buffer = "";
        await sleep(15 + Math.random() * 45);
      }
    }
    if (buffer.length > 0) {
      yield { delta: buffer };
    }
  }

  async generateTitle(firstMessage: string): Promise<string> {
    await sleep(120);
    const cleaned = firstMessage.trim().replace(/\s+/g, " ");
    if (!cleaned) return "New conversation";
    const words = cleaned.split(" ").slice(0, 6).join(" ");
    return words.length < cleaned.length ? `${words}…` : words;
  }
}

export const mockAIProvider = new MockAIProvider();
