import type { Metadata } from "next";
import Link from "next/link";
import LiveTicker from "@/components/LiveTicker";
import SpotlightCard from "@/components/home/SpotlightCard";
import StandingsWidget from "@/components/home/StandingsWidget";
import TodayBoard from "@/components/home/TodayBoard";
import {
  getTodayFixturesFromDB,
  getStandingsForLeaguesFromDB,
  isDbFinished,
  isDbLive,
  isDbNotStarted,
} from "@/lib/db-queries";
import { sortFixturesByImportance } from "@/lib/match-rank";

const HOMEPAGE_STANDINGS_LEAGUE_IDS = [340, 1, 39, 140, 78, 135, 61];

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tỷ số bóng đá trực tiếp hôm nay",
  description:
    "Kết quả bóng đá trực tiếp hôm nay với giao diện match center: tỷ số, lịch trong ngày, bảng xếp hạng World Cup 2026 và các trận tâm điểm.",
  alternates: { canonical: "/" },
};

async function getData() {
  const [fixturesRes, standingsRes] = await Promise.allSettled([
    getTodayFixturesFromDB(),
    getStandingsForLeaguesFromDB(HOMEPAGE_STANDINGS_LEAGUE_IDS),
  ]);

  const fixtures = fixturesRes.status === "fulfilled" ? fixturesRes.value : [];
  const standingsGroups = standingsRes.status === "fulfilled" ? standingsRes.value : [];

  return { fixtures, standingsGroups };
}

function QuickStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "live" | "upcoming" | "finished";
}) {
  const toneClass =
    tone === "live"
      ? "border-red-400/20 bg-red-500/10 text-red-100"
      : tone === "upcoming"
        ? "border-orange-300/20 bg-orange-500/10 text-orange-100"
        : tone === "finished"
          ? "border-sky-300/20 bg-sky-500/10 text-sky-100"
          : "border-white/10 bg-white/[0.06] text-slate-200";

  return (
    <div className={`rounded-lg border px-3 py-2.5 backdrop-blur-xl ${toneClass}`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 score text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="site-panel px-6 py-10 text-center">
      <span className="section-label">Lịch thi đấu</span>
      <h2 className="mt-4 text-3xl font-black tracking-normal text-white">
        Hôm nay chưa có trận nào.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
        Xem lịch thi đấu sắp tới hoặc tra kết quả các trận gần đây.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/lich-thi-dau" className="action-primary">
          Lịch thi đấu
        </Link>
        <Link href="/ket-qua" className="action-secondary">
          Kết quả
        </Link>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const { fixtures, standingsGroups } = await getData();

  const liveFixtures = fixtures.filter((fixture) => isDbLive(fixture.status_short));
  const upcomingFixtures = fixtures.filter((fixture) => isDbNotStarted(fixture.status_short));
  const finishedFixtures = fixtures.filter((fixture) => isDbFinished(fixture.status_short));

  const totalMatches = fixtures.length;
  const spotlight = sortFixturesByImportance(fixtures)[0];
  const todayLabel = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

  return (
    <>
      <LiveTicker fixtures={liveFixtures} />

      <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-4 sm:pt-5">
        <section className="site-panel px-4 py-4 sm:px-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
            <div className="min-w-0">
              <span className="section-label">Trung tâm trận đấu</span>
              <h1 className="mt-2 text-2xl font-black tracking-normal text-white sm:text-3xl">
                Tỷ số bóng đá trực tiếp hôm nay
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                Trận live lên trước, lịch sắp đá và kết quả FT nằm cùng một bảng để bạn quét nhanh trong vài giây.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="fact-chip capitalize">{todayLabel}</span>
                <span className="fact-chip">Cập nhật theo phút</span>
                <Link href="/lich-thi-dau" className="fact-chip hover:border-orange-300/40 hover:text-orange-100">
                  Lịch 7 ngày
                </Link>
                <Link href="/ket-qua" className="fact-chip hover:border-sky-300/40 hover:text-sky-100">
                  Kết quả 7 ngày
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <QuickStat label="Tổng" value={totalMatches} />
              <QuickStat label="Live" value={liveFixtures.length} tone="live" />
              <QuickStat label="Sắp đá" value={upcomingFixtures.length} tone="upcoming" />
              <QuickStat label="FT" value={finishedFixtures.length} tone="finished" />
            </div>
          </div>
        </section>

        <div className="mt-5 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            {fixtures.length === 0 ? <EmptyState /> : <TodayBoard fixtures={fixtures} />}
          </div>

          <aside className="min-w-0 space-y-4 xl:sticky xl:top-[92px] xl:self-start">
            <SpotlightCard fixture={spotlight} />
            <StandingsWidget groups={standingsGroups} />
          </aside>
        </div>
      </div>
    </>
  );
}
