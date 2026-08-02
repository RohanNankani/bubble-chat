import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";

interface ChatRequestBody {
  messages: { role: "user" | "assistant"; content: string }[];
  context?: string;
}

function ndjson(obj: Record<string, unknown>) {
  return `${JSON.stringify(obj)}\n`;
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "No messages provided." }, { status: 400 });
  }

  const client = new Anthropic();

  const system = body.context
    ? `You are a helpful, concise assistant embedded in a branching chat app called Bubble. Respond using Markdown, including fenced code blocks where useful. The user is asking a focused follow-up about something from a prior conversation. ${body.context}`
    : "You are a helpful, concise assistant embedded in a branching chat app called Bubble. Respond using Markdown, including fenced code blocks where useful.";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const anthropicStream = client.messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system,
          messages: body.messages.map((m) => ({ role: m.role, content: m.content })),
        });

        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(ndjson({ delta: event.delta.text })));
          }
        }

        const final = await anthropicStream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(ndjson({ error: "The model declined to respond to this request." })),
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Something went wrong contacting the model.";
        controller.enqueue(encoder.encode(ndjson({ error: message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8" },
  });
}
