"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import {
  Trophy, BookOpen, Play, Target, FileText, Sparkles, BarChart3, History,
} from "lucide-react";

const TABS = [
  { label: "Visão Geral", href: "", icon: Trophy },
  { label: "Matérias",   href: "/materias", icon: BookOpen },
  { label: "Treino",     href: "/treino",   icon: Play },
  { label: "Simulado",   href: "/simulado", icon: Target },
  { label: "Apostilas",  href: "/apostilas", icon: FileText },
  { label: "Quiz",       href: "/quiz",     icon: Sparkles },
  { label: "Desempenho", href: "/desempenho", icon: BarChart3 },
  { label: "Histórico",  href: "/historico", icon: History },
] as const;

export function CompetitionTabs({ competitionId }: { competitionId: string }) {
  const pathname = usePathname();
  const base = `/concursos/${competitionId}`;

  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-black/[0.06] bg-[#F9FAFB] p-2.5 m-2.5 scrollbar-none">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const isActive = tab.href === ""
          ? pathname === base
          : pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={tab.label}
            href={href}
            className={cn(
              "flex items-center gap-1.5 whitespace-nowrap rounded-lg p-2.5 m-2.5 text-[12.5px] transition-all",
              isActive
                ? "bg-white font-semibold text-violet-700 shadow-sm"
                : "font-medium text-[#6B7280] hover:bg-white/70 hover:text-[#111827]",
            )}
          >
            <tab.icon className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-violet-600" : "text-current")} />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
