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

function SnapshotMetric({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint: string;
  tone?: "default" | "live" | "upcoming" | "finished";
}) {
  const toneClass =
    tone === "live"
      ? "border-red-400/20 bg-red-500/10"
      : tone === "upcoming"
        ? "border-orange-300/20 bg-orange-500/10"
        : tone === "finished"
          ? "border-sky-300/20 bg-sky-500/10"
          : "border-white/10 bg-white/[0.04]";

  return (
    <div className={`rounded-[24px] border p-4 backdrop-blur-xl ${toneClass}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-3 score text-3xl font-black text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-300">{hint}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="site-panel px-6 py-10 text-center">
      <span className="section-label">Lịch thi đấu</span>
      <h2 className="mt-4 text-3xl font-black tracking-tight text-white">Hôm nay chưa có trận nào.</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
        Xem lịch thi đấu sắp tới hoặc tra kết quả các trận gần đây.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/lich-thi-dau" className="action-primary">Xem lịch thi đấu</Link>
        <Link href="/ket-qua" className="action-secondary">Kết quả gần đây</Link>
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

      <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6 sm:pt-8">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
          <div className="site-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
            <div
              aria-hidden
              className="absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(circle at top left, rgba(56,189,248,0.22), transparent 30%), radial-gradient(circle at right center, rgba(251,146,60,0.18), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
              }}
            />

            <div className="relative">
              <span className="section-label">Trung tâm trận đấu</span>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="fact-chip capitalize">{todayLabel}</span>
                <span className="fact-chip">Cập nhật theo từng phút</span>
              </div>

              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">
                Tỷ số bóng đá trực tiếp hôm nay
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
                Theo dõi tỷ số trực tiếp theo từng phút — trận đang đấu luôn lên trước, cạnh ngay kết quả và lịch sắp tới để bạn không bỏ lỡ gì.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/#match-center" className="action-primary">
                  Xem lịch hôm nay
                </Link>
                <Link href="/#spotlight" className="action-secondary">
                  Mở trận tâm điểm
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SnapshotMetric label="Tổng trận" value={totalMatches} hint="Tất cả trận đấu trong ngày." />
                <SnapshotMetric label="Đang live" value={liveFixtures.length} hint="Trận đang diễn ra ngay lúc này." tone="live" />
                <SnapshotMetric label="Sắp diễn ra" value={upcomingFixtures.length} hint="Trận chưa bắt đầu hôm nay." tone="upcoming" />
                <SnapshotMetric label="Kết thúc" value={finishedFixtures.length} hint="Trận đã có kết quả." tone="finished" />
              </div>
            </div>
          </div>

          <SpotlightCard fixture={spotlight} />
        </section>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            {fixtures.length === 0 ? <EmptyState /> : <TodayBoard fixtures={fixtures} />}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-[92px] xl:self-start">
            <StandingsWidget standings={standings} />
          </aside>
        </div>
      </div>
    </>
  );
}
