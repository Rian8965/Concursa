"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

const BRAND_NAME = "DESCOMPLIQUE SEU CONCURSO";

/** Posições fixas para partículas (evita hydration mismatch). */
const PARTICLES: { top: string; left: string; w: number; opacity: number }[] = [
  { top: "8%", left: "12%", w: 3, opacity: 0.12 },
  { top: "22%", left: "78%", w: 2, opacity: 0.18 },
  { top: "38%", left: "18%", w: 2, opacity: 0.1 },
  { top: "55%", left: "85%", w: 4, opacity: 0.14 },
  { top: "68%", left: "10%", w: 2, opacity: 0.16 },
  { top: "82%", left: "45%", w: 3, opacity: 0.11 },
  { top: "15%", left: "55%", w: 2, opacity: 0.09 },
  { top: "48%", left: "62%", w: 2, opacity: 0.13 },
  { top: "72%", left: "28%", w: 3, opacity: 0.1 },
  { top: "30%", left: "92%", w: 2, opacity: 0.15 },
];

const SUPPORT_LINES = [
  "Quem estuda com método, passa.",
  "Disciplina vence motivação.",
  "Todo dia conta.",
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { login: "", password: "", remember: false },
  });

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (localStorage.getItem("loginRemember") === "1") {
        const id = localStorage.getItem("loginIdentifier") ?? "";
        reset({ login: id, password: "", remember: true });
      }
    } catch {
      /* ignore */
    }
  }, [reset]);

  async function onSubmit(data: LoginInput) {
    const result = await signIn("credentials", {
      login: data.login.trim(),
      password: data.password,
      redirect: false,
    });
    if (result?.error) {
      toast.error("E-mail, CPF ou senha incorretos.");
      return;
    }

    try {
      if (data.remember) {
        localStorage.setItem("loginRemember", "1");
        localStorage.setItem("loginIdentifier", data.login.trim());
      } else {
        localStorage.removeItem("loginRemember");
        localStorage.removeItem("loginIdentifier");
      }
    } catch {
      /* ignore */
    }

    await router.refresh();
    const session = await getSession();
    const role = session?.user?.role;
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      router.push("/admin/dashboard");
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex min-h-[100dvh] min-h-screen w-full flex-col bg-[#f4f2fb] font-[family-name:var(--font-sans)] lg:flex-row lg:bg-[#ebe8f5]">
      {/* —— Painel esquerdo: identidade + cosmos —— */}
      <div
        className="relative flex min-h-[38vh] flex-shrink-0 flex-col justify-between overflow-hidden px-6 py-8 sm:px-10 sm:py-10 lg:min-h-screen lg:w-[min(52%,720px)] lg:flex-1 lg:px-12 lg:py-12 xl:px-16"
        style={{
          background: `
            radial-gradient(ellipse 90% 70% at 20% 15%, rgba(109, 61, 245, 0.35) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 85% 75%, rgba(182, 140, 255, 0.18) 0%, transparent 50%),
            radial-gradient(ellipse 60% 40% at 50% 100%, rgba(255, 255, 255, 0.06) 0%, transparent 45%),
            linear-gradient(165deg, #1a0f2e 0%, #2a1848 28%, #3b1f6b 58%, #4f2d82 85%, #3b1f6b 100%)
          `,
        }}
      >
        {/* Glow suave */}
        <div
          className="pointer-events-none absolute -left-24 top-1/4 h-72 w-72 rounded-full opacity-40 blur-[100px]"
          style={{ background: "#6d3df5" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full opacity-25 blur-[90px]"
          style={{ background: "#a78bfa" }}
          aria-hidden
        />

        {/* Partículas discretas */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
          {PARTICLES.map((p, i) => (
            <div
              key={i}
              className="absolute rounded-full bg-white blur-[0.5px]"
              style={{
                top: p.top,
                left: p.left,
                width: p.w,
                height: p.w,
                opacity: p.opacity,
              }}
            />
          ))}
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-2xl bg-black/40 ring-1 ring-white/25">
            <Image
              src="/brand-logo.png"
              alt={BRAND_NAME}
              width={44}
              height={44}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <p className="max-w-[200px] text-[11px] font-extrabold leading-snug tracking-tight text-white/95 sm:max-w-none sm:text-[12px] lg:text-[13px]">
            {BRAND_NAME}
          </p>
        </div>

        {/* Mensagens — desktop completo; mobile resumido */}
        <div className="relative z-10 my-6 flex flex-1 flex-col justify-center lg:my-0 lg:max-w-[440px] lg:py-8">
          <p className="mb-3 hidden text-[11px] font-bold uppercase tracking-[0.2em] text-white/45 lg:block">
            Plataforma de estudos
          </p>
          <h1 className="text-balance text-2xl font-extrabold leading-[1.2] tracking-tight text-white sm:text-3xl lg:text-[2.15rem] lg:leading-[1.18] xl:text-[2.35rem]">
            Seu futuro começa com uma{" "}
            <span className="bg-gradient-to-r from-white to-[#d4c4ff] bg-clip-text text-transparent">decisão</span>.
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75 lg:text-[15px]">
            Estude com foco, consistência e estratégia. A aprovação é questão de tempo.
          </p>

          <ul className="mt-8 hidden space-y-3 lg:block">
            {SUPPORT_LINES.map((line) => (
              <li key={line} className="flex items-start gap-3 text-[14px] leading-snug text-white/72">
                <span className="mt-1.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4b5fd]/90" aria-hidden />
                {line}
              </li>
            ))}
          </ul>

          <p className="mt-6 text-sm font-medium leading-snug text-white/65 lg:hidden">
            {SUPPORT_LINES[0]}
          </p>
        </div>

        <p className="relative z-10 text-[11px] text-white/30">© {new Date().getFullYear()} {BRAND_NAME}</p>
      </div>

      {/* —— Painel direito: card —— */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:justify-center lg:py-12 lg:pl-6 lg:pr-10 xl:pr-16">
        <div
          className="w-full max-w-[400px] rounded-[22px] border border-black/[0.05] bg-white p-8 shadow-[0_4px_40px_-8px_rgba(59,31,107,0.18),0_2px_12px_-4px_rgba(0,0,0,0.06)] sm:p-9"
          style={{ maxWidth: 420 }}
        >
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-black/90 ring-1 ring-black/10">
              <Image src="/brand-logo.png" alt="" width={40} height={40} className="h-full w-full object-cover" />
            </div>
            <span className="text-[10px] font-extrabold leading-tight text-[#1f1635]">{BRAND_NAME}</span>
          </div>

          <div className="mb-8">
            <h2 className="text-[1.65rem] font-extrabold tracking-tight text-[#14101f]">Bem-vindo de volta</h2>
            <p className="mt-2 text-[15px] text-[#5b5670]">Faça login para continuar</p>
          </div>

          <form className="flex flex-col gap-5" onSubmit={handleSubmit(onSubmit)} noValidate>
            <div>
              <label htmlFor="login" className="mb-1.5 block text-[13px] font-semibold text-[#374151]">
                E-mail ou CPF
              </label>
              <input
                id="login"
                type="text"
                autoComplete="username"
                placeholder="nome@email.com ou 000.000.000-00"
                className={`input h-12 w-full rounded-xl border-[#e8e6ef] bg-[#faf9fc] text-[15px] text-[#1f1635] placeholder:text-[#a8a3b8] focus:border-[#8b6fd8] focus:ring-2 focus:ring-[#6d3df5]/20 ${errors.login ? "border-red-400" : ""}`}
                {...register("login")}
              />
              {errors.login ? <p className="mt-1.5 text-[12px] text-red-600">{errors.login.message}</p> : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label htmlFor="password" className="text-[13px] font-semibold text-[#374151]">
                  Senha
                </label>
                <button
                  type="button"
                  className="text-[12px] font-semibold text-[#5b3ea8] underline-offset-2 hover:underline"
                  onClick={() => toast.info("Em breve: recuperação de senha. Por ora, fale com o administrador.")}
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`input h-12 w-full rounded-xl border-[#e8e6ef] bg-[#faf9fc] pr-12 text-[15px] text-[#1f1635] placeholder:text-[#a8a3b8] focus:border-[#8b6fd8] focus:ring-2 focus:ring-[#6d3df5]/20 ${errors.password ? "border-red-400" : ""}`}
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-[#9ca3af] hover:bg-black/[0.04] hover:text-[#6b7280]"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="mt-1.5 text-[12px] text-red-600">{errors.password.message}</p>
              ) : null}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-[#d1d0db] text-[#6d3df5] focus:ring-[#6d3df5]/30"
                {...register("remember")}
              />
              <span className="text-[13px] font-medium text-[#5b5670]">Lembrar-me</span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-[52px] w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#7c5ad4] to-[#5b3d9e] text-[15px] font-bold text-white shadow-[0_4px_20px_-4px_rgba(91,61,158,0.55)] transition hover:brightness-[1.03] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-65"
            >
              {isSubmitting ? (
                <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              ) : (
                "Entrar"
              )}
            </button>

            <button
              type="button"
              className="flex h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-[#e5e3ee] bg-white text-[14px] font-semibold text-[#3f3d4d] shadow-sm transition hover:bg-[#faf9fc]"
              onClick={() => toast.info("Login com Google em breve.")}
            >
              <Sparkles className="h-4 w-4 text-[#6d3df5]" aria-hidden />
              Entrar com Google
            </button>
          </form>

          <p className="mt-8 text-center text-[13px] text-[#7a7690]">
            Não tem conta?{" "}
            <button
              type="button"
              className="font-semibold text-[#5b3ea8] underline-offset-2 hover:underline"
              onClick={() => toast.info("Contas são criadas pelo administrador da plataforma.")}
            >
              Criar conta
            </button>
          </p>

          <p className="mt-6 border-t border-[#f0eef5] pt-6 text-center text-[12px] leading-relaxed text-[#9b97ab]">
            Acesso restrito. Sua conta pode ser habilitada pelo administrador.
          </p>
        </div>
      </div>
    </div>
  );
}
