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
    <div className={cn(inter.className, "min-h-[100dvh] min-h-screen bg-[#5B21B6]")}>
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1280px] grid-cols-1 items-stretch gap-0 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:px-10 lg:py-12">
        {/* Lado esquerdo */}
        <section className="relative flex flex-col justify-center rounded-3xl bg-[#5B21B6] px-6 py-10 sm:px-10 lg:rounded-r-none lg:py-12">
          <div className="mb-10 flex items-center gap-3">
            <div className="relative h-10 w-[220px] sm:h-11 sm:w-[260px]">
              <Image src="/login-brand-logo.png" alt={BRAND_NAME} fill className="object-contain object-left" sizes="260px" priority />
            </div>
          </div>

          <h1 className="max-w-[18ch] text-balance text-[40px] font-extrabold leading-[1.05] tracking-tight text-white sm:text-[52px]">
            SEU FUTURO
            <br />
            COMEÇA COM
            <br />
            UMA DECISÃO.
          </h1>

          <div className="mt-8">
            <span className="inline-flex rounded-full bg-fuchsia-500 px-6 py-2 text-sm font-extrabold uppercase tracking-wide text-white shadow-sm">
              UI DESIGN
            </span>
          </div>
        </section>

        {/* Lado direito */}
        <section className="flex flex-col justify-center rounded-3xl bg-white px-6 py-10 shadow-[0_18px_48px_rgba(17,24,39,0.18)] sm:px-10 lg:rounded-l-none lg:py-12">
          <div className="mx-auto w-full max-w-[420px]">
            <h2 className="text-2xl font-extrabold tracking-tight text-[#111827]">Login</h2>
            <p className="mt-2 text-sm leading-relaxed text-[#6B7280]">Preencha os campos abaixo com os seus dados de acesso.</p>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
              <div>
                <label htmlFor="login" className="sr-only">
                  E-mail ou CPF
                </label>
                <input
                  id="login"
                  type="text"
                  autoComplete="username"
                  placeholder="Digite o seu e-mail ou CPF"
                  className={cn(
                    "h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 text-[15px] font-medium text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-violet-400 focus:ring-2 focus:ring-violet-200",
                    errors.login && "border-red-400 focus:border-red-400 focus:ring-red-100",
                  )}
                  {...register("login")}
                />
                {errors.login ? <p className="mt-1.5 text-xs font-semibold text-red-600">{errors.login.message}</p> : null}
              </div>

              <div>
                <label htmlFor="password" className="sr-only">
                  Senha
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    className={cn(
                      "h-12 w-full rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-4 pr-12 text-[15px] font-medium text-[#111827] outline-none transition placeholder:text-[#9CA3AF] focus:border-violet-400 focus:ring-2 focus:ring-violet-200",
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
                className="mt-2 h-12 w-full rounded-xl bg-[#7C3AED] text-sm font-extrabold text-white shadow-sm transition hover:bg-[#6D28D9] disabled:opacity-60"
              >
                {isSubmitting ? "Acessando…" : "Acessar"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-[#9CA3AF]">
              © {new Date().getFullYear()} {BRAND_NAME}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

