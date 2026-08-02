export type MessageRole = "user" | "assistant";

export type MessageStatus = "pending" | "streaming" | "done" | "error";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  createdAt: number;
  errorMessage?: string;
}

export interface CanvasPosition {
  x: number;
  y: number;
}

export interface Conversation {
  id: string;
  parentId: string | null;
  rootId: string;
  depth: number;
  title: string;
  /** Text the user highlighted in the parent message that spawned this branch. */
  sourceText: string | null;
  /** Surrounding message content the highlight came from, for extra model context. */
  sourceContext: string | null;
  /** Id of the parent message the branch was created from. */
  sourceMessageId: string | null;
  /** The question the user asked about the highlighted text. */
  branchQuestion: string | null;
  createdAt: number;
  updatedAt: number;
  position: CanvasPosition;
  messages: Message[];
  childIds: string[];
}

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export type ViewMode = "canvas" | "conversation";
