import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";
import type { Difficulty, QuestionStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

type QuestionUpdateBody = {
  content: string;
  supportText?: string | null;
  competitionId?: string | null;
  subjectId?: string | null;
  topicId?: string | null;
  examBoardId?: string | null;
  cityId?: string | null;
  jobRoleId?: string | null;
  difficulty?: Difficulty;
  year?: string | number | null;
  correctAnswer: string;
  status?: QuestionStatus;
  alternatives: { letter: string; content: string }[];
  hasImage?: boolean;
  imageUrl?: string | null;
};

function parseYear(y: unknown): number | null {
  if (y === null || y === undefined || y === "") return null;
  const n = typeof y === "number" ? y : parseInt(String(y), 10);
  return Number.isFinite(n) ? n : null;
}

function optRelationId(id: unknown): string | null {
  if (typeof id !== "string") return null;
  const t = id.trim();
  return t.length > 0 ? t : null;
}

function parseDifficulty(d: unknown): Difficulty {
  if (d === "EASY" || d === "MEDIUM" || d === "HARD") return d;
  return "MEDIUM";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id },
    include: { alternatives: { orderBy: { order: "asc" } }, subject: true, competition: true, examBoard: true },
  });
  if (!question) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ question });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  let body: QuestionUpdateBody;
  try {
    body = (await req.json()) as QuestionUpdateBody;
  } catch {
    return NextResponse.json({ error: "Corpo da requisição inválido" }, { status: 400 });
  }
  const {
    content,
    supportText,
    competitionId,
    subjectId,
    topicId,
    examBoardId,
    cityId,
    jobRoleId,
    difficulty,
    year,
    correctAnswer,
    status,
    alternatives,
    hasImage,
    imageUrl,
  } = body;

  const altLetters = new Set(alternatives.map((a) => a.letter));
  if (!altLetters.has(correctAnswer)) {
    return NextResponse.json(
      { error: "A alternativa marcada como correta precisa ser uma das alternativas preenchidas (letra entre A e E)." },
      { status: 400 },
    );
  }

  try {
    const question = await prisma.$transaction(async (tx) => {
      await tx.alternative.deleteMany({ where: { questionId: id } });
      return tx.question.update({
        where: { id },
        data: {
          content,
          supportText: typeof supportText === "string" && supportText.trim() ? supportText.trim() : null,
          difficulty: parseDifficulty(difficulty),
          correctAnswer,
          status,
          competitionId: optRelationId(competitionId),
          subjectId: optRelationId(subjectId),
          topicId: optRelationId(topicId),
          examBoardId: optRelationId(examBoardId),
          cityId: optRelationId(cityId),
          jobRoleId: optRelationId(jobRoleId),
          year: parseYear(year),
          hasImage: Boolean(hasImage && imageUrl),
          imageUrl: typeof imageUrl === "string" && imageUrl.length > 0 ? imageUrl : null,
          alternatives: {
            create: alternatives.map((a, i) => ({
              letter: a.letter,
              content: a.content,
              order: i + 1,
            })),
          },
        },
        include: { alternatives: { orderBy: { order: "asc" } } },
      });
    });

    return NextResponse.json({ question });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "Concurso ou matéria selecionado não existe mais. Atualize a página e escolha outro vínculo." },
          { status: 400 },
        );
      }
      if (e.code === "P2000") {
        return NextResponse.json(
          { error: "Algum campo de texto ou a imagem (base64) excede o limite permitido. Use texto menor ou imagem mais leve." },
          { status: 400 },
        );
      }
    }
    const message = e instanceof Error ? e.message : "Erro ao atualizar questão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;
  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
