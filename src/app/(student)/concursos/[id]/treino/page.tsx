"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Play, CheckCircle2, ArrowRight, ArrowLeft,
  Trophy, RotateCcw, AlertTriangle, Send, X, Bot,
} from "lucide-react";

type ReportCategory =
  | "INCOMPLETE_STATEMENT" | "MISSING_TEXT" | "MISSING_IMAGE"
  | "MISSING_ALTERNATIVE" | "FORMAT_ERROR"
  | "WRONG_ANSWER" | "AMBIGUOUS_ANSWER" | "INCONSISTENT_CONTENT" | "OTHER";

const STRUCTURAL_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "INCOMPLETE_STATEMENT", label: "Enunciado incompleto" },
  { value: "MISSING_TEXT", label: "Texto faltando" },
  { value: "MISSING_IMAGE", label: "Imagem faltando" },
  { value: "MISSING_ALTERNATIVE", label: "Alternativa faltando" },
  { value: "FORMAT_ERROR", label: "Erro de formatação" },
];

const ALL_CATEGORIES: { value: ReportCategory; label: string }[] = [
  ...STRUCTURAL_CATEGORIES,
  { value: "WRONG_ANSWER", label: "Resposta possivelmente errada" },
  { value: "AMBIGUOUS_ANSWER", label: "Resposta ambígua/dupla" },
  { value: "INCONSISTENT_CONTENT", label: "Conteúdo inconsistente" },
  { value: "OTHER", label: "Outro problema" },
];

interface ReportModalProps {
  questionId: string;
  sessionId: string;
  phase: "during" | "after";
  onClose: () => void;
  onStructuralReplaced?: (nextQuestion: Question) => void;
}

