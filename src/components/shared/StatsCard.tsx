import { cn } from "@/lib/utils/cn";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: { value: number; label: string };
  accent?: string;
  className?: string;
}

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  accent = "#7C3AED",
  className,
}: StatsCardProps) {
  const trendPositive = (trend?.value ?? 0) >= 0;

  return (
    <div className={cn("stat-widget group", className)}>
      <div
        className="absolute left-0 right-0 top-0 h-[3px] opacity-95"
        style={{
          background: `linear-gradient(90deg, ${accent} 0%, ${accent}99 55%, transparent 100%)`,
          borderRadius: "22px 22px 0 0",
        }}
      />

      <div className="relative z-[1] flex items-start justify-between gap-4" style={{ marginTop: 6 }}>
        <div className="min-w-0 flex-1">
          <p
            className="text-[12px] font-semibold uppercase tracking-[0.07em] text-[#8B92A0]"
          >
            {title}
          </p>
          <p
            className="mt-3 text-[clamp(1.85rem,3.2vw,2.65rem)] font-extrabold leading-none tracking-tight text-[#111827]"
          >
            {value}
          </p>
          {description && (
            <p className="mt-2.5 text-[13.5px] leading-snug text-[#5B6472]">{description}</p>
          )}
          {trend && (
            <div className="mt-2.5 flex items-center gap-1.5">
              {trendPositive ? (
                <TrendingUp className="h-3 w-3 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span
                className={cn(
                  "text-[11.5px] font-semibold",
                  trendPositive ? "text-emerald-600" : "text-red-600",
                )}
              >
                {trendPositive ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-[11.5px] text-[#9CA3AF]">{trend.label}</span>
            </div>
          )}
        </div>

        {icon && (
          <div
            className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-[1.04]"
            style={{
              background: `linear-gradient(145deg, ${accent}18 0%, ${accent}0d 100%)`,
              border: `1px solid ${accent}28`,
              boxShadow: `0 1px 0 rgba(255,255,255,0.85) inset, 0 6px 16px ${accent}14`,
              color: accent,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
