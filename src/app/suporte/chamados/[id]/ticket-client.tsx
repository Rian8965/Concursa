"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Send } from "lucide-react";

type Ticket = {
  id: string;
  protocol: string;
  subject: string;
  status: string;
  type: string;
  dueAt: string | Date;
  messages: Array<{ id: string; actor: string; content: string; createdAt: string | Date }>;
};

export default function TicketClient({ ticket }: { ticket: Ticket }) {
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    if (msg.trim().length < 2) return;
    setSending(true);
    try {
      const res = await fetch(`/api/support/tickets/${ticket.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Não foi possível enviar");
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      <Link href="/suporte" className="btn btn-ghost rounded-2xl">Voltar</Link>

      <div className="orbit-card-premium p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">{ticket.protocol}</p>
        <h1 className="mt-1 text-xl font-extrabold text-[#0F172A]">{ticket.subject}</h1>
        <p className="mt-2 text-sm text-[#64748B]">
          Status: {ticket.status} · Tipo: {ticket.type} · Prazo: {new Date(ticket.dueAt).toLocaleString("pt-BR")}
        </p>

        <div className="mt-6 space-y-3">
          {ticket.messages.map((m) => (
            <div
              key={m.id}
              className={[
                "rounded-2xl border border-black/[0.06] px-4 py-3 text-sm",
                m.actor === "ADMIN" ? "bg-emerald-50" : m.actor === "AI" ? "bg-violet-50" : "bg-white",
              ].join(" ")}
            >
              <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                {m.actor} · {new Date(m.createdAt).toLocaleString("pt-BR")}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[#0F172A]">{m.content}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-2">
          <input className="input h-11 flex-1" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Escreva uma mensagem…" />
          <button className="btn btn-primary h-11 rounded-2xl" onClick={() => void send()} disabled={sending || !msg.trim()}>
            <Send className="h-4 w-4" />
            Enviar
          </button>
        </div>
      </div>
    </div>
  );
}

