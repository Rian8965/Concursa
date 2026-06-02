import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { validateCpf, formatCpf, normalizeCpf } from "@/lib/utils/cpf";

const TRIAL_DAYS = 7;
const TRIAL_AI_DAILY = 5;
const TRIAL_AI_TOTAL = 35;

const schema = z
  .object({
    name: z.string().min(3, "Nome completo obrigatório"),
    cpf: z.string().refine((v) => validateCpf(v), "CPF inválido"),
    whatsapp: z
      .string()
      .min(10, "WhatsApp inválido")
      .refine((v) => v.replace(/\D/g, "").length >= 10, "WhatsApp inválido"),
    email: z.string().email("E-mail inválido"),
    password: z
      .string()
      .min(8, "Senha deve ter no mínimo 8 caracteres")
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Senha deve ter maiúsculas, minúsculas e números"),
    confirmPassword: z.string(),
    terms: z.boolean().refine((v) => v === true, "Aceite os termos obrigatório"),
    contestSlug: z.string().optional().nullable(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json({ error: first.message }, { status: 400 });
    }

    const { name, cpf, whatsapp, email, password, contestSlug } = parsed.data;
    const cpfFormatted = formatCpf(cpf);
    const cpfDigits = normalizeCpf(cpf);
    const emailNorm = email.toLowerCase().trim();
    const phone = whatsapp.replace(/\D/g, "");

    // --- Bloqueio de abuso ---
    const existingUser = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (existingUser) {
      return NextResponse.json({ error: "Este e-mail já está cadastrado. Faça login ou recupere sua senha." }, { status: 409 });
    }

    const existingCpf = await prisma.studentProfile.findFirst({
      where: { OR: [{ cpf: cpfDigits }, { cpf: cpfFormatted }] },
    });
    if (existingCpf) {
      // Verifica se este CPF já usou trial
      const profile = existingCpf as any;
      if (profile.freeTrialStatus) {
        return NextResponse.json(
          { error: "Não foi possível ativar um novo teste grátis para este CPF. Entre em contato com o suporte." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Este CPF já está cadastrado. Faça login ou recupere sua senha." }, { status: 409 });
    }

    // Bloquear mesmo WhatsApp se já usou trial
    const existingPhone = await prisma.studentProfile.findFirst({ where: { phone } });
    if (existingPhone) {
      const ep = existingPhone as any;
      if (ep.freeTrialStatus) {
        return NextResponse.json(
          { error: "Não foi possível ativar um novo teste grátis para este WhatsApp. Entre em contato com o suporte." },
          { status: 409 },
        );
      }
    }

    // --- Concurso de origem ---
    let originCompetitionId: string | null = null;
    if (contestSlug) {
      const comp = await prisma.competition.findFirst({
        where: { slug: contestSlug, isActive: true },
        select: { id: true },
      });
      originCompetitionId = comp?.id ?? null;
    }

    // --- Criar usuário + perfil com trial ---
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();
    const trialEnds = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: emailNorm,
          password: hashedPassword,
          role: "STUDENT",
          isActive: true,
        },
      });

      await tx.studentProfile.create({
        data: {
          userId: user.id,
          phone,
          cpf: cpfFormatted,
          freeTrialStatus: "active",
          freeTrialStartedAt: now,
          freeTrialEndsAt: trialEnds,
          freeTrialOriginSlug: contestSlug ?? null,
          preferredCompetitionId: originCompetitionId,
          createdByPayment: false,
          needsOnboarding: false,
        } as any,
      });
    });

    return NextResponse.json({ ok: true, email: emailNorm });
  } catch (err) {
    console.error("[trial-register]", err);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}
