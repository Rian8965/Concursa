"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";
import type { TooltipValueType } from "recharts";

/** Recharts `ValueType` can be a scalar or a readonly array — normalize for display. */
function formatAccuracyTooltipPercent(value: TooltipValueType | undefined): string {
  if (value == null) return "0%";
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw == null || raw === "") return "0%";
  return `${raw}%`;
}

interface DayData {
  day: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface PerformanceChartProps {
  data: DayData[];
}

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
      <div className="flex h-[210px] items-center justify-center">
        <p className="text-[13px] text-gray-400">Nenhuma questão respondida esta semana</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11.5, fill: "#94A3B8", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          tick={{ fontSize: 10.5, fill: "#CBD5E1" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(139, 92, 246, 0.06)" }} />
        <Bar dataKey="correct" radius={[6, 6, 0, 0]} fill="#8B5CF6" maxBarSize={28} />
        <Bar dataKey="total" radius={[6, 6, 0, 0]} fill="#E5E7EB" maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AccuracyTrendChart({ data }: PerformanceChartProps) {
  const filtered = data.filter((d) => d.total > 0);
  if (filtered.length === 0) {
    return (
      <div className="flex h-[210px] items-center justify-center">
        <p className="text-[12.5px] text-gray-400">Sem dados de acerto ainda</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={210}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
        <defs>
          <linearGradient id="accuracyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          dy={6}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10.5, fill: "#CBD5E1" }}
          axisLine={false}
          tickLine={false}
          unit="%"
        />
        <Tooltip
          formatter={(value) => [formatAccuracyTooltipPercent(value), "Acerto"]}
          contentStyle={{ borderRadius: 12, border: "1px solid #E5E7EB", fontSize: 12, padding: "8px 12px" }}
        />
        <Area
          type="monotone"
          dataKey="accuracy"
          stroke="#8B5CF6"
          strokeWidth={2.5}
          fill="url(#accuracyGrad)"
          dot={{ r: 3.5, fill: "#8B5CF6", strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "#7C3AED" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
