import Image from "next/image";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import { apiFetch, buildQuery } from "@/lib/api";

type TabId = "scorers" | "assists" | "cards";

interface TopPlayer {
  player: { id: number; name: string; nationality: string; photo: string };
  statistics: {
    team: { id: number; name: string; logo: string };
    games: { appearances: number };
    goals: { total: number | null; assists: number | null };
    cards: { yellow: number; red: number };
  }[];
}

const TABS: { id: TabId; label: string; endpoint: string; valueKey: string; valueLabel: string }[] = [
  {
    id: "scorers",
    label: "Vua phá lưới",
    endpoint: "/players/topscorers",
    valueKey: "goals",
    valueLabel: "Bàn",
  },
  {
    id: "assists",
    label: "Kiến tạo",
    endpoint: "/players/topassists",
    valueKey: "assists",
    valueLabel: "Kiến tạo",
  },
  {
    id: "cards",
    label: "Thẻ phạt",
    endpoint: "/players/topyellowcards",
    valueKey: "cards",
    valueLabel: "Thẻ vàng",
  },
];

function getStatValue(player: TopPlayer, valueKey: string): number {
  const stats = player.statistics[0];
  if (!stats) return 0;
  if (valueKey === "goals") return stats.goals.total ?? 0;
  if (valueKey === "assists") return stats.goals.assists ?? 0;
  if (valueKey === "cards") return stats.cards.yellow;
  return 0;
}

export type TopPlayersTabId = TabId;

export default async function TopPlayersWidget({
  leagueId,
  season,
  activeTab = "scorers",
}: {
  leagueId: number;
  season: number;
  activeTab?: TabId;
}) {
  const currentTab = TABS.find((tab) => tab.id === activeTab) ?? TABS[0];
  let players: TopPlayer[] = [];
  let error: string | null = null;

  try {
    const data = await apiFetch<TopPlayer[]>(
      `${currentTab.endpoint}${buildQuery({ league: leagueId, season })}`
    );
    players = data.slice(0, 10);
  } catch (err: unknown) {
    error = err instanceof Error ? err.message : "Lỗi tải dữ liệu";
  }

  return (
    <aside className="site-panel overflow-hidden">
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

      <div className="divide-y divide-white/[0.06]">
        {error ? (
          <p className="px-4 py-6 text-center text-sm text-red-400">{error}</p>
        ) : players.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-slate-400">Chưa có dữ liệu.</p>
        ) : (
          players.map((player, index) => {
            const value = getStatValue(player, currentTab.valueKey);
            const team = player.statistics[0]?.team;

            return (
              <div
                key={player.player.id}
                className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
              >
                <span className="w-5 text-center text-sm font-bold text-slate-500">{index + 1}</span>

                <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
                  {player.player.photo ? (
                    <Image
                      src={player.player.photo}
                      alt={player.player.name}
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

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{player.player.name}</p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {team ? (
                      <>
                        <LogoMark src={team.logo} alt="" size={12} />
                        <span className="truncate text-[11px] text-slate-400">{team.name}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-lg font-black text-white">{value}</span>
                  <span className="text-[9px] text-slate-500">{currentTab.valueLabel}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
