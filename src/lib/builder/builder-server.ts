import { builder } from "@builder.io/sdk";

function getBuilderKey() {
  return (
    process.env.NEXT_PUBLIC_BUILDER_API_KEY?.trim() ||
    process.env.BUILDER_API_KEY?.trim() ||
    ""
  );
}

let inited = false;
function ensureInit() {
  const key = getBuilderKey();
  if (!key) return false;
  if (!inited) {
    builder.init(key);
    inited = true;
  }
  return true;
}

export async function getBuilderPageContent(urlPath: string) {
  if (!ensureInit()) return null;
  const content = await builder
    .get("page", {
      userAttributes: { urlPath },
      prerender: false,
    })
    .toPromise();
  return content ?? null;
}

