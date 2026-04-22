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
    <div className={cn(inter.className, "min-h-[100dvh] min-h-screen bg-[var(--bg-base)]")}>
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col justify-center px-5 py-12 sm:px-6">
        <div className="mb-8 flex items-center justify-center">
          <div className="relative h-[52px] w-[min(100%,280px)]">
            <Image src="/login-brand-logo.png" alt={BRAND_NAME} fill className="object-contain" sizes="280px" priority />
          </div>
        </div>

        <div className="rounded-[var(--r-3xl)] bg-white p-7 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="text-xl font-extrabold tracking-tight text-[#111827]">Bem-vindo de volta</h1>
          <p className="mt-2 text-sm font-medium text-[#6B7280]">Faça login para continuar</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-7 space-y-5" noValidate>
            <div>
              <label htmlFor="login" className="orbit-form-label">
                E-mail ou CPF
              </label>
              <input
                id="login"
                type="text"
                autoComplete="username"
                placeholder="Digite seu e-mail ou CPF"
                className={cn("input h-12 w-full", errors.login && "border-red-400")}
                {...register("login")}
              />
              {errors.login ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.login.message}</p> : null}
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="password" className="orbit-form-label">
                  Senha
                </label>
                <button
                  type="button"
                  className="text-xs font-semibold text-violet-700 hover:underline"
                  onClick={() => toast.info("Em breve: recuperação de senha. Fale com o administrador.")}
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative mt-2">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha"
                  className={cn("input h-12 w-full pr-12", errors.password && "border-red-400")}
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-50"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password ? <p className="mt-1.5 text-xs font-medium text-red-600">{errors.password.message}</p> : null}
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 select-none">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-600/30"
                {...register("remember")}
              />
              <span className="text-sm font-medium text-[#6B7280]">Lembrar-me</span>
            </label>

            <button type="submit" disabled={isSubmitting} className="btn btn-primary h-12 w-full rounded-2xl text-sm font-extrabold shadow-md disabled:opacity-60">
              {isSubmitting ? "Entrando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-[var(--text-muted)]">
          © {new Date().getFullYear()} {BRAND_NAME}
        </p>
      </div>
    </div>
  );
}

