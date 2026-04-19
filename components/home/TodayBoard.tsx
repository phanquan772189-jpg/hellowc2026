import LogoMark from "@/components/LogoMark";
import MatchCard from "@/components/MatchCard";
import { isDbFinished, isDbLive, isDbNotStarted, type DbFixture } from "@/lib/db-queries";
import { getLeagueDisplayRank } from "@/lib/match-rank";

type LeagueGroup = {
  league: DbFixture["league"];
  items: DbFixture[];
};

function groupByLeague(fixtures: DbFixture[]) {
  const map = new Map<number, LeagueGroup>();

  for (const fixture of fixtures) {
    const existing = map.get(fixture.league.id);
    if (existing) {
      existing.items.push(fixture);
    } else {
      map.set(fixture.league.id, { league: fixture.league, items: [fixture] });
    }
  }

  return map;
}

function fixtureStateRank(fixture: DbFixture) {
  if (isDbLive(fixture.status_short)) return 0;
  if (isDbNotStarted(fixture.status_short)) return 1;
  if (isDbFinished(fixture.status_short)) return 2;
  return 3;
}

function sortFixturesForLeague(fixtures: DbFixture[]) {
  return [...fixtures].sort((left, right) => {
    const kickoffDelta = new Date(left.kickoff_at).getTime() - new Date(right.kickoff_at).getTime();
    if (kickoffDelta !== 0) return kickoffDelta;

    const stateDelta = fixtureStateRank(left) - fixtureStateRank(right);
    if (stateDelta !== 0) return stateDelta;

    return left.id - right.id;
  });
}

function leaguePriority(group: LeagueGroup) {
  const liveCount = group.items.filter((fixture) => isDbLive(fixture.status_short)).length;
  const upcomingCount = group.items.filter((fixture) => isDbNotStarted(fixture.status_short)).length;
  const finishedCount = group.items.filter((fixture) => isDbFinished(fixture.status_short)).length;
  const firstKickoff = Math.min(...group.items.map((fixture) => new Date(fixture.kickoff_at).getTime()));
  const leagueRank = getLeagueDisplayRank(group.league.id);

  return {
    leagueRank,
    liveCount,
    finishedCount,
    stateRank: liveCount > 0 ? 0 : upcomingCount > 0 ? 1 : finishedCount > 0 ? 2 : 3,
    firstKickoff,
  };
}

function sortTodayGroups(groups: Map<number, LeagueGroup>) {
  return [...groups.values()].sort((left, right) => {
    const priorityLeft = leaguePriority(left);
    const priorityRight = leaguePriority(right);

    if (priorityLeft.stateRank !== priorityRight.stateRank) {
      return priorityLeft.stateRank - priorityRight.stateRank;
    }

    if (priorityLeft.leagueRank !== priorityRight.leagueRank) {
      return priorityLeft.leagueRank - priorityRight.leagueRank;
    }

    if (priorityLeft.liveCount !== priorityRight.liveCount) {
      return priorityRight.liveCount - priorityLeft.liveCount;
    }

    if (priorityLeft.firstKickoff !== priorityRight.firstKickoff) {
      return priorityLeft.firstKickoff - priorityRight.firstKickoff;
    }

    if (right.items.length !== left.items.length) {
      return right.items.length - left.items.length;
    }

    return left.league.id - right.league.id;
  });
}

function TodayLeagueSection({ league, items }: LeagueGroup) {
  const orderedFixtures = sortFixturesForLeague(items);
  const liveCount = orderedFixtures.filter((fixture) => isDbLive(fixture.status_short)).length;
  const upcomingCount = orderedFixtures.filter((fixture) => isDbNotStarted(fixture.status_short)).length;
  const finishedCount = orderedFixtures.filter((fixture) => isDbFinished(fixture.status_short)).length;
  const headerTone =
    liveCount > 0
      ? "linear-gradient(135deg, rgba(239,68,68,0.14), rgba(249,115,22,0.06) 65%, rgba(255,255,255,0.02) 100%)"
      : upcomingCount > 0
        ? "linear-gradient(135deg, rgba(251,146,60,0.14), rgba(255,255,255,0.03) 60%, rgba(56,189,248,0.08) 100%)"
        : "linear-gradient(135deg, rgba(56,189,248,0.12), rgba(255,255,255,0.02) 60%, rgba(15,23,42,0.12) 100%)";

  return (
    <section className="site-panel overflow-hidden">
      <div className="border-b border-white/10 px-4 py-3" style={{ background: headerTone }}>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
            <LogoMark src={league.logo_url ?? ""} alt="" size={18} />
          </div>

          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{league.name}</h3>
            <p className="mt-1 text-xs text-slate-400">
              {league.country?.name ?? "Quốc tế"} · {items.length} trận
            </p>
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            {liveCount > 0 ? (
              <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-100">
                {liveCount} live
              </span>
            ) : null}
            {upcomingCount > 0 ? (
              <span className="rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1 text-[11px] font-semibold text-orange-100">
                {upcomingCount} sắp đá
              </span>
            ) : null}
            {liveCount === 0 && upcomingCount === 0 && finishedCount > 0 ? (
              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-slate-300">
                Đã xong
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/5 px-2 py-2">
        {orderedFixtures.map((fixture) => (
          <MatchCard key={fixture.id} fixture={fixture} />
        ))}
      </div>
    </section>
  );
}

export default function TodayBoard({ fixtures }: { fixtures: DbFixture[] }) {
  const groups = sortTodayGroups(groupByLeague(fixtures));
  const liveCount = fixtures.filter((fixture) => isDbLive(fixture.status_short)).length;
  const upcomingCount = fixtures.filter((fixture) => isDbNotStarted(fixture.status_short)).length;
  const finishedCount = fixtures.filter((fixture) => isDbFinished(fixture.status_short)).length;

  return (
    <section id="match-center" className="scroll-mt-32 space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <span className="section-label">Today board</span>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Lịch hôm nay</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
            Tất cả trận trong ngày theo từng giải — trận đang live luôn lên trước.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-100">
            {liveCount} live
          </span>
          <span className="rounded-full border border-orange-300/20 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-100">
            {upcomingCount} sắp đá
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
            {finishedCount} FT
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {groups.map((group) => (
          <TodayLeagueSection key={group.league.id} league={group.league} items={group.items} />
        ))}
      </div>
    </section>
  );
}
