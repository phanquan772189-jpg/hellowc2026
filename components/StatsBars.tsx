import LogoMark from "@/components/LogoMark";
import type { MatchStatistic } from "@/lib/api";

function parseVal(value: number | string | null): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  return parseFloat(value.toString().replace("%", "")) || 0;
}

const LABEL: Record<string, string> = {
  "Ball Possession": "Kiểm soát bóng",
  "Total Shots": "Tổng cú sút",
  "Shots on Goal": "Sút trúng đích",
  "Shots off Goal": "Sút trượt",
  "Blocked Shots": "Sút bị chặn",
  "Total Passes": "Tổng đường chuyền",
  "Passes Accurate": "Chuyền chính xác",
  "Passes %": "Tỷ lệ chuyền (%)",
  Fouls: "Phạm lỗi",
  "Yellow Cards": "Thẻ vàng",
  "Red Cards": "Thẻ đỏ",
  "Goalkeeper Saves": "Cứu thua",
  "Corner Kicks": "Phạt góc",
  Offsides: "Việt vị",
  expected_goals: "xG (cơ hội)",
};

function StatRow({
  type,
  homeVal,
  awayVal,
}: {
  type: string;
  homeVal: number | string | null;
  awayVal: number | string | null;
}) {
  const home = parseVal(homeVal);
  const away = parseVal(awayVal);
  const total = home + away;
  const homePct = total === 0 ? 50 : Math.round((home / total) * 100);
  const awayPct = total === 0 ? 50 : 100 - homePct;
  const homeLead = home > away;
  const awayLead = away > home;
  const label = LABEL[type] ?? type;

  const format = (value: number | string | null) =>
    value === null ? "—" : typeof value === "string" ? value : String(value);

  return (
    <div className="rounded-[24px] border border-white/10 bg-black/10 px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`w-14 text-sm font-semibold tabular-nums ${homeLead ? "text-white" : "text-slate-400"}`}>
          {format(homeVal)}
        </span>
        <span className="flex-1 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {label}
        </span>
        <span className={`w-14 text-right text-sm font-semibold tabular-nums ${awayLead ? "text-white" : "text-slate-400"}`}>
          {format(awayVal)}
        </span>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_24px_minmax(0,1fr)] items-center gap-2">
        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={`stat-bar-fill ml-auto h-full ${homeLead ? "bg-gradient-to-l from-emerald-300 to-emerald-500" : "bg-emerald-500/70"}`}
              style={{ width: `${homePct}%` }}
            />
          </div>
        </div>

        <div className="text-center text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">VS</div>

        <div className="flex-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div
              className={`stat-bar-fill h-full ${awayLead ? "bg-gradient-to-r from-sky-300 to-sky-500" : "bg-sky-500/70"}`}
              style={{ width: `${awayPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const PRIORITY = [
  "Ball Possession",
  "Total Shots",
  "Shots on Goal",
  "expected_goals",
  "Total Passes",
  "Passes Accurate",
  "Passes %",
  "Corner Kicks",
  "Fouls",
  "Offsides",
  "Yellow Cards",
  "Red Cards",
  "Goalkeeper Saves",
];

interface Props {
  stats: MatchStatistic[];
}

export default function StatsBars({ stats }: Props) {
  if (!stats || stats.length < 2) {
    return (
      <div className="px-4 py-12 text-center text-sm text-slate-400 sm:px-6">
        Chưa có thống kê cho trận đấu này.
      </div>
    );
  }

  const [home, away] = stats;
  const map: Record<string, { h: number | string | null; a: number | string | null }> = {};

  home.statistics.forEach((stat) => {
    map[stat.type] = { h: stat.value, a: null };
  });

  away.statistics.forEach((stat) => {
    if (map[stat.type]) {
      map[stat.type].a = stat.value;
    } else {
      map[stat.type] = { h: null, a: stat.value };
    }
  });

  const sorted = [
    ...PRIORITY.filter((key) => map[key]),
    ...Object.keys(map).filter((key) => !PRIORITY.includes(key)),
  ];

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
              <LogoMark src={home.team.logo} alt="" size={26} />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300/80">Home</p>
              <p className="text-sm font-semibold text-white">{home.team.name}</p>
            </div>
          </div>

          <div className="text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Match stats</p>
            <p className="mt-1 text-xs text-slate-400">So sánh các chỉ số quan trọng giữa hai đội.</p>
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-300/80">Away</p>
              <p className="text-sm font-semibold text-white">{away.team.name}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
              <LogoMark src={away.team.logo} alt="" size={26} />
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {sorted.map((type) => (
            <StatRow key={type} type={type} homeVal={map[type].h} awayVal={map[type].a} />
          ))}
        </div>
      </div>
    </div>
  );
}
