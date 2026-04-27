import nodemailer from "nodemailer";

function reqEnv(name: string) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} não configurado`);
  return v;
}

export function getSmtpTransport() {
  const host = reqEnv("SMTP_HOST");
  const port = parseInt(reqEnv("SMTP_PORT"), 10);
  const user = reqEnv("SMTP_USER");
  const pass = reqEnv("SMTP_PASS");
  const secure = (process.env.SMTP_SECURE ?? "").trim() === "1" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export function getFromAddress() {
  return reqEnv("SMTP_FROM");
}

