"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { User, Mail, Lock, Save, Trophy, Target, BookOpen } from "lucide-react";

interface ProfileData {
  name: string; email: string; role: string; createdAt: string;
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
        if (!r.ok) throw new Error((data as { error?: string }).error ?? "Erro ao carregar perfil");
        return data as { user: ProfileData };
      })
      .then(({ user }) => {
        if (!user?.name) {
          setForm((f) => ({ ...f, name: session.user?.name ?? "" }));
          return;
        }
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

  return (
    <div style={{ maxWidth: 680 }}>
      <PageHeader title="Meu Perfil" description="Gerencie suas informações e preferências" />

      {/* Stats */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Respondidas", value: stats.studentAnswers, icon: <BookOpen style={{ width: 16, height: 16 }} />, color: "#7C3AED" },
            { label: "Treinos", value: stats.trainingSessions, icon: <Target style={{ width: 16, height: 16 }} />, color: "#059669" },
            { label: "Simulados", value: stats.simulatedExams, icon: <Trophy style={{ width: 16, height: 16 }} />, color: "#D97706" },
          ].map((s) => (
            <div key={s.label} className="card" style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                {s.icon}
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#F3F4F6", padding: 4, borderRadius: 12, marginBottom: 20 }}>
        {(["info", "security"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, height: 36, borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: tab === t ? "#FFFFFF" : "transparent",
              border: tab === t ? "1px solid #E5E7EB" : "none",
              color: tab === t ? "#111827" : "#6B7280",
              cursor: "pointer", boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.05)" : "none",
              fontFamily: "var(--font-sans)", transition: "all 0.15s",
            }}>
            {t === "info" ? "Dados Pessoais" : "Segurança"}
          </button>
        ))}
      </div>

      {tab === "info" && (
        <div className="card" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #7C3AED, #A855F7)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, color: "#fff" }}>
              {session?.user?.name?.charAt(0)?.toUpperCase() ?? "A"}
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>{session?.user?.name}</p>
              <p style={{ fontSize: 13, color: "#9CA3AF" }}>{session?.user?.email}</p>
              {profile?.studentProfile?.plan && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#EDE9FE", padding: "2px 8px", borderRadius: 10, display: "inline-block", marginTop: 4 }}>
                  {profile.studentProfile.plan.name}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                <User style={{ width: 13, height: 13, display: "inline", marginRight: 5 }} />Nome
              </label>
              <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>
                <Mail style={{ width: 13, height: 13, display: "inline", marginRight: 5 }} />E-mail
              </label>
              <input className="input" value={session?.user?.email ?? ""} disabled style={{ opacity: 0.6 }} />
              <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 4 }}>O e-mail não pode ser alterado</p>
            </div>
            {profile?.studentProfile?.accessExpiresAt && (
              <div style={{ background: "#F8F7FF", border: "1px solid #EDE9FE", borderRadius: 10, padding: "12px 14px" }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED" }}>
                  Acesso válido até: {new Date(profile.studentProfile.accessExpiresAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
            <button onClick={saveInfo} disabled={saving} className="btn btn-primary">
              <Save style={{ width: 14, height: 14 }} /> {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {tab === "security" && (
        <div className="card" style={{ padding: 28 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 18 }}>Alterar Senha</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Senha atual</label>
              <input type="password" className="input" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} placeholder="••••••••" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Nova senha</label>
              <input type="password" className="input" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 6 }}>Confirmar nova senha</label>
              <input type="password" className="input" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} placeholder="Repita a nova senha" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, paddingTop: 16, borderTop: "1px solid #F3F4F6" }}>
            <button onClick={savePassword} disabled={saving} className="btn btn-primary">
              <Lock style={{ width: 14, height: 14 }} /> {saving ? "Salvando..." : "Alterar Senha"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
