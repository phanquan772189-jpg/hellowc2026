import Image from "next/image";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import { getTopPlayersFromDB, type DbTopPlayer } from "@/lib/db-queries";

// ─── Types ────────────────────────────────────────────────────────────────────

type StatType = "scorer" | "assist" | "yellowcard";
export type TopPlayersTabId = "scorers" | "assists" | "cards";

const TABS: {
  id: TopPlayersTabId;
  statType: StatType;
  label: string;
  valueLabel: string;
}[] = [
  { id: "scorers",  statType: "scorer",     label: "Vua phá lưới", valueLabel: "Bàn"      },
  { id: "assists",  statType: "assist",     label: "Kiến tạo",     valueLabel: "Kiến tạo" },
  { id: "cards",    statType: "yellowcard", label: "Thẻ phạt",     valueLabel: "Thẻ vàng" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default async function TopPlayersWidget({
  leagueId,
  season,
  activeTab = "scorers",
}: {
  leagueId: number;
  season: number;
  activeTab?: TopPlayersTabId;
}) {
  const currentTab = TABS.find((t) => t.id === activeTab) ?? TABS[0];
  const players: DbTopPlayer[] = await getTopPlayersFromDB(
    leagueId,
    season,
    currentTab.statType
  ).catch(() => []);

  return (
    <aside className="site-panel overflow-hidden">
      {/* Header */}
      <div
        className="border-b border-white/10 px-4 py-3"
        style={{
          background:
            "linear-gradient(135deg, rgba(251,146,60,0.14), rgba(56,189,248,0.08) 60%, rgba(255,255,255,0.02))",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Thống kê cầu thủ
        </p>
        <h2 className="mt-1.5 text-lg font-bold text-white">Top Cầu Thủ</h2>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-white/10">
        {TABS.map((tab) => (
          <Link
            key={tab.id}
            href={`?tab=${tab.id}`}
            scroll={false}
            className={`flex-1 px-2 py-2.5 text-center text-[11px] font-semibold transition ${
              currentTab.id === tab.id
                ? "border-b-2 border-orange-400 text-orange-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {/* Player list */}
      <div className="divide-y divide-white/[0.06]">
        {players.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            Đang cập nhật dữ liệu…
          </p>
        ) : (
          players.map((p) => (
            <div
              key={p.player.id}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
            >
              {/* Rank */}
              <span className="w-5 shrink-0 text-center text-sm font-bold text-slate-500">
                {p.rank}
              </span>

              {/* Avatar */}
              <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
                {p.player.photo_url ? (
                  <Image
                    src={p.player.photo_url}
                    alt={p.player.name}
                    fill
                    className="object-cover"
                    sizes="36px"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                    ?
                  </span>
                )}
              </div>

              {/* Name + team */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{p.player.name}</p>
                {p.team && (
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <LogoMark src={p.team.logo_url ?? ""} alt="" size={12} />
                    <span className="truncate text-[11px] text-slate-400">{p.team.name}</span>
                  </div>
                )}
              </div>

              {/* Stat value */}
              <div className="flex shrink-0 flex-col items-center">
                <span className="text-lg font-black text-white">{p.stat_value}</span>
                <span className="text-[9px] text-slate-500">{currentTab.valueLabel}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
