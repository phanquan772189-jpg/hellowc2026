import Image from "next/image";

import LogoMark from "@/components/LogoMark";
import type { DbFixtureDetail, DbFixturePlayerRating } from "@/lib/db-queries";

function ratingTone(rating: number | null) {
  if (rating === null) return "border-white/10 bg-white/[0.04] text-slate-400";
  if (rating >= 8) return "border-emerald-400/40 bg-emerald-500/15 text-emerald-200";
  if (rating >= 7) return "border-sky-400/30 bg-sky-500/10 text-sky-200";
  if (rating >= 6) return "border-white/10 bg-white/[0.06] text-slate-200";
  return "border-red-400/30 bg-red-500/10 text-red-200";
}

function translatePosition(position: string | null) {
  if (!position) return "—";
  switch (position) {
    case "G":
      return "Thủ môn";
    case "D":
      return "Hậu vệ";
    case "M":
      return "Tiền vệ";
    case "F":
      return "Tiền đạo";
    default:
      return position;
  }
}

function PlayerRow({ entry }: { entry: DbFixturePlayerRating }) {
  const isStarter = !entry.is_substitute;
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-black/20">
        {entry.player_photo_url ? (
          <Image src={entry.player_photo_url} alt={entry.player_name} fill className="object-cover" sizes="40px" unoptimized />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-xs text-slate-500">?</span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-white">{entry.player_name}</p>
          {entry.is_captain ? (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-200" title="Đội trưởng">
              C
            </span>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
          <span>{translatePosition(entry.position)}</span>
          <span>·</span>
          <span>{entry.minutes ?? 0}&apos;</span>
          {!isStarter ? (
            <>
              <span>·</span>
              <span className="text-orange-200">Vào sân thay người</span>
            </>
          ) : null}
        </div>

        {(entry.goals || entry.assists || entry.yellow_cards || entry.red_cards) ? (
          <div className="mt-1 flex flex-wrap gap-1">
            {entry.goals ? (
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
                ⚽ {entry.goals}
              </span>
            ) : null}
            {entry.assists ? (
              <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                🅰 {entry.assists}
              </span>
            ) : null}
            {entry.yellow_cards ? (
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                🟨 {entry.yellow_cards}
              </span>
            ) : null}
            {entry.red_cards ? (
              <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-200">
                🟥 {entry.red_cards}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl border ${ratingTone(entry.rating)}`}
        title="Đánh giá 0-10"
      >
        <span className="text-base font-black leading-none">
          {entry.rating !== null ? entry.rating.toFixed(1) : "—"}
        </span>
        <span className="text-[8px] uppercase tracking-[0.18em] opacity-60">Rating</span>
      </div>
    </div>
  );
}

function TeamColumn({
  teamName,
  teamLogo,
  isHome,
  ratings,
}: {
  teamName: string;
  teamLogo: string | null;
  isHome: boolean;
  ratings: DbFixturePlayerRating[];
}) {
  const starters = ratings.filter((r) => !r.is_substitute);
  const subs = ratings.filter((r) => r.is_substitute);

  return (
    <article className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-3"
        style={{
          background: isHome
            ? "linear-gradient(135deg, rgba(56,189,248,0.18), rgba(255,255,255,0.03) 65%)"
            : "linear-gradient(135deg, rgba(251,146,60,0.18), rgba(255,255,255,0.03) 65%)",
        }}
      >
        <div className="flex items-center gap-3">
          <LogoMark src={teamLogo ?? ""} alt="" size={20} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-white">{teamName}</p>
            <p className="text-[11px] text-slate-400">{ratings.length} cầu thủ ra sân</p>
          </div>
        </div>
      </div>

      {ratings.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-slate-400">Không có dữ liệu rating.</p>
      ) : (
        <>
          <div className="divide-y divide-white/[0.05]">
            {starters.map((entry) => (
              <PlayerRow key={`starter-${entry.player_id}`} entry={entry} />
            ))}
          </div>
          {subs.length > 0 ? (
            <>
              <p className="border-t border-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Vào sân thay người
              </p>
              <div className="divide-y divide-white/[0.05]">
                {subs.map((entry) => (
                  <PlayerRow key={`sub-${entry.player_id}`} entry={entry} />
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </article>
  );
}

export default function PlayerRatingsPanel({
  fixture,
  ratings,
}: {
  fixture: DbFixtureDetail;
  ratings: DbFixturePlayerRating[];
}) {
  if (ratings.length === 0) {
    return (
      <article className="px-4 py-5 sm:px-6 sm:py-6">
        <span className="section-label">Đánh giá cầu thủ</span>
        <p className="mt-4 rounded-[26px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-8 text-center text-sm leading-7 text-slate-300">
          Đánh giá cầu thủ chỉ xuất hiện sau khi trận kết thúc và pipeline phân tích chạy xong.
        </p>
      </article>
    );
  }

  const homeRatings = ratings.filter((r) => r.team_id === fixture.home_team.id);
  const awayRatings = ratings.filter((r) => r.team_id === fixture.away_team.id);

  return (
    <article className="px-4 py-5 sm:px-6 sm:py-6">
      <span className="section-label">Đánh giá cầu thủ</span>
      <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Rating từng cầu thủ</h2>
      <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-300">
        Thang điểm 0–10 dựa trên thông số trận đấu (sút, chuyền, tranh chấp, lỗi, thẻ phạt). Dữ liệu từ pipeline phân
        tích trận đấu của API-Football.
      </p>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <TeamColumn
          teamName={fixture.home_team.name}
          teamLogo={fixture.home_team.logo_url}
          isHome
          ratings={homeRatings}
        />
        <TeamColumn
          teamName={fixture.away_team.name}
          teamLogo={fixture.away_team.logo_url}
          isHome={false}
          ratings={awayRatings}
        />
      </div>
    </article>
  );
}
