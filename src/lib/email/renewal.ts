import { getFromAddress, getSmtpTransport } from "@/lib/email/smtp";

export async function sendRenewalEmail(input: {
  to: string;
  name?: string | null;
  accessUntil: Date;
}) {
  const until = input.accessUntil.toLocaleDateString("pt-BR");
  const subject = "Sua assinatura foi renovada com sucesso";
  const text =
    `Olá${input.name ? `, ${input.name}` : ""}!\n\n` +
    `Sua assinatura foi renovada com sucesso por mais 30 dias.\n` +
    `Seu acesso está válido até ${until}.\n`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f7f7fb; padding:24px;">
    <div style="max-width:620px; margin:0 auto; background:white; border:1px solid rgba(15,23,42,.08); border-radius:16px; padding:22px;">
      <div style="font-size:14px; color:#475569;">Descomplique Seu Concurso</div>
      <h1 style="margin:10px 0 0; font-size:18px; color:#0f172a;">Assinatura renovada</h1>
      <p style="margin:12px 0 0; font-size:14px; color:#334155; line-height:1.5;">
        Olá${input.name ? `, <strong>${escapeHtml(input.name)}</strong>` : ""}! Sua assinatura foi renovada com sucesso por mais <strong>30 dias</strong>.
      </p>
      <p style="margin:10px 0 0; font-size:13px; color:#475569; line-height:1.5;">
        Acesso válido até <strong>${until}</strong>.
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

