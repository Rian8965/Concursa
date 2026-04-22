"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn, getSession } from "next-auth/react";
import { toast } from "sonner";
import {
  Eye,
  EyeOff,
  Target,
  Rocket,
  Trophy,
  User,
  Lock,
  ChevronRight,
  Quote,
} from "lucide-react";
import { Inter } from "next/font/google";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";
import { cn } from "@/lib/utils/cn";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const BRAND_NAME = "DESCOMPLIQUE SEU CONCURSO";

const STARS: { t: string; l: string; s: number; o: number }[] = [
  { t: "4%", l: "6%", s: 2, o: 0.4 },
  { t: "8%", l: "18%", s: 1, o: 0.25 },
  { t: "12%", l: "72%", s: 2.5, o: 0.35 },
  { t: "22%", l: "12%", s: 1.5, o: 0.22 },
  { t: "30%", l: "88%", s: 2, o: 0.3 },
  { t: "38%", l: "40%", s: 1, o: 0.18 },
  { t: "48%", l: "8%", s: 2, o: 0.28 },
  { t: "55%", l: "65%", s: 1.5, o: 0.2 },
  { t: "62%", l: "92%", s: 2, o: 0.32 },
  { t: "72%", l: "22%", s: 1, o: 0.24 },
  { t: "78%", l: "78%", s: 2.5, o: 0.26 },
  { t: "88%", l: "45%", s: 1.5, o: 0.2 },
  { t: "15%", l: "52%", s: 1, o: 0.16 },
  { t: "42%", l: "58%", s: 1, o: 0.2 },
  { t: "65%", l: "35%", s: 1.5, o: 0.22 },
];

const FEATURES = [
  {
    icon: Target,
    title: "Foco",
    text: "Cada minuto te aproxima.",
  },
  {
    icon: Rocket,
    title: "Disciplina",
    text: "Pequenas ações geram grandes resultados.",
  },
  {
    icon: Trophy,
    title: "Persistência",
    text: "Não é sorte. É preparação. É você no topo.",
  },
] as const;

const QUOTES = [
  "O que te leva hoje ao esforço, te leva amanhã à aprovação.",
  "Concurso não é sprint, é maratona. Confie no processo.",
  "A vaga é de quem se prepara quando ninguém está vendo.",
];

