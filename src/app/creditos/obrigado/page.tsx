"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function CreditosObrigadoPage() {
  const searchParams = useSearchParams();
  const orderNsu = searchParams.get("order_nsu") ?? "";
  const [status, setStatus] = useState<"loading" | "success" | "pending">("loading");

  useEffect(() => {
    if (!orderNsu) { setStatus("pending"); return; }
    // Polling simples: aguarda até 30s para confirmação do webhook
    let attempts = 0;
    const check = async () => {
      attempts++;
      try {
        const res = await fetch(`/api/student/ai-status`);
        if (res.ok) setStatus("success");
      } catch {}
      if (attempts >= 6) setStatus("pending");
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, [orderNsu]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#020617] px-6 text-center">
      <div className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-8">
        {status === "loading" ? (
          <>
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
            <h1 className="text-xl font-bold text-white">Confirmando pagamento...</h1>
            <p className="mt-2 text-sm text-white/50">Aguarde enquanto verificamos seu pagamento.</p>
          </>
        ) : status === "success" ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-extrabold text-white">Créditos liberados!</h1>
            <p className="mt-2 text-sm text-white/60">
              Seus créditos extras foram adicionados à sua conta. Você já pode usar as correções com IA.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block rounded-2xl bg-purple-600 px-6 py-3 font-bold text-white hover:bg-purple-700">
              Ir para o Dashboard
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/20">
              <svg className="h-8 w-8 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">Pagamento em processamento</h1>
            <p className="mt-2 text-sm text-white/60">
              Seu pagamento está sendo processado. Os créditos serão liberados automaticamente assim que a confirmação chegar.
              Isso pode levar alguns minutos.
            </p>
            <Link href="/dashboard" className="mt-6 inline-block rounded-2xl border border-white/20 bg-white/[0.05] px-6 py-3 font-semibold text-white hover:bg-white/10">
              Ir para o Dashboard
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
