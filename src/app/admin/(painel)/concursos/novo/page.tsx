"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";

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

interface Props { params?: Promise<{ id: string }> }

export default function CompetitionFormPage({ params }: Props) {
  const router = useRouter();
  const [competitionId, setCompetitionId] = useState<string | null>(null);
  const [cities, setCities] = useState<{ id: string; name: string; state: string }[]>([]);
  const [examBoards, setExamBoards] = useState<{ id: string; acronym: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [loadingData, setLoadingData] = useState(true);

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
            name: c.name, cityId: c.cityId, organization: c.organization ?? "",
            examBoardId: c.examBoardId ?? "",           examBoardDefined: c.examBoardDefined ?? false,
            examDate: c.examDate ? new Date(c.examDate).toISOString().slice(0, 10) : "",
            status: (c.status ?? "UPCOMING") as "UPCOMING" | "ACTIVE" | "PAST" | "CANCELLED", description: c.description ?? "", editalUrl: c.editalUrl ?? "",
          });
          setSelectedSubjects(c.subjects.map((s: { subjectId: string }) => s.subjectId));
        }
      }
      setLoadingData(false);
    }
    init();
  }, [params, reset]);

  async function onSubmit(data: FormData) {
    const payload = { ...data, subjectIds: selectedSubjects, examBoardId: data.examBoardId || undefined };
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
      <div style={{ textAlign: "center", padding: "48px 0" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/admin/concursos" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar aos concursos
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
          {competitionId ? "Editar Concurso" : "Novo Concurso"}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="card" style={{ padding: 28, marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 18, textTransform: "uppercase", letterSpacing: "0.06em" }}>Informações Básicas</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nome do Concurso *</label>
              <input className="input" {...register("name")} placeholder="Ex: Prefeitura de São Paulo 2025" />
              {errors.name && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{errors.name.message}</p>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Cidade *</label>
                <select className="input" {...register("cityId")}>
                  <option value="">Selecione...</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.state}</option>)}
                </select>
                {errors.cityId && <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>{errors.cityId.message}</p>}
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Organização</label>
                <input className="input" {...register("organization")} placeholder="Ex: Prefeitura Municipal" />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Banca Examinadora</label>
                <select className="input" {...register("examBoardId")}>
                  <option value="">Não definida</option>
                  {examBoards.map((b) => <option key={b.id} value={b.id}>{b.acronym} — {b.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Data da Prova</label>
                <input type="date" className="input" {...register("examDate")} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Status</label>
                <select className="input" {...register("status")}>
                  <option value="UPCOMING">Em breve</option>
                  <option value="ACTIVE">Ativo</option>
                  <option value="PAST">Encerrado</option>
                  <option value="CANCELLED">Cancelado</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Link do Edital</label>
                <input className="input" {...register("editalUrl")} placeholder="https://..." />
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Descrição</label>
              <textarea className="input" {...register("description")} rows={3} placeholder="Informações adicionais sobre o concurso..." style={{ resize: "vertical" }} />
            </div>
          </div>
        </div>

        {/* Matérias */}
        {subjects.length > 0 && (
          <div className="card" style={{ padding: 28, marginBottom: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>Matérias do Concurso</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {subjects.map((s) => (
                <button
                  key={s.id} type="button"
                  onClick={() => setSelectedSubjects((prev) => prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id])}
                  style={{
                    padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 500,
                    border: selectedSubjects.includes(s.id) ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                    background: selectedSubjects.includes(s.id) ? "#EDE9FE" : "#F9FAFB",
                    color: selectedSubjects.includes(s.id) ? "#7C3AED" : "#374151",
                    cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-sans)",
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Link href="/admin/concursos" className="btn btn-ghost">Cancelar</Link>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary" style={{ minWidth: 130 }}>
            {isSubmitting ? "Salvando..." : <><Save style={{ width: 14, height: 14 }} /> Salvar</>}
          </button>
        </div>
      </form>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
