"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/PageHeader";
import { Lightbulb, Loader2, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

type Item = {
  id: string;
  selectedAnswer: string;
  aiExplanation: string | null;
  answeredAt: string;
  question: {
    id: string;
    content: string;
    correctAnswer: string;
    supportText: string | null;
    hasImage: boolean;
    imageUrl: string | null;
    subject: { name: string; color: string } | null;
    alternatives: { letter: string; content: string }[];
  };
};

export default function RevisarErrosPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [ensuring, setEnsuring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoEnsureOnce = useRef(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/student/revisar-erros");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Falha ao carregar");
      setItems([]);
      return;
    }
    setItems(data.items ?? []);
    setError(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const runEnsure = useCallback(async () => {
    setEnsuring(true);
    try {
      let remaining = 1;
      let guard = 0;
      while (remaining > 0 && guard < 8) {
        const res = await fetch("/api/student/revisar-erros/ensure", { method: "POST" });
        const data = await res.json();
        if (!res.ok) break;
        remaining = data.remaining ?? 0;
        guard += 1;
        await load();
        if (data.filled === 0) break;
      }
    } finally {
      setEnsuring(false);
    }
  }, [load]);

  useEffect(() => {
    if (!items || items.length === 0 || autoEnsureOnce.current) return;
    if (!items.some((i) => !i.aiExplanation)) return;
    autoEnsureOnce.current = true;
    void runEnsure();
  }, [items, runEnsure]);

  if (loading) {
    return (
      <div className="orbit-stack max-w-3xl animate-fade-in">
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="orbit-stack max-w-3xl">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const list = items ?? [];
  const missingAI = list.filter((i) => !i.aiExplanation).length;

  return (
    <div className="orbit-stack max-w-3xl animate-fade-in">
      <PageHeader
        title="Revisar erros"
        description="Questões que você errou, com a resposta correta e uma explicação objetiva. Texto e imagens vinculados à questão aparecem como no treino."
      />

      <div className="flex flex-wrap items-center gap-3">
        {missingAI > 0 && (
          <button
            type="button"
            disabled={ensuring}
            onClick={() => void runEnsure()}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
          >
            {ensuring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
            {ensuring ? "Gerando explicações…" : "Gerar explicações pendentes"}
          </button>
        )}
        <Link href="/concursos" className="text-sm font-semibold text-violet-700 hover:underline">
          Ir para treino
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="orbit-empty-state">
          <CheckCircle2 className="mx-auto mb-4 h-9 w-9 text-emerald-500" strokeWidth={1.5} />
          <p className="text-[15px] font-semibold text-[var(--text-primary)]">Nenhum erro registrado ainda</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">Quando errar no treino ou no simulado, as questões aparecem aqui.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {list.map((ans) => {
            const q = ans.question;
            const showImage = Boolean((q.imageUrl ?? "").trim());
            return (
              <article key={ans.id} className="orbit-card-premium overflow-hidden py-0">
                <div className="border-b border-black/[0.06] bg-slate-50/80 px-4 py-3 sm:px-5">
                  <div className="flex flex-wrap items-center gap-2">
                    {q.subject && (
                      <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
                        {q.subject.name}
                      </span>
                    )}
                    <span className="text-[11px] font-medium text-[var(--text-muted)]">{formatDate(ans.answeredAt)}</span>
                  </div>
                </div>
                <div className="space-y-4 px-4 py-5 sm:px-6 sm:py-6">
                  {q.supportText ? (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-3 py-3 sm:px-4">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-violet-700">Texto de apoio</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{q.supportText}</p>
                    </div>
                  ) : null}
                  <p className="text-[15px] font-medium leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{q.content}</p>
                  {showImage ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={q.imageUrl!} alt="" className="max-h-[min(480px,70vh)] w-full object-contain" />
                    </div>
                  ) : null}

                  <ul className="space-y-2">
                    {q.alternatives.map((alt) => {
                      const isCor = alt.letter === q.correctAnswer;
                      const isSel = alt.letter === ans.selectedAnswer;
                      return (
                        <li
                          key={alt.letter}
                          className={cn(
                            "flex gap-3 rounded-xl border px-3 py-2.5 text-sm",
                            isCor && "border-emerald-200 bg-emerald-50/80",
                            isSel && !isCor && "border-red-200 bg-red-50/80",
                            !isCor && !isSel && "border-slate-100 bg-slate-50/50",
                          )}
                        >
                          <span className="mt-0.5 font-bold text-slate-500">{alt.letter})</span>
                          <span className="text-slate-800">{alt.content}</span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <span>
                      Sua resposta:{" "}
                      <strong className="text-red-600">{ans.selectedAnswer}</strong>
                    </span>
                    <span>
                      Correta: <strong className="text-emerald-600">{q.correctAnswer}</strong>
                    </span>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3 sm:px-4">
                    <div className="flex items-start gap-2">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900/80">Por que errou</p>
                        {ans.aiExplanation ? (
                          <p className="mt-1.5 text-sm leading-relaxed text-amber-950/90">{ans.aiExplanation}</p>
                        ) : (
                          <p className="mt-1.5 text-sm text-amber-900/70">
                            {ensuring ? "Gerando explicação…" : "Explicação ainda indisponível. Use o botão acima ou aguarde."}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
