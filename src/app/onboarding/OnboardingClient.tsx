"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type CompetitionLite = {
  id: string;
  name: string;
  examBoardAcronym: string | null;
  status: string;
};

type JobRoleLite = { id: string; name: string };

type Step = "choose_competition" | "choose_job_role" | "manual_job_role";

export default function OnboardingClient() {
  const [step, setStep] = useState<Step>("choose_competition");
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [competitions, setCompetitions] = useState<CompetitionLite[]>([]);
  const [selectedCompetition, setSelectedCompetition] = useState<CompetitionLite | null>(null);

  const [jobRoles, setJobRoles] = useState<JobRoleLite[]>([]);
  const [selectedJobRoleId, setSelectedJobRoleId] = useState<string>("");

  const [manualJobRoleText, setManualJobRoleText] = useState("");
  const [suggestions, setSuggestions] = useState<JobRoleLite[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  const filteredCompetitions = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return competitions;
    return competitions.filter((c) => `${c.name} ${c.examBoardAcronym ?? ""}`.toLowerCase().includes(s));
  }, [competitions, q]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/student/onboarding/competitions")
      .then((r) => r.json())
      .then((d) => setCompetitions(d?.competitions ?? []))
      .catch(() => toast.error("Não foi possível carregar concursos"))
      .finally(() => setLoading(false));
  }, []);

  async function pickCompetition(c: CompetitionLite) {
    setSelectedCompetition(c);
    setSelectedJobRoleId("");
    setLoading(true);
    try {
      const res = await fetch(`/api/student/onboarding/competitions/${c.id}/job-roles`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Erro ao carregar cargos");
      setJobRoles(d?.jobRoles ?? []);
      setStep("choose_job_role");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar cargos");
    } finally {
      setLoading(false);
    }
  }

  async function completeWithCompetition() {
    if (!selectedCompetition) return;
    if (!selectedJobRoleId) {
      toast.error("Selecione um cargo");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/student/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ competitionId: selectedCompetition.id, jobRoleId: selectedJobRoleId }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(d?.error ?? "Não foi possível concluir");
      return;
    }
    window.location.href = "/dashboard";
  }

  async function requestSuggestions() {
    if (manualJobRoleText.trim().length < 3) {
      toast.error("Digite um cargo (mínimo 3 caracteres)");
      return;
    }
    setSuggestLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch("/api/student/onboarding/suggest-job-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: manualJobRoleText.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Erro ao buscar sugestões");
      setSuggestions(d?.suggestions ?? []);
      if ((d?.suggestions ?? []).length === 0) toast.info("Não encontramos cargos parecidos. Você ainda pode continuar.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar sugestões");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function completeManual(jobRoleId: string | null) {
    if (!manualJobRoleText.trim()) {
      toast.error("Digite o cargo");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/student/onboarding/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manualJobRoleText: manualJobRoleText.trim(), jobRoleId }),
    });
    const d = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      toast.error(d?.error ?? "Não foi possível concluir");
      return;
    }
    // Sem concurso definido, manda direto para questões (para não cair em tela vazia)
    window.location.href = "/questoes";
  }

  return (
    <div className="mx-auto flex min-h-[80dvh] max-w-3xl flex-col justify-center px-6 py-12">
      <div className="orbit-card-premium p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Primeiro acesso</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">O que você quer estudar?</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Escolha um concurso e um cargo para liberarmos matérias, questões, treinos, simulados e apostilas.
        </p>

        {step === "choose_competition" ? (
          <>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                className="input h-11 w-full"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar concurso..."
              />
              <button
                type="button"
                className="btn btn-ghost h-11 rounded-2xl"
                onClick={() => setStep("manual_job_role")}
              >
                Ainda não tenho concurso definido
              </button>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {loading ? (
                <div className="py-10 text-center text-sm text-[var(--text-muted)]">Carregando…</div>
              ) : filteredCompetitions.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-muted)]">Nenhum concurso encontrado.</div>
              ) : (
                filteredCompetitions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded-2xl border border-black/[0.08] bg-white p-4 text-left hover:bg-slate-50"
                    onClick={() => void pickCompetition(c)}
                  >
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">{c.name}</p>
                    <p className="mt-1 text-xs text-[var(--text-muted)]">
                      {c.examBoardAcronym ? `Banca: ${c.examBoardAcronym}` : "Banca não informada"} · {c.status}
                    </p>
                  </button>
                ))
              )}
            </div>
          </>
        ) : null}

        {step === "choose_job_role" ? (
          <>
            <div className="mt-6 flex items-center justify-between gap-2">
              <button type="button" className="btn btn-ghost rounded-2xl" onClick={() => setStep("choose_competition")} disabled={loading}>
                Voltar
              </button>
              <p className="text-xs text-[var(--text-muted)]">
                Concurso: <span className="font-semibold text-[var(--text-primary)]">{selectedCompetition?.name ?? "—"}</span>
              </p>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {jobRoles.map((jr) => (
                <button
                  key={jr.id}
                  type="button"
                  onClick={() => setSelectedJobRoleId(jr.id)}
                  className={[
                    "rounded-2xl border p-4 text-left",
                    selectedJobRoleId === jr.id ? "border-violet-300 bg-violet-50" : "border-black/[0.08] bg-white hover:bg-slate-50",
                  ].join(" ")}
                >
                  <p className="text-sm font-extrabold text-[var(--text-primary)]">{jr.name}</p>
                </button>
              ))}
            </div>

            <button
              type="button"
              className="btn btn-primary mt-6 w-full rounded-2xl"
              onClick={() => void completeWithCompetition()}
              disabled={loading}
            >
              {loading ? "Salvando..." : "Continuar"}
            </button>
          </>
        ) : null}

        {step === "manual_job_role" ? (
          <>
            <div className="mt-6">
              <label className="orbit-form-label">Digite o cargo que você quer estudar</label>
              <input
                className="input h-11 w-full"
                value={manualJobRoleText}
                onChange={(e) => setManualJobRoleText(e.target.value)}
                placeholder="Ex: Agente Administrativo"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="btn btn-ghost rounded-2xl" onClick={() => setStep("choose_competition")} disabled={loading}>
                  Voltar
                </button>
                <button type="button" className="btn btn-primary rounded-2xl" onClick={() => void requestSuggestions()} disabled={suggestLoading || loading}>
                  {suggestLoading ? "Analisando..." : "Analisar com IA"}
                </button>
              </div>
            </div>

            {suggestions.length > 0 ? (
              <div className="mt-5 rounded-2xl border border-black/[0.08] bg-white p-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                  Encontramos cargos parecidos. Deseja usar essa trilha?
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left hover:bg-violet-100"
                      onClick={() => void completeManual(s.id)}
                    >
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">{s.name}</p>
                    </button>
                  ))}
                </div>
                <button type="button" className="btn btn-ghost mt-3 rounded-2xl" onClick={() => void completeManual(null)} disabled={loading}>
                  Continuar sem correspondência
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-primary mt-6 w-full rounded-2xl" onClick={() => void completeManual(null)} disabled={loading}>
                {loading ? "Salvando..." : "Continuar"}
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

