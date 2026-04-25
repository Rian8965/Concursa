"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Target, CheckCircle2, XCircle, Clock, ArrowLeft, ArrowRight,
  Trophy, Flag, RotateCcw, ChevronLeft, ChevronRight,
  AlertTriangle, Send, X, Bot,
} from "lucide-react";

type Phase = "config" | "loading" | "exam" | "results";

interface Alternative { id: string; letter: string; content: string }
interface Question {
  id: string; order: number; content: string; subject?: string;
  difficulty: string; alternatives: Alternative[];
  supportText?: string | null;
  hasImage?: boolean;
  imageUrl?: string | null;
}
interface Result {
  questionId: string; selectedAnswer: string | null;
  correctAnswer: string; isCorrect: boolean;
}

const QUANTITIES = [10, 20, 30, 40];
const TIME_OPTIONS = [
  { value: 30, label: "30 min" }, { value: 60, label: "60 min" },
  { value: 90, label: "90 min" }, { value: 120, label: "120 min" },
];

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

interface ReportModalState {
  questionId: string;
  phase: "during" | "after";
  sessionId: string;
}

function ReportModal({
  state, onClose,
}: {
  state: ReportModalState;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<ReportCategory | "">("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<{ verdict: string; analysis: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const categories = state.phase === "during" ? STRUCTURAL_CATEGORIES : ALL_CATEGORIES;

  const VERDICT_LABELS: Record<string, { label: string; color: string }> = {
    ANSWER_IS_CORRECT: { label: "Gabarito está correto", color: "#059669" },
    ANSWER_MAY_BE_WRONG: { label: "Pode estar errado — revisão recomendada", color: "#D97706" },
    ANSWER_IS_WRONG: { label: "Gabarito possivelmente errado", color: "#DC2626" },
    AMBIGUOUS: { label: "Questão ambígua", color: "#7C3AED" },
  };

  async function submit() {
    if (!category) { toast.error("Selecione uma categoria"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/question-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId: state.questionId,
          category,
          description: description.trim() || undefined,
          phase: state.phase,
          sessionId: state.sessionId,
          sessionType: "EXAM",
        }),
      });
      const data = await res.json() as { ok: boolean; reportId?: string };
      if (!res.ok) throw new Error();

      setSubmitted(true);
      toast.success("Denúncia registrada com sucesso");

      // Se for WRONG_ANSWER, espera análise da IA
      if (category === "WRONG_ANSWER" && data.reportId) {
        await new Promise((r) => setTimeout(r, 3000));
        const reviewRes = await fetch(`/api/question-reports?questionId=${state.questionId}`);
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
      zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 24,
        maxWidth: 480, width: "100%", maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
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

        {state.phase === "during" && (
          <div style={{ marginBottom: 12, padding: 10, background: "#FFFBEB", borderRadius: 8, fontSize: 12, color: "#92400E" }}>
            <strong>Durante a prova:</strong> apenas problemas estruturais (conteúdo incompleto, imagem faltando, etc.).<br />
            Para contestar o gabarito, faça ao finalizar.
          </div>
        )}

        {!submitted ? (
          <>
            <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
              Qual o problema?
            </p>
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

            {(category === "WRONG_ANSWER" || category === "AMBIGUOUS_ANSWER" || category === "OTHER") && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                  {category === "WRONG_ANSWER"
                    ? "Descreva por que você acha que a resposta está errada:"
                    : "Descreva o problema (opcional):"}
                </p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Seja específico para que a IA possa analisar melhor..."
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 8, fontSize: 13,
                    border: "1.5px solid #E5E7EB", resize: "vertical",
                    fontFamily: "var(--font-sans)", outline: "none",
                  }}
                />
                {category === "WRONG_ANSWER" && (
                  <p style={{ fontSize: 11, color: "#6B7280", marginTop: 4 }}>
                    A IA analisará o argumento e retornará um veredito honesto.
                  </p>
                )}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onClose} className="btn btn-ghost" style={{ flex: 1, height: 40 }}>
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={!category || submitting}
                className="btn btn-primary"
                style={{ flex: 2, height: 40 }}
              >
                {submitting ? "Enviando..." : (
                  <>
                    <Send style={{ width: 13, height: 13 }} />
                    Enviar denúncia
                  </>
                )}
              </button>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center" }}>
            <CheckCircle2 style={{ width: 36, height: 36, color: "#059669", margin: "0 auto 12px" }} />
            <p style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
              Denúncia registrada!
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 16 }}>
              Obrigado pelo feedback. Nossa equipe irá analisar.
            </p>

            {category === "WRONG_ANSWER" && !aiResult && (
              <div style={{ marginBottom: 16, padding: 12, background: "#EDE9FE", borderRadius: 10 }}>
                <Bot style={{ width: 16, height: 16, color: "#7C3AED", margin: "0 auto 6px" }} />
                <p style={{ fontSize: 13, color: "#5B21B6" }}>IA analisando o argumento...</p>
              </div>
            )}

            {aiResult && (
              <div style={{
                marginBottom: 16, padding: 14, borderRadius: 10, textAlign: "left",
                background: "#F9FAFB", border: "1px solid #E5E7EB",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Bot style={{ width: 14, height: 14, color: "#7C3AED" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>ANÁLISE DA IA</span>
                  <span style={{
                    marginLeft: "auto", fontSize: 11, fontWeight: 700,
                    color: VERDICT_LABELS[aiResult.verdict]?.color ?? "#374151",
                  }}>
                    {VERDICT_LABELS[aiResult.verdict]?.label ?? aiResult.verdict}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{aiResult.analysis}</p>
              </div>
            )}

            <button onClick={onClose} className="btn btn-primary" style={{ width: "100%", height: 40 }}>
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SimuladoPage() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.id as string;

  const [phase, setPhase] = useState<Phase>("config");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(30);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);
  const [isFreeMode, setIsFreeMode] = useState(false);

  const [examId, setExamId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [isFreeModeActive, setIsFreeModeActive] = useState(false);

  const [results, setResults] = useState<Result[]>([]);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const [reportModal, setReportModal] = useState<ReportModalState | null>(null);
  const [nowMs, setNowMs] = useState(() => new Date().getTime());

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const examIdRef = useRef<string>("");

  useEffect(() => {
    fetch(`/api/student/subjects-for-competition?competitionId=${competitionId}`)
      .then((r) => r.json())
      .then((d: { subjects?: { id: string; name: string }[] }) => {
        if (d.subjects?.length) setSubjects(d.subjects);
        else {
          fetch("/api/admin/subjects")
            .then((r) => r.json())
            .then((d2: { subjects?: { id: string; name: string }[] }) => setSubjects(d2.subjects ?? []));
        }
      })
      .catch(() => {
        fetch("/api/admin/subjects")
          .then((r) => r.json())
          .then((d2: { subjects?: { id: string; name: string }[] }) => setSubjects(d2.subjects ?? []));
      });
  }, [competitionId]);

  const submitExam = useCallback(async (spent: number) => {
    const currentExamId = examIdRef.current;
    if (!currentExamId) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("loading");
    try {
      const answers = questions.map((q) => ({
        questionId: q.id, selectedAnswer: selectedAnswers[q.id] ?? null,
      }));
      const res = await fetch(`/api/simulado/${currentExamId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, timeSpentSeconds: spent }),
      });
      const data = await res.json() as { results: Result[]; score: number; correctAnswers: number; error?: string };
      if (!res.ok) { toast.error(data.error); return; }
      setResults(data.results);
      setScore(data.score);
      setCorrectCount(data.correctAnswers);
      setPhase("results");
    } catch {
      toast.error("Erro ao finalizar simulado");
    }
  }, [questions, selectedAnswers]);

  // Timer
  useEffect(() => {
    if (phase === "exam" && !isFreeModeActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current!);
            const spent = Math.round((Date.now() - startTime) / 1000);
            submitExam(spent);
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase, isFreeModeActive, startTime, submitExam, timeLeft]);

  useEffect(() => {
    if (phase !== "results") return;
    const t = setInterval(() => setNowMs(new Date().getTime()), 1000);
    return () => clearInterval(t);
  }, [phase]);

  // Anti-exit: block browser navigation during exam
  useEffect(() => {
    if (phase !== "exam") return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Se você sair, o simulado será encerrado e a tentativa será perdida.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [phase]);

  // Anti-exit: abandon exam if tab becomes hidden
  useEffect(() => {
    if (phase !== "exam") return;
    let abandonTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleVisibility = () => {
      if (document.hidden) {
        abandonTimeout = setTimeout(async () => {
          const currentExamId = examIdRef.current;
          if (currentExamId) {
            await fetch(`/api/simulado/${currentExamId}/abandon`, { method: "POST" }).catch(() => {});
          }
          toast.error("Simulado encerrado — você saiu da tela de prova.", { duration: 8000 });
          setPhase("config");
          setQuestions([]);
          setSelectedAnswers({});
        }, 15000); // 15s de tolerância
      } else {
        if (abandonTimeout) clearTimeout(abandonTimeout);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (abandonTimeout) clearTimeout(abandonTimeout);
    };
  }, [phase]);

  async function startExam() {
    setPhase("loading");
    try {
      const res = await fetch("/api/simulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competitionId,
          subjectIds: selectedSubjects,
          quantity,
          timeLimitMinutes: isFreeMode ? 0 : timeLimitMinutes,
        }),
      });
      const data = await res.json() as {
        examId?: string; questions?: Question[]; timeLimitSeconds?: number; error?: string;
      };
      if (!res.ok) { toast.error(data.error ?? "Erro ao criar simulado"); setPhase("config"); return; }
      const eid = data.examId ?? "";
      setExamId(eid);
      examIdRef.current = eid;
      setQuestions(data.questions ?? []);
      setIsFreeModeActive(isFreeMode || !data.timeLimitSeconds);
      setTimeLeft(data.timeLimitSeconds ?? 0);
      setStartTime(Date.now());
      setSelectedAnswers({});
      setFlagged(new Set());
      setCurrentIdx(0);
      setPhase("exam");
    } catch {
      toast.error("Erro ao criar simulado");
      setPhase("config");
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(selectedAnswers).length;
  const timeIsLow = !isFreeModeActive && timeLeft < 300;

  // ── CONFIG ────────────────────────────────────────────────────────────────
  if (phase === "config") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            Simulado
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            Simule as condições reais da prova
          </p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {/* Tipo de simulado */}
          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
              Tipo de simulado
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { value: false, label: "Cronometrado", desc: "Tempo correndo" },
                { value: true, label: "Modo Livre", desc: "Sem limite de tempo" },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setIsFreeMode(opt.value)}
                  style={{
                    flex: 1, padding: "10px 14px", borderRadius: 10, textAlign: "center",
                    border: isFreeMode === opt.value ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                    background: isFreeMode === opt.value ? "#EDE9FE" : "#F9FAFB",
                    color: isFreeMode === opt.value ? "#5B21B6" : "#374151",
                    cursor: "pointer", fontFamily: "var(--font-sans)",
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{opt.label}</p>
                  <p style={{ fontSize: 11, color: isFreeMode === opt.value ? "#7C3AED" : "#9CA3AF" }}>{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {subjects.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                Matérias (opcional)
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubjects((prev) =>
                      prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]
                    )}
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

          <div style={{ marginBottom: 24 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
              Quantidade de questões
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {QUANTITIES.map((q) => (
                <button
                  key={q}
                  onClick={() => setQuantity(q)}
                  style={{
                    width: 60, height: 44, borderRadius: 10, fontSize: 15, fontWeight: 700,
                    border: quantity === q ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                    background: quantity === q ? "#EDE9FE" : "#F9FAFB",
                    color: quantity === q ? "#7C3AED" : "#374151",
                    cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-sans)",
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {!isFreeMode && (
            <div style={{ marginBottom: 28 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                Tempo disponível
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {TIME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTimeLimitMinutes(t.value)}
                    style={{
                      padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                      border: timeLimitMinutes === t.value ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                      background: timeLimitMinutes === t.value ? "#EDE9FE" : "#F9FAFB",
                      color: timeLimitMinutes === t.value ? "#7C3AED" : "#374151",
                      cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-sans)",
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={startExam} className="btn btn-primary" style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 14 }}>
            <Target style={{ width: 16, height: 16 }} />
            {isFreeMode ? "Iniciar simulado livre" : "Iniciar simulado cronometrado"}
          </button>
        </div>
      </div>
    );
  }

  // ── LOADING ──────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 320 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6B7280", fontSize: 14 }}>Preparando seu simulado...</p>
        </div>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────────
  if (phase === "results") {
    const color = score >= 70 ? "#059669" : score >= 50 ? "#D97706" : "#DC2626";
    const elapsedSeconds = Math.round((nowMs - startTime) / 1000);
    const mins = Math.floor(elapsedSeconds / 60);
    const secs = elapsedSeconds % 60;

    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        {reportModal && (
          <ReportModal state={reportModal} onClose={() => setReportModal(null)} />
        )}

        <div className="card" style={{ padding: "32px 28px", textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: `${color}15`, border: `3px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Trophy style={{ width: 32, height: 32, color }} />
          </div>
          <p style={{ fontSize: 13, color: "#9CA3AF", fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase" }}>Simulado concluído</p>
          <p style={{ fontSize: 52, fontWeight: 800, color, letterSpacing: "-0.05em", lineHeight: 1, marginTop: 8 }}>{score}%</p>
          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6 }}>{correctCount} de {questions.length} questões corretas</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 20, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
            <div><p style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>{correctCount}</p><p style={{ fontSize: 12, color: "#9CA3AF" }}>Acertos</p></div>
            <div><p style={{ fontSize: 22, fontWeight: 800, color: "#DC2626" }}>{questions.length - correctCount}</p><p style={{ fontSize: 12, color: "#9CA3AF" }}>Erros</p></div>
            <div><p style={{ fontSize: 22, fontWeight: 800, color: "#374151" }}>{answeredCount}</p><p style={{ fontSize: 12, color: "#9CA3AF" }}>Respondidas</p></div>
            <div>
              <p style={{ fontSize: 22, fontWeight: 800, color: "#374151" }}>{mins}:{String(secs).padStart(2, "0")}</p>
              <p style={{ fontSize: 12, color: "#9CA3AF" }}>Tempo</p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={() => setPhase("config")} className="btn btn-ghost" style={{ flex: 1, height: 44 }}>
              <RotateCcw style={{ width: 14, height: 14 }} /> Novo simulado
            </button>
            <button onClick={() => router.push(`/concursos/${competitionId}`)} className="btn btn-primary" style={{ flex: 1, height: 44 }}>
              Voltar <ArrowRight style={{ width: 14, height: 14 }} />
            </button>
          </div>
        </div>

        {/* Revisão de questões */}
        <h3 style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
          Revisão das questões
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {questions.map((q, idx) => {
            const r = results.find((r) => r.questionId === q.id);
            return (
              <div key={q.id} className="card" style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  {r?.isCorrect
                    ? <CheckCircle2 style={{ width: 16, height: 16, color: "#059669", flexShrink: 0 }} />
                    : <XCircle style={{ width: 16, height: 16, color: "#DC2626", flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>Questão {idx + 1}</span>
                  {q.subject && <span style={{ fontSize: 11, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 12 }}>{q.subject}</span>}
                  <button
                    onClick={() => setReportModal({ questionId: q.id, phase: "after", sessionId: examId })}
                    style={{
                      marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                      fontSize: 11, color: "#9CA3AF", fontWeight: 600, fontFamily: "var(--font-sans)",
                    }}
                  >
                    <AlertTriangle style={{ width: 12, height: 12 }} />
                    Denunciar
                  </button>
                </div>
                <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, marginBottom: 8 }}>
                  {q.content.length > 160 ? q.content.slice(0, 160) + "…" : q.content}
                </p>
                <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                  {r?.selectedAnswer && (
                    <span style={{ color: r.isCorrect ? "#059669" : "#DC2626", fontWeight: 600 }}>
                      Sua resposta: {r.selectedAnswer}
                    </span>
                  )}
                  {!r?.isCorrect && r?.correctAnswer && (
                    <span style={{ color: "#059669", fontWeight: 600 }}>
                      Correta: {r.correctAnswer}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── EXAM ─────────────────────────────────────────────────────────────────
  const q = questions[currentIdx];
  if (!q) return null;

  return (
    <div>
      {reportModal && (
        <ReportModal state={reportModal} onClose={() => setReportModal(null)} />
      )}

      {/* Anti-exit warning banner */}
      {!isFreeModeActive && (
        <div style={{
          background: "#FEF3C7", border: "1px solid #FDE68A",
          borderRadius: 8, padding: "8px 14px", marginBottom: 14,
          display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#92400E",
        }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span><strong>Modo prova:</strong> se você sair desta página, o simulado será encerrado e a tentativa será perdida.</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 20, maxWidth: 900, margin: "0 auto" }}>
        {/* Main area */}
        <div>
          {/* Timer / progress bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 18px", background: "#FFFFFF", border: "1px solid #E5E7EB",
            borderRadius: 12, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6B7280" }}>
              <span>Q {currentIdx + 1} / {questions.length}</span>
              <span>{answeredCount} respondidas</span>
            </div>
            {!isFreeModeActive ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock style={{ width: 14, height: 14, color: timeIsLow ? "#DC2626" : "#9CA3AF" }} />
                <span style={{ fontSize: 16, fontWeight: 800, color: timeIsLow ? "#DC2626" : "#111827", fontVariantNumeric: "tabular-nums" }}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            ) : (
              <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>Modo livre</span>
            )}
          </div>

          {/* Question card */}
          <div className="card" style={{ padding: 24, marginBottom: 14 }}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              {q.subject && <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 20 }}>{q.subject}</span>}
              <button
                onClick={() => setFlagged((prev) => { const n = new Set(prev); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: flagged.has(q.id) ? "#D97706" : "#9CA3AF", fontFamily: "var(--font-sans)", fontWeight: 600 }}
              >
                <Flag style={{ width: 13, height: 13 }} />
                {flagged.has(q.id) ? "Marcada" : "Marcar"}
              </button>
              <button
                onClick={() => setReportModal({ questionId: q.id, phase: "during", sessionId: examId })}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#9CA3AF", fontFamily: "var(--font-sans)", fontWeight: 600 }}
              >
                <AlertTriangle style={{ width: 13, height: 13 }} />
                Problema
              </button>
            </div>

            {q.supportText && (
              <div style={{ marginBottom: 14, padding: 14, background: "#F8F7FF", borderRadius: 12, border: "1px solid #EDE9FE" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Texto de apoio</p>
                <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{q.supportText}</p>
              </div>
            )}

            <p style={{ fontSize: 15.5, color: "#1F2937", lineHeight: 1.7, fontWeight: 500, whiteSpace: "pre-wrap" }}>{q.content}</p>
            {q.imageUrl && String(q.imageUrl).trim() && (
              <div style={{ marginTop: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.imageUrl} alt="" style={{ maxWidth: "100%", height: "auto", borderRadius: 10, border: "1px solid #E5E7EB" }} />
              </div>
            )}
          </div>

          {/* Alternatives */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
            {q.alternatives.map((alt) => {
              const isSelected = selectedAnswers[q.id] === alt.letter;
              return (
                <button
                  key={alt.letter}
                  onClick={() => setSelectedAnswers((prev) => ({ ...prev, [q.id]: alt.letter }))}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14, padding: "13px 18px",
                    borderRadius: 12, textAlign: "left", cursor: "pointer", transition: "all 0.15s",
                    background: isSelected ? "#EDE9FE" : "#FFFFFF",
                    border: `1.5px solid ${isSelected ? "#7C3AED" : "#E5E7EB"}`,
                    color: isSelected ? "#5B21B6" : "#374151", fontFamily: "var(--font-sans)",
                  }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: isSelected ? "#7C3AED" : "#F3F4F6",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: isSelected ? "#fff" : "#6B7280",
                  }}>
                    {alt.letter}
                  </span>
                  <span style={{ fontSize: 14, lineHeight: 1.55, paddingTop: 3 }}>{alt.content}</span>
                </button>
              );
            })}
          </div>

          {/* Navigation */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} className="btn btn-ghost" disabled={currentIdx === 0}>
              <ChevronLeft style={{ width: 15, height: 15 }} /> Anterior
            </button>
            {currentIdx < questions.length - 1 ? (
              <button onClick={() => setCurrentIdx((i) => i + 1)} className="btn btn-primary">
                Próxima <ChevronRight style={{ width: 15, height: 15 }} />
              </button>
            ) : (
              <button
                onClick={() => submitExam(Math.round((Date.now() - startTime) / 1000))}
                className="btn btn-primary"
                style={{ background: "#059669" }}
              >
                Finalizar <CheckCircle2 style={{ width: 15, height: 15 }} />
              </button>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div>
          <div className="card" style={{ padding: 16, position: "sticky", top: 20 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Questões
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 5 }}>
              {questions.map((qq, idx) => {
                const isAnswered = !!selectedAnswers[qq.id];
                const isCurrent = idx === currentIdx;
                const isFlagged = flagged.has(qq.id);
                return (
                  <button
                    key={qq.id}
                    onClick={() => setCurrentIdx(idx)}
                    style={{
                      height: 30, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
                      border: isCurrent ? "2px solid #7C3AED" : "1.5px solid #E5E7EB",
                      background: isCurrent ? "#7C3AED" : isAnswered ? "#EDE9FE" : isFlagged ? "#FFFBEB" : "#F9FAFB",
                      color: isCurrent ? "#fff" : isAnswered ? "#7C3AED" : isFlagged ? "#D97706" : "#9CA3AF",
                      transition: "all 0.1s", fontFamily: "var(--font-sans)",
                    }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F3F4F6", fontSize: 11, color: "#9CA3AF" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: "#EDE9FE" }} />
                <span>Respondida</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: "#FFFBEB" }} />
                <span>Marcada</span>
              </div>
            </div>

            <button
              onClick={() => submitExam(Math.round((Date.now() - startTime) / 1000))}
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 12, fontSize: 12, height: 38, background: "#059669", boxShadow: "0 4px 12px rgba(5,150,105,0.25)" }}
            >
              Finalizar
            </button>

            {!isFreeModeActive && (
              <button
                onClick={async () => {
                  const currentExamId = examIdRef.current;
                  if (currentExamId) {
                    await fetch(`/api/simulado/${currentExamId}/abandon`, { method: "POST" }).catch(() => {});
                  }
                  router.push(`/concursos/${competitionId}`);
                }}
                style={{
                  width: "100%", marginTop: 6, fontSize: 11, height: 30, borderRadius: 8,
                  background: "none", border: "1px solid #E5E7EB", color: "#9CA3AF",
                  cursor: "pointer", fontFamily: "var(--font-sans)",
                }}
              >
                <ArrowLeft style={{ width: 11, height: 11, display: "inline", marginRight: 4 }} />
                Abandonar
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
