import { redirect } from "next/navigation";
import { getLandingUrl } from "@/lib/billing/infinitepay";

/**
 * Os links de venda por concurso ficam na landing page:
 *   descompliqueseuconcurso.com.br/c/[slug]
 *
 * Esta rota no app redireciona permanentemente para o domínio correto,
 * garantindo que links antigos continuem funcionando.
 */
export default async function ConcursoRedirectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const landingUrl = getLandingUrl();
  redirect(`${landingUrl}/c/${slug}`);
}
