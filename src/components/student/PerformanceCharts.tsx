"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

interface DayData {
  day: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface PerformanceChartProps {
  data: DayData[];
}

const DAYS_BR = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as DayData;
  return (
    <div className="rounded-xl border border-black/[0.08] bg-white px-4 py-3 shadow-lg">
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.07em] text-gray-500">{label}</p>
      <p className="text-[13px] font-semibold text-gray-800">{d.total} questões respondidas</p>
      <p className="text-[13px] font-semibold text-emerald-600">{d.correct} acertos</p>
      {d.total > 0 && (
        <p className="mt-1 text-[12px] font-bold text-violet-600">{d.accuracy}% de acerto</p>
      )}
    </div>
  );
}

export function WeeklyPerformanceChart({ data }: PerformanceChartProps) {
  if (data.every((d) => d.total === 0)) {
    return (
      <div className="flex h-[160px] items-center justify-center">
        <p className="text-[13px] text-gray-400">Nenhuma questão respondida esta semana</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#9CA3AF", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#D1D5DB" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139, 92, 246, 0.06)" }} />
        <Bar dataKey="correct" radius={[4, 4, 0, 0]} fill="#8B5CF6" maxBarSize={32} />
        <Bar dataKey="total" radius={[4, 4, 0, 0]} fill="#E5E7EB" maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AccuracyTrendChart({ data }: PerformanceChartProps) {
  const filtered = data.filter((d) => d.total > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center">
        <p className="text-[12px] text-gray-400">Sem dados</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
        <defs>
          <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#9CA3AF" }} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#D1D5DB" }} axisLine={false} tickLine={false} unit="%" />
        <Tooltip
          formatter={(value: number) => [`${value}%`, "Acerto"]}
          contentStyle={{ borderRadius: 10, border: "1px solid #E5E7EB", fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="accuracy"
          stroke="#8B5CF6"
          strokeWidth={2.5}
          fill="url(#accuracyGrad)"
          dot={{ r: 3, fill: "#8B5CF6", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#7C3AED" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
