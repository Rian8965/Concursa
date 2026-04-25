"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, Loader2 } from "lucide-react";

export function ApostilasActions({ competitionId, competitionName }: { competitionId: string; competitionName: string }) {
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(40);
  const [difficulty, setDifficulty] = useState<"ALL" | "EASY" | "MEDIUM" | "HARD">("ALL");
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);

  useEffect(() => {
    fetch(`/api/student/subjects-for-competition?competitionId=${competitionId}`)
      .then((r) => r.json())
      .then((d: { subjects?: { id: string; name: string }[] }) => setSubjects(d.subjects ?? []))
      .catch(() => setSubjects([]));
  }, [competitionId]);

  const canPickSubjects = subjects.length > 0;
  const effectiveSubjectIds = useMemo(
    () => (selectedSubjects.length ? selectedSubjects : subjects.map((s) => s.id)),
    [selectedSubjects, subjects],
  );

  async function generatePdf() {
    setLoading(true);
    try {
      const res = await fetch("/api/student/apostilas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId,
          questionCount,
          subjectIds: canPickSubjects ? effectiveSubjectIds : [],
          difficulty,
          includeAnswerKey,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error((j as { error?: string }).error ?? "Não foi possível gerar a apostila");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `apostila-${competitionName.replace(/[^\w\-]+/g, "-").slice(0, 48)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Apostila baixada com sucesso!");
    } catch {
      toast.error("Erro ao baixar apostila");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="orbit-stack">
      <div className="rounded-xl border border-black/[0.06] bg-white p-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Quantidade</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[20, 30, 40, 50, 60].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuestionCount(n)}
                  className={n === questionCount
                    ? "rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800"
                    : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Dificuldade</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {[
                { v: "ALL" as const, l: "Todas" },
                { v: "EASY" as const, l: "Fácil" },
                { v: "MEDIUM" as const, l: "Médio" },
                { v: "HARD" as const, l: "Difícil" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setDifficulty(opt.v)}
                  className={opt.v === difficulty
                    ? "rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-800"
                    : "rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="mt-4">
            <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Matérias</p>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              Selecione matérias específicas (opcional). Sem seleção, a apostila distribui de forma equilibrada entre todas as matérias do seu cargo.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {subjects.map((s) => {
                const active = selectedSubjects.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSubjects((prev) => active ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                    className={active
                      ? "rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-[13px] font-semibold text-violet-800"
                      : "rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-100"}
                  >
                    {s.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={includeAnswerKey}
              onChange={(e) => setIncludeAnswerKey(e.target.checked)}
            />
            Incluir gabarito no final
          </label>

          <button
            type="button"
            className="btn btn-primary inline-flex h-11 min-h-[44px] items-center gap-2 rounded-2xl px-4"
            disabled={loading}
            onClick={() => generatePdf()}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Gerar PDF ({questionCount} questões)
          </button>
        </div>
      </div>

      <p className="text-[12px] text-[var(--text-muted)]">
        O sistema prioriza questões novas para você e só repete quando o banco daquela matéria/banca estiver esgotado.
      </p>
    </div>
  );
}
