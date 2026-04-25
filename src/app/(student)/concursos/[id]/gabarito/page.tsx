"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";

type ApostilaListItem = { id: string; title: string; generatedAt: string; totalQuestions: number };

type ApostilaDetail = {
  id: string;
  title: string;
  generatedAt: string;
  questions: {
    order: number;
    questionId: string;
    content: string;
    supportText: string | null;
    imageUrl: string | null;
    correctAnswer?: string;
    alternatives: { letter: string; content: string }[];
  }[];
};

export default function PreencherGabaritoPage() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.id as string;

  const [loadingList, setLoadingList] = useState(true);
  const [apostilas, setApostilas] = useState<ApostilaListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  const [loadingApostila, setLoadingApostila] = useState(false);
  const [apostila, setApostila] = useState<ApostilaDetail | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch(`/api/student/apostilas/list?competitionId=${competitionId}`)
      .then((r) => r.json())
      .then((d: { apostilas?: ApostilaListItem[] }) => {
        setApostilas(d.apostilas ?? []);
      })
      .catch(() => setApostilas([]))
      .finally(() => setLoadingList(false));
  }, [competitionId]);

  async function loadApostila(id: string) {
    setLoadingApostila(true);
    setApostila(null);
    setAnswers({});
    try {
      const res = await fetch(`/api/student/apostilas/${id}`);
      const data = await res.json() as { apostila?: ApostilaDetail; error?: string };
      if (!res.ok || !data.apostila) throw new Error(data.error ?? "Falha ao carregar apostila");
      setApostila(data.apostila);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao carregar apostila");
    } finally {
      setLoadingApostila(false);
    }
  }

  const totalQuestions = apostila?.questions.length ?? 0;
  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);

  async function submit() {
    if (!apostila) return;
    setSubmitting(true);
    try {
      const payload = apostila.questions.map((q) => ({
        questionId: q.questionId,
        selectedAnswer: answers[q.questionId] ?? null,
      }));
      const res = await fetch(`/api/student/apostilas/${apostila.id}/submit-gabarito`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payload }),
      });
      const data = await res.json() as { ok?: boolean; score?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Falha ao enviar gabarito");
      toast.success(`Gabarito enviado! Score: ${data.score ?? 0}%`);
      router.push(`/concursos/${competitionId}/historico`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar gabarito");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="orbit-stack max-w-3xl animate-fade-in">
      <Link
        href={`/concursos/${competitionId}`}
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-700 hover:text-violet-900"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Voltar ao concurso
      </Link>

      <div>
        <h1 className="text-[20px] font-extrabold tracking-tight text-[var(--text-primary)]">Preencher gabarito</h1>
        <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
          Selecione uma apostila que você baixou e marque suas respostas. Questões não marcadas contam como erradas.
        </p>
      </div>

      <div className="rounded-xl border border-black/[0.06] bg-white p-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Apostila</p>

        {loadingList ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]">Carregando…</p>
        ) : apostilas.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Você ainda não gerou nenhuma apostila para este concurso.</p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            {apostilas.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => { setSelectedId(a.id); void loadApostila(a.id); }}
                className={a.id === selectedId
                  ? "rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-left text-sm font-semibold text-violet-800"
                  : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"}
              >
                <div className="truncate">{a.title}</div>
                <div className="text-[11px] font-medium opacity-70">{a.totalQuestions} questões</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {loadingApostila && (
        <div className="rounded-xl border border-black/[0.06] bg-white p-6 text-center">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-violet-600" />
          <p className="text-sm text-[var(--text-muted)]">Carregando questões…</p>
        </div>
      )}

      {apostila && (
        <div className="orbit-stack">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--text-secondary)]">
              {answeredCount} / {totalQuestions} respondidas
            </p>
            <button
              type="button"
              disabled={submitting}
              onClick={() => void submit()}
              className="btn btn-primary inline-flex items-center gap-2 rounded-2xl px-4"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Enviar gabarito
            </button>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            Importante: se você não marcar uma alternativa, ela conta como <strong>errada</strong> na correção.
          </div>

          <div className="flex flex-col gap-4">
            {apostila.questions.map((q) => (
              <div key={q.questionId} className="rounded-xl border border-black/[0.06] bg-white p-4">
                <p className="text-[12px] font-bold text-violet-700">Questão {q.order}</p>
                <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">
                  {q.content.length > 240 ? q.content.slice(0, 240) + "…" : q.content}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {q.alternatives.map((a) => {
                    const active = answers[q.questionId] === a.letter;
                    return (
                      <button
                        key={a.letter}
                        type="button"
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.questionId]: a.letter }))}
                        className={active
                          ? "rounded-lg border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-800"
                          : "rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"}
                      >
                        {a.letter}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setAnswers((prev) => {
                      const n = { ...prev };
                      delete n[q.questionId];
                      return n;
                    })}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
                  >
                    Limpar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

