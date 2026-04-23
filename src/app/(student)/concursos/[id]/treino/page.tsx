"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Play, CheckCircle2, XCircle, ArrowRight, ArrowLeft,
  Trophy, RotateCcw, AlertTriangle, Send, X, Bot,
} from "lucide-react";

type ReportCategory =
  | "INCOMPLETE_STATEMENT" | "MISSING_TEXT" | "MISSING_IMAGE"
  | "MISSING_ALTERNATIVE" | "FORMAT_ERROR"
  | "WRONG_ANSWER" | "AMBIGUOUS_ANSWER" | "INCONSISTENT_CONTENT" | "OTHER";

const REPORT_CATEGORIES: { value: ReportCategory; label: string; structural?: boolean }[] = [
  { value: "INCOMPLETE_STATEMENT", label: "Enunciado incompleto", structural: true },
  { value: "MISSING_TEXT", label: "Texto faltando", structural: true },
  { value: "MISSING_IMAGE", label: "Imagem faltando", structural: true },
  { value: "MISSING_ALTERNATIVE", label: "Alternativa faltando", structural: true },
  { value: "FORMAT_ERROR", label: "Erro de formatação", structural: true },
  { value: "WRONG_ANSWER", label: "Resposta possivelmente errada" },
  { value: "AMBIGUOUS_ANSWER", label: "Resposta ambígua/dupla" },
  { value: "INCONSISTENT_CONTENT", label: "Conteúdo inconsistente" },
  { value: "OTHER", label: "Outro problema" },
];

interface ReportModalProps {
  questionId: string;
  sessionId: string;
  onClose: () => void;
}

function ReportModal({ questionId, sessionId, onClose }: ReportModalProps) {
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
          phase: "after",
          sessionId,
          sessionType: "TRAINING",
        }),
      });
      const data = await res.json() as { ok: boolean; reportId?: string };
      if (!res.ok) throw new Error();
      setSubmitted(true);
      toast.success("Denúncia registrada");

      if (category === "WRONG_ANSWER" && data.reportId) {
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
              {REPORT_CATEGORIES.map((c) => (
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

type Phase = "config" | "loading" | "training" | "summary";

interface Alternative { id: string; letter: string; content: string }
interface Question {
  id: string; content: string; correctAnswer: string;
  supportText?: string | null;
  subject?: string; difficulty: string; alternatives: Alternative[];
  hasImage?: boolean;
  imageUrl?: string | null;
}

interface AnswerState {
  selected: string | null;
  isCorrect: boolean | null;
  revealed: boolean;
  /** explicação da IA (só em erro) */
  aiExplanation?: string | null;
}

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
  const competitionId = params.id as string;

  const [phase, setPhase] = useState<Phase>("config");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState("ALL");
  const [quantity, setQuantity] = useState(10);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [startTime, setStartTime] = useState(0);
  const [reportModal, setReportModal] = useState<{ questionId: string } | null>(null);

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
      setStartTime(Date.now());
      setPhase("training");
    } catch {
      toast.error("Erro ao iniciar treino");
      setPhase("config");
    }
  }

  async function submitAnswer(letter: string) {
    const q = questions[currentIdx];
    if (answers[q.id]?.revealed) return;

    const res = await fetch(`/api/training/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionId: q.id, selectedAnswer: letter }),
    });
    const data = await res.json() as { isCorrect: boolean; aiExplanation?: string | null };
    setAnswers((prev) => ({
      ...prev,
      [q.id]: {
        selected: letter,
        isCorrect: data.isCorrect,
        revealed: true,
        aiExplanation: data.isCorrect ? null : (data.aiExplanation ?? null),
      },
    }));
  }

  const finishSession = useCallback(async () => {
    const correct = Object.values(answers).filter((a) => a.isCorrect).length;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    await fetch(`/api/training/${sessionId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ correctAnswers: correct, timeSpentSeconds: elapsed }),
    });
    setPhase("summary");
  }, [answers, sessionId, startTime]);

  useEffect(() => {
    if (phase === "training" && questions.length > 0 && currentIdx >= questions.length) {
      finishSession();
    }
  }, [currentIdx, phase, questions.length, finishSession]);

  const correctCount = Object.values(answers).filter((a) => a.isCorrect).length;
  const totalAnswered = Object.keys(answers).length;
  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
  const elapsed = Math.round((Date.now() - startTime) / 1000);
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
                Nenhuma matéria disponível — todas as questões serão usadas
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
          const isSelected = ans?.selected === alt.letter;
          const isCorrect = alt.letter === q.correctAnswer;
          const revealed = ans?.revealed;

          let bg = "#FFFFFF", border = "#E5E7EB", color = "#374151";
          if (revealed) {
            if (isCorrect) { bg = "#ECFDF5"; border = "#6EE7B7"; color = "#065F46"; }
            else if (isSelected && !isCorrect) { bg = "#FEF2F2"; border = "#FCA5A5"; color = "#991B1B"; }
          } else if (isSelected) {
            bg = "#EDE9FE"; border = "#7C3AED"; color = "#5B21B6";
          }

          return (
            <button
              key={alt.letter}
              onClick={() => !revealed && submitAnswer(alt.letter)}
              style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "14px 18px", borderRadius: 12,
                background: bg, border: `1.5px solid ${border}`, color,
                cursor: revealed ? "default" : "pointer",
                transition: "all 0.15s", textAlign: "left",
                fontFamily: "var(--font-sans)",
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: revealed ? (isCorrect ? "#059669" : isSelected ? "#DC2626" : "#E5E7EB") : (isSelected ? "#7C3AED" : "#F3F4F6"),
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 12, fontWeight: 700,
                color: (revealed && (isCorrect || isSelected)) ? "#fff" : isSelected ? "#fff" : "#6B7280",
              }}>
                {alt.letter}
              </span>
              <span style={{ fontSize: 14, lineHeight: 1.55, paddingTop: 3 }}>{alt.content}</span>
              {revealed && isCorrect && <CheckCircle2 style={{ width: 18, height: 18, color: "#059669", flexShrink: 0, marginLeft: "auto", marginTop: 3 }} />}
              {revealed && isSelected && !isCorrect && <XCircle style={{ width: 18, height: 18, color: "#DC2626", flexShrink: 0, marginLeft: "auto", marginTop: 3 }} />}
            </button>
          );
        })}
      </div>

        {ans?.revealed && ans.isCorrect === false && ans.aiExplanation ? (
          <div
            style={{
              marginTop: 14,
              marginBottom: 8,
              padding: 14,
              background: "#FFFBEB",
              borderRadius: 12,
              border: "1px solid #FDE68A",
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 700, color: "#B45309", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Por que errou</p>
            <p style={{ fontSize: 14, color: "#78350F", lineHeight: 1.65 }}>{ans.aiExplanation}</p>

          </div>
        ) : null}

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

          {ans?.revealed && (
            <button
              onClick={() => setReportModal({ questionId: q.id })}
              style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 4,
                fontSize: 12, color: "#9CA3AF", fontFamily: "var(--font-sans)", fontWeight: 600,
              }}
            >
              <AlertTriangle style={{ width: 12, height: 12 }} />
              Denunciar
            </button>
          )}
        </div>

        {ans?.revealed && (
          <button
            onClick={() => {
              if (currentIdx + 1 >= questions.length) finishSession();
              else setCurrentIdx((i) => i + 1);
            }}
            className="btn btn-primary"
          >
            {currentIdx + 1 >= questions.length ? "Ver resultado" : "Próxima"}
            <ArrowRight style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
