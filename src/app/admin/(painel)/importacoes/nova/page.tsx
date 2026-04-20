"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft, Upload, FileText, X, CheckCircle2, Loader2, AlertCircle } from "lucide-react";

type Stage = "form" | "processing" | "done" | "error";

export default function NovaImportacaoPage() {
  const router = useRouter();
  const [competitions, setCompetitions] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [stage, setStage] = useState<Stage>("form");
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<{ importId: string; totalExtracted: number; usedOcr: boolean } | null>(null);

  const provaRef = useRef<HTMLInputElement>(null);
  const gabaritoRef = useRef<HTMLInputElement>(null);
  const [provaFile, setProvaFile] = useState<File | null>(null);
  const [gabaritoFile, setGabaritoFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    competitionId: "", subjectId: "", year: "",
    gabaritoNoMesmoPdf: false, gabaritoSeparado: false,
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/competitions?limit=100").then((r) => r.json()),
      fetch("/api/admin/subjects").then((r) => r.json()),
    ]).then(([cd, sd]) => {
      setCompetitions(cd.competitions ?? []);
      setSubjects(sd.subjects ?? []);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!provaFile) { toast.error("Selecione o arquivo PDF da prova"); return; }

    setStage("processing");
    setErrorMsg("");

    const fd = new FormData();
    fd.append("prova", provaFile);
    if (gabaritoFile) fd.append("gabarito", gabaritoFile);
    fd.append("gabaritoNoMesmoPdf", String(form.gabaritoNoMesmoPdf));
    fd.append("useAi", "true");
    if (form.competitionId) fd.append("competitionId", form.competitionId);
    if (form.subjectId) fd.append("subjectId", form.subjectId);
    if (form.year) fd.append("year", form.year);

    try {
      const res = await fetch("/api/admin/imports/process", { method: "POST", body: fd });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Erro desconhecido");
        setStage("error");
        return;
      }

      setResult(data);
      setStage("done");
    } catch (err) {
      setErrorMsg("Erro de conexão com o servidor");
      setStage("error");
    }
  }

  // ── PROCESSING ──────────────────────────────────────────────
  if (stage === "processing") {
    return (
      <div style={{ maxWidth: 480, margin: "60px auto", textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
          <Loader2 style={{ width: 28, height: 28, color: "#7C3AED", animation: "spin 1s linear infinite" }} />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Processando PDF...</h2>
        <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.7 }}>
          A IA está lendo o PDF, interpretando o layout (inclusive 2 colunas), identificando texto-base e estruturando as questões.<br />
          Isso pode levar alguns segundos para PDFs grandes.
        </p>
        <div style={{ marginTop: 24, background: "#F8F7FF", border: "1px solid #EDE9FE", borderRadius: 12, padding: "14px 18px", textAlign: "left" }}>
          <p style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600 }}>Pipeline em execução:</p>
          {["1. OCR + layout (Document AI)", "2. Reordenação por colunas/páginas", "3. IA estruturando questões + texto-base", "4. Salvando para revisão no painel"].map((s) => (
            <p key={s} style={{ fontSize: 12, color: "#6B7280", marginTop: 4 }}>⟳ {s}</p>
          ))}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── ERROR ──────────────────────────────────────────────────
  if (stage === "error") {
    const isServiceDown = errorMsg.toLowerCase().includes("microserviço") || errorMsg.toLowerCase().includes("não está rodando");
    return (
      <div style={{ maxWidth: 560, margin: "40px auto" }}>
        <div className="card" style={{ padding: 28, textAlign: "center" }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <AlertCircle style={{ width: 26, height: 26, color: "#DC2626" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginBottom: 8 }}>Erro no processamento</h2>
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>{errorMsg}</p>

          {isServiceDown && (
            <div style={{ background: "#1E1E2E", borderRadius: 12, padding: "16px 20px", textAlign: "left", marginBottom: 20 }}>
              <p style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600, marginBottom: 8, textTransform: "uppercase" }}>Para iniciar o microserviço:</p>
              <code style={{ fontSize: 12, color: "#A78BFA", fontFamily: "monospace", lineHeight: 1.8, display: "block" }}>
                cd concursa-app/pdf-service<br />
                pip install -r requirements.txt<br />
                uvicorn main:app --reload --port 8000
              </code>
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => setStage("form")} className="btn btn-ghost">Tentar novamente</button>
            <Link href="/admin/importacoes" className="btn btn-primary">Voltar</Link>
          </div>
        </div>
      </div>
    );
  }

  // ── DONE ───────────────────────────────────────────────────
  if (stage === "done" && result) {
    return (
      <div style={{ maxWidth: 480, margin: "40px auto", textAlign: "center" }}>
        <div className="card" style={{ padding: 36 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
            <CheckCircle2 style={{ width: 30, height: 30, color: "#059669" }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginBottom: 8 }}>PDF processado!</h2>
          <p style={{ fontSize: 14, color: "#6B7280", marginBottom: 4 }}>
            <strong style={{ color: "#111827", fontSize: 32 }}>{result.totalExtracted}</strong> questões extraídas
          </p>
          {result.usedOcr && (
            <p style={{ fontSize: 12, color: "#7C3AED", background: "#EDE9FE", padding: "4px 12px", borderRadius: 10, display: "inline-block", marginBottom: 12 }}>
              OCR aplicado (PDF escaneado)
            </p>
          )}
          <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 24 }}>
            As questões estão aguardando revisão. Acesse para aprovar ou rejeitar cada uma.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <Link href="/admin/importacoes" className="btn btn-ghost">Ver todas as importações</Link>
            <Link href={`/admin/importacoes/${result.importId}/revisao`} className="btn btn-primary">
              Revisar questões →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── FORM ───────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/admin/importacoes" style={{ fontSize: 13, color: "#7C3AED", fontWeight: 600, textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 8 }}>
          <ArrowLeft style={{ width: 13, height: 13 }} /> Voltar
        </Link>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>Nova Importação de PDF</h1>
        <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
          Faça upload do PDF da prova para extração automática de questões
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* PDF da prova */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Arquivo da Prova *
          </p>
          <input ref={provaRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => setProvaFile(e.target.files?.[0] ?? null)} />

          {!provaFile ? (
            <button type="button" onClick={() => provaRef.current?.click()}
              style={{
                width: "100%", border: "2px dashed #E5E7EB", borderRadius: 14, padding: "32px 24px",
                background: "#FAFAFA", cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", transition: "all 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#7C3AED"; (e.currentTarget as HTMLButtonElement).style.background = "#FAF5FF"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#E5E7EB"; (e.currentTarget as HTMLButtonElement).style.background = "#FAFAFA"; }}
            >
              <Upload style={{ width: 28, height: 28, color: "#D1D5DB" }} />
              <p style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>Clique para selecionar o PDF</p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>Arquivos .pdf até 50 MB</p>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", background: "#EDE9FE", border: "1.5px solid #C4B5FD", borderRadius: 12 }}>
              <FileText style={{ width: 22, height: 22, color: "#7C3AED", flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#5B21B6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{provaFile.name}</p>
                <p style={{ fontSize: 11, color: "#7C3AED" }}>{(provaFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button type="button" onClick={() => setProvaFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#7C3AED", padding: 4, fontFamily: "var(--font-sans)" }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>
          )}
        </div>

        {/* Gabarito */}
        <div className="card" style={{ padding: 24, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.06em" }}>Gabarito</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.gabaritoNoMesmoPdf}
                onChange={(e) => setForm({ ...form, gabaritoNoMesmoPdf: e.target.checked, gabaritoSeparado: e.target.checked ? false : form.gabaritoSeparado })}
                style={{ accentColor: "#7C3AED", width: 16, height: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>O gabarito está no mesmo PDF da prova (no final)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.gabaritoSeparado}
                onChange={(e) => setForm({ ...form, gabaritoSeparado: e.target.checked, gabaritoNoMesmoPdf: e.target.checked ? false : form.gabaritoNoMesmoPdf })}
                style={{ accentColor: "#7C3AED", width: 16, height: 16 }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>Tenho o gabarito em um PDF separado</span>
            </label>
          </div>

          {form.gabaritoSeparado && (
            <div style={{ marginTop: 14 }}>
              <input ref={gabaritoRef} type="file" accept=".pdf" style={{ display: "none" }} onChange={(e) => setGabaritoFile(e.target.files?.[0] ?? null)} />
              {!gabaritoFile ? (
                <button type="button" onClick={() => gabaritoRef.current?.click()}
                  style={{ width: "100%", border: "2px dashed #E5E7EB", borderRadius: 12, padding: "20px", background: "#FAFAFA", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-sans)" }}>
                  <Upload style={{ width: 18, height: 18, color: "#D1D5DB" }} />
                  <span style={{ fontSize: 13, color: "#9CA3AF" }}>Selecionar PDF do gabarito</span>
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "#ECFDF5", border: "1.5px solid #6EE7B7", borderRadius: 10 }}>
                  <FileText style={{ width: 18, height: 18, color: "#059669" }} />
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#065F46", flex: 1 }}>{gabaritoFile.name}</p>
                  <button type="button" onClick={() => setGabaritoFile(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#059669", fontFamily: "var(--font-sans)" }}>
                    <X style={{ width: 14, height: 14 }} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Metadados */}
        <div className="card" style={{ padding: 24, marginBottom: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Metadados da Prova
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Concurso vinculado</label>
              <select className="input" value={form.competitionId} onChange={(e) => setForm({ ...form, competitionId: e.target.value })}>
                <option value="">Selecione (opcional)</option>
                {competitions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Matéria principal</label>
                <select className="input" value={form.subjectId} onChange={(e) => setForm({ ...form, subjectId: e.target.value })}>
                  <option value="">Detectar automaticamente</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Ano da prova</label>
                <input type="number" className="input" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <Link href="/admin/importacoes" className="btn btn-ghost">Cancelar</Link>
          <button type="submit" disabled={!provaFile} className="btn btn-primary" style={{ minWidth: 160, opacity: !provaFile ? 0.5 : 1 }}>
            <Upload style={{ width: 14, height: 14 }} /> Processar PDF
          </button>
        </div>
      </form>
    </div>
  );
}
