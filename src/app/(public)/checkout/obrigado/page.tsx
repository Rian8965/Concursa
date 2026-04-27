"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  const slug = useMemo(() => (sp.get("slug") ?? "").trim(), [sp]);
  const transactionNsu = useMemo(() => (sp.get("transaction_nsu") ?? "").trim(), [sp]);
  const captureMethod = useMemo(() => (sp.get("capture_method") ?? "").trim(), [sp]);

  const [status, setStatus] = useState<"idle" | "checking" | "paid" | "unpaid" | "error">("idle");
  const [firstAccessUrl, setFirstAccessUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!orderNsu) return;
    let cancelled = false;
    setStatus("checking");
    fetch("/api/billing/infinitepay/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        order_nsu: orderNsu,
        slug: slug || undefined,
        transaction_nsu: transactionNsu || undefined,
      }),
    })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })).catch(() => ({ ok: false, j: {} })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) {
          setStatus("error");
          return;
        }
        if (j?.paid) {
          setStatus("paid");
          setFirstAccessUrl(j?.firstAccessUrl ?? null);
        } else {
          setStatus("unpaid");
        }
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [orderNsu, slug, transactionNsu]);

  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col justify-center px-6 py-12">
      <div className="orbit-card-premium p-6 sm:p-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">Pagamento</p>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
          {status === "paid" ? "Pagamento aprovado" : "Recebemos sua solicitação"}
        </h1>

        {status === "checking" ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Confirmando o pagamento…</p>
        ) : status === "paid" ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Seu acesso foi liberado. Se o e-mail não chegar em alguns minutos, use o botão abaixo para criar sua senha agora.
          </p>
        ) : status === "unpaid" ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Ainda não identificamos a aprovação deste pagamento. Se você pagou via Pix, aguarde alguns minutos e recarregue esta página.
          </p>
        ) : status === "error" ? (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Não conseguimos confirmar automaticamente agora. Recarregue esta página em instantes.
          </p>
        ) : (
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Se o pagamento for aprovado, você receberá um e-mail para criar sua senha e acessar a plataforma.
          </p>
        )}

        {captureMethod ? (
          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Método: <span className="font-semibold text-[var(--text-primary)]">{captureMethod}</span>
          </p>
        ) : null}

        {orderNsu ? (
          <p className="mt-4 text-xs text-[var(--text-muted)]">
            Código do pedido: <span className="font-mono font-semibold text-[var(--text-primary)]">{orderNsu}</span>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2">
          {status === "paid" && firstAccessUrl ? (
            <a href={firstAccessUrl} className="btn btn-primary rounded-2xl">
              Criar senha e acessar
            </a>
          ) : null}
          <Link href="/login" className="btn btn-primary rounded-2xl">Ir para login</Link>
          <Link href="/assinar" className="btn btn-ghost rounded-2xl">Voltar</Link>
        </div>
      </div>
    </div>
  );
}

