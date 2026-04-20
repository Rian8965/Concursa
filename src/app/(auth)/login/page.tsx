"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff, ArrowRight, Orbit, CheckCircle2, Sparkles, BarChart3 } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    });
    if (result?.error) {
      toast.error("E-mail ou senha incorretos.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const features = [
    { icon: CheckCircle2, text: "Treino inteligente por matéria" },
    { icon: BarChart3,    text: "Simulados cronometrados" },
    { icon: Sparkles,     text: "Apostilas personalizadas" },
  ];

  return (
    <div
      className="min-h-screen flex"
      style={{ background: "#F8F7FF", fontFamily: "var(--font-sans)" }}
    >
      {/* ══════════════════════════════════════
          PAINEL ESQUERDO — BRANDING
      ══════════════════════════════════════ */}
      <div
        className="hidden lg:flex flex-col justify-between relative overflow-hidden"
        style={{
          width: "46%",
          background: "linear-gradient(145deg, #7C3AED 0%, #6D28D9 50%, #5B21B6 100%)",
          padding: "48px 52px",
        }}
      >
        {/* Pattern decorativo */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 20% 80%, rgba(255,255,255,0.06) 0%, transparent 50%),
                              radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)`,
          }}
        />

        {/* Círculos orbitais decorativos */}
        <div
          className="absolute"
          style={{
            width: 500,
            height: 500,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.08)",
            bottom: -150,
            right: -150,
          }}
        />
        <div
          className="absolute"
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            border: "1px solid rgba(255,255,255,0.10)",
            bottom: -50,
            right: -50,
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
                backdropFilter: "blur(10px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Orbit className="w-5 h-5 text-white" strokeWidth={1.75} />
            </div>
            <div>
              <p
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  color: "#FFFFFF",
                  letterSpacing: "-0.03em",
                  lineHeight: 1,
                }}
              >
                ÓRBITA
              </p>
              <p
                style={{
                  fontSize: 10,
                  color: "rgba(255,255,255,0.55)",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 500,
                  marginTop: 2,
                }}
              >
                Concursos
              </p>
            </div>
          </div>
        </div>

        {/* Headline central */}
        <div className="relative z-10" style={{ padding: "20px 0" }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginBottom: 16,
            }}
          >
            Plataforma Premium
          </p>
          <h1
            style={{
              fontSize: 38,
              fontWeight: 800,
              color: "#FFFFFF",
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              marginBottom: 20,
            }}
          >
            Sua aprovação
            <br />
            está mais perto
            <br />
            do que imagina.
          </h1>
          <p
            style={{
              fontSize: 15,
              color: "rgba(255,255,255,0.65)",
              lineHeight: 1.7,
              maxWidth: 320,
            }}
          >
            Estude com método, acompanhe sua evolução e chegue preparado no dia da prova.
          </p>

          <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 14 }}>
            {features.map((f) => (
              <div key={f.text} className="flex items-center gap-3">
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <f.icon style={{ width: 14, height: 14, color: "rgba(255,255,255,0.85)" }} />
                </div>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.75)", fontWeight: 500 }}>
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé do painel */}
        <div className="relative z-10">
          <p style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
            © 2025 ÓRBITA Concursos. Todos os direitos reservados.
          </p>
        </div>
      </div>

      {/* ══════════════════════════════════════
          PAINEL DIREITO — FORMULÁRIO
      ══════════════════════════════════════ */}
      <div
        className="flex-1 flex flex-col items-center justify-center"
        style={{ padding: "40px 24px", background: "#FFFFFF" }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>

          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg, #7C3AED, #A855F7)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Orbit className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: "#111827", letterSpacing: "-0.03em", lineHeight: 1 }}>
                ÓRBITA
              </p>
              <p style={{ fontSize: 9, color: "#9CA3AF", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Concursos
              </p>
            </div>
          </div>

          {/* Header do form */}
          <div style={{ marginBottom: 36 }}>
            <h2
              style={{
                fontSize: 26,
                fontWeight: 800,
                color: "#111827",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              Bem-vindo de volta
            </h2>
            <p style={{ fontSize: 14, color: "#6B7280", lineHeight: 1.6 }}>
              Entre com sua conta para continuar estudando
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* E-mail */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: 6,
                }}
              >
                E-mail
              </label>
              <input
                {...register("email")}
                type="email"
                placeholder="seu@email.com"
                autoComplete="email"
                className="input"
                style={errors.email ? { borderColor: "#DC2626" } : {}}
              />
              {errors.email && (
                <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Senha */}
            <div>
              <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Senha
                </label>
                <button
                  type="button"
                  style={{
                    fontSize: 12,
                    color: "#7C3AED",
                    fontWeight: 600,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  Esqueci a senha
                </button>
              </div>
              <div style={{ position: "relative" }}>
                <input
                  {...register("password")}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input"
                  style={{
                    paddingRight: 44,
                    ...(errors.password ? { borderColor: "#DC2626" } : {}),
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9CA3AF",
                    display: "flex",
                    alignItems: "center",
                    padding: 2,
                  }}
                >
                  {showPassword
                    ? <EyeOff style={{ width: 16, height: 16 }} />
                    : <Eye style={{ width: 16, height: 16 }} />
                  }
                </button>
              </div>
              {errors.password && (
                <p style={{ fontSize: 12, color: "#DC2626", marginTop: 4 }}>
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Botão */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                width: "100%",
                padding: "13px 24px",
                borderRadius: 12,
                background: isSubmitting ? "#A78BFA" : "#7C3AED",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                border: "none",
                cursor: isSubmitting ? "not-allowed" : "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 4px 16px rgba(124,58,237,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                fontFamily: "var(--font-sans)",
                marginTop: 4,
              }}
            >
              {isSubmitting ? (
                <>
                  <span
                    style={{
                      width: 15,
                      height: 15,
                      border: "2px solid rgba(255,255,255,0.3)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      animation: "spin 0.7s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar na plataforma
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </>
              )}
            </button>
          </form>

          {/* Divisor */}
          <div
            className="flex items-center gap-3"
            style={{ margin: "28px 0" }}
          >
            <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
            <p style={{ fontSize: 12, color: "#D1D5DB", fontWeight: 500 }}>
              acesso restrito
            </p>
            <div style={{ flex: 1, height: 1, background: "#F3F4F6" }} />
          </div>

          <p style={{ fontSize: 12, color: "#9CA3AF", textAlign: "center", lineHeight: 1.6 }}>
            Sua conta é criada pelo administrador da plataforma.
            <br />
            Entre em contato caso não tenha acesso.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
