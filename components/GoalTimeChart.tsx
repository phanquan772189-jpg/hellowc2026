"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Dữ liệu từ API-Football: goals.for.minute hoặc goals.against.minute */
export interface GoalMinuteData {
  "0-15"?: { total: number | null; percentage: string | null } | null;
  "16-30"?: { total: number | null; percentage: string | null } | null;
  "31-45"?: { total: number | null; percentage: string | null } | null;
  "46-60"?: { total: number | null; percentage: string | null } | null;
  "61-75"?: { total: number | null; percentage: string | null } | null;
  "76-90"?: { total: number | null; percentage: string | null } | null;
  "91-105"?: { total: number | null; percentage: string | null } | null;
}

export interface GoalTimeChartProps {
  /** Dữ liệu phút ghi bàn từ /teams/statistics (goals.for.minute) */
  minuteData: GoalMinuteData;
  /** Nhãn hiển thị trên chart header */
  label?: string;
  /** Màu cột bar (Tailwind hex hoặc CSS color) */
  color?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MINUTE_ORDER = [
  "0-15",
  "16-30",
  "31-45",
  "46-60",
  "61-75",
  "76-90",
  "91-105",
] as const;

const MINUTE_LABELS: Record<string, string> = {
  "0-15": "0–15'",
  "16-30": "16–30'",
  "31-45": "31–45'",
  "46-60": "46–60'",
  "61-75": "61–75'",
  "76-90": "76–90'",
  "91-105": "90+'",
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface TooltipPayloadItem {
  value: number;
  payload: { minute: string; goals: number; percentage: string };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const { minute, goals, percentage } = payload[0].payload;

  return (
    <div className="rounded-xl border border-white/15 bg-slate-900/95 px-3 py-2.5 shadow-xl backdrop-blur-sm">
      <p className="text-xs font-semibold text-slate-300">{minute}</p>
      <p className="mt-1 text-lg font-black text-white">{goals} bàn</p>
      <p className="text-xs text-slate-400">{percentage}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function GoalTimeChart({
  minuteData,
  label = "Thời điểm ghi bàn",
  color = "#f97316",
}: GoalTimeChartProps) {
  // Chuyển object → array theo thứ tự chuẩn
  const chartData = MINUTE_ORDER.map((key) => {
    const raw = minuteData[key];
    return {
      minute: MINUTE_LABELS[key],
      goals: raw?.total ?? 0,
      percentage: raw?.percentage ?? "0%",
    };
  }).filter((d) => d.goals > 0 || true); // giữ tất cả kể cả 0 để trục X đầy đủ

  const maxGoals = Math.max(...chartData.map((d) => d.goals), 1);

  // Tô màu cột cao nhất đậm hơn
  function getCellOpacity(goals: number): number {
    if (goals === 0) return 0.15;
    return 0.4 + (goals / maxGoals) * 0.6;
  }

  const totalGoals = chartData.reduce((sum, d) => sum + d.goals, 0);

  if (totalGoals === 0) {
    return (
      <div className="flex min-h-[140px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-slate-400">
        Chưa có dữ liệu thời điểm ghi bàn.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Phân tích
          </p>
          <h3 className="mt-1 text-base font-bold text-white">{label}</h3>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-white">{totalGoals}</p>
          <p className="text-[11px] text-slate-500">tổng bàn</p>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
          barCategoryGap="20%"
        >
          <CartesianGrid
            vertical={false}
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
          />
          <XAxis
            dataKey="minute"
            tick={{ fill: "rgb(100,116,139)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "rgb(100,116,139)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.04)", radius: 6 }}
          />
          <Bar dataKey="goals" radius={[6, 6, 0, 0]} maxBarSize={40}>
            {chartData.map((entry, index) => (
              <Cell
                key={index}
                fill={color}
                fillOpacity={getCellOpacity(entry.goals)}
                stroke={entry.goals === maxGoals ? color : "transparent"}
                strokeWidth={1}
                strokeOpacity={0.6}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Highlight: mốc nguy hiểm nhất */}
      {(() => {
        const peak = chartData.reduce((max, d) => (d.goals > max.goals ? d : max), chartData[0]);
        if (!peak || peak.goals === 0) return null;
        return (
          <p className="mt-3 text-center text-xs text-slate-400">
            Nguy hiểm nhất:{" "}
            <span className="font-semibold text-orange-300">{peak.minute}</span>
            {" — "}
            <span className="font-semibold text-white">{peak.goals} bàn</span>
            {" "}({peak.percentage})
          </p>
        );
      })()}
    </div>
  );
}
