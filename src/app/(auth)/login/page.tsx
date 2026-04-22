"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { Playfair_Display, DM_Sans } from "next/font/google";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { cn } from "@/lib/utils/cn";

const display = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const sans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const BRAND_NAME = "DESCOMPLIQUE SEU CONCURSO";

/** Estrelas / partículas — posições fixas (SSR-safe). */
const STARS: { t: string; l: string; s: number; o: number }[] = [
  { t: "6%", l: "8%", s: 2, o: 0.35 },
  { t: "12%", l: "22%", s: 1.5, o: 0.28 },
  { t: "18%", l: "78%", s: 2.5, o: 0.4 },
  { t: "28%", l: "14%", s: 1, o: 0.22 },
  { t: "35%", l: "88%", s: 2, o: 0.32 },
  { t: "42%", l: "42%", s: 1.5, o: 0.2 },
  { t: "52%", l: "6%", s: 2, o: 0.3 },
  { t: "58%", l: "65%", s: 1, o: 0.25 },
  { t: "68%", l: "92%", s: 2.5, o: 0.38 },
  { t: "76%", l: "28%", s: 1.5, o: 0.2 },
  { t: "84%", l: "55%", s: 2, o: 0.28 },
  { t: "92%", l: "18%", s: 1, o: 0.22 },
  { t: "24%", l: "52%", s: 1, o: 0.18 },
  { t: "48%", l: "72%", s: 1.5, o: 0.26 },
  { t: "64%", l: "38%", s: 1, o: 0.2 },
];

