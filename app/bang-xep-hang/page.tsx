import type { Metadata } from "next";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import {
  formatSeasonLabel,
  getLeagueCurrentRound,
  getTrackedLeaguesFromDB,
  type DbStanding,
  type DbTrackedLeague,
} from "@/lib/db-queries";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng xếp hạng các giải đang theo dõi",
  description:
    "Tổng hợp bảng xếp hạng của các giải lớn như Premier League, La Liga, Bundesliga, Serie A và World Cup 2026. Có link đi thẳng sang vòng đấu hiện tại của từng giải.",
  alternates: { canonical: "/bang-xep-hang" },
};

function SnapshotMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 score text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

type LeagueCardData = {
  league: DbTrackedLeague;
  standings: DbStanding[];
  currentRound: string | null;
};

function LeagueAnchorNav({ leagues }: { leagues: LeagueCardData[] }) {
  return (
    <div className="site-panel px-5 py-5">
      <span className="section-label">Đi nhanh theo giải</span>
      <div className="mt-4 flex flex-wrap gap-2">
        {leagues.map(({ league, standings }) => (
          <a
            key={league.id}
            href={`#league-${league.id}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              standings.length > 0
                ? "border-white/10 bg-white/[0.06] text-slate-200 hover:border-white/20 hover:bg-white/[0.10]"
                : "border-orange-300/20 bg-orange-500/10 text-orange-100 hover:bg-orange-500/15"
            }`}
          >
            {league.name}
          </a>
        ))}
      </div>
    </div>
  );
}

function LeagueStandingsCard({ item }: { item: LeagueCardData }) {
  const { league, standings, currentRound } = item;
  const previewRows = standings.slice(0, 8);
  const seasonLabel = formatSeasonLabel(league.season_year, league.season_start_date, league.season_end_date);

  return (
    <article id={`league-${league.id}`} className="site-panel scroll-mt-28 overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            standings.length > 0
              ? "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))"
              : "linear-gradient(135deg, rgba(251,146,60,0.16), rgba(56,189,248,0.08) 65%, rgba(255,255,255,0.02))",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
            <LogoMark src={league.logo_url ?? ""} alt="" size={22} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="fact-chip">{league.country?.name ?? "Quốc tế"}</span>
              {seasonLabel ? <span className="fact-chip">Mùa {seasonLabel}</span> : null}
              {currentRound ? <span className="fact-chip">{currentRound}</span> : null}
            </div>
            <h2 className="mt-3 truncate text-xl font-bold text-white">{league.name}</h2>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            <Link href={`/league/${league.id}?section=standings`} className="text-sm font-semibold text-orange-200 transition hover:text-white">
              BXH / Bảng đấu
            </Link>
            <Link href={`/league/${league.id}?section=fixtures`} className="text-sm font-semibold text-slate-300 transition hover:text-white">
              Vòng hiện tại
            </Link>
          </div>
        </div>
      </div>

      {previewRows.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-slate-400">Bảng xếp hạng sẽ cập nhật sau vòng đấu đầu tiên.</p>
          <Link href={`/league/${league.id}?section=fixtures`} className="action-secondary mt-4 inline-flex text-xs">
            Xem lịch thi đấu
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-500">
                <th className="w-8 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">#</th>
                <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">Đội</th>
                <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">Đ</th>
                <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">HS</th>
                <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">PT</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.map((entry) => (
                <tr key={`${entry.league_id}-${entry.team_id}`} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-sm text-slate-400">{entry.rank}</td>
                  <td className="py-3 pr-2">
                    <div className="flex items-center gap-2">
                      <LogoMark src={entry.team.logo_url ?? ""} alt="" size={18} />
                      <span className="truncate font-medium text-white">{entry.team.name}</span>
                    </div>
                  </td>
                  <td className="py-3 text-center text-slate-300">{entry.played}</td>
                  <td className={`py-3 text-center ${entry.goals_diff > 0 ? "text-emerald-300" : entry.goals_diff < 0 ? "text-red-300" : "text-slate-500"}`}>
                    {entry.goals_diff > 0 ? `+${entry.goals_diff}` : entry.goals_diff}
                  </td>
                  <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export default async function StandingsOverviewPage() {
  const leagues = await getTrackedLeaguesFromDB();
  const seasonByLeague = new Map(
    leagues.filter((league) => league.season_year).map((league) => [league.id, league.season_year as number])
  );

  const standingsRes = await getSupabaseAdmin()
    .from("standings")
    .select(
      [
        "league_id",
        "season_year",
        "team_id",
        "rank",
        "points",
        "goals_diff",
        "played",
        "win",
        "draw",
        "lose",
        "form",
        "team:teams!team_id(id,name,logo_url)",
      ].join(",")
    )
    .in("league_id", leagues.map((league) => league.id))
    .order("league_id", { ascending: true })
    .order("rank", { ascending: true });

  const rawStandings = standingsRes.error ? [] : ((standingsRes.data ?? []) as unknown as DbStanding[]);
  const standingsByLeague = new Map<number, DbStanding[]>();

  for (const row of rawStandings) {
    const expectedSeason = seasonByLeague.get(row.league_id);
    if (!expectedSeason || row.season_year !== expectedSeason) continue;

    const existing = standingsByLeague.get(row.league_id) ?? [];
    existing.push(row);
    standingsByLeague.set(row.league_id, existing);
  }

  const currentRounds = await Promise.all(
    leagues.map(async (league) => ({
      leagueId: league.id,
      round: league.season_year ? await getLeagueCurrentRound(league.id, league.season_year) : null,
    }))
  );
  const currentRoundByLeague = new Map(currentRounds.map((item) => [item.leagueId, item.round]));

  const cards = leagues
    .map((league) => ({
      league,
      standings: standingsByLeague.get(league.id) ?? [],
      currentRound: currentRoundByLeague.get(league.id) ?? null,
    }))
    .sort((left, right) => {
      const leftHasStandings = left.standings.length > 0 ? 0 : 1;
      const rightHasStandings = right.standings.length > 0 ? 0 : 1;
      if (leftHasStandings !== rightHasStandings) return leftHasStandings - rightHasStandings;
      return left.league.name.localeCompare(right.league.name);
    });

  const leaguesWithStandings = cards.filter((card) => card.standings.length > 0).length;
  const totalTeams = cards.reduce((sum, card) => sum + card.standings.length, 0);

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      <section className="site-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 30%), radial-gradient(circle at right center, rgba(251,146,60,0.12), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        />

        <div className="relative">
          <span className="section-label">Bảng xếp hạng</span>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="fact-chip">Premier League, La Liga, Bundesliga, Serie A...</span>
            <span className="fact-chip">Có lối tắt sang vòng đấu hiện tại của từng giải</span>
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
            Bảng xếp hạng các giải lớn
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Theo dõi thứ hạng các đội ở Premier League, La Liga, Bundesliga, Serie A và World Cup 2026. Cập nhật sau mỗi vòng đấu.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <SnapshotMetric label="Giải có BXH" value={leaguesWithStandings} hint="Giải đang có dữ liệu bảng xếp hạng." />
            <SnapshotMetric label="Tổng đội" value={totalTeams} hint="Câu lạc bộ và đội tuyển đang được theo dõi." />
            <SnapshotMetric label="Giải theo dõi" value={cards.length} hint="Giải đấu được cập nhật thường xuyên." />
          </div>
        </div>
      </section>

      <div className="mt-6">
        <LeagueAnchorNav leagues={cards} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {cards.map((item) => (
          <LeagueStandingsCard key={item.league.id} item={item} />
        ))}
      </div>
    </div>
  );
}
