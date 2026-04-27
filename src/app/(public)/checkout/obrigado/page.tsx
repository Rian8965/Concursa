"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function CheckoutObrigadoPage() {
  return (
    <Suspense fallback={<div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center px-6 py-12 text-center text-sm text-[var(--text-muted)]">Carregando…</div>}>
      <CheckoutObrigadoInner />
    </Suspense>
  );
}

function CheckoutObrigadoInner() {
  const sp = useSearchParams();
  const orderNsu = useMemo(() => (sp.get("order_nsu") ?? "").trim(), [sp]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center px-6 py-12">
      <div className="orbit-card-premium p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Pagamento</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">Recebemos sua solicitação</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Se o pagamento for aprovado, você receberá um e-mail para criar sua senha e acessar a plataforma.
        </p>
        {orderNsu ? (
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Código do pedido: <span className="font-mono font-semibold text-[var(--text-primary)]">{orderNsu}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/login" className="btn btn-primary rounded-2xl">Ir para login</Link>
          <Link href="/assinar" className="btn btn-ghost rounded-2xl">Voltar</Link>
        </div>
      </div>
    </div>
  );
}

