"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock } from "lucide-react";

export default function TrialExpiradoPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-black/10">
          <Image src="/landing/logo.png" alt="Logo" fill className="object-cover" />
        </div>
        <p className="text-[12px] font-extrabold tracking-[0.12em] text-violet-700">DESCOMPLIQUE SEU CONCURSO</p>
      </div>

      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
        <Clock className="h-8 w-8 text-amber-600" />
      </div>

      <h1 className="mt-5 text-3xl font-extrabold text-[var(--text-primary)]">Seu teste grátis terminou</h1>
      <p className="mt-3 text-base text-[var(--text-secondary)]">
        Para continuar estudando, escolha um dos planos abaixo e mantenha seu histórico e acesso à plataforma.
      </p>

      <div className="mt-8 grid w-full gap-4 sm:grid-cols-2">
        <div className="orbit-card-premium p-5 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">Plano Avançado</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--text-primary)]">R$ 39,90</p>
          <p className="text-sm text-[var(--text-muted)]">por 30 dias</p>
          <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
            <li>✓ 20 correções com IA por dia</li>
            <li>✓ 500 correções no ciclo</li>
            <li>✓ Simulados e treinos completos</li>
            <li>✓ Todas as apostilas</li>
          </ul>
          <Link
            href="/assinar?plano=avancado"
            className="btn btn-primary mt-5 w-full rounded-2xl py-2.5 text-sm font-bold"
          >
            Assinar Avançado
          </Link>
        </div>

        <div className="orbit-card-premium border-purple-200 bg-purple-50/50 p-5 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-purple-600">Plano Premium</p>
          <p className="mt-1 text-3xl font-extrabold text-[var(--text-primary)]">R$ 69,90</p>
          <p className="text-sm text-[var(--text-muted)]">por 30 dias</p>
          <ul className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
            <li>✓ 50 correções com IA por dia</li>
            <li>✓ 1.200 correções no ciclo</li>
            <li>✓ Simulados e treinos completos</li>
            <li>✓ Todas as apostilas + prioridade</li>
          </ul>
          <Link
            href="/assinar?plano=premium"
            className="mt-5 w-full rounded-2xl bg-purple-600 px-4 py-2.5 text-center text-sm font-bold text-white hover:bg-purple-700 transition-colors block"
          >
            Assinar Premium
          </Link>
        </div>
      </div>

      <p className="mt-6 text-sm text-[var(--text-muted)]">
        Já tem assinatura?{" "}
        <Link href="/login" className="font-semibold text-violet-600 hover:underline">
          Fazer login
        </Link>
      </p>
    </div>
  );
}
