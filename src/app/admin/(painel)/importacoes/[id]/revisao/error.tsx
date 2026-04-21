"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[revisao] route error boundary", {
      message: error?.message,
      digest: (error as any)?.digest ?? null,
      stack: error?.stack,
    });
    // #region agent log
    fetch('http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03dbee'},body:JSON.stringify({sessionId:'03dbee',runId:'pre-fix',hypothesisId:'H-review-error-boundary',location:'revisao/error.tsx:useEffect',message:'review route crashed',data:{message:error?.message ?? null,digest:(error as any)?.digest ?? null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [error]);

  return (
    <div className="mx-auto mt-10 max-w-[720px] rounded-[18px] border border-[#E5E7EB] bg-white p-6">
      <div className="text-[14px] font-extrabold text-[#111827]">Esta página falhou ao carregar</div>
      <div className="mt-2 rounded-[14px] border border-[#FCA5A5] bg-[#FEF2F2] p-3 text-[12.5px] text-[#7F1D1D]">
        <div className="font-bold">Erro</div>
        <div className="mt-1 break-words">{error?.message || "Erro desconhecido"}</div>
        {(error as any)?.digest ? <div className="mt-1 text-[11px] text-[#991B1B]">Digest: {(error as any).digest}</div> : null}
      </div>

      <div className="mt-4 flex gap-2">
        <button type="button" className="btn btn-primary !h-[36px] !text-[12px]" onClick={() => reset()}>
          Tentar novamente
        </button>
        <button
          type="button"
          className="btn btn-ghost !h-[36px] !text-[12px]"
          onClick={() => {
            location.reload();
          }}
        >
          Recarregar
        </button>
      </div>
      <div className="mt-3 text-[11px] text-[#6B7280]">
        Se isso acontecer só no Firebase, provavelmente é cache/chunk ou erro de runtime sem request 500. Este painel registra detalhes no console.
      </div>
    </div>
  );
}

