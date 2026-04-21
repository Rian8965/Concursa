type Props = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
};

function StatCard({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-black/[0.06] bg-gradient-to-br from-white to-[#fafafd] px-4 py-4 shadow-sm sm:px-5 sm:py-4">
      <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{label}</div>
      <div className={`mt-2 text-2xl font-extrabold tabular-nums tracking-tight ${valueClass}`}>{value}</div>
    </div>
  );
}

export function StatsRow({ total, approved, rejected, pending }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:gap-4">
      <StatCard label="Total" value={total} valueClass="text-[var(--text-primary)]" />
      <StatCard label="Aprovadas" value={approved} valueClass="text-emerald-700" />
      <StatCard label="Rejeitadas" value={rejected} valueClass="text-red-700" />
      <StatCard label="Pendentes" value={pending} valueClass="text-amber-700" />
    </div>
  );
}