const SUPPORT = [
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
    <div
      className={cn(
        sans.className,
        "relative flex min-h-[100dvh] min-h-screen w-full flex-col overflow-x-hidden bg-[#f3f0fa] antialiased lg:flex-row",
      )}
    >
      {/* ——— Coluna visual (~58%) ——— */}
      <section
        className="relative order-1 flex min-h-[320px] w-full flex-shrink-0 flex-col overflow-hidden lg:order-1 lg:min-h-screen lg:w-[58%] lg:max-w-none"
        style={{
          background: `
            radial-gradient(ellipse 120% 90% at 10% 15%, rgba(139, 107, 255, 0.45) 0%, transparent 52%),
            radial-gradient(ellipse 90% 70% at 90% 80%, rgba(109, 61, 245, 0.28) 0%, transparent 48%),
            radial-gradient(ellipse 70% 50% at 50% 100%, rgba(255, 255, 255, 0.07) 0%, transparent 42%),
            radial-gradient(ellipse 60% 45% at 70% 25%, rgba(182, 140, 255, 0.15) 0%, transparent 40%),
            linear-gradient(168deg, #1a0f2e 0%, #24123d 18%, #2d1850 38%, #4b238f 62%, #5c32a8 82%, #4b238f 100%)
          `,
        }}
      >
        {/* Glows de profundidade */}
        <div
          className="pointer-events-none absolute -left-32 top-[15%] h-[420px] w-[420px] rounded-full opacity-[0.35] blur-[120px]"
          style={{ background: "#6d3df5" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-24 bottom-[10%] h-[360px] w-[360px] rounded-full opacity-25 blur-[100px]"
          style={{ background: "#8b6bff" }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute left-1/3 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.12] blur-[80px]"
          style={{ background: "#ffffff" }}
          aria-hidden
        />

        {/* Partículas / estrelas */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {STARS.map((st, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white"
              style={{
                top: st.t,
                left: st.l,
                width: st.s,
                height: st.s,
                opacity: st.o,
                boxShadow: `0 0 ${st.s * 2}px rgba(255,255,255,0.35)`,
              }}
            />
          ))}
        </div>

        {/* Borda suave entre colunas (desktop) */}
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-[1] hidden w-px bg-gradient-to-b from-transparent via-white/12 to-transparent lg:block"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 z-0 hidden w-32 bg-gradient-to-l from-[#f3f0fa]/90 to-transparent lg:block"
          aria-hidden
        />

        {/* Logo — canto superior esquerdo, respiro generoso */}
        <header className="relative z-10 shrink-0 px-8 pt-10 sm:px-10 sm:pt-12 lg:px-14 lg:pt-14 xl:px-[4.5rem] xl:pt-16">
          <div className="relative h-[52px] w-[min(100%,320px)] sm:h-[58px] lg:h-[64px]">
            <Image
              src="/login-brand-logo.png"
              alt={BRAND_NAME}
              fill
              className="object-contain object-left"
              sizes="320px"
              priority
            />
          </div>
        </header>

        {/* Conteúdo — centralizado no eixo vertical da coluna */}
        <div className="relative z-10 flex flex-1 flex-col justify-center px-8 pb-12 pt-6 sm:px-10 lg:px-14 lg:pb-20 lg:pt-4 xl:px-[4.5rem]">
          <div className="mx-auto w-full max-w-[540px] lg:mx-0">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/50">
              Plataforma de estudos
            </p>

            <h1
              className={cn(
                display.className,
                "text-[2rem] font-semibold leading-[1.18] tracking-[-0.02em] text-white sm:text-[2.35rem] sm:leading-[1.15] lg:text-[2.65rem] xl:text-[2.85rem]",
              )}
            >
              Seu futuro começa com uma{" "}
              <span className="bg-gradient-to-r from-white via-[#e8e0ff] to-[#c4b5fd] bg-clip-text font-semibold text-transparent">
                decisão
              </span>
              .
            </h1>

            <p className="mt-8 max-w-[480px] text-[17px] leading-[1.75] text-white/[0.82] lg:text-[18px]">
              Estude com foco, consistência e estratégia. A aprovação é questão de tempo.
            </p>

            <ul className="mt-12 hidden space-y-4 border-l border-white/15 pl-6 sm:block">
              {SUPPORT.map((line) => (
                <li key={line} className="text-[15px] font-medium leading-snug tracking-wide text-white/70">
                  {line}
                </li>
              ))}
            </ul>

            <p className="mt-8 text-[14px] font-medium leading-relaxed text-white/65 sm:hidden">{SUPPORT[0]}</p>
          </div>
        </div>

        <footer className="relative z-10 shrink-0 px-8 pb-8 pt-4 sm:px-10 lg:px-14 lg:pb-10 xl:px-[4.5rem]">
          <p className="text-[12px] text-white/30">© {new Date().getFullYear()} {BRAND_NAME}</p>
        </footer>
      </section>

      {/* ——— Coluna login (~42%) ——— */}
      <section className="relative order-2 flex w-full flex-1 flex-col justify-center bg-[#f3f0fa] px-5 py-12 sm:px-8 lg:order-2 lg:w-[42%] lg:min-h-screen lg:px-10 lg:py-16 xl:px-14">
        <div className="mx-auto w-full max-w-[480px]">
          {/* Card premium */}
          <div
            className={cn(
              "rounded-[28px] border border-white/80 bg-[#fefeff]",
              "shadow-[0_4px_8px_-2px_rgba(20,10,36,0.04),0_24px_64px_-16px_rgba(75,35,143,0.22),0_12px_40px_-12px_rgba(36,18,61,0.12)]",
            )}
          >
            <div className="p-9 sm:p-10 lg:p-11">
              {/* Logo mobile */}
              <div className="mb-9 flex items-center lg:hidden">
                <div className="relative h-11 w-[min(100%,260px)]">
                  <Image
                    src="/login-brand-logo.png"
                    alt={BRAND_NAME}
                    fill
                    className="object-contain object-left"
                    sizes="260px"
                  />
                </div>
              </div>

              <header className="mb-9">
                <h2 className="text-[1.75rem] font-bold tracking-tight text-[#161026] sm:text-[1.85rem]">Bem-vindo de volta</h2>
                <p className="mt-2.5 text-[15px] font-medium text-[#5c566f]">Faça login para continuar</p>
              </header>

              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-[22px]" noValidate>
                <div>
                  <label htmlFor="login" className="mb-2 block text-[13px] font-semibold text-[#3f3a4d]">
                    E-mail ou CPF
                  </label>
                  <input
                    id="login"
                    type="text"
                    autoComplete="username"
                    placeholder="nome@email.com ou 000.000.000-00"
                    className={cn(
                      "h-[52px] w-full rounded-[14px] border border-[#e6e2f0] bg-[#faf9fc] px-4 text-[15px] text-[#161026] outline-none transition",
                      "placeholder:text-[#9e97ae]",
                      "focus:border-[#9b82e8] focus:bg-white focus:ring-2 focus:ring-[#6d3df5]/18",
                      errors.login && "border-red-400 focus:ring-red-200",
                    )}
                    {...register("login")}
                  />
                  {errors.login ? <p className="mt-2 text-[12px] font-medium text-red-600">{errors.login.message}</p> : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label htmlFor="password" className="text-[13px] font-semibold text-[#3f3a4d]">
                      Senha
                    </label>
                    <button
                      type="button"
                      className="text-[12px] font-semibold text-[#6346c4] underline-offset-2 hover:underline"
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
                      className={cn(
                        "h-[52px] w-full rounded-[14px] border border-[#e6e2f0] bg-[#faf9fc] py-3 pl-4 pr-12 text-[15px] text-[#161026] outline-none transition",
                        "placeholder:text-[#9e97ae]",
                        "focus:border-[#9b82e8] focus:bg-white focus:ring-2 focus:ring-[#6d3df5]/18",
                        errors.password && "border-red-400 focus:ring-red-200",
                      )}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[#9b95a8] transition hover:bg-[#f3f0fa] hover:text-[#5c566f]"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-2 text-[12px] font-medium text-red-600">{errors.password.message}</p>
                  ) : null}
                </div>

                <label className="flex cursor-pointer items-center gap-3 select-none pt-1">
                  <input
                    type="checkbox"
                    className="h-[18px] w-[18px] rounded-md border-[#d4cfe6] text-[#6d3df5] focus:ring-[#6d3df5]/25"
                    {...register("remember")}
                  />
                  <span className="text-[14px] font-medium text-[#5c566f]">Lembrar-me</span>
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "mt-1 flex h-[54px] w-full items-center justify-center rounded-[14px] text-[15px] font-bold text-white",
                    "bg-gradient-to-b from-[#7c5ce0] to-[#5a3bb8]",
                    "shadow-[0_4px_16px_-2px_rgba(109,61,245,0.45)]",
                    "transition hover:brightness-[1.06] active:scale-[0.99]",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  {isSubmitting ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    "Entrar"
                  )}
                </button>

                <button
                  type="button"
                  className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#e4dff0] bg-white text-[14px] font-semibold text-[#3f3a4d] shadow-sm transition hover:border-[#d4cce8] hover:bg-[#faf9fc]"
                  onClick={() => toast.info("Login com Google em breve.")}
                >
                  <Sparkles className="h-4 w-4 text-[#6d3df5]" aria-hidden />
                  Entrar com Google
                </button>
              </form>

              <p className="mt-9 text-center text-[14px] text-[#6f6a7e]">
                Não tem conta?{" "}
                <button
                  type="button"
                  className="font-semibold text-[#5a3bb8] underline-offset-2 hover:underline"
                  onClick={() => toast.info("Contas são criadas pelo administrador da plataforma.")}
                >
                  Criar conta
                </button>
              </p>

              <p className="mt-8 border-t border-[#f0ecf5] pt-8 text-center text-[12px] leading-relaxed text-[#9b96a8]">
                Acesso restrito. Sua conta pode ser habilitada pelo administrador.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