function MountainSilhouette() {
  return (
    <svg
      className="pointer-events-none absolute bottom-0 left-0 z-[1] w-[min(55%,420px)] opacity-[0.18] sm:w-[min(50%,480px)] lg:opacity-[0.22]"
      viewBox="0 0 400 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="silGrad" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#0a0212" stopOpacity="0" />
          <stop offset="100%" stopColor="#c4b5fd" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M0 200 L120 95 L160 120 L200 70 L260 130 L320 60 L400 110 L400 200 Z"
        fill="url(#silGrad)"
      />
      <circle cx="200" cy="78" r="14" fill="rgba(255,255,255,0.08)" />
      <path
        d="M196 82 L204 82 L202 74 Z"
        fill="rgba(255,255,255,0.12)"
      />
    </svg>
  );
}

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
        inter.className,
        "relative min-h-[100dvh] min-h-screen w-full overflow-x-hidden text-white antialiased",
      )}
    >
      {/* Fundo cósmico — tela inteira */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 100% 80% at 20% 0%, rgba(147, 51, 234, 0.35) 0%, transparent 45%),
            radial-gradient(ellipse 80% 60% at 85% 90%, rgba(109, 40, 217, 0.25) 0%, transparent 50%),
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(139, 92, 246, 0.12) 0%, transparent 55%),
            radial-gradient(ellipse 120% 40% at 50% 100%, rgba(167, 139, 250, 0.15) 0%, transparent 40%),
            linear-gradient(180deg, #0a0212 0%, #12081f 25%, #1a0d2e 50%, #0f0618 78%, #0a0212 100%)
          `,
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-40 mix-blend-screen"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.15'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <div className="pointer-events-none absolute -left-40 top-1/4 h-[500px] w-[500px] rounded-full bg-[#9333ea]/25 blur-[140px]" aria-hidden />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-[400px] w-[400px] rounded-full bg-[#7c3aed]/20 blur-[120px]" aria-hidden />

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
              boxShadow: `0 0 ${Number(st.s) * 3}px rgba(196,181,253,0.4)`,
            }}
          />
        ))}
      </div>

      <MountainSilhouette />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col lg:flex-row">
        {/* Coluna esquerda — conteúdo (~62%) */}
        <div className="flex flex-1 flex-col justify-between px-6 pb-8 pt-8 sm:px-10 sm:pt-10 lg:w-[62%] lg:max-w-none lg:px-12 lg:pb-12 lg:pt-12 xl:px-16 xl:pt-14">
          <header className="shrink-0">
            <div className="relative h-[48px] w-[min(100%,300px)] sm:h-[54px] lg:h-[58px]">
              <Image
                src="/login-brand-logo.png"
                alt={BRAND_NAME}
                fill
                className="object-contain object-left drop-shadow-[0_2px_24px_rgba(147,51,234,0.35)]"
                sizes="300px"
                priority
              />
            </div>
          </header>

          <div className="flex flex-1 flex-col justify-center py-10 lg:py-6">
            <h1 className="max-w-[640px] text-balance text-3xl font-bold leading-[1.15] tracking-tight text-white sm:text-4xl lg:text-[2.65rem] lg:leading-[1.12] xl:text-[2.85rem]">
              Seu futuro começa com{" "}
              <span className="relative inline">
                <span className="relative z-10 bg-gradient-to-r from-[#e9d5ff] via-white to-[#c084fc] bg-clip-text font-bold text-transparent drop-shadow-[0_0_28px_rgba(168,85,247,0.65)]">
                  uma decisão
                </span>
                <span
                  className="absolute -inset-1 -z-0 rounded-lg bg-[#9333ea]/25 blur-md"
                  aria-hidden
                />
              </span>
              .
            </h1>

            <p className="mt-6 max-w-[560px] text-[16px] leading-relaxed text-white/75 sm:text-[17px] lg:mt-8 lg:text-lg">
              Estude com foco, persistência e estratégia. A{" "}
              <strong className="font-semibold text-white">aprovação</strong> é uma questão de tempo.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3 lg:mt-12">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm transition hover:border-[#9333ea]/40 hover:bg-white/[0.08]"
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#9333ea]/35 ring-1 ring-[#a855f7]/40">
                    <Icon className="h-5 w-5 text-[#e9d5ff]" strokeWidth={2} />
                  </div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="mt-1.5 text-[13px] leading-snug text-white/60">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 hidden max-w-[520px] space-y-5 lg:mt-14 lg:block">
              {QUOTES.map((q) => (
                <div key={q} className="flex gap-3">
                  <Quote className="mt-0.5 h-5 w-5 shrink-0 text-[#a855f7]" aria-hidden />
                  <p className="text-[15px] font-medium leading-relaxed text-white/70">{q}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 space-y-3 lg:hidden">
              {QUOTES.slice(0, 2).map((q) => (
                <p key={q} className="flex gap-2 text-sm leading-relaxed text-white/65">
                  <Quote className="mt-0.5 h-4 w-4 shrink-0 text-[#a855f7]" aria-hidden />
                  {q}
                </p>
              ))}
            </div>
          </div>

          <footer className="shrink-0 pt-4 text-[11px] text-white/25">© {new Date().getFullYear()} {BRAND_NAME}</footer>
        </div>

        {/* Coluna direita — glass card (~38%) */}
        <div className="flex w-full flex-shrink-0 items-center justify-center px-5 pb-10 pt-2 sm:px-8 lg:w-[38%] lg:px-8 lg:pb-12 lg:pt-12 xl:px-10">
          <div
            className={cn(
              "w-full max-w-[440px] rounded-[24px] border border-white/[0.12]",
              "bg-[rgba(12,6,22,0.55)] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.65)] backdrop-blur-2xl",
            )}
          >
            <div className="p-8 sm:p-9">
              <div className="mb-2 lg:hidden">
                <div className="relative mx-auto h-10 w-[min(100%,240px)]">
                  <Image
                    src="/login-brand-logo.png"
                    alt={BRAND_NAME}
                    fill
                    className="object-contain object-center"
                    sizes="240px"
                  />
                </div>
              </div>

              <h2 className="text-center text-2xl font-bold tracking-tight text-white sm:text-left lg:text-[1.65rem]">
                Bem-vindo de volta!
              </h2>
              <p className="mt-2 text-center text-[14px] text-white/50 sm:text-left">
                Faça login para continuar sua jornada.
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="mt-8 flex flex-col gap-5" noValidate>
                <div>
                  <label htmlFor="login" className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-white/45">
                    E-mail ou CPF
                  </label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
                    <input
                      id="login"
                      type="text"
                      autoComplete="username"
                      placeholder="Digite seu e-mail ou CPF"
                      className={cn(
                        "h-[50px] w-full rounded-xl border border-white/10 bg-black/35 py-3 pl-11 pr-4 text-[15px] text-white outline-none transition placeholder:text-white/35",
                        "focus:border-[#9333ea]/60 focus:bg-black/45 focus:ring-2 focus:ring-[#9333ea]/25",
                        errors.login && "border-red-400/80 focus:ring-red-500/20",
                      )}
                      {...register("login")}
                    />
                  </div>
                  {errors.login ? <p className="mt-1.5 text-xs font-medium text-red-300">{errors.login.message}</p> : null}
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-white/45">
                    Senha
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Digite sua senha"
                      className={cn(
                        "h-[50px] w-full rounded-xl border border-white/10 bg-black/35 py-3 pl-11 pr-12 text-[15px] text-white outline-none transition placeholder:text-white/35",
                        "focus:border-[#9333ea]/60 focus:bg-black/45 focus:ring-2 focus:ring-[#9333ea]/25",
                        errors.password && "border-red-400/80 focus:ring-red-500/20",
                      )}
                      {...register("password")}
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/40 transition hover:bg-white/5 hover:text-white/70"
                      onClick={() => setShowPassword((p) => !p)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                  {errors.password ? (
                    <p className="mt-1.5 text-xs font-medium text-red-300">{errors.password.message}</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <label className="flex cursor-pointer items-center gap-2.5 select-none">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-black/30 text-[#9333ea] focus:ring-[#9333ea]/40"
                      {...register("remember")}
                    />
                    <span className="text-[13px] font-medium text-white/65">Lembrar-me</span>
                  </label>
                  <button
                    type="button"
                    className="text-[13px] font-semibold text-[#c084fc] transition hover:text-[#e9d5ff]"
                    onClick={() => toast.info("Em breve: recuperação de senha. Fale com o administrador.")}
                  >
                    Esqueci minha senha
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={cn(
                    "mt-1 flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-[15px] font-bold text-white",
                    "bg-gradient-to-r from-[#9333ea] to-[#7c3aed] shadow-[0_8px_32px_-4px_rgba(147,51,234,0.55)]",
                    "transition hover:brightness-110 active:scale-[0.99]",
                    "disabled:cursor-not-allowed disabled:opacity-55",
                  )}
                >
                  {isSubmitting ? (
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  ) : (
                    <>
                      Entrar
                      <ChevronRight className="h-5 w-5 opacity-90" strokeWidth={2.5} />
                    </>
                  )}
                </button>

                <div className="relative my-1 flex items-center gap-3">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-white/35">ou</span>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
                </div>

                <button
                  type="button"
                  className="flex h-[48px] w-full items-center justify-center gap-3 rounded-xl border border-white/20 bg-black/25 text-[14px] font-semibold text-white/90 transition hover:border-white/30 hover:bg-black/35"
                  onClick={() => toast.info("Login com Google em breve.")}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[13px] font-bold text-[#4285F4]">
                    G
                  </span>
                  Entrar com Google
                </button>
              </form>

              <p className="mt-8 text-center text-[14px] text-white/50">
                Ainda não tem uma conta?{" "}
                <button
                  type="button"
                  className="font-semibold text-[#c084fc] underline-offset-2 hover:text-[#e9d5ff] hover:underline"
                  onClick={() => toast.info("Contas são criadas pelo administrador da plataforma.")}
                >
                  Criar conta
                </button>
              </p>

              <p className="mt-6 border-t border-white/[0.08] pt-6 text-center text-[11px] leading-relaxed text-white/35">
                Acesso restrito. Sua conta pode ser habilitada pelo administrador.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
