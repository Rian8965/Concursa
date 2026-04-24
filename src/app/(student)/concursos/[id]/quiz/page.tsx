"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Send, Bot, User, Sparkles, Loader2,
  FileQuestion, ChevronRight,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
}

const SUGGESTED = [
  "Qual é a data da prova?",
  "Quais são as matérias do meu cargo?",
  "Quantas etapas tem o concurso?",
  "Qual é o prazo de inscrição?",
  "Tem TAF (teste de aptidão física)?",
  "Qual é a banca organizadora?",
  "Quantas vagas existem?",
  "Qual é o conteúdo programático?",
];

export default function QuizEditalPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    setError(null);
    setMessages((p) => [...p, { role: "user", content: q }]);
    setLoading(true);

    try {
      const res = await fetch("/api/student/quiz-edital", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: id, question: q }),
      });
      const data = (await res.json()) as { answer?: string; model?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Erro ao obter resposta");
      setMessages((p) => [...p, { role: "assistant", content: data.answer ?? "", model: data.model }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao obter resposta";
      setError(msg);
      setMessages((p) => [...p, { role: "assistant", content: `Não consegui obter a resposta: ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

  const showSuggested = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      {/* Cabeçalho */}
      <div className="shrink-0 border-b border-black/[0.06] bg-white px-5 py-4">
        <Link href={`/concursos/${id}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900">
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao concurso
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100">
            <Sparkles className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-[17px] font-extrabold tracking-tight text-[#111827]">Quiz do seu concurso</h1>
            <p className="text-[12.5px] text-[#6B7280]">Pergunte qualquer coisa sobre o seu edital</p>
          </div>
        </div>
      </div>

      {/* Área de mensagens */}
      <div className="flex-1 overflow-y-auto bg-[#F9FAFB] px-4 py-4">
        {showSuggested ? (
          <div className="mx-auto max-w-xl space-y-5 pt-4">
            <div className="rounded-2xl border border-violet-100 bg-white px-5 py-5 shadow-sm">
              <div className="flex items-center gap-2.5">
                <Bot className="h-6 w-6 shrink-0 text-violet-500" />
                <div>
                  <p className="text-[14px] font-bold text-[#111827]">Olá! Sou o assistente do seu edital.</p>
                  <p className="text-[13px] text-[#6B7280]">Faça qualquer pergunta sobre o concurso ao qual você está inscrito.</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#9CA3AF]">Sugestões de perguntas</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => send(q)}
                    className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.07] bg-white px-4 py-3 text-left text-[13px] font-medium text-[#374151] transition-colors hover:border-violet-200 hover:bg-violet-50"
                  >
                    <span className="flex items-center gap-2">
                      <FileQuestion className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                      {q}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#D1D5DB]" />
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-[11.5px] text-[#9CA3AF]">
              As respostas são baseadas apenas nas informações do edital cadastrado.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  msg.role === "user" ? "bg-violet-600" : "bg-white border border-black/[0.08] shadow-sm"
                }`}>
                  {msg.role === "user"
                    ? <User className="h-4 w-4 text-white" />
                    : <Bot className="h-4 w-4 text-violet-500" />
                  }
                </div>
                {/* Balão */}
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === "user"
                    ? "rounded-tr-md bg-violet-600 text-white"
                    : "rounded-tl-md bg-white text-[#111827] border border-black/[0.06]"
                }`}>
                  <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed">{msg.content}</p>
                  {msg.role === "assistant" && msg.model && (
                    <p className="mt-1.5 text-[10px] opacity-40">Modelo: {msg.model}</p>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/[0.08] bg-white shadow-sm">
                  <Bot className="h-4 w-4 text-violet-500" />
                </div>
                <div className="rounded-2xl rounded-tl-md border border-black/[0.06] bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-500" />
                    <span className="text-[13px] text-[#6B7280]">Consultando o edital…</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Área de input */}
      <div className="shrink-0 border-t border-black/[0.06] bg-white px-4 py-3">
        {error && (
          <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>
        )}
        <div className="mx-auto flex max-w-2xl gap-2">
          <input
            className="flex-1 rounded-xl border border-black/[0.10] bg-[#F9FAFB] px-4 py-2.5 text-[13.5px] text-[#111827] placeholder:text-[#9CA3AF] focus:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100"
            placeholder="Faça uma pergunta sobre o edital…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => send(input)}
            disabled={!input.trim() || loading}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm hover:bg-violet-700 disabled:opacity-40"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[#9CA3AF]">
          Respostas baseadas no edital. Sempre consulte o documento oficial.
        </p>
      </div>
    </div>
  );
}
