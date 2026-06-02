import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getLandingUrl } from "@/lib/billing/infinitepay";

function isAdmin(role?: string) {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const competition = await prisma.competition.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      salesLinkActive: true,
      salesLinkVisits: true,
    },
  });

  if (!competition) return NextResponse.json({ error: "Concurso não encontrado" }, { status: 404 });

  const appUrl = getLandingUrl();
  const publicLink = `${appUrl}/c/${competition.slug}`;

  // Checkouts iniciados (transações com este competitionId)
  const allTxWithCompetition = await prisma.paymentTransaction.findMany({
    where: {
      raw: {
        path: ["competitionId"],
        equals: id,
      },
    },
    select: {
      id: true,
      status: true,
      amountCents: true,
      approvedAt: true,
      raw: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const checkoutsStarted = allTxWithCompetition.length;
  const approvedTxs = allTxWithCompetition.filter((t) => t.status === "APPROVED");
  const totalSales = approvedTxs.length;
  const totalRevenueCents = approvedTxs.reduce((sum, t) => sum + t.amountCents, 0);

  // Alunos que compraram por este link
  const studentEmails = new Set<string>();
  const salesList: Array<{
    name: string;
    email: string;
    plan: string;
    approvedAt: string | null;
    amountCents: number;
  }> = [];

  for (const tx of approvedTxs) {
    const raw = tx.raw as any;
    const email = raw?.customer?.email ?? "";
    const name = raw?.customer?.name ?? "";
    const plan = raw?.planSlug ?? "";
    if (!studentEmails.has(email)) {
      studentEmails.add(email);
    }
    salesList.push({
      name,
      email,
      plan,
      approvedAt: tx.approvedAt?.toISOString() ?? null,
      amountCents: tx.amountCents,
    });
  }

  return NextResponse.json({
    competition: {
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      isActive: competition.isActive,
      salesLinkActive: competition.salesLinkActive,
      salesLinkVisits: competition.salesLinkVisits,
    },
    publicLink,
    stats: {
      visits: competition.salesLinkVisits,
      checkoutsStarted,
      totalSales,
      totalRevenueCents,
      totalRevenueFormatted: `R$ ${(totalRevenueCents / 100).toFixed(2).replace(".", ",")}`,
    },
    sales: salesList,
  });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { salesLinkActive, slug: newSlug } = body as {
    salesLinkActive?: boolean;
    slug?: string;
  };

  const competition = await prisma.competition.findUnique({
    where: { id },
    select: { id: true, slug: true },
  });
  if (!competition) return NextResponse.json({ error: "Concurso não encontrado" }, { status: 404 });

  const updateData: Record<string, unknown> = {};

  if (typeof salesLinkActive === "boolean") {
    updateData.salesLinkActive = salesLinkActive;
  }

  if (newSlug !== undefined) {
    const cleanSlug = slugify(newSlug);
    if (!cleanSlug || cleanSlug.length < 2) {
      return NextResponse.json({ error: "Slug inválido. Use letras, números e hífens." }, { status: 400 });
    }
    // Verificar conflito
    const conflict = await prisma.competition.findFirst({
      where: { slug: cleanSlug, id: { not: id } },
      select: { id: true, name: true },
    });
    if (conflict) {
      return NextResponse.json(
        { error: `O slug "${cleanSlug}" já está em uso pelo concurso "${conflict.name}".` },
        { status: 409 },
      );
    }
    updateData.slug = cleanSlug;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nenhuma alteração enviada" }, { status: 400 });
  }

  const updated = await prisma.competition.update({
    where: { id },
    data: updateData as any,
    select: { id: true, slug: true, salesLinkActive: true, salesLinkVisits: true },
  });

  const landingUrl = getLandingUrl();
  return NextResponse.json({
    ok: true,
    competition: updated,
    publicLink: `${landingUrl}/c/${updated.slug}`,
  });
}
