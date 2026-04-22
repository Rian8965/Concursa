"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";
import { Inter } from "next/font/google";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { cn } from "@/lib/utils/cn";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const BRAND_NAME = "DESCOMPLIQUE SEU CONCURSO";
const BRAND_PHRASING = "Descomplique Seu Concurso";

export function LoginClient() {
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

  function focusLogin() {
    const el = document.getElementById("login");
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    (el as HTMLInputElement | null)?.focus?.();
  }

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
    if (role === "ADMIN" || role === "SUPER_ADMIN") router.push("/admin/dashboard");
    else router.push("/dashboard");
  }

  return (
    <div
      className={cn(
        inter.className,
        "flex min-h-[100dvh] min-h-screen items-center justify-center bg-[#f3f0fc] px-5 py-10 sm:px-8 sm:py-12 lg:px-10 lg:py-14",
      )}
    >
      <div
        className={cn(
          "grid w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-violet-200/40 bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.12)]",
          "grid-cols-1 gap-0",
          "lg:min-h-[min(600px,calc(100dvh-7rem))] lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]",
        )}
      >
        {/* Painel institucional: ~40% — conteúdo centralizado no eixo vertical e horizontal */}
        <aside className="relative flex min-h-0 flex-col items-center justify-center border-b border-violet-200/25 bg-gradient-to-b from-[#f1edff] via-[#ede9fe] to-[#e9e3fc] px-8 py-12 sm:px-10 sm:py-14 md:px-12 md:py-16 lg:border-b-0 lg:border-r lg:border-r-violet-200/30 lg:px-10 lg:py-12 xl:px-14 xl:py-16">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 70% at 50% 20%, rgba(196, 181, 253, 0.45) 0%, transparent 60%), radial-gradient(70% 60% at 80% 90%, rgba(233, 213, 255, 0.55) 0%, transparent 55%)",
            }}
            aria-hidden
          />
          <div className="relative z-[1] flex w-full max-w-[22rem] flex-col items-center text-center sm:max-w-[24rem]">
            <div className="relative mx-auto h-12 w-full max-w-[220px] sm:h-[52px] sm:max-w-[260px]">
              <Image
                src="/login-brand-logo.png"
                alt={BRAND_NAME}
                fill
                className="object-contain object-center"
                sizes="(max-width: 640px) 220px, 260px"
                priority
              />
            </div>

            <p className="mt-8 text-[10px] font-bold uppercase leading-relaxed tracking-[0.22em] text-violet-800/65 sm:text-[11px]">
              {BRAND_PHRASING}
            </p>

            <h1 className="mt-5 text-balance text-[1.6rem] font-bold leading-[1.2] tracking-[-0.03em] text-[#1a1229] sm:text-[1.85rem] lg:text-[1.9rem]">
              Seu futuro começa com uma decisão.
            </h1>

            <p className="mt-6 text-[0.95rem] leading-[1.7] text-[#4b455f] sm:text-base sm:leading-[1.75]">
              Estude com foco, consistência e estratégia. A aprovação é questão de tempo.
            </p>

            <div className="mt-10 w-full max-w-xs">
              <button
                type="button"
                onClick={focusLogin}
                className="inline-flex w-full items-center justify-center rounded-full border border-violet-300/90 bg-white/60 px-6 py-2.5 text-sm font-semibold text-violet-900 shadow-sm backdrop-blur-sm transition hover:border-violet-400 hover:bg-white/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
              >
                Ir para o login
              </button>
            </div>
          </div>
        </aside>

        {/* Área do formulário: ~60% — card centralizado com margens generosas */}
        <section className="flex min-h-0 items-center justify-center bg-white px-6 py-12 sm:px-10 sm:py-14 md:px-12 md:py-16 lg:px-12 lg:py-12 xl:px-16 xl:py-16">
          <div
            className="w-full max-w-[420px] rounded-[22px] border border-slate-200/90 bg-white px-8 py-10 shadow-[0_8px_32px_-6px_rgba(15,23,42,0.08),0_2px_8px_-4px_rgba(15,23,42,0.04)] sm:px-10 sm:py-11"
            id="login-card"
          >
            <header className="px-0.5 text-left">
              <h2 className="text-[1.25rem] font-bold leading-snug tracking-[-0.02em] text-[#0f172a] sm:text-[1.35rem]">
                Faça login com email e senha
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#64748b]">
                Use e-mail ou CPF para acessar sua conta.
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-9 flex flex-col gap-6" noValidate>
              <div className="space-y-2.5">
                <label htmlFor="login" className="block text-[13px] font-semibold text-slate-600">
                  E-mail ou CPF
                </label>
                <input
                  id="login"
                  type="text"
                  autoComplete="username"
                  placeholder="nome@exemplo.com ou 000.000.000-00"
                  className={cn(
                    "h-12 w-full rounded-[14px] border border-slate-200/95 bg-slate-50/90 px-4 text-[15px] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-slate-400",
                    "focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100/90",
                    errors.login && "border-red-300 focus:border-red-400 focus:ring-red-100",
                  )}
                  {...register("login")}
                />
                {errors.login ? <p className="pt-0.5 text-xs font-medium text-red-600">{errors.login.message}</p> : null}
              </div>

              <div className="space-y-2.5">
                <label htmlFor="password" className="block text-[13px] font-semibold text-slate-600">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    className={cn(
                      "h-12 w-full rounded-[14px] border border-slate-200/95 bg-slate-50/90 py-0 pl-4 pr-12 text-[15px] font-medium text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] outline-none transition placeholder:text-slate-400",
                      "focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100/90",
                      errors.password && "border-red-300 focus:border-red-400 focus:ring-red-100",
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-100/90 hover:text-slate-700"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? <p className="pt-0.5 text-xs font-medium text-red-600">{errors.password.message}</p> : null}
              </div>

              <div className="flex flex-col gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <label className="inline-flex cursor-pointer select-none items-center gap-3">
                  <input
                    type="checkbox"
                    className="h-[18px] w-[18px] shrink-0 rounded border-slate-300 text-violet-600 focus:ring-2 focus:ring-violet-200"
                    {...register("remember")}
                  />
                  <span className="text-sm font-medium text-slate-600">Lembrar-me</span>
                </label>
                <button
                  type="button"
                  className="shrink-0 self-start text-left text-sm font-semibold text-violet-700 underline-offset-4 hover:underline sm:self-auto sm:text-right"
                  onClick={() => toast.info("Em breve: recuperação de senha. Fale com o administrador.")}
                >
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-12 w-full rounded-[14px] bg-violet-600 text-[15px] font-bold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-60"
              >
                {isSubmitting ? "Acessando…" : "Acessar"}
              </button>
            </form>

            <p className="mt-10 text-center text-[11px] leading-normal text-slate-400">© {new Date().getFullYear()} {BRAND_NAME}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
