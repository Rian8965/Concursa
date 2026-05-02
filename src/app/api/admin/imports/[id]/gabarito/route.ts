import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { saveImportGabaritoPdfBuffer, readImportGabaritoPdfBuffer, readImportPdfBuffer } from "@/lib/import-pdf-storage";
import { NextRequest, NextResponse } from "next/server";
import { ocrPdfBufferToText } from "@/lib/import/ocr-pdf-buffer-once";
import { applyGabaritoTextToImportQuestions } from "@/lib/import/apply-gabarito-to-import";
import { extractGabaritoSectionFromProvaFullText } from "@/lib/import/gabarito";

function isAdmin(r?: string) {
  return r === "ADMIN" || r === "SUPER_ADMIN";
}

/** Download do PDF do gabarito salvo para esta importação. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const imp = await prisma.pDFImport.findUnique({
    where: { id },
    select: { originalFilenameGabarito: true, createdAt: true },
  });
  if (!imp) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });

  const buf = await readImportGabaritoPdfBuffer(id);
  if (!buf?.length) {
    return NextResponse.json({ error: "Nenhum arquivo de gabarito foi enviado para esta importação." }, { status: 404 });
  }

  const ageMs = Date.now() - new Date(imp.createdAt).getTime();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (Number.isFinite(ageMs) && ageMs > sevenDaysMs) {
    return NextResponse.json(
      { error: "Arquivo expirado (>7 dias). Reenvie o gabarito." },
      { status: 410 },
    );
  }

  const fname = imp.originalFilenameGabarito?.trim() || "gabarito.pdf";

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fname)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}

/**
 * POST multipart: campo `gabarito` (File) — salva e reaplica o mapa de gabarito
 * em todas as questões já extraídas (usa `number` no rawText de cada uma).
 *
 * Query opcional: `fromProva=1` — ignora arquivo e extrai a seção de gabarito do PDF da prova (OCR completo).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const { id } = await params;

  const imp = await prisma.pDFImport.findUnique({
    where: { id },
    select: { id: true, storedPdfPath: true, gabaritoInSamePdf: true },
  });
  if (!imp) return NextResponse.json({ error: "Importação não encontrada" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const fromProva = searchParams.get("fromProva") === "1";

  let gabaritoOcrText = "";

  if (fromProva) {
    if (!imp.storedPdfPath) {
      return NextResponse.json({ error: "PDF da prova não disponível." }, { status: 400 });
    }
    try {
      const provaBuf = await readImportPdfBuffer(imp.storedPdfPath);
      if (!provaBuf?.length) {
        return NextResponse.json({ error: "Não foi possível ler o PDF da prova." }, { status: 400 });
      }
      const full = await ocrPdfBufferToText(provaBuf);
      gabaritoOcrText = extractGabaritoSectionFromProvaFullText(full).trim();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `Falha ao OCR da prova para localizar gabarito: ${msg}`.slice(0, 900) },
        { status: 422 },
      );
    }
  } else {
    const formData = await req.formData().catch(() => null);
    const file = formData?.get("gabarito") as File | null;
    if (!file || !(file instanceof File) || file.size <= 0) {
      return NextResponse.json({ error: "Envie o arquivo em form-data com o campo 'gabarito'." }, { status: 400 });
    }

    try {
      const buf = Buffer.from(await file.arrayBuffer());
      await saveImportGabaritoPdfBuffer(id, buf);
      await prisma.pDFImport.update({
        where: { id },
        data: { originalFilenameGabarito: file.name },
      });
      gabaritoOcrText = await ocrPdfBufferToText(buf);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        { error: `Falha ao processar o gabarito: ${msg}`.slice(0, 900) },
        { status: 422 },
      );
    }
  }

  try {
    const { updated, mapSize } = await applyGabaritoTextToImportQuestions(prisma, id, gabaritoOcrText);
    return NextResponse.json({
      ok: true,
      updated,
      mapSize,
      message:
        mapSize === 0
          ? "Gabarito salvo, mas nenhuma resposta foi reconhecida no texto. Confira o formato do arquivo."
          : `Gabarito reinterpretado: ${mapSize} entradas no mapa; ${updated} questões atualizadas.`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg.slice(0, 900) }, { status: 500 });
  }
}
