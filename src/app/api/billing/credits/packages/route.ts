import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

/** Retorna os pacotes de créditos extras disponíveis para compra */
export async function GET() {
  const packages = await prisma.aiCreditPackage.findMany({
    where: { active: true },
    orderBy: { priceBrl: "asc" },
    select: { id: true, name: true, slug: true, priceBrl: true, creditsAmount: true },
  });
  return NextResponse.json({ packages });
}
