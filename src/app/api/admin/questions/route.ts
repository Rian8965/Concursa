import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getQuestionOptionalLinkColumns } from "@/lib/db/questions-table-columns";
import { Prisma } from "@prisma/client";
import type { Difficulty } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";

function isAdmin(r?: string) { return r === "ADMIN" || r === "SUPER_ADMIN"; }

type QuestionCreateBody = {
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

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "25");
  const search = searchParams.get("search") ?? "";
  const competitionId = searchParams.get("competitionId") ?? undefined;
  const subjectId = searchParams.get("subjectId") ?? undefined;
  const examBoardId = searchParams.get("examBoardId") ?? undefined;
  const cityId = searchParams.get("cityId") ?? undefined;
  const jobRoleId = searchParams.get("jobRoleId") ?? undefined;
  const year = searchParams.get("year") ?? undefined;
  const topicId = searchParams.get("topicId") ?? undefined;
  const difficulty = searchParams.get("difficulty") ?? undefined;
  const tag = searchParams.get("tag")?.trim() ?? undefined;
  const status = searchParams.get("status") ?? undefined;

  const searchWhere: Prisma.QuestionWhereInput | undefined = search
    ? {
        OR: [
          { content: { contains: search, mode: "insensitive" } },
          { supportText: { contains: search, mode: "insensitive" } },
          { alternatives: { some: { content: { contains: search, mode: "insensitive" } } } },
        ],
      }
    : undefined;

  // Filtros "de localização" e vínculos: quando a questão ainda não tem metadados oficiais,
  // permitir filtrar pelo que a IA sugeriu.
  const cityWhere: Prisma.QuestionWhereInput | undefined = cityId
    ? { OR: [{ cityId }, { aiMeta: { suggestedCityId: cityId } }] }
    : undefined;
  const examBoardWhere: Prisma.QuestionWhereInput | undefined = examBoardId
    ? { OR: [{ examBoardId }, { aiMeta: { suggestedExamBoardId: examBoardId } }] }
    : undefined;
  const jobRoleWhere: Prisma.QuestionWhereInput | undefined = jobRoleId
    ? { OR: [{ jobRoleId }, { aiMeta: { suggestedJobRoleId: jobRoleId } }] }
    : undefined;
  const subjectWhere: Prisma.QuestionWhereInput | undefined = subjectId
    ? { OR: [{ subjectId }, { aiMeta: { suggestedSubjectId: subjectId } }] }
    : undefined;
  const topicWhere: Prisma.QuestionWhereInput | undefined = topicId
    ? { OR: [{ topicId }, { aiMeta: { suggestedTopicId: topicId } }] }
    : undefined;

  const where: Prisma.QuestionWhereInput = {
    ...(searchWhere ? searchWhere : {}),
    ...(competitionId ? { competitionId } : {}),
    ...(difficulty && (difficulty === "EASY" || difficulty === "MEDIUM" || difficulty === "HARD") ? { difficulty } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(year ? { year: parseYear(year) ?? undefined } : {}),
    ...(status ? { status } : {}),
    AND: [
      ...(subjectWhere ? [subjectWhere] : []),
      ...(topicWhere ? [topicWhere] : []),
      ...(examBoardWhere ? [examBoardWhere] : []),
      ...(cityWhere ? [cityWhere] : []),
      ...(jobRoleWhere ? [jobRoleWhere] : []),
    ],
  };

  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: {
        subject: { select: { name: true } },
        topic: { select: { name: true } },
        competition: { select: { name: true } },
        examBoard: { select: { acronym: true } },
        city: { select: { name: true, state: true } },
        jobRole: { select: { name: true } },
        aiMeta: {
          select: {
            confidence: true,
            suggestedYear: true,
            subject: { select: { name: true } },
            topic: { select: { name: true } },
            examBoard: { select: { acronym: true } },
            city: { select: { name: true, state: true } },
            jobRole: { select: { name: true } },
          },
        },
        alternatives: { orderBy: { order: "asc" } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: (page - 1) * limit,
    }),
    prisma.question.count({ where }),
  ]);

  return NextResponse.json({ questions, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session.user.role)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let body: QuestionCreateBody;
  try {
    body = (await req.json()) as QuestionCreateBody;
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
    const linkCols = await getQuestionOptionalLinkColumns(prisma);
    const question = await prisma.question.create({
      data: {
        content,
        supportText: typeof supportText === "string" && supportText.trim() ? supportText.trim() : null,
        competitionId: optRelationId(competitionId),
        subjectId: optRelationId(subjectId),
        topicId: optRelationId(topicId),
        examBoardId: optRelationId(examBoardId),
        ...(linkCols.hasCityId ? { cityId: optRelationId(cityId) } : {}),
        ...(linkCols.hasJobRoleId ? { jobRoleId: optRelationId(jobRoleId) } : {}),
        difficulty: parseDifficulty(difficulty),
        year: parseYear(year),
        correctAnswer,
        hasImage: Boolean(hasImage && imageUrl),
        imageUrl: typeof imageUrl === "string" && imageUrl.length > 0 ? imageUrl : null,
        status: "ACTIVE",
        alternatives: {
          create: alternatives.map((a, i) => ({
            letter: a.letter,
            content: a.content,
            order: i + 1,
          })),
        },
      },
      include: { alternatives: { orderBy: { order: "asc" } }, subject: { select: { name: true } } },
    });

    return NextResponse.json({ question }, { status: 201 });
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
    const message = e instanceof Error ? e.message : "Erro ao criar questão";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
