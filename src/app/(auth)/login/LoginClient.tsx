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
    <div className={cn(inter.className, "min-h-[100dvh] min-h-screen bg-[#f5f3ff]")}>
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1180px] grid-cols-1 items-stretch gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_480px] lg:gap-8 lg:px-10 lg:py-12">
        {/* Lado esquerdo (roxo claro) */}
        <section className="relative overflow-hidden rounded-[28px] border border-violet-200/60 bg-[#ede9fe] px-7 py-10 shadow-[0_18px_48px_rgba(124,58,237,0.10)] sm:px-10 sm:py-12">
          <div className="flex items-center justify-between gap-4">
            <div className="relative h-10 w-[220px] sm:h-11 sm:w-[280px]">
              <Image src="/login-brand-logo.png" alt={BRAND_NAME} fill className="object-contain object-left" sizes="280px" priority />
            </div>
          </div>

          <div className="mt-10 max-w-[560px]">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-700/70">Descomplique seu Concurso</p>

            <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.08] tracking-tight text-[#1f1635] sm:text-5xl">
              Seu futuro começa com uma decisão.
            </h1>
            <p className="mt-5 max-w-prose text-[15px] leading-relaxed text-[#4b4662] sm:text-[16px]">
              Estude com foco, consistência e estratégia. A aprovação é questão de tempo.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-violet-700 px-5 text-sm font-extrabold text-white shadow-sm transition hover:bg-violet-800"
                onClick={() => {
                  const el = document.getElementById("login");
                  el?.scrollIntoView({ block: "center", behavior: "smooth" });
                  (el as HTMLInputElement | null)?.focus?.();
                }}
              >
                Acessar
              </button>
              <span className="text-sm font-semibold text-violet-800/70">Acesse sua conta para continuar.</span>
            </div>
          </div>

          {/* detalhes sutis */}
          <div className="pointer-events-none absolute -right-32 -top-32 h-72 w-72 rounded-full bg-violet-300/35 blur-[80px]" aria-hidden />
          <div className="pointer-events-none absolute -left-24 bottom-[-120px] h-72 w-72 rounded-full bg-fuchsia-200/40 blur-[90px]" aria-hidden />
        </section>

        {/* Lado direito (card clean) */}
        <section className="flex flex-col justify-center">
          <div className="rounded-[28px] border border-black/[0.06] bg-white px-7 py-10 shadow-[0_18px_48px_rgba(17,24,39,0.10)] sm:px-9 sm:py-12">
            <div className="mx-auto w-full max-w-[420px]">
              <h2 className="text-xl font-extrabold tracking-tight text-[#111827]">Faça login com email e senha</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">
                Use seu e-mail ou CPF para entrar na plataforma.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-4" noValidate>
              <div>
                <input
                  id="login"
                  type="text"
                  autoComplete="username"
                  placeholder="E-mail ou CPF"
                  className={cn(
                    "h-12 w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-[15px] font-medium text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-violet-400 focus:ring-2 focus:ring-violet-200",
                    errors.login && "border-red-400 focus:border-red-400 focus:ring-red-100",
                  )}
                  {...register("login")}
                />
                {errors.login ? <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.login.message}</p> : null}
              </div>

              <div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Senha"
                    className={cn(
                      "h-12 w-full rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 pr-12 text-[15px] font-medium text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-violet-400 focus:ring-2 focus:ring-violet-200",
                      errors.password && "border-red-400 focus:border-red-400 focus:ring-red-100",
                    )}
                    {...register("password")}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    onClick={() => setShowPassword((p) => !p)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password ? <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.password.message}</p> : null}
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-2.5 select-none">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600/30"
                    {...register("remember")}
                  />
                  <span className="text-sm font-medium text-[#6B7280]">Lembrar-me</span>
                </label>
                <button
                  type="button"
                  className="text-sm font-semibold text-violet-700 hover:underline"
                  onClick={() => toast.info("Em breve: recuperação de senha. Fale com o administrador.")}
                >
                  Esqueci minha senha
                </button>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 h-12 w-full rounded-2xl bg-violet-700 text-sm font-extrabold text-white shadow-sm transition hover:bg-violet-800 disabled:opacity-60"
              >
                {isSubmitting ? "Acessando…" : "Acessar"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-[#9CA3AF]">
              © {new Date().getFullYear()} {BRAND_NAME}
            </p>
          </div>
        </div>
        </section>
      </div>
    </div>
  );
}

