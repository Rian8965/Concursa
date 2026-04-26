import { cn } from "@/lib/utils/cn";

export type QuestionMeta = {
  code?: string | null;
  examBoard?: string | null;
  year?: number | null;
  subject?: string | null;
  topic?: string | null;
  competition?: string | null;
  jobRole?: string | null;
  city?: string | null; // "Cidade/UF"
  level?: string | null;
  difficulty?: string | null;
};

function chip(cls: string) {
  return cn(
    "rounded-lg border px-2.5 py-0.5 text-[11px] font-bold",
    cls,
  );
}

export function QuestionMetaLine({ meta, className }: { meta: QuestionMeta; className?: string }) {
  const items: { key: string; label: string; cls: string }[] = [];

  if (meta.code) items.push({ key: "code", label: meta.code, cls: "border-slate-200 bg-slate-50 text-slate-800" });
  if (meta.examBoard) items.push({ key: "board", label: meta.examBoard, cls: "border-slate-200 bg-white text-slate-700" });
  if (meta.year) items.push({ key: "year", label: String(meta.year), cls: "border-slate-200 bg-white text-slate-700" });
  if (meta.subject) items.push({ key: "subject", label: meta.subject, cls: "border-violet-200 bg-violet-50 text-violet-800" });
  if (meta.topic) items.push({ key: "topic", label: meta.topic, cls: "border-slate-200 bg-slate-50 text-slate-700" });
  if (meta.competition) items.push({ key: "competition", label: meta.competition, cls: "border-slate-200 bg-slate-50 text-slate-700" });
  if (meta.jobRole) items.push({ key: "jobRole", label: meta.jobRole, cls: "border-slate-200 bg-slate-50 text-slate-700" });
  if (meta.city) items.push({ key: "city", label: meta.city, cls: "border-slate-200 bg-slate-50 text-slate-700" });
  if (meta.level) items.push({ key: "level", label: meta.level, cls: "border-slate-200 bg-slate-50 text-slate-700" });
  if (meta.difficulty) items.push({ key: "difficulty", label: meta.difficulty, cls: "border-amber-200 bg-amber-50 text-amber-900" });

  if (!items.length) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {items.map((it) => (
        <span key={it.key} className={chip(it.cls)} title={it.label}>
          {it.label}
        </span>
      ))}
    </div>
  );
}

