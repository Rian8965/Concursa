"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Trophy,
  BookOpen,
  BarChart3,
  History,
  User,
  LogOut,
  Orbit,
} from "lucide-react";

const navItems = [
  { label: "Dashboard",       href: "/dashboard",  icon: LayoutDashboard },
  { label: "Meus Concursos",  href: "/concursos",  icon: Trophy },
  { label: "Questões",        href: "/questoes",   icon: BookOpen },
  { label: "Desempenho",      href: "/desempenho", icon: BarChart3 },
  { label: "Histórico",       href: "/historico",  icon: History },
];

interface StudentSidebarProps {
  studentName?: string;
  planName?: string;
}

export function StudentSidebar({ studentName, planName }: StudentSidebarProps) {
  const pathname = usePathname();
  const initials = studentName
    ?.split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "A";

  return (
    <aside
      className="fixed inset-y-0 left-0 z-50 flex flex-col sidebar-shadow"
      style={{
        width: "240px",
        background: "#FFFFFF",
        borderRight: "1px solid #E5E7EB",
      }}
    >
      {/* ── Logo ── */}
      <div style={{ padding: "24px 20px 18px" }}>
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
              boxShadow: "0 4px 12px rgba(124,58,237,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Orbit className="w-4 h-4 text-white" strokeWidth={2} />
          </div>
          <div>
            <p
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: "#111827",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              ÓRBITA
            </p>
            <p
              style={{
                fontSize: 9.5,
                color: "#9CA3AF",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginTop: 2,
                fontWeight: 500,
              }}
            >
              Concursos
            </p>
          </div>
        </Link>
      </div>

      {/* ── Divisor ── */}
      <div style={{ height: 1, background: "#F3F4F6", margin: "0 16px" }} />

      {/* ── Nav ── */}
      <nav
        className="flex-1 overflow-y-auto"
        style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2 }}
      >
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-item", isActive && "active")}
            >
              <item.icon
                style={{
                  width: 16,
                  height: 16,
                  color: isActive ? "#7C3AED" : "#9CA3AF",
                  flexShrink: 0,
                }}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ── */}
      <div style={{ borderTop: "1px solid #F3F4F6", padding: "12px 10px" }}>
        <Link
          href="/perfil"
          className="flex items-center gap-3 hover-row"
          style={{
            padding: "10px 12px",
            textDecoration: "none",
            marginBottom: 4,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: "linear-gradient(135deg, #7C3AED, #A855F7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#111827",
                lineHeight: 1,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {studentName ?? "Aluno"}
            </p>
            <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>
              {planName ?? "Plano Básico"}
            </p>
          </div>
          <User style={{ width: 13, height: 13, color: "#D1D5DB" }} />
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="btn-logout"
        >
          <LogOut style={{ width: 14, height: 14 }} />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
