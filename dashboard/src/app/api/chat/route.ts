import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "llama-3.3-70b-versatile";

type ChatMessage = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY missing" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { messages, context, topic } = body as {
    messages: ChatMessage[];
    context?: unknown;
    topic?: string;
  };

  const systemPrompt = buildSystemPrompt(topic, context);

  const upstream = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      temperature: 0.4,
      max_tokens: 1500,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: "groq_failed", status: upstream.status, detail: errText.slice(0, 500) },
      { status: 500 },
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed?.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(new TextEncoder().encode(delta));
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

function buildSystemPrompt(topic: string | undefined, context: unknown): string {
  const role =
    topic === "finanzas-chile"
      ? "Eres un analista financiero chileno experto en mercados locales (IPSA, dólar, cobre, BCCh) y contexto global. Respondes en español de Chile, claro y directo."
      : "Eres un analista de tendencias en IA. Respondes en español, conciso y sin relleno, ayudando a entender lo que está pasando en inteligencia artificial.";

  const ctxJson = context ? JSON.stringify(context).slice(0, 12000) : "";
  const ctxBlock = ctxJson
    ? `\n\nCONTEXTO DEL DÍA (resumen JSON al que el usuario está mirando):\n${ctxJson}\n\nUSA ESTE CONTEXTO como referencia principal. Si el usuario pregunta algo que no está cubierto, dilo y responde con tu conocimiento general.`
    : "";

  return `${role}

REGLAS:
- Responde en máximo 6 frases salvo que pidan profundizar.
- Si el usuario pregunta "cómo me afecta", aterriza al contexto chileno o de un builder/founder.
- No inventes datos numéricos. Si no lo sabes, dilo.
- No repitas el resumen del día — responde la pregunta específica.${ctxBlock}`;
}
