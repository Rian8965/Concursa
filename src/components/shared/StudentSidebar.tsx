"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getPostLogoutUrl } from "@/lib/auth/post-logout-url";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Trophy,
  BookOpen,
  BarChart3,
  History,
  User,
  LogOut,
  Menu,
  X,
  Lightbulb,
} from "lucide-react";

const BRAND_NAME = "DESCOMPLIQUE SEU CONCURSO";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Meus Concursos", href: "/concursos", icon: Trophy },
  { label: "Questões", href: "/questoes", icon: BookOpen },
  { label: "Revisar erros", href: "/revisar-erros", icon: Lightbulb },
  { label: "Desempenho", href: "/desempenho", icon: BarChart3 },
  { label: "Histórico", href: "/historico", icon: History },
];

interface StudentSidebarProps {
  studentName?: string;
  planName?: string;
}

export function StudentSidebar({ studentName, planName }: StudentSidebarProps) {
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
    studentName
      ?.split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "A";

  return (
    <>
      <div className="student-mobile-bar">
        <button
          type="button"
          className="student-mobile-bar__menu"
          aria-label="Abrir menu"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" strokeWidth={2} />
        </button>
        <span className="student-mobile-bar__title max-w-[min(220px,52vw)] text-[11px] font-extrabold leading-tight text-[var(--text-primary)]">
          {BRAND_NAME}
        </span>
        <span className="student-mobile-bar__badge">Aluno</span>
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
            <Link href="/dashboard" className="group flex min-w-0 flex-1 items-center gap-3.5" onClick={() => setMobileOpen(false)}>
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-[1.03]">
                <Image
                  src="/brand-logo.png"
                  alt={BRAND_NAME}
                  width={44}
                  height={44}
                  className="h-full w-full object-cover"
                  priority
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-extrabold leading-snug tracking-tight text-white sm:text-[13px]">{BRAND_NAME}</p>
                <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">Área do aluno</p>
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
          {navItems.map((item) => {
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
        </nav>

        <div className="border-t border-white/10 bg-black/15 px-3 py-4 backdrop-blur-sm">
          <Link
            href="/perfil"
            className="mb-2 flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/8"
            onClick={() => setMobileOpen(false)}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white"
              style={{
                background: "linear-gradient(135deg, #FB923C, #EA580C)",
                boxShadow: "0 2px 12px rgba(234,88,12,0.35)",
              }}
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight text-white">{studentName ?? "Aluno"}</p>
              <p className="mt-0.5 truncate text-[11px] text-white/45">{planName ?? "Plano"}</p>
            </div>
            <User className="h-4 w-4 shrink-0 text-white/35" />
          </Link>

          <button
            type="button"
            onClick={() => void signOut({ callbackUrl: getPostLogoutUrl(), redirect: true })}
            className="btn-logout"
          >
            <LogOut className="h-[13px] w-[13px]" />
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
