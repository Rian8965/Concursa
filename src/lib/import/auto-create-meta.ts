import type { PrismaClient } from "@prisma/client";

function makeSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(
  base: string,
  check: (s: string) => Promise<boolean>,
): Promise<string> {
  let slug = base || "registro";
  for (let n = 2; n <= 60; n++) {
    if (!(await check(slug))) return slug;
    slug = `${base}-${n}`;
  }
  return `${base}-${Date.now()}`;
}

/** Normalise AI text for display (trim + collapse spaces). */
function normaliseText(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject
// ─────────────────────────────────────────────────────────────────────────────

export async function findOrCreateSubject(
  name: string,
  prisma: PrismaClient,
): Promise<string | null> {
  const t = normaliseText(name);
  if (!t) return null;

  const existing = await prisma.subject.findFirst({
    where: { name: { equals: t, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const base = makeSlug(t);
  const slug = await uniqueSlug(base, async (s) =>
    Boolean(await prisma.subject.findUnique({ where: { slug: s }, select: { id: true } })),
  );

  try {
    const created = await prisma.subject.create({
      data: { name: t, slug, isActive: true },
      select: { id: true },
    });
    return created.id;
  } catch {
    const retry = await prisma.subject.findFirst({
      where: { name: { equals: t, mode: "insensitive" } },
      select: { id: true },
    });
    return retry?.id ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Topic (assunto)
// ─────────────────────────────────────────────────────────────────────────────

export async function findOrCreateTopic(
  name: string,
  subjectId: string,
  prisma: PrismaClient,
): Promise<string | null> {
  const t = normaliseText(name);
  if (!t || !subjectId) return null;

  const existing = await prisma.topic.findFirst({
    where: { subjectId, name: { equals: t, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const base = makeSlug(t);
  const slug = await uniqueSlug(base, async (s) =>
    Boolean(
      await prisma.topic.findFirst({ where: { slug: s, subjectId }, select: { id: true } }),
    ),
  );

  try {
    const created = await prisma.topic.create({
      data: { name: t, slug, subjectId, isActive: true },
      select: { id: true },
    });
    return created.id;
  } catch {
    const retry = await prisma.topic.findFirst({
      where: { subjectId, name: { equals: t, mode: "insensitive" } },
      select: { id: true },
    });
    return retry?.id ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ExamBoard (banca)
// ─────────────────────────────────────────────────────────────────────────────

export async function findOrCreateExamBoard(
  text: string,
  prisma: PrismaClient,
): Promise<string | null> {
  const t = normaliseText(text);
  if (!t) return null;

  // Derive acronym: first token of all-caps or first alphabetic word
  const firstToken = t.split(/[\s·|/,\-–—(]+/)[0] ?? "";
  const acronym = firstToken.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20) || t.slice(0, 20).toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (acronym) {
    const byAcronym = await prisma.examBoard.findUnique({
      where: { acronym },
      select: { id: true },
    });
    if (byAcronym) return byAcronym.id;
  }

  const byName = await prisma.examBoard.findFirst({
    where: { name: { equals: t, mode: "insensitive" } },
    select: { id: true },
  });
  if (byName) return byName.id;

  const safeAcronym = acronym || t.slice(0, 20).replace(/[^A-Z0-9]/gi, "").toUpperCase();
  try {
    const created = await prisma.examBoard.create({
      data: { name: t, acronym: safeAcronym, isActive: true },
      select: { id: true },
    });
    return created.id;
  } catch {
    const retry = await prisma.examBoard.findUnique({
      where: { acronym: safeAcronym },
      select: { id: true },
    });
    return retry?.id ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// City
// ─────────────────────────────────────────────────────────────────────────────

export async function findOrCreateCity(
  nameWithState: string,
  prisma: PrismaClient,
): Promise<string | null> {
  const t = normaliseText(nameWithState);
  if (!t) return null;

  // Parse "Brasília - DF", "Brasília/DF", "Brasília (DF)", "Brasília"
  const m = t.match(/^(.+?)[\s]*[-–/\\(][\s]*([A-Z]{2})[\s)]*$/);
  const cityName = normaliseText(m?.[1] ?? t);
  const state = (m?.[2] ?? "").toUpperCase();

  const existing = state
    ? await prisma.city.findFirst({
        where: { name: { equals: cityName, mode: "insensitive" }, state },
        select: { id: true },
      })
    : await prisma.city.findFirst({
        where: { name: { equals: cityName, mode: "insensitive" } },
        select: { id: true },
      });
  if (existing) return existing.id;

  try {
    const created = await prisma.city.create({
      data: { name: cityName, state: state || "XX", isActive: true },
      select: { id: true },
    });
    return created.id;
  } catch {
    const retry = await prisma.city.findFirst({
      where: { name: { equals: cityName, mode: "insensitive" } },
      select: { id: true },
    });
    return retry?.id ?? null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// JobRole (cargo)
// ─────────────────────────────────────────────────────────────────────────────

export async function findOrCreateJobRole(
  name: string,
  prisma: PrismaClient,
): Promise<string | null> {
  const t = normaliseText(name);
  if (!t) return null;

  const existing = await prisma.jobRole.findFirst({
    where: { name: { equals: t, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const base = makeSlug(t);
  const slug = await uniqueSlug(base, async (s) =>
    Boolean(await prisma.jobRole.findUnique({ where: { slug: s }, select: { id: true } })),
  );

  try {
    const created = await prisma.jobRole.create({
      data: { name: t, slug, isActive: true },
      select: { id: true },
    });
    return created.id;
  } catch {
    const retry = await prisma.jobRole.findFirst({
      where: { name: { equals: t, mode: "insensitive" } },
      select: { id: true },
    });
    return retry?.id ?? null;
  }
}
