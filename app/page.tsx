import type { Metadata } from "next";
import Link from "next/link";
import LiveTicker from "@/components/LiveTicker";
import SpotlightCard from "@/components/home/SpotlightCard";
import StandingsWidget from "@/components/home/StandingsWidget";
import TodayBoard from "@/components/home/TodayBoard";
import {
  getTodayFixturesFromDB,
  getStandingsFromDB,
  isDbFinished,
  isDbLive,
  isDbNotStarted,
} from "@/lib/db-queries";
import { sortFixturesByImportance } from "@/lib/match-rank";

const WC_LEAGUE_ID = 1;
const WC_SEASON = 2026;

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
    getStandingsFromDB(WC_LEAGUE_ID, WC_SEASON),
  ]);

  const fixtures = fixturesRes.status === "fulfilled" ? fixturesRes.value : [];
  const standings = standingsRes.status === "fulfilled" ? standingsRes.value : [];

  return { fixtures, standings };
}

function StatPill({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${toneClass}`}>
      {tone === "live" ? <span className="live-dot" /> : null}
      <span className="score font-black">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function EmptyState() {
  return (
    <div className="site-panel px-6 py-10 text-center">
      <h2 className="text-2xl font-black tracking-tight text-white">Hôm nay chưa có trận nào.</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-7 text-slate-300">
        Xem lịch sắp tới hoặc tra kết quả gần đây.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <Link href="/lich-thi-dau" className="action-primary">Lịch thi đấu</Link>
        <Link href="/ket-qua" className="action-secondary">Kết quả</Link>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const { fixtures, standings } = await getData();

  const liveFixtures = fixtures.filter((f) => isDbLive(f.status_short));
  const upcomingFixtures = fixtures.filter((f) => isDbNotStarted(f.status_short));
  const finishedFixtures = fixtures.filter((f) => isDbFinished(f.status_short));

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

      <div className="mx-auto max-w-screen-xl px-4 pb-14 pt-4 sm:pt-5">
        <section className="site-panel px-4 py-4 sm:px-5 sm:py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                Tỷ số bóng đá trực tiếp
              </h1>
              <p className="mt-1 text-xs capitalize text-slate-400 sm:text-sm">
                {todayLabel} · cập nhật theo phút
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatPill label="trận" value={totalMatches} />
              <StatPill label="live" value={liveFixtures.length} tone="live" />
              <StatPill label="sắp đá" value={upcomingFixtures.length} tone="upcoming" />
              <StatPill label="FT" value={finishedFixtures.length} tone="finished" />
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            {fixtures.length === 0 ? <EmptyState /> : <TodayBoard fixtures={fixtures} />}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-[76px] xl:self-start">
            {spotlight ? <SpotlightCard fixture={spotlight} /> : null}
            <StandingsWidget standings={standings} />
          </aside>
        </div>
      </div>
    </>
  );
}
