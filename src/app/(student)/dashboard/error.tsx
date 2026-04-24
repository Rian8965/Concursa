"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] error:", error?.message, error?.digest);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-16">
      <div className="rounded-xl border border-black/[0.08] bg-white p-7 shadow-sm">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-red-50">
          <AlertTriangle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#9CA3AF]">Erro ao carregar</p>
        <h1 className="mt-1 text-[19px] font-extrabold tracking-tight text-[#111827]">
          Dashboard não pôde ser carregado
        </h1>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[#6B7280]">
          Ocorreu um erro inesperado. Tente recarregar a página.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-violet-700"
            onClick={() => reset()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recarregar
          </button>
          <Link href="/concursos" className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2.5 text-[13px] font-semibold text-gray-600 hover:bg-gray-50">
            Meus Concursos
          </Link>
        </div>
      </div>
    </div>
  );
}
