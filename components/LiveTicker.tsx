import Link from "next/link";
import { dbStatusLabel, isDbLive, type DbFixture } from "@/lib/db-queries";
import { sortFixturesByImportance } from "@/lib/match-rank";

interface Props {
  fixtures: DbFixture[];
}

export default function LiveTicker({ fixtures }: Props) {
  const live = sortFixturesByImportance(fixtures.filter((f) => isDbLive(f.status_short)));

  if (live.length === 0) return null;

  return (
    <div className="px-4 pt-4">
      <div className="mx-auto max-w-screen-xl">
        <div className="site-panel overflow-hidden px-3 py-3">
          <div className="flex items-stretch gap-3">
            <div className="flex shrink-0 items-center gap-2 rounded-[18px] border border-red-400/20 bg-red-500/10 px-4">
              <span className="live-dot" />
              <div className="text-xs">
                <p className="font-semibold uppercase tracking-[0.28em] text-red-200">Live</p>
                <p className="text-slate-400">{live.length} trận đang diễn ra</p>
              </div>
            </div>

            <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto pb-1">
              {live.map((fixture) => (
                <div key={fixture.id} className="min-w-max">
                  <Link
                    href={`/match/${fixture.slug}`}
                    className="inline-flex min-h-[48px] items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-4 text-sm text-slate-200 transition hover:border-white/20 hover:bg-white/[0.08]"
                  >
                    <span className="max-w-[120px] truncate font-semibold">{fixture.home_team.name}</span>
                    <span className="score font-black text-white">
                      {fixture.goals_home ?? 0} - {fixture.goals_away ?? 0}
                    </span>
                    <span className="max-w-[120px] truncate font-semibold">{fixture.away_team.name}</span>
                    <span className="rounded-full border border-red-400/20 bg-red-500/10 px-2 py-1 text-[11px] font-semibold text-red-100">
                      {dbStatusLabel(fixture.status_short, fixture.status_elapsed)}
                    </span>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
