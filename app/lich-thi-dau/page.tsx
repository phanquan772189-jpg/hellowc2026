import type { Metadata } from "next";
import Link from "next/link";

import GroupedFixtureDays from "@/components/GroupedFixtureDays";
import LogoMark from "@/components/LogoMark";
import {
  getTrackedLeaguesFromDB,
  getUpcomingFixturesFromDB,
  type DbFixture,
  type DbTrackedLeague,
} from "@/lib/db-queries";
import { sortFixturesByImportance } from "@/lib/match-rank";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lịch thi đấu bóng đá 7 ngày tới",
  description:
    "Theo dõi lịch thi đấu bóng đá 7 ngày tới theo từng ngày và từng giải đấu. Ưu tiên các giải lớn, link nhanh vào match center và bảng xếp hạng.",
  alternates: { canonical: "/lich-thi-dau" },
};

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function formatTimeOnly(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function SnapshotMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 score text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

function SpotlightFixture({ fixture }: { fixture?: DbFixture }) {
  if (!fixture) {
    return (
      <div className="site-panel p-5">
        <span className="section-label">Trận đáng chú ý</span>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Chưa có lịch thi đấu mới trong 7 ngày tới. Khi dữ liệu đồng bộ thêm, block này sẽ ưu tiên trận đáng xem nhất để mở nhanh.
        </p>
      </div>
    );
  }

  return (
    <div className="site-panel relative overflow-hidden p-5">
      <div
        aria-hidden
        className="absolute inset-0 opacity-80"
        style={{
          background:
            "linear-gradient(145deg, rgba(251,146,60,0.16), rgba(56,189,248,0.10) 55%, transparent 100%)",
        }}
      />

      <div className="relative">
        <span className="section-label">Trận đáng chú ý</span>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
          <span className="fact-chip">{fixture.league.name}</span>
          {fixture.round ? <span className="fact-chip">{fixture.round}</span> : null}
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 text-right">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-black/10">
              <LogoMark src={fixture.home_team.logo_url ?? ""} alt="" size={24} />
            </div>
            <p className="truncate text-sm font-bold text-white">{fixture.home_team.name}</p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/15 px-4 py-3 text-center">
            <p className="score text-xl font-black text-white">VS</p>
            <p className="mt-1 text-xs text-slate-400">{formatKickoff(fixture.kickoff_at)}</p>
          </div>

          <div className="min-w-0">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-black/10">
              <LogoMark src={fixture.away_team.logo_url ?? ""} alt="" size={24} />
            </div>
            <p className="truncate text-sm font-bold text-white">{fixture.away_team.name}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/match/${fixture.slug}`} className="action-primary">
            Mở match center
          </Link>
          <Link href={`/league/${fixture.league.id}?section=fixtures`} className="action-secondary">
            Xem lịch của giải
          </Link>
        </div>
      </div>
    </div>
  );
}

function TrackedLeagueDirectory({ leagues }: { leagues: DbTrackedLeague[] }) {
  return (
    <div className="site-panel overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Giải đang theo dõi</p>
        <h2 className="mt-2 text-xl font-bold text-white">Đi tắt theo giải đấu</h2>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {leagues.slice(0, 12).map((league) => (
          <Link
            key={league.id}
            href={`/league/${league.id}?section=fixtures`}
            className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
              <LogoMark src={league.logo_url ?? ""} alt="" size={18} />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{league.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {league.country?.name ?? "Quốc tế"}
                {league.season_year ? ` · Mùa ${league.season_year}` : ""}
              </p>
            </div>

            <span className="text-slate-500">→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function SchedulePage() {
  const [fixtures, trackedLeagues] = await Promise.all([getUpcomingFixturesFromDB(7), getTrackedLeaguesFromDB()]);

  const spotlight = sortFixturesByImportance(fixtures)[0];
  const leagueCount = new Set(fixtures.map((fixture) => fixture.league.id)).size;
  const firstKickoff = fixtures[0]?.kickoff_at;

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="site-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
          <div
            aria-hidden
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at top left, rgba(251,146,60,0.18), transparent 28%), radial-gradient(circle at right center, rgba(56,189,248,0.14), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
            }}
          />

          <div className="relative">
            <span className="section-label">Lịch thi đấu</span>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="fact-chip">Khung nhìn 7 ngày tới</span>
              <span className="fact-chip">Sắp theo từng ngày, trong ngày gom theo giải</span>
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Lịch thi đấu bóng đá 7 ngày tới
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Trang này gom toàn bộ trận sắp diễn ra trong 7 ngày tới, ưu tiên giải lớn và giữ link vào match center để mở thẳng chi tiết trận.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <SnapshotMetric label="Tổng trận" value={fixtures.length} hint="Toàn bộ lịch trong cửa sổ 7 ngày." />
              <SnapshotMetric label="Giải đấu" value={leagueCount} hint="Số giải có mặt trong lịch sắp tới." />
              <SnapshotMetric
                label="Bóng lăn gần nhất"
                value={firstKickoff ? formatTimeOnly(firstKickoff) : "—"}
                hint={firstKickoff ? formatKickoff(firstKickoff) : "Đang chờ dữ liệu mới."}
              />
            </div>
          </div>
        </div>

        <SpotlightFixture fixture={spotlight} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <GroupedFixtureDays
            fixtures={fixtures}
            tone="upcoming"
            dayOrder="asc"
            fixtureOrder="asc"
            emptyTitle="7 ngày tới chưa có trận nào được đồng bộ."
            emptyDescription="Khi lịch mới được nạp từ API-Football, trang này sẽ tự chia theo ngày và từng giải đấu để bạn mở nhanh trận cần xem."
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[92px] xl:self-start">
          <TrackedLeagueDirectory leagues={trackedLeagues} />

          <div className="site-panel p-5">
            <span className="section-label">Điểm vào nhanh</span>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/" className="action-secondary justify-center">
                Về trang chủ
              </Link>
              <Link href="/ket-qua" className="action-secondary justify-center">
                Xem kết quả gần đây
              </Link>
              <Link href="/bang-xep-hang" className="action-secondary justify-center">
                Xem bảng xếp hạng
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
