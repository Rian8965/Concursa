"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Save, Plus, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const schema = z.object({
  name: z.string().min(3, "Nome muito curto"),
  cityId: z.string().min(1, "Selecione uma cidade"),
  organization: z.string().optional(),
  examBoardId: z.string().optional(),
  examBoardDefined: z.boolean(),
  examDate: z.string().optional(),
  status: z.enum(["UPCOMING", "ACTIVE", "PAST", "CANCELLED"]),
  description: z.string().optional(),
  editalUrl: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

type JobRoleEntry = {
  _key: string;
  name: string;
  subjectIds: string[];
  expanded: boolean;
};

const COMMON_STAGES = [
  "Prova Objetiva",
  "Prova Discursiva",
  "TAF – Teste de Aptidão Física",
  "Avaliação Psicológica",
  "Investigação Social",
  "Curso de Formação",
  "Avaliação de Títulos",
  "Entrevista",
  "Exame Médico",
  "Prova Prática",
];

interface Props { params?: Promise<{ id: string }> }

export default function CompetitionFormPage({ params }: Props) {
  const router = useRouter();
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [cities, setCities] = useState<{ id: string; name: string; state: string }[]>([]);
  const [examBoards, setExamBoards] = useState<{ id: string; acronym: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Cargos + matérias
  const [jobRoles, setJobRoles] = useState<JobRoleEntry[]>([]);
  // Etapas
  const [stages, setStages] = useState<string[]>([]);
  const [stageInput, setStageInput] = useState("");

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { examBoardDefined: false, status: "UPCOMING" },
  });

  useEffect(() => {
    async function init() {
      const [citiesRes, boardsRes, subjectsRes] = await Promise.all([
        fetch("/api/admin/cities").then((r) => r.json()),
        fetch("/api/admin/exam-boards").then((r) => r.json()),
        fetch("/api/admin/subjects").then((r) => r.json()),
      ]);
      setCities(citiesRes.cities ?? []);
      setExamBoards(boardsRes.examBoards ?? []);
      setSubjects(subjectsRes.subjects ?? []);

      if (params) {
        const { id } = await params;
        if (id && id !== "novo") {
          setCompetitionId(id);
          const res = await fetch(`/api/admin/competitions/${id}`);
          const data = await res.json();
          const c = data.competition;
          reset({
            name: c.name,
            cityId: c.cityId,
            organization: c.organization ?? "",
            examBoardId: c.examBoardId ?? "",
            examBoardDefined: c.examBoardDefined ?? false,
            examDate: c.examDate ? new Date(c.examDate).toISOString().slice(0, 10) : "",
            status: (c.status ?? "UPCOMING") as FormData["status"],
            description: c.description ?? "",
            editalUrl: c.editalUrl ?? "",
          });
          // Load cargos com matérias
          if (Array.isArray(c.jobRolesWithSubjects)) {
            setJobRoles(
              c.jobRolesWithSubjects.map((jr: { jobRoleId: string; name: string; subjectIds: string[] }) => ({
                _key: jr.jobRoleId,
                name: jr.name,
                subjectIds: jr.subjectIds ?? [],
                expanded: true,
              })),
            );
          }
          // Load etapas
          if (Array.isArray(c.stages)) {
            setStages(c.stages.map((s: { name: string }) => s.name));
          }
        }
      }
      setLoadingData(false);
    }
    init();
  }, [params, reset]);

  // Cargo helpers
  function addJobRole() {
    setJobRoles((prev) => [
      ...prev,
      { _key: Math.random().toString(36).slice(2), name: "", subjectIds: [], expanded: true },
    ]);
  }

  function removeJobRole(key: string) {
    setJobRoles((prev) => prev.filter((jr) => jr._key !== key));
  }

  function updateJobRoleName(key: string, name: string) {
    setJobRoles((prev) => prev.map((jr) => (jr._key === key ? { ...jr, name } : jr)));
  }

  function toggleSubjectInJobRole(key: string, subjectId: string) {
    setJobRoles((prev) =>
      prev.map((jr) => {
        if (jr._key !== key) return jr;
        const has = jr.subjectIds.includes(subjectId);
        return { ...jr, subjectIds: has ? jr.subjectIds.filter((x) => x !== subjectId) : [...jr.subjectIds, subjectId] };
      }),
    );
  }

  function toggleJobRoleExpanded(key: string) {
    setJobRoles((prev) => prev.map((jr) => (jr._key === key ? { ...jr, expanded: !jr.expanded } : jr)));
  }

  // Stage helpers
  function addStage(name: string) {
    const t = name.trim();
    if (!t || stages.includes(t)) return;
    setStages((prev) => [...prev, t]);
    setStageInput("");
  }

  function removeStage(name: string) {
    setStages((prev) => prev.filter((s) => s !== name));
  }

  async function onSubmit(data: FormData) {
    const invalidCargo = jobRoles.find((jr) => !jr.name.trim());
    if (invalidCargo) {
      toast.error("Preencha o nome de todos os cargos.");
      return;
    }
    const payload = {
      ...data,
      examBoardId: data.examBoardId || undefined,
      jobRolesWithSubjects: jobRoles.map((jr) => ({
        name: jr.name.trim(),
        subjectIds: jr.subjectIds,
      })),
      stages,
    };
    const url = competitionId ? `/api/admin/competitions/${competitionId}` : "/api/admin/competitions";
    const method = competitionId ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (res.ok) {
      toast.success(competitionId ? "Concurso atualizado!" : "Concurso criado!");
      router.push("/admin/concursos");
    } else {
      const d = await res.json();
      toast.error(d.error ?? "Erro ao salvar");
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Back + Title */}
      <div className="mb-7">
        <Link
          href="/admin/concursos"
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-violet-600 hover:text-violet-800 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar aos concursos
        </Link>
        <h1 className="text-[26px] font-extrabold tracking-tight text-[var(--text-primary)]">
          {competitionId ? "Editar Concurso" : "Novo Concurso"}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* ── Section 1: Informações Básicas ── */}
        <div className="orbit-panel p-7">
          <h2 className="mb-5 text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
            Informações Básicas
          </h2>
          <div className="space-y-4">
            <div>
              <label className="orbit-form-label">Nome do Concurso *</label>
              <input className="input" {...register("name")} placeholder="Ex: PM do Maranhão 2026" />
              {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="orbit-form-label">Cidade *</label>
                <select className="input" {...register("cityId")}>
                  <option value="">Selecione...</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} — {c.state}</option>
                  ))}
                </select>
                {errors.cityId && <p className="mt-1 text-xs text-red-500">{errors.cityId.message}</p>}
              </div>
              <div>
                <label className="orbit-form-label">Organização</label>
                <input className="input" {...register("organization")} placeholder="Ex: Secretaria de Segurança" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="orbit-form-label">Banca Examinadora</label>
                <select className="input" {...register("examBoardId")}>
                  <option value="">Não definida</option>
                  {examBoards.map((b) => (
                    <option key={b.id} value={b.id}>{b.acronym} — {b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="orbit-form-label">Data da Prova</label>
                <input type="date" className="input" {...register("examDate")} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="orbit-form-label">Status</label>
                <select className="input" {...register("status")}>
                  <option value="UPCOMING">Em breve</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="PAST">Encerrado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
              <div>
                <label className="orbit-form-label">Link do Edital</label>
                <input className="input" {...register("editalUrl")} placeholder="https://..." />
              </div>
            </div>

            <div>
              <label className="orbit-form-label">Descrição</label>
              <textarea
                className="input min-h-[80px] resize-y"
                {...register("description")}
                rows={3}
                placeholder="Informações adicionais sobre o concurso..."
              />
            </div>
          </div>
        </div>

        {/* ── Section 2: Cargos e Matérias ── */}
        <div className="orbit-panel p-7">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
                Cargos e Matérias
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--text-muted)]">
                Cada cargo possui suas próprias matérias.
              </p>
            </div>
            <button
              type="button"
              onClick={addJobRole}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> Adicionar cargo
            </button>
          </div>

          {jobRoles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-center">
              <p className="text-sm text-[var(--text-muted)]">
                Nenhum cargo adicionado.
              </p>
              <button
                type="button"
                onClick={addJobRole}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar primeiro cargo
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {jobRoles.map((jr) => (
                <div key={jr._key} className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
                  {/* Cargo header */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => toggleJobRoleExpanded(jr._key)}
                      className="shrink-0 text-gray-400 hover:text-violet-600 transition-colors"
                    >
                      {jr.expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <input
                      className="input min-w-0 flex-1 bg-transparent text-sm font-semibold"
                      placeholder="Nome do cargo (ex: Soldado, Oficial, Analista...)"
                      value={jr.name}
                      onChange={(e) => updateJobRoleName(jr._key, e.target.value)}
                    />
                    <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                      {jr.subjectIds.length} {jr.subjectIds.length === 1 ? "matéria" : "matérias"}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeJobRole(jr._key)}
                      className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remover cargo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Subject picker */}
                  {jr.expanded && (
                    <div className="border-t border-[var(--border-subtle)] px-4 pb-4 pt-3">
                      {subjects.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)]">
                          Nenhuma matéria cadastrada.{" "}
                          <Link href="/admin/materias" className="text-violet-600 underline" target="_blank">
                            Cadastrar matérias
                          </Link>
                        </p>
                      ) : (
                        <>
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                            Matérias deste cargo
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {subjects.map((s) => {
                              const selected = jr.subjectIds.includes(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => toggleSubjectInJobRole(jr._key, s.id)}
                                  className={cn(
                                    "rounded-full px-3 py-1.5 text-[12px] font-medium transition-all border",
                                    selected
                                      ? "border-violet-500 bg-violet-100 text-violet-800"
                                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-violet-300",
                                  )}
                                >
                                  {s.name}
                                </button>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Section 3: Etapas ── */}
        <div className="orbit-panel p-7">
          <h2 className="mb-4 text-[11px] font-extrabold uppercase tracking-widest text-[var(--text-muted)]">
            Etapas do Concurso
          </h2>

          {/* Quick-add common stages */}
          <div className="mb-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
              Etapas comuns
            </p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_STAGES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => (stages.includes(s) ? removeStage(s) : addStage(s))}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                    stages.includes(s)
                      ? "border-violet-500 bg-violet-100 text-violet-800"
                      : "border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:border-violet-300",
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Custom stage input */}
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Outra etapa..."
              value={stageInput}
              onChange={(e) => setStageInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addStage(stageInput); } }}
            />
            <button
              type="button"
              onClick={() => addStage(stageInput)}
              className="shrink-0 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Current stages */}
          {stages.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {stages.map((s, i) => (
                <div key={s} className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2">
                  <span className="w-5 shrink-0 text-center text-[11px] font-bold text-[var(--text-muted)]">{i + 1}</span>
                  <span className="flex-1 text-[13px] font-medium text-[var(--text-primary)]">{s}</span>
                  <button type="button" onClick={() => removeStage(s)} className="shrink-0 text-gray-400 hover:text-red-500 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-end gap-3 pb-10">
          <Link href="/admin/concursos" className="btn btn-ghost rounded-2xl">Cancelar</Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary inline-flex min-w-[130px] items-center gap-2 rounded-2xl"
          >
            {isSubmitting ? (
              "Salvando..."
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                Salvar
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
