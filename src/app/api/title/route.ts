import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const MODEL = "claude-haiku-4-5";

export async function POST(req: Request) {
  let body: { message?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return Response.json({ title: "New conversation" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ title: message.slice(0, 40) });
  }

  try {
    const client = new Anthropic();
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 20,
      messages: [
        {
          role: "user",
          content: `Reply with only a short 3-6 word title (no quotes, no trailing punctuation) summarizing this message:\n\n${message}`,
        },
      ],
    });
    const textBlock = res.content.find((b) => b.type === "text");
    const title = textBlock && "text" in textBlock ? textBlock.text.trim() : "";
    return Response.json({ title: title || message.slice(0, 40) });
  } catch {
    return Response.json({ title: message.slice(0, 40) });
  }
}
