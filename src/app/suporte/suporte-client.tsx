"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { LifeBuoy, Send, Sparkles, MessageSquarePlus, Paperclip, ShieldAlert } from "lucide-react";

type Role = "STUDENT" | "ADMIN" | "SUPER_ADMIN";

type TicketLite = {
  id: string;
  protocol: string;
  subject: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  dueAt: string;
};

type ChatMsg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Como faço um simulado?",
  "Como baixo uma apostila?",
  "Como reviso meus erros?",
  "Como altero minha senha?",
  "Onde vejo meu desempenho?",
  "Como denuncio uma questão?",
  "Como funciona o preenchimento de gabarito?",
  "Como falar com o administrador?",
];

export default function SuporteClient({ role }: { role: Role }) {
  const [tab, setTab] = useState<"ia" | "chamados">("ia");
  const [q, setQ] = useState("");
  const [chat, setChat] = useState<ChatMsg[]>([
    {
      role: "assistant",
      content:
        "Olá! Eu sou o suporte do sistema. Posso te orientar passo a passo sobre como usar a plataforma (treino, simulado, revisão, apostilas, gabarito, desempenho, login/senha, pagamentos).",
    },
    {
      role: "assistant",
      content:
        "Importante: não consigo responder sobre conteúdo de questões/matérias/concurso. Se você quiser, você também pode abrir um chamado para falar com o administrador.",
    },
  ]);
  const [aiLoading, setAiLoading] = useState(false);

  const [tickets, setTickets] = useState<TicketLite[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Form "falar com administrador"
  const [openForm, setOpenForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [type, setType] = useState("USAGE_DOUBT");
  const [message, setMessage] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [sendingTicket, setSendingTicket] = useState(false);
  const canSendTicket = subject.trim().length >= 3 && message.trim().length >= 10;

  const headerRight = useMemo(() => {
    if (role === "ADMIN" || role === "SUPER_ADMIN") {
      return (
        <Link href="/admin/suporte" className="btn btn-ghost rounded-2xl">
          <LifeBuoy className="h-4 w-4" />
          Painel de suporte
        </Link>
      );
    }
    return null;
  }, [role]);

  useEffect(() => {
    if (tab !== "chamados") return;
    setTicketsLoading(true);
    fetch("/api/support/tickets")
      .then((r) => r.json())
      .then((d) => setTickets(d?.tickets ?? []))
      .catch(() => toast.error("Não foi possível carregar seus chamados"))
      .finally(() => setTicketsLoading(false));
  }, [tab]);

  async function askAi(text: string) {
    const prompt = text.trim();
    if (!prompt) return;
    setQ("");
    setAiLoading(true);
    const next: ChatMsg[] = [...chat, { role: "user" as const, content: prompt }];
    setChat(next);
    try {
      const res = await fetch("/api/support/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-12) }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Erro no suporte");
      setChat((prev) => [...prev, { role: "assistant", content: String(d?.answer ?? "") || "Desculpe, não consegui responder." }]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro no suporte");
    } finally {
      setAiLoading(false);
    }
  }

  async function submitTicket() {
    if (!canSendTicket) {
      toast.error("Preencha assunto e mensagem");
      return;
    }
    setSendingTicket(true);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          type,
          message: message.trim(),
          attachments: attachmentUrl.trim() ? [{ url: attachmentUrl.trim() }] : [],
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error ?? "Não foi possível enviar");
      toast.success("Sua solicitação foi enviada com sucesso. Responderemos em até 24 horas.");
      setOpenForm(false);
      setSubject("");
      setType("USAGE_DOUBT");
      setMessage("");
      setAttachmentUrl("");
      // atualiza lista
      setTab("chamados");
      setTicketsLoading(true);
      const r2 = await fetch("/api/support/tickets");
      const d2 = await r2.json().catch(() => ({}));
      setTickets(d2?.tickets ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar solicitação");
    } finally {
      setSendingTicket(false);
      setTicketsLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-violet-600">Suporte</p>
          <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-[#0F172A]">Falar com o Suporte</h1>
          <p className="mt-2 text-sm text-[#64748B]">
            Tire dúvidas sobre como usar o sistema ou envie uma solicitação para o administrador.
          </p>
        </div>
        <div className="flex items-center gap-2">{headerRight}</div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={tab === "ia" ? "btn btn-primary rounded-2xl" : "btn btn-ghost rounded-2xl"}
          onClick={() => setTab("ia")}
        >
          <Sparkles className="h-4 w-4" />
          Suporte com IA
        </button>
        <button
          type="button"
          className={tab === "chamados" ? "btn btn-primary rounded-2xl" : "btn btn-ghost rounded-2xl"}
          onClick={() => setTab("chamados")}
        >
          <MessageSquarePlus className="h-4 w-4" />
          Meus chamados
        </button>
        <button type="button" className="btn btn-ghost rounded-2xl" onClick={() => setOpenForm(true)}>
          <LifeBuoy className="h-4 w-4" />
          Falar com administrador
        </button>
      </div>

      {tab === "ia" ? (
        <div className="orbit-card-premium p-5 sm:p-6">
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-700" />
            <p className="text-sm text-amber-900">
              Este chat responde somente sobre <strong>uso do sistema</strong>. Para dúvidas sobre questões/matérias, use a denúncia ou abra um chamado.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-2xl border border-black/[0.08] bg-white px-3 py-2 text-xs font-semibold text-[#0F172A] hover:bg-slate-50"
                onClick={() => void askAi(s)}
                disabled={aiLoading}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mt-5 space-y-3">
            {chat.map((m, idx) => (
              <div
                key={idx}
                className={[
                  "max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  m.role === "assistant"
                    ? "bg-slate-50 text-[#0F172A] border border-black/[0.06]"
                    : "ml-auto bg-violet-600 text-white",
                ].join(" ")}
              >
                {m.content}
              </div>
            ))}
            {aiLoading ? (
              <div className="max-w-[92%] rounded-2xl border border-black/[0.06] bg-slate-50 px-4 py-3 text-sm text-[#64748B]">
                Pensando…
              </div>
            ) : null}
          </div>

          <form
            className="mt-5 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void askAi(q);
            }}
          >
            <input
              className="input h-11 flex-1"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Digite sua dúvida sobre o uso do sistema…"
              disabled={aiLoading}
            />
            <button className="btn btn-primary h-11 rounded-2xl" disabled={aiLoading || !q.trim()}>
              <Send className="h-4 w-4" />
              Enviar
            </button>
          </form>
        </div>
      ) : null}

      {tab === "chamados" ? (
        <div className="orbit-card-premium p-5 sm:p-6">
          {ticketsLoading ? (
            <p className="text-sm text-[#64748B]">Carregando…</p>
          ) : tickets.length === 0 ? (
            <div className="rounded-2xl border border-black/[0.06] bg-white p-6 text-center">
              <p className="text-sm font-bold text-[#0F172A]">Nenhum chamado ainda</p>
              <p className="mt-2 text-sm text-[#64748B]">Se precisar, clique em “Falar com administrador”.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((t) => (
                <Link
                  key={t.id}
                  href={`/suporte/chamados/${t.id}`}
                  className="block rounded-2xl border border-black/[0.08] bg-white p-4 hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">{t.protocol}</p>
                      <p className="mt-1 truncate text-sm font-extrabold text-[#0F172A]">{t.subject}</p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        Tipo: {t.type} · Status: {t.status}
                      </p>
                    </div>
                    <span className="rounded-xl border border-black/[0.08] bg-slate-50 px-3 py-1 text-xs font-semibold text-[#0F172A]">
                      Prazo: {new Date(t.dueAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {openForm ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-[#64748B]">Falar com administrador</p>
                <h2 className="mt-1 text-lg font-extrabold text-[#0F172A]">Enviar solicitação</h2>
              </div>
              <button className="btn btn-ghost rounded-2xl" type="button" onClick={() => setOpenForm(false)}>
                Fechar
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="orbit-form-label">Assunto</label>
                <input className="input h-11 w-full" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Não consigo acessar / Dúvida sobre simulado" />
              </div>
              <div>
                <label className="orbit-form-label">Tipo do problema</label>
                <select className="input h-11 w-full" value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="ACCESS">Problema de acesso</option>
                  <option value="PAYMENT">Pagamento</option>
                  <option value="QUESTION_ERROR">Questão com erro</option>
                  <option value="USAGE_DOUBT">Dúvida sobre uso</option>
                  <option value="TECHNICAL">Problema técnico</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
              <div>
                <label className="orbit-form-label">Mensagem</label>
                <textarea className="input min-h-[110px] w-full py-3" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Descreva com detalhes o que aconteceu e o que você já tentou…" />
              </div>
              <div>
                <label className="orbit-form-label">Anexo (opcional)</label>
                <div className="flex gap-2">
                  <input className="input h-11 flex-1" value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="Cole o link de uma imagem (ex.: print no Drive)" />
                  <button type="button" className="btn btn-ghost h-11 rounded-2xl" onClick={() => toast.info("Você pode anexar um link de imagem por enquanto.")}>
                    <Paperclip className="h-4 w-4" />
                  </button>
                </div>
                <p className="mt-1 text-xs text-[#94A3B8]">
                  (Implementação de upload de imagem pode ser adicionada depois; por enquanto use link.)
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary mt-5 w-full rounded-2xl"
              disabled={sendingTicket || !canSendTicket}
              onClick={() => void submitTicket()}
            >
              {sendingTicket ? "Enviando..." : "Enviar solicitação"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

