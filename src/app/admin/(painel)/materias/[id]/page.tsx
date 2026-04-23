"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, FileQuestion, Hash, BookOpen } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

interface Topic {
  id: string;
  name: string;
  _count: { questions: number };
}

interface SubjectDetail {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  _count: { questions: number; topics: number };
  topics: Topic[];
}

export default function MateriaDetailPage() {
  const params = useParams() as { id: string };
  const router = useRouter();
  const [subject, setSubject] = useState<SubjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/subjects/${params.id}`)
      .then((r) => r.json())
      .then((d) => {
        setSubject(d.subject ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
      </div>
    );
  }

  if (!subject) {
    return (
      <div className="flex flex-col items-center gap-4 py-20">
        <p className="text-[var(--text-muted)]">Matéria não encontrada.</p>
        <button onClick={() => router.back()} className="btn btn-ghost rounded-2xl">
          Voltar
        </button>
      </div>
    );
  }

  const color = subject.color ?? "#7C3AED";
  const colorBg = `${color}18`;

  return (
    <div className="orbit-stack mx-auto w-full max-w-5xl animate-fade-up">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-[var(--text-muted)]">
        <button
          onClick={() => router.push("/admin/materias")}
          className="inline-flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Matérias
        </button>
        <ChevronRight className="h-3.5 w-3.5 opacity-40" />
        <span className="font-medium text-[var(--text-primary)]">{subject.name}</span>
      </nav>

      <PageHeader
        eyebrow="Matéria"
        title={subject.name}
        description={subject.description ?? undefined}
      >
        <button
          type="button"
          onClick={() => router.push(`/admin/questoes?subjectId=${subject.id}`)}
          className="btn btn-primary inline-flex items-center gap-2 rounded-2xl"
        >
          <FileQuestion className="h-3.5 w-3.5" />
          Ver todas as questões
        </button>
      </PageHeader>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-2 gap-4">
        <div
          className="rounded-2xl border p-5"
          style={{ background: colorBg, borderColor: `${color}22` }}
        >
          <p className="text-2xl font-extrabold" style={{ color }}>
            {subject._count.questions}
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {subject._count.questions === 1 ? "Questão" : "Questões"}
          </p>
        </div>
        <div
          className="rounded-2xl border p-5"
          style={{ background: colorBg, borderColor: `${color}22` }}
        >
          <p className="text-2xl font-extrabold" style={{ color }}>
            {subject._count.topics}
          </p>
          <p className="mt-0.5 text-sm text-[var(--text-muted)]">
            {subject._count.topics === 1 ? "Conteúdo" : "Conteúdos"}
          </p>
        </div>
      </div>

      {/* Topics list */}
      <div className="orbit-panel overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
            Conteúdos / Assuntos
          </h2>
          {subject._count.topics > 0 && (
            <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
              {subject._count.topics}
            </span>
          )}
        </div>

        {subject.topics.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <BookOpen className="h-8 w-8 text-gray-300" />
            <p className="text-sm text-[var(--text-muted)]">
              Nenhum conteúdo vinculado a esta matéria ainda.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              Os conteúdos aparecem aqui conforme as questões são importadas e aprovadas.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-subtle)]">
            {subject.topics.map((topic) => (
              <li key={topic.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/admin/questoes?topicId=${topic.id}`)}
                  className="group flex w-full items-center gap-4 px-6 py-4 text-left transition-colors hover:bg-violet-50/60"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    style={{ background: colorBg }}
                  >
                    <Hash className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold leading-snug text-[var(--text-primary)]">
                      {topic.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                      {topic._count.questions}{" "}
                      {topic._count.questions === 1 ? "questão" : "questões"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-gray-300 transition-colors group-hover:text-violet-500" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
