"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  MapPin,
  Trophy,
  Briefcase,
  BookOpen,
  Building2,
  Users,
  CreditCard,
  HelpCircle,
  Upload,
  Settings,
  LogOut,
  Orbit,
  Menu,
  X,
} from "lucide-react";

const navGroups = [
  {
    label: "Visão Geral",
    items: [{ label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard }],
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
    items: [{ label: "Configurações", href: "/admin/configuracoes", icon: Settings }],
  },
];

interface AdminSidebarProps {
  adminName?: string;
}

export function AdminSidebar({ adminName }: AdminSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const initials =
    adminName
      ?.split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "A";

  return (
    <>
      <div className="orbit-mobile-bar">
        <button
          type="button"
          className="orbit-mobile-bar__menu"
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
        <span className="orbit-mobile-bar__title">ÓRBITA</span>
        <span className="orbit-mobile-bar__badge">Admin</span>
      </div>

      <button
        type="button"
        className={cn("sidebar-backdrop", mobileOpen && "is-visible")}
        aria-label="Fechar menu"
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={cn(
          "sidebar-app fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden",
          mobileOpen && "is-open",
        )}
        style={{ width: "var(--sidebar-w)" }}
      >
        <div className="px-5 pt-7 pb-5">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/dashboard"
              className="group flex min-w-0 flex-1 items-center gap-3.5"
              onClick={() => setMobileOpen(false)}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-[1.03]"
                style={{
                  background: "linear-gradient(145deg, #FB923C 0%, #EA580C 35%, #C2410C 100%)",
                  boxShadow:
                    "0 1px 0 rgba(255,255,255,0.35) inset, 0 8px 22px rgba(234,88,12,0.35), 0 2px 8px rgba(124,58,237,0.2)",
                }}
              >
                <Orbit className="h-[18px] w-[18px] text-white" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-extrabold leading-none tracking-tight text-white">ÓRBITA</p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Painel admin</p>
              </div>
            </Link>
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white/90 lg:hidden"
              aria-label="Fechar menu"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mx-4 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

        <nav className="flex flex-1 flex-col gap-0 overflow-y-auto overscroll-contain px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-5">
              <p className="section-label">{group.label}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn("nav-item", isActive && "active")}
                      onClick={() => setMobileOpen(false)}
                    >
                      <item.icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0 transition-colors",
                          isActive ? "text-[var(--accent-on-dark)]" : "text-white/45",
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

        <div className="border-t border-white/10 bg-black/15 px-3 py-4 backdrop-blur-sm">
          <div className="mb-2 flex items-center gap-3 rounded-2xl px-2 py-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #A855F7, #6D28D9)",
                boxShadow: "0 2px 12px rgba(0,0,0,0.25)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-white">{adminName ?? "Admin"}</p>
              <p className="mt-0.5 text-[11px] text-white/45">Administrador</p>
            </div>
          </div>

          <button type="button" onClick={() => signOut({ callbackUrl: "/login" })} className="btn-logout">
            <LogOut className="h-[13px] w-[13px]" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
