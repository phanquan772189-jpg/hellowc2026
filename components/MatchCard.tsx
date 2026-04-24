/**
 * components/MatchCard.tsx
 *
 * Compact match row in a livescore-like layout:
 * [time/status]  [team rows + logos]  [score]
 */

import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import { type MatchEvent } from "@/lib/api";
import {
  dbStatusLabel,
  isDbFinished,
  isDbLive,
  type DbFixture,
} from "@/lib/db-queries";

function StatusCell({ fixture }: { fixture: DbFixture }) {
  const { status_short, status_elapsed } = fixture;

  if (isDbLive(status_short)) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-orange-300 tabular-nums">
          <span className="live-dot" />
          {dbStatusLabel(status_short, status_elapsed)}
        </span>
        <span className="text-[9px] font-semibold uppercase tracking-[0.2em] text-red-300/80">Live</span>
      </div>
    );
  }

  if (status_short === "HT") {
    return <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-yellow-300">HT</span>;
  }

  if (isDbFinished(status_short)) {
    return <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">FT</span>;
  }

  if (["PST", "CANC", "SUSP"].includes(status_short)) {
    return <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Hoãn</span>;
  }

  return (
    <span className="text-sm font-bold text-slate-100 tabular-nums">
      {new Date(fixture.kickoff_at).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })}
    </span>
  );
}

function TeamRow({
  name,
  logo,
  score,
  hasScore,
  live,
  lost,
  notStarted,
}: {
  name: string;
  logo: string | null | undefined;
  score: number | null;
  hasScore: boolean;
  live: boolean;
  lost: boolean;
  notStarted: boolean;
}) {
  const nameClass = live
    ? "text-white"
    : notStarted
      ? "text-slate-200"
      : lost
        ? "text-slate-400"
        : "text-white";

  const scoreClass = live
    ? "text-white"
    : notStarted
      ? "text-slate-500"
      : lost
        ? "text-slate-400"
        : "text-white";

  return (
    <div className="flex items-center gap-2">
      <LogoMark src={logo ?? ""} alt="" size={18} />
      <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${nameClass}`}>{name}</span>
      {hasScore ? (
        <span className={`score w-6 text-right text-base leading-none ${scoreClass}`}>{score ?? 0}</span>
      ) : null}
    </div>
  );
}

function ScorerRow({ events, fixture }: { events?: MatchEvent[]; fixture: DbFixture }) {
  if (!events?.length) return null;

  const goals = events.filter((event) => event.type === "Goal" && event.detail !== "Missed Penalty");
  if (!goals.length) return null;

  const homeGoals = goals.filter((goal) => goal.team.id === fixture.home_team.id);
  const awayGoals = goals.filter((goal) => goal.team.id === fixture.away_team.id);

  const formatGoal = (goal: MatchEvent) => (
    <span key={`${goal.player.id}-${goal.time.elapsed}`} className="inline-flex items-center gap-0.5 text-[11px] text-slate-500">
      ⚽ {goal.player.name.split(" ").pop()} {goal.time.elapsed}&apos;
    </span>
  );

  return (
    <div className="mt-1.5 flex items-start justify-between gap-2 pl-[56px] pr-1">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">{homeGoals.map(formatGoal)}</div>
      <div className="flex flex-wrap justify-end gap-x-2 gap-y-0.5">{awayGoals.map(formatGoal)}</div>
    </div>
  );
}

interface Props {
  fixture: DbFixture;
  events?: MatchEvent[];
}

export default function MatchCard({ fixture, events }: Props) {
  const live = isDbLive(fixture.status_short);
  const finished = isDbFinished(fixture.status_short);
  const notStarted = !live && !finished;
  const hasScore = fixture.goals_home !== null;
  const home = fixture.home_team;
  const away = fixture.away_team;

  const homeLost = finished && hasScore && (fixture.goals_home ?? 0) < (fixture.goals_away ?? 0);
  const awayLost = finished && hasScore && (fixture.goals_away ?? 0) < (fixture.goals_home ?? 0);

  return (
    <Link
      href={`/match/${fixture.slug}`}
      className={`match-row flex flex-col px-3 py-2 ${live ? "match-row-live" : ""}`}
      aria-label={`${home.name} ${fixture.goals_home ?? ""} - ${fixture.goals_away ?? ""} ${away.name}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex w-11 shrink-0 items-center justify-center text-center">
          <StatusCell fixture={fixture} />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <TeamRow
            name={home.name}
            logo={home.logo_url}
            score={fixture.goals_home}
            hasScore={hasScore}
            live={live}
            lost={homeLost}
            notStarted={notStarted}
          />
          <TeamRow
            name={away.name}
            logo={away.logo_url}
            score={fixture.goals_away}
            hasScore={hasScore}
            live={live}
            lost={awayLost}
            notStarted={notStarted}
          />
        </div>
      </div>

      <ScorerRow events={events} fixture={fixture} />
    </Link>
  );
}
