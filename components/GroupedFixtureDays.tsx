import LogoMark from "@/components/LogoMark";
import MatchCard from "@/components/MatchCard";
import { type DbFixture } from "@/lib/db-queries";
import { getLeagueDisplayRank } from "@/lib/match-rank";

type DayOrder = "asc" | "desc";

type Props = {
  fixtures: DbFixture[];
  tone: "upcoming" | "finished";
  dayOrder?: DayOrder;
  fixtureOrder?: DayOrder;
  emptyTitle: string;
  emptyDescription: string;
};

type LeagueGroup = {
  league: DbFixture["league"];
  items: DbFixture[];
};

type DayGroup = {
  dayKey: string;
  leagues: LeagueGroup[];
  matchCount: number;
};

function getDayKey(kickoffAt: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(kickoffAt));
}

function formatDayLabel(dayKey: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(`${dayKey}T00:00:00+07:00`));
}

function groupFixtures(fixtures: DbFixture[], dayOrder: DayOrder, fixtureOrder: DayOrder): DayGroup[] {
  const byDay = new Map<string, Map<number, LeagueGroup>>();

  for (const fixture of fixtures) {
    const dayKey = getDayKey(fixture.kickoff_at);
    const dayGroups = byDay.get(dayKey) ?? new Map<number, LeagueGroup>();
    const leagueGroup = dayGroups.get(fixture.league.id);

    if (leagueGroup) {
      leagueGroup.items.push(fixture);
    } else {
      dayGroups.set(fixture.league.id, {
        league: fixture.league,
        items: [fixture],
      });
    }

    byDay.set(dayKey, dayGroups);
  }

  return [...byDay.entries()]
    .sort(([left], [right]) => (dayOrder === "asc" ? left.localeCompare(right) : right.localeCompare(left)))
    .map(([dayKey, leagues]) => {
      const orderedLeagues = [...leagues.values()]
        .map((group) => ({
          ...group,
          items: [...group.items].sort((left, right) => {
            const delta = new Date(left.kickoff_at).getTime() - new Date(right.kickoff_at).getTime();
            if (delta !== 0) return fixtureOrder === "asc" ? delta : -delta;
            return left.id - right.id;
          }),
        }))
        .sort((left, right) => {
          const rankDelta = getLeagueDisplayRank(left.league.id) - getLeagueDisplayRank(right.league.id);
          if (rankDelta !== 0) return rankDelta;

          const kickoffDelta =
            new Date(left.items[0]?.kickoff_at ?? 0).getTime() - new Date(right.items[0]?.kickoff_at ?? 0).getTime();
          if (kickoffDelta !== 0) return kickoffDelta;

          return left.league.id - right.league.id;
        });

      return {
        dayKey,
        leagues: orderedLeagues,
        matchCount: orderedLeagues.reduce((total, league) => total + league.items.length, 0),
      };
    });
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="site-panel px-6 py-12 text-center">
      <span className="section-label">Không có dữ liệu</span>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

export default function GroupedFixtureDays({
  fixtures,
  tone,
  dayOrder = "asc",
  fixtureOrder = "asc",
  emptyTitle,
  emptyDescription,
}: Props) {
  if (fixtures.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const days = groupFixtures(fixtures, dayOrder, fixtureOrder);
  const dayTone =
    tone === "upcoming"
      ? "linear-gradient(135deg, rgba(251,146,60,0.16), rgba(56,189,248,0.08) 65%, rgba(255,255,255,0.02))"
      : "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))";

  const chipClass =
    tone === "upcoming"
      ? "border-orange-300/20 bg-orange-500/10 text-orange-100"
      : "border-sky-300/20 bg-sky-500/10 text-sky-100";

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.dayKey} className="site-panel overflow-hidden">
          <div className="border-b border-white/10 px-5 py-4" style={{ background: dayTone }}>
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <span className="section-label">Matchday</span>
                <h2 className="mt-3 text-2xl font-black capitalize tracking-tight text-white sm:text-3xl">
                  {formatDayLabel(day.dayKey)}
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${chipClass}`}>
                  {day.matchCount} trận
                </span>
                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
                  {day.leagues.length} giải
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-4 px-3 py-3">
            {day.leagues.map((league) => (
              <div key={`${day.dayKey}-${league.league.id}`} className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.03]">
                <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                    <LogoMark src={league.league.logo_url ?? ""} alt="" size={18} />
                  </div>

                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white">{league.league.name}</h3>
                    <p className="mt-1 text-xs text-slate-400">{league.league.country?.name ?? "Quốc tế"}</p>
                  </div>

                  <span className="ml-auto rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-slate-300">
                    {league.items.length} trận
                  </span>
                </div>

                <div className="divide-y divide-white/[0.05] px-2 py-2">
                  {league.items.map((fixture) => (
                    <MatchCard key={fixture.id} fixture={fixture} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
