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

function getRelativeDayLabel(dayKey: string): string | null {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  if (dayKey === today) return "Hôm nay";

  const dayMs = 24 * 60 * 60 * 1000;
  const dayDate = new Date(`${dayKey}T00:00:00+07:00`).getTime();
  const todayDate = new Date(`${today}T00:00:00+07:00`).getTime();
  const diff = Math.round((dayDate - todayDate) / dayMs);

  if (diff === 1) return "Ngày mai";
  if (diff === -1) return "Hôm qua";
  return null;
}

function groupFixtures(
  fixtures: DbFixture[],
  dayOrder: DayOrder,
  fixtureOrder: DayOrder
): DayGroup[] {
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
    .sort(([left], [right]) =>
      dayOrder === "asc" ? left.localeCompare(right) : right.localeCompare(left)
    )
    .map(([dayKey, leagues]) => {
      const orderedLeagues = [...leagues.values()]
        .map((group) => ({
          ...group,
          items: [...group.items].sort((left, right) => {
            const delta =
              new Date(left.kickoff_at).getTime() - new Date(right.kickoff_at).getTime();
            if (delta !== 0) return fixtureOrder === "asc" ? delta : -delta;
            return left.id - right.id;
          }),
        }))
        .sort((left, right) => {
          const rankDelta =
            getLeagueDisplayRank(left.league.id) - getLeagueDisplayRank(right.league.id);
          if (rankDelta !== 0) return rankDelta;

          const kickoffDelta =
            new Date(left.items[0]?.kickoff_at ?? 0).getTime() -
            new Date(right.items[0]?.kickoff_at ?? 0).getTime();
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
      <h2 className="mt-4 text-3xl font-black tracking-normal text-white">{title}</h2>
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

  const chipClass =
    tone === "upcoming"
      ? "border-orange-300/25 bg-orange-500/15 text-orange-100"
      : "border-sky-300/25 bg-sky-500/15 text-sky-100";

  return (
    <div className="space-y-4">
      {days.map((day) => {
        const relative = getRelativeDayLabel(day.dayKey);

        return (
          <section
            key={day.dayKey}
            className="site-panel"
            style={{ overflow: "clip" }}
          >
            <header
              className="sticky-day-header border-b border-white/10 px-4 py-2.5 sm:px-5 sm:py-3"
            >
              <div className="flex items-center gap-2.5">
                {relative ? (
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] ${
                      relative === "Hôm nay"
                        ? "border-orange-300/30 bg-orange-500/15 text-orange-200"
                        : "border-white/10 bg-white/[0.05] text-slate-300"
                    }`}
                  >
                    {relative}
                  </span>
                ) : null}
                <h2 className="min-w-0 truncate text-[15px] font-black capitalize tracking-normal text-white sm:text-base">
                  {formatDayLabel(day.dayKey)}
                </h2>

                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold tabular-nums ${chipClass}`}
                  >
                    {day.matchCount} trận
                  </span>
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-300 sm:inline">
                    {day.leagues.length} giải
                  </span>
                </div>
              </div>
            </header>

            <div className="divide-y divide-white/[0.06]">
              {day.leagues.map((league) => (
                <div key={`${day.dayKey}-${league.league.id}`}>
                  <div
                    className="sticky-league-header flex items-center gap-2.5 border-b border-white/[0.06] px-3 py-2 sm:px-4"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                      <LogoMark src={league.league.logo_url ?? ""} alt="" size={16} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[13px] font-semibold text-white">
                        {league.league.name}
                      </h3>
                      {league.league.country?.name ? (
                        <p className="truncate text-[11px] text-slate-500">
                          {league.league.country.name}
                        </p>
                      ) : null}
                    </div>

                    <span className="shrink-0 rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-300">
                      {league.items.length}
                    </span>
                  </div>

                  <div className="divide-y divide-white/[0.05] px-1.5 py-1 sm:px-2">
                    {league.items.map((fixture) => (
                      <MatchCard key={fixture.id} fixture={fixture} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
