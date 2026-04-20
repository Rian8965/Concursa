import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const [imports, total] = await Promise.all([
    prisma.pDFImport.findMany({
      include: { competition: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.pDFImport.count(),
  ]);

  return NextResponse.json({ imports, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const { competitionId, originalFilename, year, subjectId } = body;

  const pdfImport = await prisma.pDFImport.create({
    data: {
      competitionId: competitionId || null,
      originalFilename,
      year: year ? parseInt(year) : null,
      subjectId: subjectId || null,
      status: "PENDING",
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ import: pdfImport }, { status: 201 });
}
