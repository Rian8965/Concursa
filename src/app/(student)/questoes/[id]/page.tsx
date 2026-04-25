"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Bot, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils/cn";

type Alternative = { letter: string; content: string; imageUrl: string | null };
type QuestionDetail = {
  id: string;
  content: string;
  supportText: string | null;
  imageUrl: string | null;
  correctAnswer: string;
  year: number | null;
  difficulty: string;
  subject: { id: string; name: string; color: string | null } | null;
  topic: { id: string; name: string } | null;
  examBoard: { id: string; acronym: string; name: string } | null;
  alternatives: Alternative[];
};

type HistoryRow = {
  id: string;
  selectedAnswer: string;
  isCorrect: boolean;
  aiExplanation: string | null;
  answeredAt: string;
  sessionType: string;
  sessionId: string | null;
};

function statusChip(last: HistoryRow | null) {
  if (!last) return { label: "Não respondida", cls: "border-slate-200 bg-slate-50 text-slate-700" };
  if (last.isCorrect) return { label: "Acertou", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" };
  return { label: "Errou", cls: "border-red-200 bg-red-50 text-red-800" };
}

export default function StudentQuestionDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<QuestionDetail | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);

  const last = history[0] ?? null;
  const chip = useMemo(() => statusChip(last), [last]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/student/questions/${id}`)
      .then((r) => r.json())
      .then((d: { question?: QuestionDetail; history?: HistoryRow[]; error?: string }) => {
        if (!d.question) throw new Error(d.error ?? "Questão não encontrada");
        setQ(d.question);
        setHistory(d.history ?? []);
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Erro ao carregar"))
      .finally(() => setLoading(false));
  }, [id]);

  async function report(category: string) {
    if (!q) return;
    try {
      const res = await fetch("/api/question-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: q.id,
          category,
          description: undefined,
          phase: "after",
          sessionId: last?.sessionId ?? null,
          sessionType: last?.sessionType ?? "MANUAL",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Falha ao enviar");
      toast.success("Registro enviado. Obrigado!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar");
    }
  }

  if (loading) {
    return (
      <div className="orbit-stack max-w-3xl animate-fade-in">
        <p className="text-sm text-[var(--text-muted)]">Carregando…</p>
      </div>
    );
  }

  if (!q) return null;

  const showImage = Boolean((q.imageUrl ?? "").trim());

  return (
    <div className="orbit-stack max-w-3xl animate-fade-in">
      <Link href="/questoes" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900">
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar para Questões
      </Link>

      <PageHeader
        title="Detalhe da questão"
        description="Enunciado completo, sua resposta, a correta e seu histórico."
      />

      <div className="flex flex-wrap gap-2">
        {q.subject && (
          <span className="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[11px] font-bold text-violet-800">
            {q.subject.name}
          </span>
        )}
        {q.topic && (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
            {q.topic.name}
          </span>
        )}
        {q.examBoard?.acronym && (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
            {q.examBoard.acronym}
          </span>
        )}
        {q.year && (
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
            {q.year}
          </span>
        )}
        <span className={cn("rounded-lg border px-2.5 py-0.5 text-[11px] font-bold", chip.cls)}>
          {chip.label}
        </span>
      </div>

      <article className="orbit-card-premium space-y-4">
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
            <img src={q.imageUrl!} alt="" className="max-h-[min(520px,70vh)] w-full object-contain" />
          </div>
        ) : null}

        <div className="space-y-2">
          {q.alternatives.map((a) => {
            const isCorrect = a.letter === q.correctAnswer;
            const isSelected = last?.selectedAnswer === a.letter;
            return (
              <div
                key={a.letter}
                className={cn(
                  "flex gap-3 rounded-xl border px-3 py-2.5 text-sm",
                  isCorrect && "border-emerald-200 bg-emerald-50/80",
                  isSelected && !isCorrect && "border-red-200 bg-red-50/80",
                  !isCorrect && !isSelected && "border-slate-100 bg-slate-50/50",
                )}
              >
                <span className="mt-0.5 font-bold text-slate-500">{a.letter})</span>
                <span className="text-slate-800 whitespace-pre-wrap">{a.content}</span>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            Sua resposta:{" "}
            <strong className={last?.isCorrect ? "text-emerald-600" : "text-red-600"}>
              {last?.selectedAnswer ?? "—"}
            </strong>
          </span>
          <span>
            Correta: <strong className="text-emerald-600">{q.correctAnswer}</strong>
          </span>
          {last?.answeredAt && (
            <span className="ml-auto text-[var(--text-muted)]">{formatDate(last.answeredAt)}</span>
          )}
        </div>

        <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-3 sm:px-4">
          <div className="flex items-start gap-2">
            <Bot className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-900/80">Explicação da IA</p>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-950/90">
                {last?.aiExplanation ?? "Ainda não há explicação registrada para esta questão."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void report("WRONG_ANSWER")}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
          >
            <AlertTriangle className="h-4 w-4" />
            Discordar do gabarito
          </button>
          <button
            type="button"
            onClick={() => void report("FORMAT_ERROR")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <AlertTriangle className="h-4 w-4" />
            Reportar problema (texto/imagem/formatação)
          </button>
        </div>
      </article>

      <section className="orbit-card-premium">
        <h3 className="text-[13px] font-extrabold text-[var(--text-primary)]">Histórico dessa questão</h3>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Você ainda não respondeu essa questão.</p>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            {history.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-white px-3 py-2.5">
                {h.isCorrect ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {h.isCorrect ? "Correta" : "Incorreta"} · resposta: {h.selectedAnswer}
                  </p>
                  <p className="text-[12px] text-[var(--text-muted)]">
                    {formatDate(h.answeredAt)} · origem: {h.sessionType}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

