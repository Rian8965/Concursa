"use client";

import Image from "next/image";
import Link from "next/link";

export default function PublicLandingPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <header className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="relative h-10 w-10 overflow-hidden rounded-2xl ring-1 ring-black/10">
            <Image src="/landing/logo.png" alt="Logo" fill className="object-cover" />
          </div>
          <div>
            <p className="text-[12px] font-extrabold tracking-[0.12em] text-violet-700">DESCOMPLIQUE SEU CONCURSO</p>
            <p className="text-sm text-[var(--text-muted)]">Plataforma de estudos</p>
          </div>
        </div>

        <Link href="/assinar" className="btn btn-primary rounded-2xl">
          Assinar R$ 27,90
        </Link>
      </header>

      <main className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--text-primary)] sm:text-4xl">
            Estude com foco e constância — sem perder tempo.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-secondary)]">
            Treino ilimitado, simulados, apostilas, explicações com IA, quiz do edital e relatórios de desempenho.
          </p>

          <ul className="mt-6 grid gap-2 text-sm text-[var(--text-secondary)]">
            {[
              "Treino ilimitado e revisão de erros",
              "Simulados com estatísticas",
              "Apostilas e conteúdos por matéria",
              "Explicações com IA quando errar",
              "Quiz do edital",
              "Relatórios e gráficos",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-violet-500" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap gap-2">
            <Link href="/assinar" className="btn btn-primary rounded-2xl">
              Assinar agora
            </Link>
            <Link href="/login" className="btn btn-ghost rounded-2xl">
              Já tenho acesso
            </Link>
          </div>

          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Após pagamento aprovado, você recebe e-mail para criar sua senha.
          </p>
        </div>

        <div className="orbit-card-premium overflow-hidden p-0">
          <div className="relative aspect-[16/10] w-full bg-slate-100">
            <Image src="/landing/hero.png" alt="Imagem da plataforma" fill className="object-cover" />
          </div>
          <div className="p-5">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Trocar imagens é simples</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Substitua os arquivos em <code className="rounded bg-slate-100 px-1.5 py-0.5">concursa-app/public/landing</code>:
              <br />
              <code className="rounded bg-slate-100 px-1.5 py-0.5">logo.png</code> e{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5">hero.png</code>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