function ReportModal({ questionId, sessionId, phase, onClose, onStructuralReplaced }: ReportModalProps) {
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiResult, setAiResult] = useState<{ verdict: string; analysis: string } | null>(null);

  const VERDICT_LABELS: Record<string, { label: string; color: string }> = {
    ANSWER_IS_CORRECT: { label: "Gabarito está correto", color: "#059669" },
    ANSWER_MAY_BE_WRONG: { label: "Pode estar errado — revisão recomendada", color: "#D97706" },
    ANSWER_IS_WRONG: { label: "Gabarito possivelmente errado", color: "#DC2626" },
    AMBIGUOUS: { label: "Questão ambígua", color: "#7C3AED" },
  };
  const categories = phase === "during" ? STRUCTURAL_CATEGORIES : ALL_CATEGORIES;

  async function submit() {
    if (!category) { toast.error("Selecione uma categoria"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/question-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId, category,
          description: description.trim() || undefined,
          phase,
          sessionId,
          sessionType: "TRAINING",
        }),
      });
      const data = await res.json() as { ok: boolean; reportId?: string };
      if (!res.ok) throw new Error();
      setSubmitted(true);
      toast.success("Denúncia registrada");

      if (phase === "during") {
        if (onStructuralReplaced) {
          const rep = await fetch(`/api/training/${sessionId}/replace`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ questionId }),
          });
          const repData = await rep.json() as { question?: Question; error?: string };
          if (rep.ok && repData.question) {
            onStructuralReplaced(repData.question);
            toast.success("Questão substituída automaticamente");
          } else {
            toast.info(repData.error ?? "Não foi possível substituir agora");
          }
        }
      }

      if (phase === "after" && category === "WRONG_ANSWER" && data.reportId) {
        await new Promise((r) => setTimeout(r, 3000));
        const reviewRes = await fetch(`/api/question-reports?questionId=${questionId}`);
        const reviewData = await reviewRes.json() as { reports: { aiReview?: { verdict: string; analysis: string } }[] };
        const report = reviewData.reports?.[0];
        if (report?.aiReview) setAiResult(report.aiReview);
      }
    } catch {
      toast.error("Erro ao enviar denúncia");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 24, maxWidth: 480, width: "100%",
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle style={{ width: 18, height: 18, color: "#D97706" }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>Denunciar questão</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {!submitted ? (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  style={{
                    padding: "9px 14px", borderRadius: 8, fontSize: 13, textAlign: "left",
                    border: category === c.value ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                    background: category === c.value ? "#EDE9FE" : "#F9FAFB",
                    color: category === c.value ? "#5B21B6" : "#374151",
                    cursor: "pointer", fontFamily: "var(--font-sans)",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {phase === "after" && (category === "WRONG_ANSWER" || category === "AMBIGUOUS_ANSWER" || category === "OTHER") && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  {category === "WRONG_ANSWER" ? "Descreva por que a resposta pode estar errada:" : "Detalhes (opcional):"}
                </p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13, border: "1.5px solid #E5E7EB", resize: "vertical", fontFamily: "var(--font-sans)", outline: "none" }}
                />
                {category === "WRONG_ANSWER" && (
                  <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>A IA analisará e emitirá um veredito honesto.</p>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, height: 40 }}>Cancelar</button>
              <button onClick={submit} disabled={!category || submitting} className="btn btn-primary" style={{ flex: 2, height: 40 }}>
                {submitting ? "Enviando..." : <><Send style={{ width: 13, height: 13 }} /> Enviar</>}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <CheckCircle2 style={{ width: 36, height: 36, color: "#059669", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Denúncia registrada!</p>
            {category === "WRONG_ANSWER" && !aiResult && (
              <div style={{ marginBottom: 12, padding: 10, background: "#EDE9FE", borderRadius: 8 }}>
                <Bot style={{ width: 14, height: 14, color: "#7C3AED", margin: "0 auto 4px" }} />
                <p style={{ fontSize: 12, color: "#5B21B6" }}>IA analisando...</p>
              </div>
            )}
            {aiResult && (
              <div style={{ marginBottom: 12, padding: 14, background: "#F9FAFB", borderRadius: 10, textAlign: "left", border: "1px solid #E5E7EB" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Bot style={{ width: 13, height: 13, color: "#7C3AED" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>ANÁLISE DA IA</span>
                  <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: VERDICT_LABELS[aiResult.verdict]?.color }}>{VERDICT_LABELS[aiResult.verdict]?.label ?? aiResult.verdict}</span>
                </div>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{aiResult.analysis}</p>
              </div>
            )}
            <button onClick={onClose} className="btn btn-primary" style={{ width: "100%", height: 40 }}>Fechar</button>
          </div>
        )}
      </div>
    </div>
  );
}

type Phase = "config" | "loading" | "training" | "finishing" | "summary";

interface Alternative { id: string; letter: string; content: string; imageUrl?: string | null }
interface Question {
  id: string; content: string;
  supportText?: string | null;
  subject?: string; difficulty: string; alternatives: Alternative[];
  hasImage?: boolean;
  imageUrl?: string | null;
}

type AnswersMap = Record<string, string | null>;

const QUANTITIES = [5, 10, 15, 20];
const DIFFICULTIES = [
  { value: "ALL", label: "Todas" },
  { value: "EASY", label: "Fácil" },
  { value: "MEDIUM", label: "Médio" },
  { value: "HARD", label: "Difícil" },
];

export default function TreinoPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const competitionId = params.id as string;

  const [phase, setPhase] = useState<Phase>("config");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("ALL");
  const [quantity, setQuantity] = useState(10);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [startTime, setStartTime] = useState(0);
  const [reportModal, setReportModal] = useState<{ questionId: string; phase: "during" | "after" } | null>(null);
  const [nowMs, setNowMs] = useState(() => new Date().getTime());
  const [results, setResults] = useState<Record<string, { isCorrect: boolean; correctAnswer: string; aiExplanation?: string | null }>>({});
  const [subjectPerf, setSubjectPerf] = useState<Array<{ subject: string; total: number; correct: number; accuracy: number }>>([]);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [finishPhraseIdx, setFinishPhraseIdx] = useState(0);

  const FINISH_PHRASES = [
    "Calculando sua nota...",
    "Analisando seu desempenho...",
    "Organizando seus resultados...",
    "Preparando sua revisão de erros...",
    "Gerando gráficos de desempenho...",
    "Quase lá...",
    "Nós acreditamos em você. Acredite também.",
  ];

  useEffect(() => {
    fetch(`/api/student/subjects-for-competition?competitionId=${competitionId}`)
      .then((r) => r.json())
      .then((d: { subjects?: { id: string; name: string }[] }) => {
        setSubjects(d.subjects ?? []);
        const pre = searchParams.get("subject")?.trim();
        if (pre && (d.subjects ?? []).some((s) => s.id === pre)) {
          setSelectedSubjects([pre]);
        }
      })
      .catch(() => setSubjects([]));
  }, [competitionId, searchParams]);

  async function startTraining() {
    setPhase("loading");
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId, subjectIds: selectedSubjects, difficulty: difficulty === "ALL" ? undefined : difficulty, quantity }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao iniciar treino"); setPhase("config"); return; }
      setSessionId(data.sessionId);
      setQuestions(data.questions);
      setCurrentIdx(0);
      setAnswers({});
      setResults({});
      setStartTime(Date.now());
      setPhase("training");
    } catch {
      toast.error("Erro ao iniciar treino");
      setPhase("config");
    }
  }

  async function markAnswer(letter: string) {
    const q = questions[currentIdx];
    if (!q || !sessionId) return;
    setAnswers((prev) => ({ ...prev, [q.id]: letter }));
    fetch(`/api/training/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, selectedAnswer: letter }),
    }).catch(() => {});
  }

  const finishSession = useCallback(async () => {
    if (!sessionId) return;
    setPhase("finishing");
    const elapsed = Math.round((new Date().getTime() - startTime) / 1000);
    const payloadAnswers = questions.map((q) => ({ questionId: q.id, selectedAnswer: answers[q.id] ?? null }));
    const res = await fetch(`/api/training/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: payloadAnswers, timeSpentSeconds: elapsed }),
    });
    const data = await res.json() as {
      ok?: boolean;
      results?: { questionId: string; selectedAnswer: string | null; correctAnswer: string; isCorrect: boolean; aiExplanation?: string | null }[];
      subjectPerformance?: { subject: string; total: number; correct: number; accuracy: number }[];
      error?: string;
    };
    if (!res.ok) { toast.error(data.error ?? "Erro ao finalizar treino"); setPhase("training"); return; }
    const map: Record<string, { isCorrect: boolean; correctAnswer: string; aiExplanation?: string | null }> = {};
    for (const r of data.results ?? []) {
      map[r.questionId] = { isCorrect: r.isCorrect, correctAnswer: r.correctAnswer, aiExplanation: r.aiExplanation ?? null };
    }
    setResults(map);
    setSubjectPerf(data.subjectPerformance ?? []);
    setPhase("summary");
  }, [answers, sessionId, startTime, questions]);

  useEffect(() => {
    if (phase !== "finishing") return;
    setFinishPhraseIdx(0);
    const t = setInterval(() => setFinishPhraseIdx((i) => (i + 1) % 7), 1400);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "training") return;
    const t = setInterval(() => setNowMs(new Date().getTime()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  const totalAnswered = Object.values(answers).filter((v) => v != null).length;
  const correctCount = Object.values(results).filter((r) => r.isCorrect).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const elapsed = Math.round((nowMs - startTime) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  // ── CONFIG ──────────────────────────────────────────────────────────────────
  if (phase === "config") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            Modo Treino
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            Pratique questões com correção imediata e feedback detalhado
          </p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {/* Matérias */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
              Matérias (opcional)
            </p>
            {subjects.length === 0 ? (
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>
                Nenhuma matéria disponível para o seu cargo neste concurso (ou o vínculo ainda não foi configurado).
              </p>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() =>
                      setSelectedSubjects((prev) =>
                        prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                      )
                    }
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      fontSize: 13,
                      fontWeight: 500,
                      border: selectedSubjects.includes(s.id) ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                      background: selectedSubjects.includes(s.id) ? "#EDE9FE" : "#F9FAFB",
                      color: selectedSubjects.includes(s.id) ? "#7C3AED" : "#374151",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      fontFamily: "var(--font-sans)",
                    }}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dificuldade */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
              Dificuldade
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setDifficulty(d.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 500,
                    border: difficulty === d.value ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                    background: difficulty === d.value ? "#EDE9FE" : "#F9FAFB",
                    color: difficulty === d.value ? "#7C3AED" : "#374151",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantidade */}
          <div style={{ marginBottom: 28 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
              Quantidade de questões
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {QUANTITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuantity(q)}
                  style={{
                    width: 52,
                    height: 44,
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 700,
                    border: quantity === q ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                    background: quantity === q ? "#EDE9FE" : "#F9FAFB",
                    color: quantity === q ? "#7C3AED" : "#374151",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startTraining}
            className="btn btn-primary"
            style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 14 }}
          >
            <Play style={{ width: 16, height: 16 }} />
            Iniciar Treino
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING ─────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 320 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid #EDE9FE", borderTopColor: "#7C3AED",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ color: "#6B7280", fontSize: 14 }}>Preparando suas questões...</p>
        </div>
      </div>
    );
  }

  // ── FINISHING ───────────────────────────────────────────────────────────────
  if (phase === "finishing") {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 360 }}>
        <div style={{ textAlign: "center", maxWidth: 520, padding: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: "3px solid #EDE9FE", borderTopColor: "#7C3AED",
            animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          <p style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{FINISH_PHRASES[finishPhraseIdx] ?? "Processando..."}</p>
          <p style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>Estamos finalizando seu treino e preparando a tela de resultados.</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── SUMMARY ─────────────────────────────────────────────────────────────────
  if (phase === "summary") {
    const pct = score;
    const color = pct >= 70 ? "#059669" : pct >= 50 ? "#D97706" : "#DC2626";
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="card" style={{ padding: 36, textAlign: "center" }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: "50%",
              background: `${color}15`, border: `3px solid ${color}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <Trophy style={{ width: 32, height: 32, color }} />
          </div>

          <p style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>
            Treino finalizado!
          </p>
          <p style={{ fontSize: 52, fontWeight: 800, color, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 8 }}>
            {pct}%
          </p>
          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>
            {correctCount} de {questions.length} questões corretas
          </p>

          <div
            style={{
              display: "flex", justifyContent: "center", gap: 24,
              marginTop: 24, padding: "16px 0",
              borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{correctCount}</p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>Acertos</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#DC2626" }}>{questions.length - correctCount}</p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>Erros</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#374151" }}>
                {minutes}:{String(seconds).padStart(2, "0")}
              </p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>Tempo</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button
              onClick={() => { setPhase("config"); setQuestions([]); setAnswers({}); }}
              className="btn btn-ghost"
              style={{ flex: 1, height: 44 }}
            >
              <RotateCcw style={{ width: 14, height: 14 }} />
              Novo treino
            </button>
            <button
              onClick={() => router.push(`/concursos/${competitionId}`)}
              className="btn btn-primary"
              style={{ flex: 1, height: 44 }}
            >
              Voltar ao concurso
              <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Desempenho por matéria */}
        {subjectPerf.length > 0 && (
          <div className="card" style={{ padding: 18, marginTop: 14 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 10 }}>Desempenho por matéria</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {subjectPerf.map((s) => (
                <div key={s.subject}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6B7280", marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, color: "#374151" }}>{s.subject}</span>
                    <span>{s.correct}/{s.total} · {s.accuracy}%</span>
                  </div>
                  <div style={{ height: 8, background: "#F3F4F6", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${s.accuracy}%`, background: "linear-gradient(90deg, #7C3AED, #A855F7)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Revisar erros */}
        <div className="card" style={{ padding: 18, marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>Revisão</p>
            <button
              className="btn btn-ghost"
              style={{ height: 34, fontSize: 12 }}
              onClick={() => setOnlyWrong((v) => !v)}
            >
              {onlyWrong ? "Mostrar todas" : "Revisar erros"}
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {questions
              .filter((q) => (onlyWrong ? (results[q.id]?.isCorrect === false) : true))
              .map((q, idx) => {
                const r = results[q.id];
                const isCorrect = r?.isCorrect === true;
                return (
                  <div key={q.id} style={{ padding: "12px 14px", border: "1px solid #E5E7EB", borderRadius: 12, background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      {isCorrect
                        ? <CheckCircle2 style={{ width: 16, height: 16, color: "#059669" }} />
                        : <AlertTriangle style={{ width: 16, height: 16, color: "#DC2626" }} />}
                      <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 600 }}>Questão {idx + 1}</span>
                      {q.subject && <span style={{ fontSize: 11, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 12 }}>{q.subject}</span>}
                      <button
                        onClick={() => router.push(`/questoes/${q.id}`)}
                        style={{ marginLeft: "auto" }}
                        className="btn btn-ghost"
                      >
                        Abrir
                      </button>
                    </div>
                    <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                      {q.content.length > 140 ? q.content.slice(0, 140) + "…" : q.content}
                    </p>
                    {r && (
                      <p style={{ fontSize: 12, color: "#6B7280", marginTop: 6 }}>
                        Sua resposta: <strong>{answers[q.id] ?? "-"}</strong>{" "}
                        {!isCorrect && r.correctAnswer ? <>· Correta: <strong>{r.correctAnswer}</strong></> : null}
                      </p>
                    )}
                    {!isCorrect && (
                      <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6 }}>
                        A explicação da IA pode levar alguns instantes para aparecer ao abrir a questão (gerada no pós-prova).
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  // ── TRAINING ─────────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;
  const ans = answers[q.id];
  const showQuestionImage = Boolean((q.hasImage && q.imageUrl) || (q.imageUrl && String(q.imageUrl).trim().length > 0));
  const progress = ((currentIdx) / questions.length) * 100;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto" }}>
      {reportModal && sessionId && (
        <ReportModal
          questionId={reportModal.questionId}
          sessionId={sessionId}
          phase={reportModal.phase}
          onStructuralReplaced={(nextQuestion) => {
            setQuestions((prev) => {
              const idx = prev.findIndex((qq) => qq.id === reportModal.questionId);
              if (idx < 0) return prev;
              const copy = [...prev];
              copy[idx] = nextQuestion;
              return copy;
            });
            setAnswers((prev) => {
              const copy = { ...prev };
              delete copy[reportModal.questionId];
              return copy;
            });
            setReportModal(null);
          }}
          onClose={() => setReportModal(null)}
        />
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
            Questão {currentIdx + 1} de {questions.length}
          </p>
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#9CA3AF" }}>
            <span style={{ color: "#059669", fontWeight: 600 }}>✓ {totalAnswered > 0 ? correctCount : 0}</span>
            <span style={{ color: "#DC2626", fontWeight: 600 }}>✗ {totalAnswered - correctCount}</span>
          </div>
        </div>
        <div style={{ height: 6, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #7C3AED, #A855F7)", borderRadius: 4, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* Question card */}
      <div className="card" style={{ padding: 28, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          {q.subject && (
            <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 20, letterSpacing: "0.02em" }}>
              {q.subject}
            </span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: q.difficulty === "EASY" ? "#059669" : q.difficulty === "HARD" ? "#DC2626" : "#D97706",
            background: q.difficulty === "EASY" ? "#ECFDF5" : q.difficulty === "HARD" ? "#FEF2F2" : "#FFFBEB",
            padding: "3px 10px", borderRadius: 20,
          }}>
            {q.difficulty === "EASY" ? "Fácil" : q.difficulty === "HARD" ? "Difícil" : "Médio"}
          </span>
        </div>

        {q.supportText ? (
          <div style={{ marginBottom: 16, padding: 14, background: "#F8F7FF", borderRadius: 12, border: "1px solid #EDE9FE" }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Texto de apoio</p>
            <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{q.supportText}</p>
          </div>
        ) : null}

        <p style={{ fontSize: 15.5, color: "#1F2937", lineHeight: 1.7, fontWeight: 500, whiteSpace: "pre-wrap" }}>
          {q.content}
        </p>
        {showQuestionImage && q.imageUrl && (
          <div style={{ marginTop: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={q.imageUrl}
              alt=""
              style={{ maxWidth: "100%", height: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }}
            />
          </div>
        )}
      </div>

      {/* Alternatives */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {q.alternatives.map((alt) => {
          const isSelected = (ans ?? null) === alt.letter;
          let bg = "#FFFFFF", border = "#E5E7EB", color = "#374151";
          if (isSelected) {
            bg = "#EDE9FE"; border = "#7C3AED"; color = "#5B21B6";
          }

          return (
            <button
              key={alt.letter}
              onClick={() => markAnswer(alt.letter)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "14px 18px", borderRadius: 12,
                background: bg, border: `1.5px solid ${border}`, color,
                cursor: "pointer",
                transition: "all 0.15s", textAlign: "left",
                fontFamily: "var(--font-sans)",
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: isSelected ? "#7C3AED" : "#F3F4F6",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: isSelected ? "#fff" : "#6B7280",
              }}>
                {alt.letter}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.55, paddingTop: 3, flex: 1 }}>
                {(alt.imageUrl && String(alt.imageUrl).trim().length > 0) ? (
                  <span style={{ display: "block" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={alt.imageUrl}
                      alt=""
                      style={{ maxWidth: "100%", height: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }}
                    />
                  </span>
                ) : (
                  alt.content
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => router.push(`/concursos/${competitionId}`)}
            className="btn btn-ghost"
            style={{ fontSize: 13 }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Sair
          </button>

          <button
            onClick={() => setReportModal({ questionId: q.id, phase: "during" })}
            style={{
              background: "none", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
              fontSize: 12, color: "#9CA3AF", fontFamily: "var(--font-sans)", fontWeight: 600,
            }}
          >
            <AlertTriangle style={{ width: 12, height: 12 }} />
            Denunciar
          </button>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            className="btn btn-ghost"
            disabled={currentIdx === 0}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} />
            Voltar
          </button>
          <button
            onClick={() => {
              if (currentIdx + 1 >= questions.length) finishSession();
              else setCurrentIdx((i) => i + 1);
            }}
            className="btn btn-primary"
          >
            {currentIdx + 1 >= questions.length ? "Finalizar" : ((ans ?? null) ? "Próxima" : "Pular")}
            <ArrowRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
