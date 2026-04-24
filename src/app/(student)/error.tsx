"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[student-area] page error:", error?.message, error?.digest);
    // #region agent log
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
      body: JSON.stringify({
        sessionId: "03dbee",
        location: "src/app/(student)/error.tsx",
        message: "Student area error boundary caught error",
        data: {
          name: error?.name,
          message: error?.message,
          digest: (error as { digest?: string })?.digest,
          stackTop: (error?.stack ?? "").split("\n").slice(0, 6).join("\n"),
        },
        hypothesisId: "H1",
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[640px] px-6 py-16">
      <div className="rounded-[20px] border border-black/[0.08] bg-white p-8 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_50px_rgba(17,24,39,0.06)]">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50">
          <AlertTriangle className="h-6 w-6 text-red-500" />
        </div>

        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#9CA3AF]">
          Erro ao carregar
        </p>
        <h1 className="mt-1 text-[20px] font-extrabold tracking-tight text-[#111827]">
          Esta página não pôde ser carregada
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#6B7280]">
          Ocorreu um erro inesperado. Tente recarregar. Se o problema persistir, entre em contato com o suporte.
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
            <Home className="h-4 w-4" />
            Ir para o Dashboard
          </Link>
        </div>

        {(error as { digest?: string })?.digest && (
          <p className="mt-6 text-[11px] text-[#9CA3AF]">
            Código de diagnóstico: {(error as { digest?: string }).digest}
          </p>
        )}
      </div>
    </div>
  );
}
