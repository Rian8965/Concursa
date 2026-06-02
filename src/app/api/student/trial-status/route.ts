import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await prisma.studentProfile.findUnique({
    where: { userId: session.user.id },
    select: {
      freeTrialStatus: true,
      freeTrialStartedAt: true,
      freeTrialEndsAt: true,
      freeTrialAiUsedToday: true,
      freeTrialAiUsedTotal: true,
      freeTrialMaterialsDownloaded: true,
      freeTrialOriginSlug: true,
      freeTrialConvertedAt: true,
      trialPopupCount: true,
      trialLastPopupAt: true,
      preferredCompetitionId: true,
    } as any,
  });

  if (!profile) return NextResponse.json({ trial: null });

  const p = profile as any;
  const now = new Date();
  const endsAt = p.freeTrialEndsAt ? new Date(p.freeTrialEndsAt) : null;
  const daysLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / 86400000)) : 0;

  return NextResponse.json({
    trial: {
      status: p.freeTrialStatus ?? null,
      startedAt: p.freeTrialStartedAt,
      endsAt: p.freeTrialEndsAt,
      daysLeft,
      aiUsedToday: p.freeTrialAiUsedToday ?? 0,
      aiUsedTotal: p.freeTrialAiUsedTotal ?? 0,
      materialsDownloaded: p.freeTrialMaterialsDownloaded ?? 0,
      originSlug: p.freeTrialOriginSlug,
      convertedAt: p.freeTrialConvertedAt,
      popupCount: p.trialPopupCount ?? 0,
      lastPopupAt: p.trialLastPopupAt,
    },
  });
}

/** Registrar exibição de popup */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json().catch(() => ({ action: "" }));

  if (action === "popup_shown") {
    await prisma.studentProfile.update({
      where: { userId: session.user.id },
      data: {
        trialPopupCount: { increment: 1 },
        trialLastPopupAt: new Date(),
      } as any,
    });
  }

  return NextResponse.json({ ok: true });
}
