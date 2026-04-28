"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Trophy, Play } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

const QUANTITIES = [10, 20, 30, 40];
const TIME_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
  { value: 90, label: "90 min" },
  { value: 120, label: "120 min" },
  { value: 0, label: "Sem tempo" },
];

export default function SimuladoGeralPage() {
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(20);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    fetch("/api/student/question-filters")
      .then((r) => r.json())
      .then((d) => setSubjects(d?.subjects ?? []))
      .catch(() => {});
  }, []);

  const effectiveSubjectIds = useMemo(() => subjectIds, [subjectIds]);

  async function start() {
    setLoading(true);
    try {
      const res = await fetch("/api/simulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quantity, timeLimitMinutes, subjectIds: effectiveSubjectIds }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Não foi possível iniciar");
      window.location.href = `/simulado/${d.examId}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao iniciar simulado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 pb-12">
      <PageHeader
        title="Simulado"
        description="Simulado por matérias do seu cargo/trilha (sem exigir concurso)."
      >
        <Link href="/concursos" className="btn btn-ghost rounded-2xl">
          <Trophy className="h-4 w-4" />
          Ver concursos
        </Link>
      </PageHeader>

      <div className="orbit-card-premium p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="orbit-form-label">Quantidade</label>
            <select className="input h-11" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value, 10))}>
              {QUANTITIES.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="orbit-form-label">Tempo</label>
            <select className="input h-11" value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value, 10))}>
              {TIME_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="orbit-form-label">Matérias (opcional)</label>
          <div className="flex flex-wrap gap-2">
            {subjects.slice(0, 40).map((s) => {
              const active = subjectIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={active ? "btn btn-primary rounded-2xl" : "btn btn-ghost rounded-2xl"}
                  onClick={() => setSubjectIds((prev) => active ? prev.filter((id) => id !== s.id) : [...prev, s.id])}
                >
                  {s.name}
                </button>
              );
            })}
          </div>
        </div>

        <button className="btn btn-primary mt-6 w-full rounded-2xl" disabled={loading} onClick={() => void start()}>
          <Play className="h-4 w-4" />
          {loading ? "Iniciando..." : "Iniciar simulado"}
        </button>
      </div>
    </div>
  );
}

