export interface AIMessage {
  role: "user" | "assistant";
  content: string;
}

export interface StreamChunk {
  delta: string;
}

export interface AIProvider {
  /** Streams a response for the given message history. Yields text deltas. */
  streamResponse(
    messages: AIMessage[],
    options: { signal?: AbortSignal; context?: string },
  ): AsyncGenerator<StreamChunk, void, unknown>;

  /** Generates a short title from the first user message. */
  generateTitle(firstMessage: string): Promise<string>;
}
