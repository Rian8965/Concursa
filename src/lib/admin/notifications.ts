import { prisma } from "@/lib/db/prisma";

export async function createAdminNotification(input: {
  type: "SUPPORT_TICKET_CREATED" | "QUESTION_REPORTED" | "PAYMENT_STUDENT_CREATED" | "SYSTEM";
  title: string;
  body?: string | null;
  href?: string | null;
  meta?: unknown;
}) {
  try {
    await prisma.adminNotification.create({
      data: {
        type: input.type as any,
        title: input.title,
        body: input.body ?? null,
        href: input.href ?? null,
        meta: (input.meta ?? null) as any,
      },
    });
  } catch (e) {
    console.error("[admin-notifications] create failed", e);
  }
}

