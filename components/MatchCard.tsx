/**
 * components/MatchCard.tsx
 *
 * Compact match row in a livescore-like layout:
 * [status/time] [team names + logos] [score]
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

function StatusText({ fixture }: { fixture: DbFixture }) {
  const { status_short, status_elapsed } = fixture;

  if (isDbLive(status_short)) {
    return (
      <span className="inline-flex items-center justify-center gap-1 text-xs font-bold text-orange-300 tabular-nums">
        <span className="live-dot" />
        {dbStatusLabel(status_short, status_elapsed)}
      </span>
    );
  }

  if (status_short === "HT") {
    return <span className="text-xs font-bold uppercase tracking-[0.2em] text-yellow-300">HT</span>;
  }

  if (isDbFinished(status_short)) {
    return <span className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">FT</span>;
  }

  if (["PST", "CANC", "SUSP"].includes(status_short)) {
    return <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Hoãn</span>;
  }

  return (
    <span className="text-sm font-bold text-slate-200 tabular-nums">
      {new Date(fixture.kickoff_at).toLocaleTimeString("vi-VN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
      })}
    </span>
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
    <div className="mt-2 flex items-start justify-between gap-2 pl-14 pr-2">
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
  const hasScore = fixture.goals_home !== null;
  const home = fixture.home_team;
  const away = fixture.away_team;

  return (
    <Link
      href={`/match/${fixture.slug}`}
      className={`match-row flex flex-col px-3 py-3 ${live ? "match-row-live" : ""}`}
      aria-label={`${home.name} ${fixture.goals_home ?? ""} - ${fixture.goals_away ?? ""} ${away.name}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-14 shrink-0 text-center">
          <StatusText fixture={fixture} />
          {live ? (
            <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">Live</p>
          ) : null}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <LogoMark src={home.logo_url ?? ""} alt="" size={18} />
            <span className={`truncate text-sm font-semibold ${live ? "text-white" : finished ? "text-slate-300" : "text-slate-100"}`}>
              {home.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LogoMark src={away.logo_url ?? ""} alt="" size={18} />
            <span className={`truncate text-sm font-semibold ${live ? "text-white" : finished ? "text-slate-300" : "text-slate-100"}`}>
              {away.name}
            </span>
          </div>
        </div>

        <div className="w-10 shrink-0 text-right">
          {hasScore ? (
            <>
              <p className={`score text-lg leading-none ${live ? "text-white" : "text-slate-200"}`}>{fixture.goals_home}</p>
              <p className={`score mt-2 text-lg leading-none ${live ? "text-white" : "text-slate-200"}`}>{fixture.goals_away}</p>
            </>
          ) : (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">VS</p>
          )}
        </div>
      </div>

      <ScorerRow events={events} fixture={fixture} />
    </Link>
  );
}
