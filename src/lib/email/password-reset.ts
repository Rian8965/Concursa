import { getAppUrl } from "@/lib/billing/infinitepay";
import { getFromAddress, getSmtpTransport } from "@/lib/email/smtp";

export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string | null;
  token: string;
  expiresMinutes: number;
}) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/redefinir-senha?token=${encodeURIComponent(input.token)}`;
  const subject = "Redefinição de senha — Descomplique Seu Concurso";

  const text =
    `Olá${input.name ? `, ${input.name}` : ""}!\n\n` +
    `Recebemos um pedido para redefinir sua senha.\n` +
    `Use o link abaixo (válido por ${input.expiresMinutes} minutos):\n\n` +
    `${link}\n\n` +
    `Se você não solicitou isso, ignore este e-mail.`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f7f7fb; padding:24px;">
    <div style="max-width:620px; margin:0 auto; background:white; border:1px solid rgba(15,23,42,.08); border-radius:16px; padding:22px;">
      <div style="font-size:14px; color:#475569;">Descomplique Seu Concurso</div>
      <h1 style="margin:10px 0 0; font-size:18px; color:#0f172a;">Redefinir senha</h1>
      <p style="margin:12px 0 0; font-size:14px; color:#334155; line-height:1.5;">
        Olá${input.name ? `, <strong>${escapeHtml(input.name)}</strong>` : ""}! Clique no botão abaixo para criar uma nova senha.
      </p>
      <p style="margin:10px 0 0; font-size:12px; color:#64748b;">
        Link válido por <strong>${input.expiresMinutes} minutos</strong>.
      </p>
      <p style="margin:16px 0 0;">
        <a href="${link}" style="display:inline-block; background:#7c3aed; color:white; text-decoration:none; padding:10px 14px; border-radius:12px; font-weight:700; font-size:14px;">
          Redefinir senha
        </a>
      </p>
      <p style="margin:14px 0 0; font-size:12px; color:#64748b; line-height:1.5;">
        Se o botão não abrir, copie e cole no navegador:<br />
        <a href="${link}" style="color:#7c3aed; word-break:break-all;">${link}</a>
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

