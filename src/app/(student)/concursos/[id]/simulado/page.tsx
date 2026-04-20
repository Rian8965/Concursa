"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Target, CheckCircle2, XCircle, Clock, ArrowLeft, ArrowRight,
  Trophy, Flag, RotateCcw, ChevronLeft, ChevronRight,
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
interface Result { questionId: string; selectedAnswer: string | null; correctAnswer: string; isCorrect: boolean }

const QUANTITIES = [10, 20, 30, 40];
const TIME_OPTIONS = [
  { value: 30, label: "30 min" }, { value: 60, label: "60 min" },
  { value: 90, label: "90 min" }, { value: 120, label: "120 min" },
];

export default function SimuladoPage() {
  const params = useParams();
  const router = useRouter();
  const competitionId = params.id as string;

  const [phase, setPhase] = useState<Phase>("config");
  const [subjects, setSubjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(20);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(60);

  const [examId, setExamId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [startTime, setStartTime] = useState(0);

  const [results, setResults] = useState<Result[]>([]);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/admin/subjects").then((r) => r.json()).then((d) => setSubjects(d.subjects ?? []));
  }, []);

  const submitExam = useCallback(async (spent: number) => {
    if (!examId) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("loading");
    try {
      const answers = questions.map((q) => ({ questionId: q.id, selectedAnswer: selectedAnswers[q.id] ?? null }));
      const res = await fetch(`/api/simulado/${examId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, timeSpentSeconds: spent }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      setResults(data.results);
      setScore(data.score);
      setCorrectCount(data.correctAnswers);
      setPhase("results");
    } catch {
      toast.error("Erro ao finalizar simulado");
    }
  }, [examId, questions, selectedAnswers]);

  useEffect(() => {
    if (phase === "exam" && timeLeft > 0) {
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
  }, [phase, startTime, submitExam, timeLeft]);

  async function startExam() {
    setPhase("loading");
    try {
      const res = await fetch("/api/simulado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId, subjectIds: selectedSubjects, quantity, timeLimitMinutes }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao criar simulado"); setPhase("config"); return; }
      setExamId(data.examId);
      setQuestions(data.questions);
      setTimeLeft(data.timeLimitSeconds);
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
  const timeIsLow = timeLeft < 300;

  // ── CONFIG ─────────────────────────────────────────────────────────────────
  if (phase === "config") {
    return (
      <div style={{ maxWidth: 560, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em" }}>
            Simulado
          </h1>
          <p style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>
            Simule as condições reais da prova com cronômetro e correção final
          </p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {subjects.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                Matérias (opcional)
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {subjects.map((s) => (
                  <button
                    key={s.id}
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

          <button onClick={startExam} className="btn btn-primary" style={{ width: "100%", height: 48, fontSize: 15, borderRadius: 14 }}>
            <Target style={{ width: 16, height: 16 }} />
            Iniciar Simulado
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
          <div style={{ width: 48, height: 48, borderRadius: "50%", border: "3px solid #EDE9FE", borderTopColor: "#7C3AED", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
          <p style={{ color: "#6B7280", fontSize: 14 }}>Preparando seu simulado...</p>
        </div>
      </div>
    );
  }

  // ── RESULTS ─────────────────────────────────────────────────────────────────
  if (phase === "results") {
    const color = score >= 70 ? "#059669" : score >= 50 ? "#D97706" : "#DC2626";
    return (
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
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

        {/* Question review */}
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
                </div>
                <p style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.6, marginBottom: 8 }}>{q.content.length > 160 ? q.content.slice(0, 160) + "…" : q.content}</p>
                <div style={{ display: "flex", gap: 8, fontSize: 12 }}>
                  {r?.selectedAnswer && (
                    <span style={{ color: r.isCorrect ? "#059669" : "#DC2626", fontWeight: 600 }}>
                      Sua resposta: {r.selectedAnswer}
                    </span>
                  )}
                  {!r?.isCorrect && (
                    <span style={{ color: "#059669", fontWeight: 600 }}>
                      Correta: {r?.correctAnswer}
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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 20, maxWidth: 900, margin: "0 auto" }}>
      {/* Main area */}
      <div>
        {/* Timer bar */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 18px", background: "#FFFFFF", border: "1px solid #E5E7EB",
            borderRadius: 12, marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#6B7280" }}>
            <span>Q {currentIdx + 1} / {questions.length}</span>
            <span>{answeredCount} respondidas</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Clock style={{ width: 14, height: 14, color: timeIsLow ? "#DC2626" : "#9CA3AF" }} />
            <span style={{ fontSize: 16, fontWeight: 800, color: timeIsLow ? "#DC2626" : "#111827", fontVariantNumeric: "tabular-nums" }}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="card" style={{ padding: 24, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            {q.subject && <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "3px 10px", borderRadius: 20 }}>{q.subject}</span>}
            <button
              onClick={() => setFlagged((prev) => { const n = new Set(prev); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: flagged.has(q.id) ? "#D97706" : "#9CA3AF", fontFamily: "var(--font-sans)", fontWeight: 600 }}
            >
              <Flag style={{ width: 13, height: 13 }} />
              {flagged.has(q.id) ? "Marcada" : "Marcar"}
            </button>
          </div>
          {q.supportText ? (
            <div style={{ marginBottom: 14, padding: 14, background: "#F8F7FF", borderRadius: 12, border: "1px solid #EDE9FE" }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Texto de apoio</p>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{q.supportText}</p>
            </div>
          ) : null}
          <p style={{ fontSize: 15.5, color: "#1F2937", lineHeight: 1.7, fontWeight: 500, whiteSpace: "pre-wrap" }}>{q.content}</p>
          {q.hasImage && q.imageUrl && (
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
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
