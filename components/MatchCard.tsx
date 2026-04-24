/**
 * components/MatchCard.tsx
 *
 * Compact livescore row — easy to scan at a glance.
 * Layout: [ time / live pill ] [ teams stacked ] [ score col ]
 *
 * Khi finished: team thắng in đậm trắng, team thua mờ.
 * Khi live: viền đỏ trái + pill phút đập nhịp, tỉ số trắng đậm.
 * Khi NS: giờ kickoff lớn, tabular-nums để dễ đọc nhanh.
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

function StatusColumn({ fixture }: { fixture: DbFixture }) {
  const { status_short, status_elapsed } = fixture;

  if (isDbLive(status_short)) {
    return (
      <span className={`live-pill ${status_short === "HT" ? "live-pill--ht" : ""}`}>
        {status_short !== "HT" ? <span className="live-dot" /> : null}
        {dbStatusLabel(status_short, status_elapsed)}
      </span>
    );
  }

  if (isDbFinished(status_short)) {
    return (
      <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
        {status_short === "AET" ? "HP" : status_short === "PEN" ? "PEN" : "FT"}
      </span>
    );
  }

  if (["PST", "CANC", "SUSP"].includes(status_short)) {
    return (
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        Hoãn
      </span>
    );
  }

  return (
    <span className="text-[15px] font-bold text-slate-100 tabular-nums leading-none">
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

  const goals = events.filter(
    (event) => event.type === "Goal" && event.detail !== "Missed Penalty"
  );
  if (!goals.length) return null;

  const homeGoals = goals.filter((goal) => goal.team.id === fixture.home_team.id);
  const awayGoals = goals.filter((goal) => goal.team.id === fixture.away_team.id);

  const formatGoal = (goal: MatchEvent) => (
    <span
      key={`${goal.player.id}-${goal.time.elapsed}`}
      className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 tabular-nums"
    >
      ⚽ {goal.player.name.split(" ").pop()} {goal.time.elapsed}&apos;
    </span>
  );

  return (
    <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-start gap-2 pl-[68px] pr-3">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">{homeGoals.map(formatGoal)}</div>
      <span aria-hidden className="text-[11px] text-slate-600">·</span>
      <div className="flex flex-wrap justify-end gap-x-2 gap-y-0.5">
        {awayGoals.map(formatGoal)}
      </div>
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

  const homeWin =
    finished && fixture.goals_home !== null && fixture.goals_away !== null
      ? fixture.goals_home > fixture.goals_away
      : false;
  const awayWin =
    finished && fixture.goals_home !== null && fixture.goals_away !== null
      ? fixture.goals_away > fixture.goals_home
      : false;
  const draw =
    finished && fixture.goals_home !== null && fixture.goals_away !== null
      ? fixture.goals_home === fixture.goals_away
      : false;

  const teamClass = (isWinner: boolean) => {
    if (live) return "text-white";
    if (finished) return isWinner || draw ? "text-slate-100 font-semibold" : "text-slate-400";
    return "text-slate-100";
  };

  const scoreClass = live
    ? "text-white"
    : finished
      ? "text-slate-100"
      : "text-slate-300";

  return (
    <Link
      href={`/match/${fixture.slug}`}
      className={`match-row flex flex-col px-3 py-2.5 sm:px-4 sm:py-3 ${live ? "match-row-live" : ""} ${finished ? "match-row-finished" : ""}`}
      aria-label={`${home.name} ${fixture.goals_home ?? ""} - ${fixture.goals_away ?? ""} ${away.name}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex w-14 shrink-0 items-center justify-center sm:w-16">
          <StatusColumn fixture={fixture} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <LogoMark src={home.logo_url ?? ""} alt="" size={20} />
            <span className={`truncate text-[13px] sm:text-sm ${teamClass(homeWin)}`}>
              {home.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LogoMark src={away.logo_url ?? ""} alt="" size={20} />
            <span className={`truncate text-[13px] sm:text-sm ${teamClass(awayWin)}`}>
              {away.name}
            </span>
          </div>
        </div>

        <div className="flex w-9 shrink-0 flex-col items-end gap-1.5 text-right sm:w-10">
          {hasScore ? (
            <>
              <span
                className={`score text-lg leading-none tabular-nums sm:text-xl ${scoreClass}`}
              >
                {fixture.goals_home}
              </span>
              <span
                className={`score text-lg leading-none tabular-nums sm:text-xl ${scoreClass}`}
              >
                {fixture.goals_away}
              </span>
            </>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              VS
            </span>
          )}
        </div>
      </div>

      <ScorerRow events={events} fixture={fixture} />
    </Link>
  );
}
