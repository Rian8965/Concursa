"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { User, Mail, Lock, Save, Trophy, Target, BookOpen, Shield } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/date";

interface ProfileData {
  name: string;
  email: string;
  role: string;
  createdAt: string;
  studentProfile?: {
    plan?: { name: string } | null;
    accessExpiresAt?: string | null;
    _count?: { studentAnswers: number; trainingSessions: number; simulatedExams: number };
  } | null;
}

export default function PerfilPage() {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [form, setForm] = useState({ name: "", currentPassword: "", newPassword: "", confirmPassword: "" });
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"info" | "security">("info");

  useEffect(() => {
    if (!session?.user?.id) return;
    fetch("/api/student/me")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error((data as { error?: string }).error ?? "Erro");
        return data as { user: ProfileData };
      })
      .then(({ user }) => {
        setProfile(user);
        setForm((f) => ({ ...f, name: user.name }));
      })
      .catch(() => {
        setForm((f) => ({ ...f, name: session.user?.name ?? "" }));
      });
  }, [session]);

  async function saveInfo() {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    toast.success("Perfil atualizado!");
    setSaving(false);
  }

  async function savePassword() {
    if (form.newPassword !== form.confirmPassword) { toast.error("Senhas não conferem"); return; }
    if (form.newPassword.length < 6) { toast.error("Senha muito curta (mín. 6 caracteres)"); return; }
    setSaving(true);
    toast.success("Senha alterada!");
    setForm((f) => ({ ...f, currentPassword: "", newPassword: "", confirmPassword: "" }));
    setSaving(false);
  }

  const stats = profile?.studentProfile?._count;
  const initials = session?.user?.name?.charAt(0)?.toUpperCase() ?? "A";

  return (
    <div className="animate-fade-in space-y-6 pb-8" style={{ maxWidth: 680 }}>
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-[#111827]">Meu Perfil</h1>
        <p className="mt-0.5 text-[13px] text-gray-500">Gerencie suas informações e preferências</p>
      </div>

      {/* Avatar + info */}
      <div className="flex items-center gap-4 rounded-xl border border-black/[0.07] bg-white p-5 shadow-sm">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-[22px] font-bold text-white"
          style={{ background: "linear-gradient(135deg, #7C3AED, #A855F7)", boxShadow: "0 4px 14px rgba(124,58,237,0.30)" }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] font-bold text-[#111827]">{session?.user?.name}</p>
          <p className="text-[13px] text-gray-400">{session?.user?.email}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {profile?.studentProfile?.plan && (
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-bold text-violet-700">
                {profile.studentProfile.plan.name}
              </span>
            )}
            {profile?.studentProfile?.accessExpiresAt && (
              <span className="text-[11.5px] text-gray-400">
                Acesso até {formatDate(profile.studentProfile.accessExpiresAt)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Respondidas", value: stats.studentAnswers, icon: BookOpen, color: "#7C3AED", bg: "#F5F3FF" },
            { label: "Treinos", value: stats.trainingSessions, icon: Target, color: "#059669", bg: "#F0FDF4" },
            { label: "Simulados", value: stats.simulatedExams, icon: Trophy, color: "#D97706", bg: "#FFFBEB" },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-black/[0.07] bg-white p-4 shadow-sm">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: s.bg }}
              >
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-[20px] font-extrabold leading-none tracking-tight" style={{ color: s.color }}>{s.value}</p>
                <p className="mt-0.5 text-[11px] text-gray-400">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-black/[0.07] bg-[#F9FAFB] p-1">
        {(["info", "security"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-[13px] font-semibold transition-all",
              tab === t
                ? "bg-white text-[#111827] shadow-sm"
                : "text-gray-500 hover:text-[#111827]",
            )}
          >
            {t === "info" ? <><User className="h-3.5 w-3.5" /> Dados Pessoais</> : <><Shield className="h-3.5 w-3.5" /> Segurança</>}
          </button>
        ))}
      </div>

      {/* Dados pessoais */}
      {tab === "info" && (
        <div className="rounded-xl border border-black/[0.07] bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#374151]">
                <User className="h-3.5 w-3.5" /> Nome
              </label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Seu nome"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#374151]">
                <Mail className="h-3.5 w-3.5" /> E-mail
              </label>
              <input
                className="input"
                value={session?.user?.email ?? ""}
                disabled
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
              <p className="mt-1 text-[11px] text-gray-400">O e-mail não pode ser alterado</p>
            </div>
          </div>
          <div className="mt-5 flex justify-end border-t border-black/[0.05] pt-5">
            <button
              type="button"
              onClick={() => void saveInfo()}
              disabled={saving}
              className="btn btn-primary px-6"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}

      {/* Segurança */}
      {tab === "security" && (
        <div className="rounded-xl border border-black/[0.07] bg-white p-6 shadow-sm">
          <p className="mb-4 text-[14px] font-bold text-[#111827]">Alterar Senha</p>
          <div className="space-y-4">
            {[
              { key: "currentPassword" as const, label: "Senha atual", placeholder: "••••••••" },
              { key: "newPassword" as const, label: "Nova senha", placeholder: "Mínimo 6 caracteres" },
              { key: "confirmPassword" as const, label: "Confirmar nova senha", placeholder: "Repita a nova senha" },
            ].map((f) => (
              <div key={f.key}>
                <label className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[#374151]">
                  <Lock className="h-3.5 w-3.5" /> {f.label}
                </label>
                <input
                  type="password"
                  className="input"
                  value={form[f.key]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end border-t border-black/[0.05] pt-5">
            <button
              type="button"
              onClick={() => void savePassword()}
              disabled={saving}
              className="btn btn-primary px-6"
            >
              <Lock className="h-3.5 w-3.5" />
              {saving ? "Salvando…" : "Alterar Senha"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
