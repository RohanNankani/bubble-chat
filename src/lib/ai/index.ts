import { anthropicProvider } from "./anthropicProvider";
import type { AIProvider } from "./provider";

/**
 * Backed by a real Claude Haiku model via a server-side API route
 * (src/app/api/chat, src/app/api/title) so the API key never reaches the
 * browser. Swap this export to point at a different AIProvider
 * implementation without touching any calling code.
 */
export const aiProvider: AIProvider = anthropicProvider;

export type { AIProvider, AIMessage, StreamChunk } from "./provider";
