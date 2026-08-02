import type { AIMessage, AIProvider, StreamChunk } from "./provider";

interface NdjsonLine {
  delta?: string;
  error?: string;
}

function parseLine(line: string): NdjsonLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as NdjsonLine;
  } catch {
    return null;
  }
}

class AnthropicProvider implements AIProvider {
  async *streamResponse(
    messages: AIMessage[],
    options: { signal?: AbortSignal; context?: string } = {},
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, context: options.context }),
      signal: options.signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.error ?? `Request failed (${res.status}).`);
    }
    if (!res.body) {
      throw new Error("No response body from server.");
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const parsed = parseLine(line);
        if (!parsed) continue;
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.delta) yield { delta: parsed.delta };
      }
    }
    const trailing = parseLine(buffer);
    if (trailing) {
      if (trailing.error) throw new Error(trailing.error);
      if (trailing.delta) yield { delta: trailing.delta };
    }
  }

  async generateTitle(firstMessage: string): Promise<string> {
    const fallback = () => {
      const cleaned = firstMessage.trim().replace(/\s+/g, " ");
      if (!cleaned) return "New conversation";
      const words = cleaned.split(" ").slice(0, 6).join(" ");
      return words.length < cleaned.length ? `${words}…` : words;
    };

    try {
      const res = await fetch("/api/title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: firstMessage }),
      });
      if (!res.ok) return fallback();
      const data = (await res.json()) as { title?: string };
      return data.title?.trim() || fallback();
    } catch {
      return fallback();
    }
  }
}

export const anthropicProvider = new AnthropicProvider();
