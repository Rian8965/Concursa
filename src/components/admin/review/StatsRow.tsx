type Props = {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
};

export function StatsRow({ total, approved, rejected, pending }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Total</div>
        <div className="mt-1 text-[18px] font-extrabold text-[#111827]">{total}</div>
      </div>
      <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Aprovadas</div>
        <div className="mt-1 text-[18px] font-extrabold text-[#059669]">{approved}</div>
      </div>
      <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Rejeitadas</div>
        <div className="mt-1 text-[18px] font-extrabold text-[#DC2626]">{rejected}</div>
      </div>
      <div className="rounded-[14px] border border-[#E5E7EB] bg-white px-4 py-3">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">Pendentes</div>
        <div className="mt-1 text-[18px] font-extrabold text-[#D97706]">{pending}</div>
      </div>
    </div>
  );
}

