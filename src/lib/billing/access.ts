export type AccessStatus =
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "GRACE_PERIOD"
  | "BLOCKED";

export function getAccessStatus(input: {
  accessExpiresAt: Date | string | null | undefined;
  now?: Date;
  warnDays?: number;
  graceDays?: number;
}) {
  const now = input.now ?? new Date();
  const warnDays = input.warnDays ?? 3;
  const graceDays = input.graceDays ?? 3;

  if (!input.accessExpiresAt) {
    return { status: "BLOCKED" as const, expiresAt: null as Date | null, daysToExpire: null as number | null, daysInGrace: null as number | null };
  }

  const expiresAt = input.accessExpiresAt instanceof Date ? input.accessExpiresAt : new Date(input.accessExpiresAt);
  if (isNaN(expiresAt.getTime())) {
    return { status: "BLOCKED" as const, expiresAt: null as Date | null, daysToExpire: null as number | null, daysInGrace: null as number | null };
  }

  const msLeft = expiresAt.getTime() - now.getTime();
  const daysToExpire = Math.ceil(msLeft / 86400000);

  if (msLeft >= 0) {
    if (daysToExpire <= warnDays) {
      return { status: "EXPIRING_SOON" as const, expiresAt, daysToExpire, daysInGrace: null as number | null };
    }
    return { status: "ACTIVE" as const, expiresAt, daysToExpire, daysInGrace: null as number | null };
  }

  // Expirado
  const daysExpired = Math.ceil(Math.abs(msLeft) / 86400000);
  if (daysExpired <= graceDays) {
    return { status: "GRACE_PERIOD" as const, expiresAt, daysToExpire: 0, daysInGrace: graceDays - daysExpired + 1 };
  }

  return { status: "BLOCKED" as const, expiresAt, daysToExpire: 0, daysInGrace: 0 };
}

