import { getAppUrl } from "@/lib/billing/infinitepay";
import { getFromAddress, getSmtpTransport } from "@/lib/email/smtp";

export async function sendFirstAccessEmail(input: { to: string; name?: string | null; token: string }) {
  const appUrl = getAppUrl();
  const link = `${appUrl}/primeiro-acesso?token=${encodeURIComponent(input.token)}`;

  const subject = "Seu acesso foi liberado — Crie sua senha";
  const text = `Olá${input.name ? `, ${input.name}` : ""}!\n\nSeu pagamento foi aprovado e seu acesso ao Descomplique Seu Concurso já está liberado.\n\nCrie sua senha no primeiro acesso:\n${link}\n\nSe você não solicitou isso, ignore esta mensagem.`;

  const html = `
  <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#f7f7fb; padding:24px;">
    <div style="max-width:620px; margin:0 auto; background:white; border:1px solid rgba(15,23,42,.08); border-radius:16px; padding:22px;">
      <div style="font-size:14px; color:#475569;">Descomplique Seu Concurso</div>
      <h1 style="margin:10px 0 0; font-size:18px; color:#0f172a;">Seu acesso foi liberado</h1>
      <p style="margin:12px 0 0; font-size:14px; color:#334155; line-height:1.5;">
        Olá${input.name ? `, <strong>${escapeHtml(input.name)}</strong>` : ""}! Seu pagamento foi aprovado e seu acesso já está disponível.
      </p>
      <p style="margin:12px 0 0; font-size:14px; color:#334155; line-height:1.5;">
        Clique no botão abaixo para <strong>criar sua senha</strong> no primeiro acesso:
      </p>
      <p style="margin:16px 0 0;">
        <a href="${link}" style="display:inline-block; background:#7c3aed; color:white; text-decoration:none; padding:10px 14px; border-radius:12px; font-weight:700; font-size:14px;">
          Criar senha e acessar
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

