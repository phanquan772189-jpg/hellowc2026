import type { Metadata } from "next";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import {
  getTrackedLeaguesFromDB,
  type DbStanding,
  type DbTrackedLeague,
} from "@/lib/db-queries";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bảng xếp hạng các giải đang theo dõi",
  description:
    "Tổng hợp bảng xếp hạng của các giải đấu đang được KetquaWC.vn theo dõi. Xem nhanh top đội dẫn đầu rồi mở sâu vào trang giải để theo dõi lịch và thống kê.",
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

function LeagueStandingsCard({
  league,
  standings,
}: {
  league: DbTrackedLeague;
  standings: DbStanding[];
}) {
  const previewRows = standings.slice(0, 6);

  return (
    <article className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))",
        }}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
            <LogoMark src={league.logo_url ?? ""} alt="" size={22} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="fact-chip">{league.country?.name ?? "Quốc tế"}</span>
              {league.season_year ? <span className="fact-chip">Mùa {league.season_year}</span> : null}
            </div>
            <h2 className="mt-3 truncate text-xl font-bold text-white">{league.name}</h2>
          </div>

          <Link href={`/league/${league.id}?section=standings`} className="text-sm font-semibold text-orange-200 transition hover:text-white">
            Xem đủ
          </Link>
        </div>
      </div>

      {previewRows.length === 0 ? (
        <div className="px-5 py-8">
          <p className="text-sm leading-7 text-slate-300">
            Chưa có dữ liệu bảng xếp hạng cho giải này ở mùa hiện tại. Trang giải đấu vẫn sẵn sàng để theo dõi lịch khi dữ liệu cập nhật.
          </p>
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
  const seasonByLeague = new Map(leagues.filter((league) => league.season_year).map((league) => [league.id, league.season_year as number]));

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

  const leaguesWithStandings = leagues.filter((league) => (standingsByLeague.get(league.id) ?? []).length > 0).length;
  const totalTeams = [...standingsByLeague.values()].reduce((sum, rows) => sum + rows.length, 0);

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
            <span className="fact-chip">Tổng hợp nhiều giải đấu</span>
            <span className="fact-chip">Mở sâu từng giải khi cần lịch và top cầu thủ</span>
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
            Bảng xếp hạng các giải đang theo dõi
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Đây là lớp tổng quan để quét nhanh đội đầu bảng ở từng giải. Khi cần xem đủ bảng, lịch hoặc top cầu thủ, bạn có thể mở thẳng sang trang giải đấu tương ứng.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <SnapshotMetric label="Giải có BXH" value={leaguesWithStandings} hint="Số giải đã có bảng xếp hạng mùa hiện tại." />
            <SnapshotMetric label="Tổng đội" value={totalTeams} hint="Số CLB/đội tuyển đang hiện diện trong các bảng." />
            <SnapshotMetric label="Giải theo dõi" value={leagues.length} hint="Danh mục giải được sync trong hệ thống." />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        {leagues.map((league) => (
          <LeagueStandingsCard key={league.id} league={league} standings={standingsByLeague.get(league.id) ?? []} />
        ))}
      </div>
    </div>
  );
}
