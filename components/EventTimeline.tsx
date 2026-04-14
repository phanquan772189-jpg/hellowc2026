import type { DbEvent, DbFixtureDetail } from "@/lib/db-queries";
import { isDbFinished } from "@/lib/db-queries";

function badgeForEvent(type: string, detail: string | null) {
  const d = detail ?? "";

  if (type === "Goal") {
    if (d === "Own Goal") {
      return { label: "OG", title: "Phản lưới", className: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" };
    }
    if (d === "Penalty") {
      return { label: "PK", title: "Penalty", className: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" };
    }
    if (d === "Missed Penalty") {
      return { label: "MP", title: "Hỏng penalty", className: "border-orange-300/20 bg-orange-500/10 text-orange-100" };
    }
    return { label: "G", title: "Bàn thắng", className: "border-emerald-300/20 bg-emerald-500/10 text-emerald-100" };
  }

  if (type === "Card") {
    if (d.includes("Red")) {
      return { label: "RC", title: "Thẻ đỏ", className: "border-red-300/20 bg-red-500/10 text-red-100" };
    }
    if (d.includes("Yellow")) {
      return { label: "YC", title: "Thẻ vàng", className: "border-yellow-300/20 bg-yellow-500/10 text-yellow-100" };
    }
    return { label: "C", title: "Thẻ phạt", className: "border-yellow-300/20 bg-yellow-500/10 text-yellow-100" };
  }

  if (type === "subst") {
    return { label: "SUB", title: "Thay người", className: "border-sky-300/20 bg-sky-500/10 text-sky-100" };
  }

  if (type === "Var") {
    return { label: "VAR", title: "VAR", className: "border-white/15 bg-white/[0.06] text-white" };
  }

  return { label: "EV", title: "Sự kiện", className: "border-white/15 bg-white/[0.06] text-white" };
}

function TimeLabel({ elapsed, extra }: { elapsed: number; extra: number | null }) {
  return (
    <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-slate-500">
      {elapsed}
      {extra ? `+${extra}` : ""}
      &apos;
    </span>
  );
}

/**
 * ScoreSnapshot — Badge tỉ số tại thời điểm bàn thắng (vd "1-0", "2-1")
 * Đây là tính năng signature của Flashscore / Sofascore.
 */
function ScoreSnapshot({ snapshot, isHome }: { snapshot: string; isHome: boolean }) {
  return (
    <span
      title="Tỉ số sau bàn thắng"
      className={`ml-auto shrink-0 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-sm font-black tabular-nums text-emerald-300 ${isHome ? "" : "mr-auto ml-0"}`}
    >
      {snapshot}
    </span>
  );
}

interface Props {
  events: DbEvent[];
  fixture: DbFixtureDetail;
}

export default function EventTimeline({ events, fixture }: Props) {
  if (!events.length) {
    return (
      <div className="px-4 py-12 text-center text-sm text-slate-400 sm:px-6">
        {fixture.status_short === "NS" ? "Trận đấu chưa bắt đầu." : "Chưa có sự kiện nào được ghi nhận."}
      </div>
    );
  }

  const significant = events.filter((event) =>
    event.type === "Goal" || event.type === "Card" || event.type === "subst" || event.type === "Var"
  );

  const halftimeIndex = significant.findIndex(
    (event) => event.time_elapsed >= 45 && event.time_extra !== null && event.time_elapsed === 45
  );

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <div className="space-y-3">
        {/* Kickoff */}
        <div className="flex items-center gap-3 rounded-[22px] border border-white/10 bg-black/10 px-4 py-3">
          <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-slate-500">0&apos;</span>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] text-[10px] font-black uppercase tracking-[0.24em] text-white">
            KO
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Bắt đầu trận đấu</p>
            <p className="mt-1 text-xs text-slate-500">
              {fixture.home_team.name} vs {fixture.away_team.name}
            </p>
          </div>
        </div>

        {significant.map((event, index) => {
          const isHome = event.team_id === fixture.home_team.id;
          const detail = event.detail ?? "";
          const isGoal = event.type === "Goal" && detail !== "Missed Penalty";
          const isYellow = event.type === "Card" && detail.includes("Yellow");
          const isRed = event.type === "Card" && detail.includes("Red");
          const showHalftime =
            index === halftimeIndex ||
            (index > 0 && significant[index - 1].time_elapsed < 45 && event.time_elapsed > 45);
          const badge = badgeForEvent(event.type, event.detail);
          const playerName = event.player?.name ?? "Không rõ";
          const assistName = event.assist?.name ?? null;
          const teamName = event.team?.name ?? "";
          const description =
            event.type === "subst"
              ? `${playerName}${assistName ? ` vào sân, ${assistName} rời sân` : " vào sân"}`
              : event.type === "Goal"
                ? `${detail === "Penalty" ? "Bàn thắng trên chấm phạt đền" : detail === "Own Goal" ? "Phản lưới nhà" : "Bàn thắng được ghi"}${assistName ? `, kiến tạo bởi ${assistName}` : ""}`
                : event.type === "Card"
                  ? detail
                  : "Tình huống VAR";

          return (
            <div key={`${event.id}`}>
              {showHalftime && (
                <div className="flex items-center gap-3 px-2 py-1">
                  <div className="h-px flex-1 bg-white/10" />
                  <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                    Nghỉ giữa hiệp
                  </span>
                  <div className="h-px flex-1 bg-white/10" />
                </div>
              )}

              <div
                className={`rounded-[24px] border px-4 py-3 transition-colors
                  ${isGoal ? "border-emerald-300/15 bg-emerald-500/[0.08]" : "border-white/10 bg-black/10"}
                  ${isRed ? "border-red-300/20 bg-red-500/10" : ""}
                  ${isYellow ? "border-yellow-300/15 bg-yellow-500/[0.08]" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <TimeLabel elapsed={event.time_elapsed} extra={event.time_extra} />
                  <span
                    title={badge.title}
                    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-2xl border px-2 text-[10px] font-black uppercase tracking-[0.16em] ${badge.className}`}
                  >
                    {badge.label}
                  </span>

                  <div className={`min-w-0 flex-1 ${isHome ? "" : "text-right"}`}>
                    <div className={`flex items-center gap-2 ${isHome ? "" : "flex-row-reverse"}`}>
                      <p className="text-sm font-semibold text-white">{playerName}</p>
                      {/* Score snapshot — điểm nhấn của livescore chuyên nghiệp */}
                      {isGoal && event.score_snapshot && (
                        <ScoreSnapshot snapshot={event.score_snapshot} isHome={isHome} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{description}</p>
                    <span
                      className={`mt-3 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-slate-300 ${isHome ? "" : "ml-auto"}`}
                    >
                      {teamName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {isDbFinished(fixture.status_short) && (
          <div className="flex items-center gap-3 px-2 py-1">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Kết thúc</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>
        )}
      </div>
    </div>
  );
}
