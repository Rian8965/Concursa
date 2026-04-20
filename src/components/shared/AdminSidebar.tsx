"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard, MapPin, Trophy, Briefcase,
  BookOpen, Building2, Users, CreditCard,
  HelpCircle, Upload, Settings, LogOut, Orbit,
} from "lucide-react";

const navGroups = [
  {
    label: "Visão Geral",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Estrutura",
    items: [
      { label: "Cidades", href: "/admin/cidades", icon: MapPin },
      { label: "Concursos", href: "/admin/concursos", icon: Trophy },
      { label: "Cargos", href: "/admin/cargos", icon: Briefcase },
      { label: "Bancas", href: "/admin/bancas", icon: Building2 },
    ],
  },
  {
    label: "Conteúdo",
    items: [
      { label: "Matérias", href: "/admin/materias", icon: BookOpen },
      { label: "Questões", href: "/admin/questoes", icon: HelpCircle },
      { label: "Importar PDF", href: "/admin/importacoes", icon: Upload },
    ],
  },
  {
    label: "Alunos",
    items: [
      { label: "Alunos", href: "/admin/alunos", icon: Users },
      { label: "Planos", href: "/admin/planos", icon: CreditCard },
    ],
  },
  {
    label: "Sistema",
    items: [
      { label: "Configurações", href: "/admin/configuracoes", icon: Settings },
    ],
  },
];

interface AdminSidebarProps { adminName?: string }

export function AdminSidebar({ adminName }: AdminSidebarProps) {
  const pathname = usePathname();
  const initials = adminName
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "A";

  return (
    <aside
      className="sidebar-shadow fixed inset-y-0 left-0 z-50 flex flex-col"
      style={{
        width: "var(--sidebar-w)",
        background: "linear-gradient(180deg, #FDFCFF 0%, #F8F6FD 55%, #F3F0FB 100%)",
        borderRight: "1px solid rgba(17,24,39,0.06)",
      }}
    >
      <div className="px-6 pt-8 pb-6">
        <Link href="/admin/dashboard" className="group flex items-center gap-4">
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] transition-transform duration-200 group-hover:scale-[1.03]"
            style={{
              background: "linear-gradient(145deg, #9F7AEA 0%, #7C3AED 45%, #6D28D9 100%)",
              boxShadow:
                "0 1px 0 rgba(255,255,255,0.25) inset, 0 8px 22px rgba(124,58,237,0.28), 0 2px 6px rgba(91,33,182,0.15)",
            }}
          >
            <Orbit className="h-[18px] w-[18px] text-white" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[16px] font-extrabold leading-none tracking-tight text-[#111827]">
              ÓRBITA
            </p>
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.13em] text-[#9CA3AF]">
              Admin
            </p>
          </div>
        </Link>
      </div>

      <div className="mx-5 h-px bg-gradient-to-r from-transparent via-[rgba(124,58,237,0.15)] to-transparent" />

      <nav className="flex flex-1 flex-col gap-0 overflow-y-auto px-3.5 py-5">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="section-label">{group.label}</p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link key={item.href} href={item.href} className={cn("nav-item", isActive && "active")}>
                    <item.icon
                      className={cn(
                        "h-[17px] w-[17px] flex-shrink-0 transition-colors",
                        isActive ? "text-[#7C3AED]" : "text-[#9CA3AF]",
                      )}
                      strokeWidth={isActive ? 2.25 : 1.85}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div
        className="border-t border-[rgba(17,24,39,0.05)] px-3 py-4"
        style={{
          background: "linear-gradient(180deg, rgba(255,255,255,0.4) 0%, rgba(248,246,253,0.95) 100%)",
        }}
      >
        <div className="mb-2 flex items-center gap-3 rounded-[14px] px-2.5 py-2">
          <div
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[11px] text-[11px] font-bold text-white"
            style={{
              background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
              boxShadow: "0 2px 10px rgba(124,58,237,0.25)",
            }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
              {adminName ?? "Admin"}
            </p>
            <p className="mt-0.5 text-[11px] text-[#9CA3AF]">Administrador</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-logout"
        >
          <LogOut className="h-[13px] w-[13px]" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
