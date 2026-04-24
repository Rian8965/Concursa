"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Trophy, RefreshCw, LayoutDashboard } from "lucide-react";

export default function ConcursosError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[concursos] page error:", error?.message, error?.digest);
  }, [error]);

  return (
    <div className="orbit-stack animate-fade-in">
      <div className="mx-auto w-full max-w-[640px]">
        <div className="rounded-[20px] border border-black/[0.08] bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_50px_rgba(17,24,39,0.06)]">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50">
            <Trophy className="h-6 w-6 text-violet-500" strokeWidth={1.5} />
          </div>

          <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#9CA3AF]">
            Meus Concursos
          </p>
          <h1 className="mt-1 text-[20px] font-extrabold tracking-tight text-[#111827]">
            Não foi possível carregar seus concursos
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">
            Ocorreu um erro ao buscar seus concursos. Tente recarregar a página.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_14px_rgba(124,58,237,0.3)] hover:bg-violet-700"
              onClick={() => reset()}
            >
              <RefreshCw className="h-4 w-4" />
              Tentar novamente
            </button>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-2.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
            >
              <LayoutDashboard className="h-4 w-4" />
              Voltar ao Dashboard
            </Link>
          </div>

          {(error as { digest?: string })?.digest && (
            <p className="mt-6 text-[11px] text-[#9CA3AF]">
              Código: {(error as { digest?: string }).digest}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
