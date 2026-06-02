"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { validateCpf, formatCpf } from "@/lib/utils/cpf";

function formatWhatsApp(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

interface FormState {
  name: string;
  cpf: string;
  whatsapp: string;
  email: string;
  password: string;
  confirmPassword: string;
  terms: boolean;
}

function TesteGratisForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestSlug = searchParams.get("concurso") ?? "";

  const [form, setForm] = useState<FormState>({
    name: "",
    cpf: "",
    whatsapp: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
  });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function handleCpfChange(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, 11);
    const formatted = formatCpf(digits);
    set("cpf", formatted);
  }

  function validate(): boolean {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (form.name.trim().length < 3) e.name = "Nome completo obrigatório";
    const cpfDigits = form.cpf.replace(/\D/g, "");
    if (cpfDigits.length !== 11) e.cpf = "CPF incompleto";
    else if (!validateCpf(form.cpf)) e.cpf = "CPF inválido";
    const whaDigits = form.whatsapp.replace(/\D/g, "");
    if (whaDigits.length < 10) e.whatsapp = "WhatsApp inválido";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) e.email = "E-mail inválido";
    if (form.password.length < 8) e.password = "Mínimo 8 caracteres";
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
      e.password = "Precisa de maiúsculas, minúsculas e números";
    if (form.confirmPassword !== form.password) e.confirmPassword = "Senhas não coincidem";
    if (!form.terms) e.terms = "Aceite os termos para continuar";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError("");

    try {
      const res = await fetch("/api/auth/trial-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          cpf: form.cpf,
          whatsapp: form.whatsapp,
          email: form.email.toLowerCase().trim(),
          password: form.password,
          confirmPassword: form.confirmPassword,
          terms: form.terms,
          contestSlug: contestSlug || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "Erro ao criar conta. Tente novamente.");
        return;
      }

      setSuccess(true);
      // Auto-login
      const result = await signIn("credentials", {
        login: data.email,
        password: form.password,
        redirect: false,
      });
      if (result?.ok) {
        setTimeout(() => router.push("/dashboard"), 1500);
      } else {
        setTimeout(() => router.push("/login"), 1500);
      }
    } catch {
      setServerError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-extrabold text-[var(--text-primary)]">Teste grátis ativado!</h2>
        <p className="text-[var(--text-secondary)]">
          Seu teste grátis foi ativado por 7 dias. Redirecionando para a plataforma…
        </p>
        <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {contestSlug && (
        <div className="rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm">
          <span className="font-semibold text-violet-700">Concurso de origem: </span>
          <span className="capitalize text-violet-800">{contestSlug}</span>
        </div>
      )}

      {/* Nome */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Nome completo *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Seu nome completo"
          className={`orbit-input w-full ${errors.name ? "border-red-400" : ""}`}
          autoComplete="name"
        />
        {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
      </div>

      {/* CPF */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">CPF *</label>
        <input
          type="text"
          inputMode="numeric"
          value={form.cpf}
          onChange={(e) => handleCpfChange(e.target.value)}
          placeholder="000.000.000-00"
          maxLength={14}
          className={`orbit-input w-full ${errors.cpf ? "border-red-400" : ""}`}
        />
        {errors.cpf && <p className="mt-1 text-xs text-red-500">{errors.cpf}</p>}
        <p className="mt-1 text-xs text-[var(--text-muted)]">O teste grátis é permitido uma vez por CPF.</p>
      </div>

      {/* WhatsApp */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">WhatsApp *</label>
        <input
          type="tel"
          value={form.whatsapp}
          onChange={(e) => set("whatsapp", formatWhatsApp(e.target.value))}
          placeholder="(00) 99999-0000"
          maxLength={15}
          className={`orbit-input w-full ${errors.whatsapp ? "border-red-400" : ""}`}
          autoComplete="tel"
        />
        {errors.whatsapp && <p className="mt-1 text-xs text-red-500">{errors.whatsapp}</p>}
      </div>

      {/* E-mail */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">E-mail *</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="seuemail@exemplo.com"
          className={`orbit-input w-full ${errors.email ? "border-red-400" : ""}`}
          autoComplete="email"
        />
        {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
      </div>

      {/* Senha */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Senha *</label>
        <div className="relative">
          <input
            type={showPass ? "text" : "password"}
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className={`orbit-input w-full pr-10 ${errors.password ? "border-red-400" : ""}`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password ? (
          <p className="mt-1 text-xs text-red-500">{errors.password}</p>
        ) : (
          <p className="mt-1 text-xs text-[var(--text-muted)]">Maiúsculas, minúsculas e números.</p>
        )}
      </div>

      {/* Confirmar senha */}
      <div>
        <label className="mb-1 block text-sm font-semibold text-[var(--text-primary)]">Confirmar senha *</label>
        <div className="relative">
          <input
            type={showConfirm ? "text" : "password"}
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword", e.target.value)}
            placeholder="Repita a senha"
            className={`orbit-input w-full pr-10 ${errors.confirmPassword ? "border-red-400" : ""}`}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowConfirm((v) => !v)}
            className="absolute inset-y-0 right-3 flex items-center text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.confirmPassword && <p className="mt-1 text-xs text-red-500">{errors.confirmPassword}</p>}
      </div>

      {/* Termos */}
      <div>
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.terms}
            onChange={(e) => set("terms", e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-violet-600"
          />
          <span className="text-sm text-[var(--text-secondary)]">
            Li e aceito os{" "}
            <Link href="/termos" className="font-semibold text-violet-600 hover:underline">
              Termos de Uso
            </Link>{" "}
            e a{" "}
            <Link href="/privacidade" className="font-semibold text-violet-600 hover:underline">
              Política de Privacidade
            </Link>
            . Entendo que o teste grátis é limitado e não substitui um plano pago.
          </span>
        </label>
        {errors.terms && <p className="mt-1 text-xs text-red-500">{errors.terms}</p>}
      </div>

      {serverError && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn btn-primary w-full rounded-2xl py-3 text-base font-extrabold disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Criando acesso…
          </span>
        ) : (
          "Criar acesso grátis"
        )}
      </button>

      <p className="text-center text-xs text-[var(--text-muted)]">
        Já tem conta?{" "}
        <Link href="/login" className="font-semibold text-violet-600 hover:underline">
          Fazer login
        </Link>
      </p>
    </form>
  );
}

export default function TesteGratisPage() {
  return (
    <div className="mx-auto min-h-screen max-w-6xl px-4 py-10">
      <div className="grid gap-10 lg:grid-cols-2 lg:items-start">
        {/* Lado esquerdo: benefícios */}
        <div className="lg:sticky lg:top-10">
          <div className="mb-6 flex items-center gap-3">
            <div className="relative h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-black/10">
              <Image src="/landing/logo.png" alt="Logo" fill className="object-cover" />
            </div>
            <p className="text-[12px] font-extrabold tracking-[0.12em] text-violet-700">DESCOMPLIQUE SEU CONCURSO</p>
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Teste grátis por 7 dias
          </h1>
          <p className="mt-3 text-base text-[var(--text-secondary)]">
            Crie seu acesso grátis em poucos minutos e conheça a plataforma com acesso limitado.
          </p>

          <ul className="mt-6 space-y-3 text-sm text-[var(--text-secondary)]">
            {[
              { ok: true, text: "Até 5 correções com IA por dia" },
              { ok: true, text: "Baixe 1 apostila no período" },
              { ok: true, text: "Simulados demonstrativos (até 10 questões)" },
              { ok: true, text: "Acesso à plataforma por 7 dias" },
              { ok: false, text: "IA ilimitada (apenas no plano pago)" },
              { ok: false, text: "Simulados completos (apenas no plano pago)" },
              { ok: false, text: "Treinos completos (apenas no plano pago)" },
            ].map(({ ok, text }) => (
              <li key={text} className="flex items-center gap-2">
                <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${ok ? "bg-violet-500" : "bg-slate-300"}`} />
                <span className={ok ? "" : "text-[var(--text-muted)] line-through"}>{text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
            <p className="font-semibold text-amber-900">Avisos importantes</p>
            <ul className="mt-2 space-y-1 text-amber-800">
              <li>• Teste grátis limitado a uma vez por CPF.</li>
              <li>• Não há IA ilimitada no teste grátis.</li>
              <li>• Simulados e treinos completos são exclusivos dos planos pagos.</li>
            </ul>
          </div>

          <div className="mt-6 rounded-2xl border bg-[var(--bg-card)] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">Após o teste</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Escolha um plano para continuar estudando sem limites.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-violet-200 bg-violet-50 p-3 text-center">
                <p className="text-xs font-bold text-violet-700">Plano Avançado</p>
                <p className="text-lg font-extrabold text-violet-900">R$ 39,90</p>
                <p className="text-xs text-violet-700">20 IA/dia • 500/ciclo</p>
              </div>
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-3 text-center">
                <p className="text-xs font-bold text-purple-700">Plano Premium</p>
                <p className="text-lg font-extrabold text-purple-900">R$ 69,90</p>
                <p className="text-xs text-purple-700">50 IA/dia • 1.200/ciclo</p>
              </div>
            </div>
          </div>
        </div>

        {/* Lado direito: formulário */}
        <div className="orbit-card-premium p-6 sm:p-8">
          <h2 className="mb-6 text-xl font-extrabold text-[var(--text-primary)]">Crie seu acesso grátis</h2>
          <Suspense fallback={<div className="text-sm text-[var(--text-muted)]">Carregando…</div>}>
            <TesteGratisForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
