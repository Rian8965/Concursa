import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { processImportAiJob } from "@/lib/import/process-import-ai";
import { NextRequest, NextResponse } from "next/server";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function POST(req: NextRequest) {
  // Permite execução via Cloud Tasks (recomendado) ou manual por admin (fallback).
  const secret = process.env.IMPORT_JOB_SECRET;
  const headerSecret = req.headers.get("x-import-job-secret");

  let isAuthorizedJob = Boolean(secret && headerSecret && secret === headerSecret);
  if (!isAuthorizedJob) {
    const session = await auth();
    if (!session?.user || !isAdmin(session.user.role)) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
  }

  const body = (await req.json().catch(() => ({}))) as { importId?: string };
  const importId = typeof body.importId === "string" ? body.importId : "";
  if (!importId) return NextResponse.json({ error: "importId é obrigatório" }, { status: 400 });

  try {
    await processImportAiJob(importId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[import][job] failed", { importId, message, stack: e instanceof Error ? e.stack : undefined });
    await prisma.pDFImport.update({
      where: { id: importId },
      data: { status: "FAILED", processingError: message.slice(0, 1500) },
    }).catch(() => {});
    return NextResponse.json({ error: "Falha no job de importação", detail: message }, { status: 500 });
  }
}

