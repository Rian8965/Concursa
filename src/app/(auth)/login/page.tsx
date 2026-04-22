import { LoginClient } from "./LoginClient";
import { getBuilderPageContent } from "@/lib/builder/builder-server";
import { BuilderContent } from "@/components/builder/BuilderContent";

export default async function LoginPage() {
  const content = await getBuilderPageContent("/login");
  if (content) return <BuilderContent content={content} />;
  return <LoginClient />;
}
