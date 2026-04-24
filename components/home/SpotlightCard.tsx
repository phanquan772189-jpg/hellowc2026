import Link from "next/link";
import LogoMark from "@/components/LogoMark";
import { dbStatusLabel, isDbFinished, isDbLive, type DbFixture } from "@/lib/db-queries";

function formatKickoff(kickoffAt: string) {
  return new Date(kickoffAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatMatchDate(kickoffAt: string) {
  return new Date(kickoffAt).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export default function SpotlightCard({ fixture }: { fixture?: DbFixture }) {
  if (!fixture) return null;

  const live = isDbLive(fixture.status_short);
  const finished = isDbFinished(fixture.status_short);
  const hasScore = fixture.goals_home !== null;
  const badgeClass =
    fixture.status_short === "HT"
      ? "border-yellow-300/20 bg-yellow-500/10 text-yellow-100"
      : live
        ? "border-red-400/20 bg-red-500/10 text-red-100"
        : finished
          ? "border-white/10 bg-white/[0.06] text-slate-200"
          : "border-orange-300/20 bg-orange-500/10 text-orange-100";
  const badgeText =
    live || fixture.status_short === "HT"
      ? dbStatusLabel(fixture.status_short, fixture.status_elapsed)
      : finished
        ? "FT"
        : formatKickoff(fixture.kickoff_at);

  return (
    <Link
      id="spotlight"
      href={`/match/${fixture.slug}`}
      className="site-panel scroll-mt-32 relative block overflow-hidden p-4 transition hover:border-white/20"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-80"
        style={{
          background: live
            ? "linear-gradient(145deg, rgba(239,68,68,0.18), rgba(249,115,22,0.08) 45%, transparent 100%)"
            : finished
              ? "linear-gradient(145deg, rgba(56,189,248,0.14), rgba(15,23,42,0.08) 55%, transparent 100%)"
              : "linear-gradient(145deg, rgba(251,146,60,0.16), rgba(56,189,248,0.10) 55%, transparent 100%)",
        }}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate text-slate-400">
            <span className="text-orange-300">★</span> Tâm điểm · {fixture.league.name}
          </span>
          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
            {live ? <span className="live-dot" /> : null}
            {badgeText}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="flex min-w-0 items-center justify-end gap-2">
            <span className="truncate text-right text-sm font-bold text-white">{fixture.home_team.name}</span>
            <LogoMark src={fixture.home_team.logo_url ?? ""} alt="" size={28} />
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-center">
            {hasScore ? (
              <div className="flex items-center gap-1.5">
                <span className="score text-2xl font-black text-white">{fixture.goals_home}</span>
                <span className="text-slate-500">-</span>
                <span className="score text-2xl font-black text-white">{fixture.goals_away}</span>
              </div>
            ) : (
              <p className="score text-lg font-black text-white">{formatKickoff(fixture.kickoff_at)}</p>
            )}
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <LogoMark src={fixture.away_team.logo_url ?? ""} alt="" size={28} />
            <span className="truncate text-sm font-bold text-white">{fixture.away_team.name}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate">{fixture.round}</span>
          <span>{hasScore ? "Xem diễn biến →" : formatMatchDate(fixture.kickoff_at) + " →"}</span>
        </div>
      </div>
    </Link>
  );
}
