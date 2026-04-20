import { format, formatDistanceToNow, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatDate(date: Date | string, pattern = "dd/MM/yyyy") {
  return format(new Date(date), pattern, { locale: ptBR });
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export function formatRelative(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: ptBR });
}

export function daysUntil(date: Date | string): number {
  return differenceInDays(new Date(date), new Date());
}

export function isExpired(date: Date | string): boolean {
  return isPast(new Date(date));
}

export function formatCountdown(targetDate: Date | string): string {
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
