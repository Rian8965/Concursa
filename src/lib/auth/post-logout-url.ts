/** URL canônica da tela de login (produção). */
export const CANONICAL_LOGIN_URL = "https://descompliqueseuconcurso.com.br/login";

/**
 * Destino após `signOut` (NextAuth `callbackUrl`).
 * - Em desenvolvimento local: mesmo origin + `/login`.
 * - No domínio de produção: URL canônica informada pelo produto.
 * - Outros hosts (ex.: preview): mesmo origin + `/login`.
 * - `NEXT_PUBLIC_POST_LOGOUT_URL` sobrescreve tudo quando definida.
 */
export function getPostLogoutUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_POST_LOGOUT_URL?.trim();
  if (fromEnv) return fromEnv;

  if (typeof window === "undefined") return "/login";

  const { origin, hostname } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${origin}/login`;
  }

  if (hostname === "descompliqueseuconcurso.com.br" || hostname === "www.descompliqueseuconcurso.com.br") {
    return CANONICAL_LOGIN_URL;
  }

  return `${origin}/login`;
}
