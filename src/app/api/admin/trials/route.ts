import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? ""; // active | expired | converted | blocked
  const search = searchParams.get("search") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") ?? "50", 10)));
  const skip = (page - 1) * limit;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileWhere: any = {
    freeTrialStatus: { not: null },
  };
  if (status) profileWhere.freeTrialStatus = status;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userWhere: any = {};
  if (search) {
    userWhere.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [profiles, total] = await Promise.all([
    prisma.studentProfile.findMany({
      where: {
        ...profileWhere,
        user: search ? userWhere : undefined,
      },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        plan: { select: { name: true } },
        preferredCompetition: { select: { name: true } },
      },
      orderBy: { freeTrialStartedAt: "desc" },
      skip,
      take: limit,
    }) as Promise<any[]>,
    prisma.studentProfile.count({
      where: {
        ...profileWhere,
        user: search ? userWhere : undefined,
      },
    }),
  ]);

  const now = new Date();

  const data = profiles.map((p) => {
    const endsAt = p.freeTrialEndsAt ? new Date(p.freeTrialEndsAt) : null;
    const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86400000)) : 0;
    return {
      id: p.id,
      userId: p.userId,
      name: p.user.name,
      email: p.user.email,
      cpf: p.cpf,
      whatsapp: p.phone,
      contestName: p.preferredCompetition?.name ?? null,
      originSlug: p.freeTrialOriginSlug,
      status: p.freeTrialStatus,
      startedAt: p.freeTrialStartedAt,
      endsAt: p.freeTrialEndsAt,
      daysLeft,
      aiUsedToday: p.freeTrialAiUsedToday ?? 0,
      aiUsedTotal: p.freeTrialAiUsedTotal ?? 0,
      materialsDownloaded: p.freeTrialMaterialsDownloaded ?? 0,
      popupCount: p.trialPopupCount ?? 0,
      lastPopupAt: p.trialLastPopupAt,
      convertedAt: p.freeTrialConvertedAt,
      conversionPlanId: p.freeTrialConversionPlanId,
      conversionPlanName: p.plan?.name ?? null,
      createdAt: p.user.createdAt,
    };
  });

  // Métricas
  const [
    totalActive,
    totalExpired,
    totalConverted,
    totalBlocked,
    startedToday,
    startedThisMonth,
  ] = await Promise.all([
    prisma.studentProfile.count({ where: { freeTrialStatus: "active" } }),
    prisma.studentProfile.count({ where: { freeTrialStatus: "expired" } }),
    prisma.studentProfile.count({ where: { freeTrialStatus: "converted" } }),
    prisma.studentProfile.count({ where: { freeTrialStatus: "blocked" } }),
    prisma.studentProfile.count({
      where: {
        freeTrialStatus: { not: null },
        freeTrialStartedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      },
    }),
    prisma.studentProfile.count({
      where: {
        freeTrialStatus: { not: null },
        freeTrialStartedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
  ]);

  const totalAll = totalActive + totalExpired + totalConverted + totalBlocked;
  const conversionRate = totalAll > 0 ? Math.round((totalConverted / totalAll) * 100) : 0;

  return NextResponse.json({
    data,
    total,
    page,
    limit,
    metrics: {
      totalActive,
      totalExpired,
      totalConverted,
      totalBlocked,
      startedToday,
      startedThisMonth,
      conversionRate,
    },
  });
}

/** Ações administrativas sobre um trial */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !["ADMIN", "SUPER_ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { profileId, action, reason } = await req.json().catch(() => ({}));
  if (!profileId || !action) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });

  const profile = await prisma.studentProfile.findUnique({
    where: { id: profileId },
    select: { id: true, freeTrialStatus: true, userId: true },
  });
  if (!profile) return NextResponse.json({ error: "Perfil não encontrado" }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let update: any = {};

  if (action === "block") {
    update = { freeTrialStatus: "blocked" };
  } else if (action === "end") {
    update = { freeTrialStatus: "expired" };
  } else {
    return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
  }

  await prisma.studentProfile.update({ where: { id: profileId }, data: update as any });

  // Log administrativo
  await prisma.adminActionLog.create({
    data: {
      adminUserId: session.user.id,
      targetUserId: profile.userId,
      actionType: `TRIAL_${action.toUpperCase()}`,
      previousValue: profile.freeTrialStatus ?? "active",
      newValue: update.freeTrialStatus,
      reason: reason ?? null,
    } as any,
  });

  return NextResponse.json({ ok: true });
}
