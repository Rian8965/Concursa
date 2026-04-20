import { NextResponse } from "next/server";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

type DocaiLayout = {
  textAnchor?: { textSegments?: Array<{ startIndex?: string | number; endIndex?: string | number }> };
  boundingPoly?: { normalizedVertices?: Array<{ x?: number; y?: number }>; vertices?: Array<{ x?: number; y?: number }> };
};

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function segText(fullText: string, layout?: DocaiLayout) {
  const segs = layout?.textAnchor?.textSegments ?? [];
  if (!fullText || !segs.length) return "";
  let out = "";
  for (const s of segs) {
    const a = Number(s.startIndex ?? 0);
    const b = Number(s.endIndex ?? 0);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) out += fullText.slice(a, b);
  }
  return out;
}

function bboxXStats(layout?: DocaiLayout) {
  const verts =
    layout?.boundingPoly?.normalizedVertices ??
    layout?.boundingPoly?.vertices ??
    [];
  const xs = verts.map((v) => (typeof v.x === "number" ? v.x : NaN)).filter((n) => Number.isFinite(n));
  if (!xs.length) return null;
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const midX = (minX + maxX) / 2;
  const ys = verts.map((v) => (typeof v.y === "number" ? v.y : NaN)).filter((n) => Number.isFinite(n));
  const minY = ys.length ? Math.min(...ys) : null;
  const maxY = ys.length ? Math.max(...ys) : null;
  const midY = minY != null && maxY != null ? (minY + maxY) / 2 : null;
  return { minX, maxX, midX, minY, maxY, midY };
}

export async function POST(req: Request) {
  const devToken = process.env.ADMIN_API_DEV_TOKEN;
  const hasDevBypass = !!devToken && req.headers.get("x-dev-token") === devToken;

  if (!hasDevBypass) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user.role === "STUDENT") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const startedAt = Date.now();
  const url = new URL(req.url);
  const mode = (url.searchParams.get("mode") ?? "text").toLowerCase(); // "text" | "layout"

  const projectId = process.env.DOC_AI_PROJECT_ID ?? process.env.GOOGLE_CLOUD_PROJECT ?? "concursa-docai";
  const location = requiredEnv("DOC_AI_LOCATION");
  const processorId = requiredEnv("DOC_AI_PROCESSOR_ID");

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um PDF no campo 'file' (multipart/form-data)." }, { status: 400 });
  }

  const mimeType = file.type || "application/pdf";
  if (mimeType !== "application/pdf") {
    return NextResponse.json({ error: "Apenas PDF é suportado (application/pdf)." }, { status: 415 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-docai-route",
      location: "src/app/api/admin/docai/extract/route.ts:POST",
      message: "docai extract request received",
      data: { projectId, location, processorId, bytes: bytes.length, mimeType },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const client = new DocumentProcessorServiceClient({
    apiEndpoint: `${location}-documentai.googleapis.com`,
  });

  const name = client.processorPath(projectId, location, processorId);
  const [result] = await client.processDocument({
    name,
    rawDocument: {
      content: bytes.toString("base64"),
      mimeType: "application/pdf",
    },
  });

  const text = result.document?.text ?? "";
  const elapsedMs = Date.now() - startedAt;

  const doc = result.document as unknown as {
    pages?: Array<{
      pageNumber?: number;
      dimension?: { width?: number; height?: number };
      paragraphs?: Array<{ layout?: DocaiLayout }>;
    }>;
  } | undefined;

  // Monta um payload "layout" enxuto: por página, apenas parágrafos com bbox + texto.
  const pages =
    doc?.pages?.map((p) => {
      const parasRaw = p.paragraphs ?? [];
      const paras = parasRaw
        .map((para, i) => {
          const stats = bboxXStats(para.layout);
          return {
            i,
            text: segText(text, para.layout),
            bbox: para.layout?.boundingPoly ?? null,
            minX: stats?.minX ?? null,
            midX: stats?.midX ?? null,
            maxX: stats?.maxX ?? null,
            minY: stats?.minY ?? null,
            midY: stats?.midY ?? null,
            maxY: stats?.maxY ?? null,
          };
        })
        .filter((x) => x.text.trim().length > 0);

      // Heurística simples: 2 colunas se houver massa relevante em ambos lados.
      const mids = paras.map((x) => x.midX).filter((n): n is number => typeof n === "number" && Number.isFinite(n));
      const left = mids.filter((x) => x < 0.45).length;
      const right = mids.filter((x) => x > 0.55).length;
      const likelyTwoCols = left > 8 && right > 8; // limiar conservador

      return {
        pageNumber: p.pageNumber ?? null,
        dimension: p.dimension ?? null,
        stats: { paragraphs: paras.length, left, right, likelyTwoCols },
        paragraphs: paras,
      };
    }) ?? [];

  // #region agent log
  fetch("http://127.0.0.1:7283/ingest/9736e9f4-dabc-4bb0-9625-863cffe8a676", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "03dbee" },
    body: JSON.stringify({
      sessionId: "03dbee",
      runId: "pre-fix",
      hypothesisId: "H-docai-route",
      location: "src/app/api/admin/docai/extract/route.ts:POST:done",
      message: "docai extract completed",
      data: {
        elapsedMs,
        textLength: text.length,
        mode,
        pages: pages.length,
        likelyTwoColsPages: pages.filter((p) => p.stats.likelyTwoCols).length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (mode === "layout") {
    return NextResponse.json({
      ok: true,
      meta: {
        elapsedMs,
        textLength: text.length,
        pages: pages.length,
        likelyTwoColsPages: pages.filter((p) => p.stats.likelyTwoCols).length,
      },
      text,
      pages,
    });
  }

  return NextResponse.json({
    ok: true,
    meta: { elapsedMs, textLength: text.length },
    text,
  });
}

