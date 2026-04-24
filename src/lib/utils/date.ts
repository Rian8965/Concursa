import { format, formatDistanceToNow, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Returns true if the value can be converted to a valid (non-NaN) Date */
function isValidDate(date: unknown): boolean {
  if (date === null || date === undefined || date === "") return false;
  const d = new Date(date as Date | string | number);
  return !isNaN(d.getTime());
}

export function formatDate(date: Date | string | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!isValidDate(date)) return "—";
  try {
    return format(new Date(date as Date | string), pattern, { locale: ptBR });
  } catch {
    return "—";
  }
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!isValidDate(date)) return "—";
  try {
    return format(new Date(date as Date | string), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return "—";
  }
}

export function formatRelative(date: Date | string | null | undefined): string {
  if (!isValidDate(date)) return "—";
  try {
    return formatDistanceToNow(new Date(date as Date | string), { addSuffix: true, locale: ptBR });
  } catch {
    return "—";
  }
}

export function daysUntil(date: Date | string | null | undefined): number {
  if (!isValidDate(date)) return 0;
  try {
    return differenceInDays(new Date(date as Date | string), new Date());
  } catch {
    return 0;
  }
}

export function isExpired(date: Date | string | null | undefined): boolean {
  if (!isValidDate(date)) return false;
  try {
    return isPast(new Date(date as Date | string));
  } catch {
    return false;
  }
}

export function formatCountdown(targetDate: Date | string | null | undefined): string {
  if (!isValidDate(targetDate)) return "—";
  const days = daysUntil(targetDate);
  if (days < 0) return "Prova realizada";
  if (days === 0) return "Prova hoje!";
  if (days === 1) return "1 dia restante";
  if (days < 30) return `${days} dias restantes`;
  const months = Math.floor(days / 30);
  const remainingDays = days % 30;
  if (remainingDays === 0) return `${months} ${months === 1 ? "mês" : "meses"} restantes`;
  return `${months} ${months === 1 ? "mês" : "meses"} e ${remainingDays} ${remainingDays === 1 ? "dia" : "dias"}`;
}

export function formatSeconds(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
}
