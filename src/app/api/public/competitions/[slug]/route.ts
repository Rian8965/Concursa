import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { corsHeaders } from "@/lib/billing/infinitepay";

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  const { slug } = await params;

  const competition = await prisma.competition.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      salesLinkActive: true,
      organization: true,
      description: true,
      city: { select: { name: true, state: true } },
      examBoard: { select: { acronym: true } },
    },
  });

  if (!competition) {
    return NextResponse.json({ error: "Concurso não encontrado", code: "NOT_FOUND" }, { status: 404, headers });
  }

  if (!competition.isActive) {
    return NextResponse.json({ error: "Este concurso está inativo", code: "COMPETITION_INACTIVE" }, { status: 410, headers });
  }

  if (!competition.salesLinkActive) {
    return NextResponse.json({ error: "Este link de inscrição não está disponível no momento", code: "LINK_INACTIVE" }, { status: 410, headers });
  }

  // Incrementa visita de forma assíncrona
  void prisma.competition
    .update({ where: { slug }, data: { salesLinkVisits: { increment: 1 } } })
    .catch(() => {});

  return NextResponse.json(
    {
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      organization: competition.organization,
      description: competition.description,
      city: competition.city,
      examBoard: competition.examBoard,
    },
    { headers },
  );
}
