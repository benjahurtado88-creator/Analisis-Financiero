"use client";

import { useEffect, useRef, useState } from "react";

type ChatMessage = { role: "user" | "assistant"; content: string };

type Props = {
  context: unknown;
  topic: "ai-news" | "finanzas-chile";
  placeholder?: string;
  starterQuestions?: string[];
};

export default function ChatPanel({ context, topic, placeholder, starterQuestions }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, context, topic }),
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${(e as Error).message}` },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
      <header className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <h3 className="font-semibold text-sm">Chat con el reporte</h3>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-slate-500 hover:text-slate-300"
            disabled={streaming}
          >
            Limpiar
          </button>
        )}
      </header>

      <div ref={scrollRef} className="px-4 py-3 max-h-96 overflow-y-auto space-y-3 text-sm">
        {messages.length === 0 && (
          <div className="text-slate-400 space-y-3">
            <p>Pregunta lo que quieras sobre el resumen de hoy. Ej:</p>
            <div className="flex flex-wrap gap-2">
              {(starterQuestions || []).map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-full px-3 py-1 text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                m.role === "user"
                  ? "bg-blue-600/30 border border-blue-700 rounded-lg px-3 py-2 max-w-[85%]"
                  : "bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 max-w-[85%] whitespace-pre-wrap"
              }
            >
              {m.content || (streaming && i === messages.length - 1 ? "..." : "")}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-800 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder || "Escribe tu pregunta..."}
          disabled={streaming}
          className="flex-1 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 rounded px-4 py-2 text-sm font-medium"
        >
          {streaming ? "..." : "Enviar"}
        </button>
      </form>
    </section>
  );
}
