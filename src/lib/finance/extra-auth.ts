import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "fin_auth";

function reqEnv(name: string) {
  const v = (process.env[name] ?? "").trim();
  if (!v) throw new Error(`${name} não configurado`);
  return v;
}

export function financeCookieMaxAgeSeconds() {
  return 60 * 60 * 12; // 12h
}

export function setFinanceAuthCookie() {
  const secret = reqEnv("FINANCE_REPORT_SESSION_SECRET");
  const ts = Date.now().toString(10);
  const sig = crypto.createHmac("sha256", secret).update(ts).digest("hex");
  const value = `${ts}.${sig}`;
  const jar = cookies() as any;
  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: financeCookieMaxAgeSeconds(),
  });
}

export function clearFinanceAuthCookie() {
  const jar = cookies() as any;
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

export function hasValidFinanceAuthCookie(): boolean {
  const secret = (process.env.FINANCE_REPORT_SESSION_SECRET ?? "").trim();
  if (!secret) return false;
  const jar = cookies() as any;
  const v = jar.get(COOKIE_NAME)?.value ?? "";
  const [ts, sig] = v.split(".");
  if (!ts || !sig) return false;
  if (!/^\d+$/.test(ts)) return false;
  const ageMs = Date.now() - parseInt(ts, 10);
  if (ageMs < 0 || ageMs > financeCookieMaxAgeSeconds() * 1000) return false;
  const expected = crypto.createHmac("sha256", secret).update(ts).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

