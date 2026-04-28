import { getAppUrl } from "@/lib/billing/infinitepay";
import { getFromAddress, getSmtpTransport } from "@/lib/email/smtp";

export async function sendSupportTicketCreatedEmail(input: {
  to: string;
  name?: string | null;
  protocol: string;
  subject: string;
}) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/suporte`;

  const subject = `Solicitação enviada — Protocolo ${input.protocol}`;
  const text =
    `Olá${input.name ? `, ${input.name}` : ""}!\n\n` +
    `Recebemos sua solicitação de suporte.\n` +
    `Protocolo: ${input.protocol}\n` +
    `Assunto: ${input.subject}\n\n` +
    `Responderemos em até 24 horas.\n` +
    `Você pode acompanhar pelo sistema: ${link}\n`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f7f7fb; padding:24px;">
    <div style="max-width:620px; margin:0 auto; background:white; border:1px solid rgba(15,23,42,.08); border-radius:16px; padding:22px;">
      <div style="font-size:14px; color:#475569;">Descomplique Seu Concurso</div>
      <h1 style="margin:10px 0 0; font-size:18px; color:#0f172a;">Solicitação enviada</h1>
      <p style="margin:12px 0 0; font-size:14px; color:#334155; line-height:1.5;">
        Olá${input.name ? `, <strong>${escapeHtml(input.name)}</strong>` : ""}! Recebemos sua solicitação.
      </p>
      <p style="margin:10px 0 0; font-size:13px; color:#475569; line-height:1.5;">
        Protocolo: <strong>${escapeHtml(input.protocol)}</strong><br />
        Assunto: <strong>${escapeHtml(input.subject)}</strong>
      </p>
      <p style="margin:14px 0 0; font-size:13px; color:#475569; line-height:1.5;">
        Responderemos em até <strong>24 horas</strong>.
      </p>
      <p style="margin:16px 0 0;">
        <a href="${link}" style="display:inline-block; background:#7c3aed; color:white; text-decoration:none; padding:10px 14px; border-radius:12px; font-weight:700; font-size:14px;">
          Acompanhar no sistema
        </a>
      </p>
    </div>
  </div>`;

  const transporter = getSmtpTransport();
  await transporter.sendMail({
    from: getFromAddress(),
    to: input.to,
    subject,
    text,
    html,
  });
}

export async function sendSupportTicketReplyEmail(input: {
  to: string;
  name?: string | null;
  protocol: string;
  subject: string;
  reply: string;
}) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/suporte`;

  const subject = `Resposta do suporte — ${input.protocol}`;
  const text =
    `Olá${input.name ? `, ${input.name}` : ""}!\n\n` +
    `Você recebeu uma resposta no seu chamado.\n` +
    `Protocolo: ${input.protocol}\n` +
    `Assunto: ${input.subject}\n\n` +
    `Resposta:\n${input.reply}\n\n` +
    `Você pode responder pelo sistema: ${link}\n`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f7f7fb; padding:24px;">
    <div style="max-width:620px; margin:0 auto; background:white; border:1px solid rgba(15,23,42,.08); border-radius:16px; padding:22px;">
      <div style="font-size:14px; color:#475569;">Descomplique Seu Concurso</div>
      <h1 style="margin:10px 0 0; font-size:18px; color:#0f172a;">Resposta do suporte</h1>
      <p style="margin:12px 0 0; font-size:14px; color:#334155; line-height:1.5;">
        Protocolo: <strong>${escapeHtml(input.protocol)}</strong><br />
        Assunto: <strong>${escapeHtml(input.subject)}</strong>
      </p>
      <div style="margin:14px 0 0; background:#f8fafc; border:1px solid rgba(15,23,42,.08); border-radius:12px; padding:12px; font-size:13px; color:#0f172a; line-height:1.55; white-space:pre-wrap;">
        ${escapeHtml(input.reply)}
      </div>
      <p style="margin:16px 0 0;">
        <a href="${link}" style="display:inline-block; background:#7c3aed; color:white; text-decoration:none; padding:10px 14px; border-radius:12px; font-weight:700; font-size:14px;">
          Ver chamado no sistema
        </a>
      </p>
    </div>
  </div>`;

  const transporter = getSmtpTransport();
  await transporter.sendMail({
    from: getFromAddress(),
    to: input.to,
    subject,
    text,
    html,
  });
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#039;";
      default: return c;
    }
  });
}

