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

function formatVenue(fixture: DbFixture) {
  return fixture.league.country?.name ?? "Quốc tế";
}

export default function SpotlightCard({ fixture }: { fixture?: DbFixture }) {
  if (!fixture) {
    return (
      <section id="spotlight" className="site-panel scroll-mt-32 overflow-hidden p-6">
        <span className="section-label">Trận tâm điểm</span>
        <h2 className="mt-4 text-2xl font-black tracking-tight text-white">Hôm nay chưa có cặp đấu nổi bật.</h2>
        <p className="mt-3 text-sm leading-7 text-slate-300">
          Khi có lịch thi đấu trong ngày, khu vực này sẽ ưu tiên đẩy trận live hoặc trận sắp đá lên đầu để người xem mở nhanh.
        </p>
      </section>
    );
  }

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
        ? "Kết thúc"
        : `${formatKickoff(fixture.kickoff_at)} · ${formatMatchDate(fixture.kickoff_at)}`;

  return (
    <section id="spotlight" className="site-panel scroll-mt-32 relative overflow-hidden p-6">
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
        <span className="section-label">Trận tâm điểm</span>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="fact-chip">{fixture.league.name}</span>
          <span className="fact-chip">{fixture.round}</span>
          <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${badgeClass}`}>{badgeText}</span>
        </div>

        <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="min-w-0 text-right">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-black/10">
              <LogoMark src={fixture.home_team.logo_url ?? ""} alt="" size={30} />
            </div>
            <p className="truncate text-lg font-bold text-white">{fixture.home_team.name}</p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-black/15 px-5 py-4 text-center shadow-card">
            {hasScore ? (
              <div className="flex items-center justify-center gap-2">
                <span className="score text-4xl font-black text-white">{fixture.goals_home}</span>
                <span className="text-slate-500">-</span>
                <span className="score text-4xl font-black text-white">{fixture.goals_away}</span>
              </div>
            ) : (
              <>
                <p className="score text-3xl font-black text-white">{formatKickoff(fixture.kickoff_at)}</p>
                <p className="mt-2 text-sm text-slate-400">{formatMatchDate(fixture.kickoff_at)}</p>
              </>
            )}
          </div>

          <div className="min-w-0">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-black/10">
              <LogoMark src={fixture.away_team.logo_url ?? ""} alt="" size={30} />
            </div>
            <p className="truncate text-lg font-bold text-white">{fixture.away_team.name}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Sân đấu</p>
            <p className="mt-2 text-sm font-semibold text-white">{formatVenue(fixture)}</p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Điểm vào trận</p>
            <p className="mt-2 text-sm font-semibold text-white">
              {live ? "Theo dõi diễn biến trực tiếp" : finished ? "Xem lại tỷ số và trạng thái" : "Mở trước giờ bóng lăn"}
            </p>
          </div>
        </div>

        <Link href={`/match/${fixture.slug}`} className="action-secondary mt-6 inline-flex w-full sm:w-auto">
          Mở trận đấu
        </Link>
      </div>
    </section>
  );
}
