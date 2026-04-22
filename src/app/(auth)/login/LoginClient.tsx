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
        "flex min-h-[100dvh] min-h-screen items-center justify-center bg-[#f4f1fb] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10",
      )}
    >
      <div className="grid w-full max-w-[1040px] items-stretch gap-5 sm:gap-6 lg:grid-cols-5 lg:items-stretch lg:gap-0 lg:rounded-3xl lg:shadow-[0_24px_64px_-12px_rgba(15,23,42,0.10)]">
        {/* Coluna esquerda ~40%: painel roxo claro */}
        <aside className="relative flex min-h-0 flex-col justify-between overflow-hidden rounded-3xl border border-violet-200/50 bg-[#ede9fe] p-6 sm:p-8 lg:col-span-2 lg:rounded-r-none lg:border-r-0 lg:rounded-l-3xl lg:p-9">
          <div
            className="pointer-events-none absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(120% 100% at 0% 0%, rgba(167, 139, 250, 0.35) 0%, transparent 55%), radial-gradient(90% 80% at 100% 100%, rgba(221, 214, 254, 0.9) 0%, transparent 50%)",
            }}
            aria-hidden
          />
          <div className="relative z-[1] flex w-full max-w-full flex-1 flex-col">
            <div className="relative h-10 w-[200px] shrink-0 sm:h-11 sm:w-[240px]">
              <Image
                src="/login-brand-logo.png"
                alt={BRAND_NAME}
                fill
                className="object-contain object-left"
                sizes="(max-width: 640px) 200px, 240px"
                priority
              />
            </div>
            <p className="mt-6 text-[10px] font-bold uppercase leading-none tracking-[0.2em] text-violet-800/60 sm:text-[11px]">
              {BRAND_PHRASING}
            </p>
            <h1 className="mt-4 text-balance text-2xl font-bold leading-[1.15] tracking-[-0.02em] text-[#1a1229] sm:text-3xl lg:text-[1.75rem] xl:text-[1.9rem]">
              Seu futuro começa com uma decisão.
            </h1>
            <p className="mt-4 max-w-[28ch] text-[14px] leading-relaxed text-[#4c4660] sm:text-[15px] sm:leading-[1.65]">
              Estude com foco, consistência e estratégia. A aprovação é questão de tempo.
            </p>
            <div className="mt-6 shrink-0 sm:mt-8">
              <button
                type="button"
                onClick={focusLogin}
                className="inline-flex h-10 items-center justify-center rounded-full border border-violet-300/80 bg-white/50 px-5 text-[13px] font-semibold text-violet-800 shadow-sm backdrop-blur-sm transition hover:border-violet-400/90 hover:bg-white/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
              >
                Ir para o login
              </button>
            </div>
          </div>
        </aside>

        {/* Coluna direita ~60%: fundo e card centralizado verticalmente */}
        <section className="flex min-h-0 items-center justify-center bg-white/80 p-0 sm:bg-[#faf9ff] lg:col-span-3 lg:rounded-l-none lg:rounded-r-3xl lg:border lg:border-slate-200/80 lg:border-l-0 lg:bg-white lg:px-10 lg:py-10 xl:px-12">
          <div
            className="w-full max-w-[400px] rounded-2xl border border-slate-200/80 bg-white px-6 py-8 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.08),0_4px_12px_-4px_rgba(15,23,42,0.04)] sm:px-7 sm:py-9"
            id="login-card"
          >
            <header className="text-left">
              <h2 className="text-lg font-bold tracking-[-0.02em] text-[#0f172a] sm:text-xl">
                Faça login com email e senha
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-[#64748b]">
                Use e-mail ou CPF para acessar sua conta.
              </p>
            </header>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7 flex flex-col gap-5" noValidate>
              <div className="space-y-1.5">
                <label htmlFor="login" className="text-xs font-semibold text-[#475569]">
                  E-mail ou CPF
                </label>
                <input
                  id="login"
                  type="text"
                  autoComplete="username"
                  placeholder="nome@exemplo.com ou 000.000.000-00"
                  className={cn(
                    "h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 text-[15px] font-medium text-slate-900 shadow-inner shadow-white/40 outline-none transition ring-0 placeholder:text-slate-400",
                    "focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100",
                    errors.login && "border-red-300 focus:border-red-400 focus:ring-red-100",
                  )}
                  {...register("login")}
                />
                {errors.login ? <p className="text-xs font-medium text-red-600">{errors.login.message}</p> : null}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold text-[#475569]">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className={cn(
                      "h-11 w-full rounded-xl border border-slate-200/90 bg-slate-50/80 py-0 pl-3.5 pr-11 text-[15px] font-medium text-slate-900 shadow-inner shadow-white/40 outline-none transition placeholder:text-slate-400",
                      "focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100",
                      errors.password && "border-red-300 focus:border-red-400 focus:ring-red-100",
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100/90 hover:text-slate-700"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? <p className="text-xs font-medium text-red-600">{errors.password.message}</p> : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 pt-0.5">
                <label className="inline-flex cursor-pointer select-none items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-2 focus:ring-violet-200"
                    {...register("remember")}
                  />
                  <span className="text-sm font-medium text-[#64748b]">Lembrar-me</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-semibold text-violet-700 underline-offset-2 hover:underline"
                  onClick={() => toast.info("Em breve: recuperação de senha. Fale com o administrador.")}
                >
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-1 h-11 w-full rounded-xl bg-violet-600 text-sm font-bold text-white shadow-sm transition hover:bg-violet-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:opacity-60"
              >
                {isSubmitting ? "Acessando…" : "Acessar"}
              </button>
            </form>

            <p className="mt-8 text-center text-[11px] leading-tight text-slate-400">© {new Date().getFullYear()} {BRAND_NAME}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
