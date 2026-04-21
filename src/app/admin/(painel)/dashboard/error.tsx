"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/dashboard] error boundary", {
      name: error?.name,
      message: error?.message,
      digest: (error as Error & { digest?: string })?.digest,
      stack: error?.stack,
    });
    // #region agent log
    fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
      body: JSON.stringify({
        sessionId: "03dbee",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "src/app/admin/(painel)/dashboard/error.tsx:1",
        message: "Admin dashboard error boundary caught error",
        data: {
          name: error?.name,
          message: error?.message,
          digest: (error as any)?.digest,
          stackTop: (error?.stack ?? "").split("\n").slice(0, 6).join("\n"),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-[960px] px-6 py-16">
      <div className="rounded-[20px] border border-black/[0.08] bg-white p-6 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_50px_rgba(17,24,39,0.06)]">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#9CA3AF]">
          Erro ao carregar
        </p>
        <h1 className="mt-2 text-[22px] font-extrabold tracking-tight text-[#111827]">
          Esta página não pôde ser carregada
        </h1>
        <p className="mt-2 text-[14px] text-[#6B7280]">
          Tente recarregar. Se persistir, o erro já foi registrado para diagnóstico.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => reset()}>
            Recarregar
          </button>
          <a className="btn btn-ghost" href="/admin/concursos">
            Ir para Concursos
          </a>
        </div>

        <div className="mt-6 rounded-[14px] border border-black/[0.06] bg-[#FBFAFF] p-4">
          <p className="text-[12px] font-semibold text-[#111827]">Detalhes (debug)</p>
          <p className="mt-1 text-[12px] text-[#6B7280]">
            {error?.message || "Sem mensagem"}{" "}
            {(error as any)?.digest ? (
              <span className="text-[#9CA3AF]">(digest: {(error as any).digest})</span>
            ) : null}
          </p>
        </div>
      </div>
    </div>
  );
}

