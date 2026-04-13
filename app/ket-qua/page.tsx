import type { Metadata } from "next";
import Link from "next/link";

import GroupedFixtureDays from "@/components/GroupedFixtureDays";
import LogoMark from "@/components/LogoMark";
import {
  formatSeasonLabel,
  getRecentFinishedFixturesFromDB,
  getTrackedLeaguesFromDB,
  type DbFixture,
  type DbTrackedLeague,
} from "@/lib/db-queries";
import { sortFixturesByImportance } from "@/lib/match-rank";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kết quả bóng đá 7 ngày gần đây",
  description:
    "Xem kết quả bóng đá 7 ngày gần đây theo từng ngày và từng giải đấu. Mở nhanh từng trận để xem diễn biến, đội hình, thống kê và phân tích.",
  alternates: { canonical: "/ket-qua" },
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

function SnapshotMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-4 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 score text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

function HighlightResult({ fixture }: { fixture?: DbFixture }) {
  if (!fixture) {
    return (
      <div className="site-panel p-5">
        <span className="section-label">Kết quả nổi bật</span>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Chưa có trận nào kết thúc trong cửa sổ 7 ngày gần đây. Khi có dữ liệu FT, trang này sẽ tự đẩy cặp đấu đáng chú ý lên trên.
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
            "linear-gradient(145deg, rgba(56,189,248,0.16), rgba(255,255,255,0.03) 55%, transparent 100%)",
        }}
      />

      <div className="relative">
        <span className="section-label">Kết quả nổi bật</span>
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
            <div className="flex items-center justify-center gap-2">
              <span className="score text-3xl font-black text-white">{fixture.goals_home ?? 0}</span>
              <span className="text-slate-500">-</span>
              <span className="score text-3xl font-black text-white">{fixture.goals_away ?? 0}</span>
            </div>
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
            Xem chi tiết trận
          </Link>
          <Link href={`/league/${fixture.league.id}?section=fixtures`} className="action-secondary">
            Mở trang giải đấu
          </Link>
        </div>
      </div>
    </div>
  );
}

function LeagueDirectory({ leagues }: { leagues: DbTrackedLeague[] }) {
  return (
    <div className="site-panel overflow-hidden">
      <div className="border-b border-white/10 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Theo dõi tiếp</p>
        <h2 className="mt-2 text-xl font-bold text-white">Đi thẳng vào giải đấu</h2>
      </div>

      <div className="divide-y divide-white/[0.06]">
        {leagues.slice(0, 12).map((league) => {
          const seasonLabel = formatSeasonLabel(
            league.season_year,
            league.season_start_date,
            league.season_end_date
          );

          return (
            <Link
              key={league.id}
              href={`/league/${league.id}?section=standings`}
              className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
                <LogoMark src={league.logo_url ?? ""} alt="" size={18} />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{league.name}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {league.country?.name ?? "Quốc tế"}
                  {seasonLabel ? ` · Mùa ${seasonLabel}` : ""}
                </p>
              </div>

              <span className="text-slate-500">→</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default async function ResultsPage() {
  const [fixtures, trackedLeagues] = await Promise.all([getRecentFinishedFixturesFromDB(7), getTrackedLeaguesFromDB()]);

  const spotlight = sortFixturesByImportance(fixtures)[0];
  const leagueCount = new Set(fixtures.map((fixture) => fixture.league.id)).size;
  const dayCount = new Set(
    fixtures.map((fixture) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(fixture.kickoff_at))
    )
  ).size;
  const latestResult = fixtures[0]?.kickoff_at;

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <div className="site-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
          <div
            aria-hidden
            className="absolute inset-0 opacity-90"
            style={{
              background:
                "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 28%), radial-gradient(circle at right center, rgba(255,255,255,0.06), transparent 34%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
            }}
          />

          <div className="relative">
            <span className="section-label">Kết quả bóng đá</span>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
              <span className="fact-chip">Cửa sổ 7 ngày gần nhất</span>
              <span className="fact-chip">Kết quả được gom theo ngày và giải</span>
            </div>

            <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Kết quả bóng đá 7 ngày gần đây
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Trang này tập trung vào các trận đã kết thúc để bạn quét nhanh tỷ số, rồi mở sâu vào match center khi cần xem diễn biến, đội hình hoặc thống kê.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <SnapshotMetric label="Tổng trận FT" value={fixtures.length} hint="Tất cả trận đã chốt kết quả." />
              <SnapshotMetric label="Giải đấu" value={leagueCount} hint="Số giải đã có trận kết thúc." />
              <SnapshotMetric
                label="Ngày có dữ liệu"
                value={dayCount}
                hint={latestResult ? `Cập nhật gần nhất: ${formatKickoff(latestResult)}` : "Đang chờ dữ liệu FT mới."}
              />
            </div>
          </div>
        </div>

        <HighlightResult fixture={spotlight} />
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <GroupedFixtureDays
            fixtures={fixtures}
            tone="finished"
            dayOrder="desc"
            fixtureOrder="desc"
            emptyTitle="7 ngày gần đây chưa có trận nào chốt kết quả."
            emptyDescription="Khi dữ liệu FT được đồng bộ, trang này sẽ tự chia theo ngày và từng giải đấu để bạn tìm lại trận vừa xong nhanh hơn."
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[92px] xl:self-start">
          <LeagueDirectory leagues={trackedLeagues} />

          <div className="site-panel p-5">
            <span className="section-label">Điểm vào nhanh</span>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/" className="action-secondary justify-center">
                Về trang chủ
              </Link>
              <Link href="/lich-thi-dau" className="action-secondary justify-center">
                Xem lịch thi đấu
              </Link>
              <Link href="/goc-chuyen-gia" className="action-secondary justify-center">
                Mở góc chuyên gia
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
