import type { Metadata } from "next";
import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import {
  getLatestMatchPreviewsFromDB,
  getUpcomingFixturesFromDB,
  type DbFixture,
  type DbPreviewIndexItem,
} from "@/lib/db-queries";
import { sortFixturesByImportance } from "@/lib/match-rank";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Nhận định & Phân tích",
  description:
    "Nhận định chuyên sâu trước giờ bóng lăn — phân tích đội hình, phong độ và dự đoán kết quả các trận đấu lớn tại World Cup 2026 và các giải hàng đầu.",
  alternates: { canonical: "/goc-chuyen-gia" },
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

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function createExcerpt(content: string, maxLength = 180) {
  const plain = content.replace(/^#+\s+/gm, "").replace(/\s+/g, " ").trim();
  if (plain.length <= maxLength) return plain;
  return `${plain.slice(0, maxLength).trim()}...`;
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

function PublishedPreviewCard({ item }: { item: DbPreviewIndexItem }) {
  const fixture = item.fixture;

  return (
    <article className="site-panel overflow-hidden p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="fact-chip">{fixture.league.name}</span>
        {fixture.round ? <span className="fact-chip">{fixture.round}</span> : null}
        <span className="fact-chip">Cập nhật {formatGeneratedAt(item.generated_at)}</span>
      </div>

      <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
        {fixture.home_team.name} vs {fixture.away_team.name}
      </h2>

      <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="min-w-0 text-right">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-black/10">
            <LogoMark src={fixture.home_team.logo_url ?? ""} alt="" size={24} />
          </div>
          <p className="truncate text-sm font-bold text-white">{fixture.home_team.name}</p>
        </div>

        <div className="rounded-[24px] border border-white/10 bg-black/15 px-4 py-3 text-center">
          <p className="score text-xl font-black text-white">
            {fixture.goals_home !== null ? `${fixture.goals_home} - ${fixture.goals_away}` : "VS"}
          </p>
          <p className="mt-1 text-xs text-slate-400">{formatKickoff(fixture.kickoff_at)}</p>
        </div>

        <div className="min-w-0">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] border border-white/10 bg-black/10">
            <LogoMark src={fixture.away_team.logo_url ?? ""} alt="" size={24} />
          </div>
          <p className="truncate text-sm font-bold text-white">{fixture.away_team.name}</p>
        </div>
      </div>

      <p className="mt-5 text-sm leading-7 text-slate-300">{createExcerpt(item.content)}</p>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/match/${fixture.slug}?tab=analysis`} className="action-primary">
          Đọc nhận định
        </Link>
        <Link href={`/match/${fixture.slug}`} className="action-secondary">
          Mở match center
        </Link>
      </div>
    </article>
  );
}

function UpcomingAnalysisCard({ fixture }: { fixture: DbFixture }) {
  return (
    <article className="site-panel overflow-hidden p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span className="fact-chip">{fixture.league.name}</span>
        {fixture.round ? <span className="fact-chip">{fixture.round}</span> : null}
        <span className="fact-chip">{formatKickoff(fixture.kickoff_at)}</span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <LogoMark src={fixture.home_team.logo_url ?? ""} alt="" size={18} />
            <p className="truncate text-sm font-semibold text-white">{fixture.home_team.name}</p>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <LogoMark src={fixture.away_team.logo_url ?? ""} alt="" size={18} />
            <p className="truncate text-sm font-semibold text-white">{fixture.away_team.name}</p>
          </div>
        </div>

        <div className="shrink-0 rounded-[20px] border border-orange-300/20 bg-orange-500/10 px-4 py-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">Sắp có</p>
          <p className="mt-1 text-xs text-slate-400">Nhận định sắp ra</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <Link href={`/match/${fixture.slug}?tab=analysis`} className="action-primary">
          Mở tab phân tích
        </Link>
        <Link href={`/league/${fixture.league.id}?section=fixtures`} className="action-secondary">
          Xem lịch của giải
        </Link>
      </div>
    </article>
  );
}

export default async function ExpertCornerPage() {
  const [previews, upcomingFixtures] = await Promise.all([getLatestMatchPreviewsFromDB(10), getUpcomingFixturesFromDB(5)]);

  const previewFixtureIds = new Set(previews.map((item) => item.fixture_id));
  const queuedFixtures = sortFixturesByImportance(upcomingFixtures).filter((fixture) => !previewFixtureIds.has(fixture.id)).slice(0, 8);
  const headlineFixture = previews[0]?.fixture ?? queuedFixtures[0];

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      <section className="site-panel relative overflow-hidden px-6 py-7 sm:px-8 sm:py-8">
        <div
          aria-hidden
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(251,146,60,0.18), transparent 30%), radial-gradient(circle at right center, rgba(56,189,248,0.14), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        />

        <div className="relative">
          <span className="section-label">Nhận định & Phân tích</span>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="fact-chip">Phân tích chuyên sâu</span>
            <span className="fact-chip">Cập nhật liên tục</span>
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
            Nhận định & Phân tích chuyên sâu
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Đọc nhận định chi tiết trước giờ bóng lăn — phân tích đội hình, phong độ, lịch sử đối đầu và dự đoán kết quả các trận đấu lớn.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <SnapshotMetric label="Bài nhận định" value={previews.length} hint="Nhận định chi tiết đã có sẵn." />
            <SnapshotMetric label="Sắp có nhận định" value={queuedFixtures.length} hint="Trận đang được chuẩn bị phân tích." />
            <SnapshotMetric
              label="Nổi bật"
              value={headlineFixture ? headlineFixture.league.name : "—"}
              hint={headlineFixture ? `${headlineFixture.home_team.name} vs ${headlineFixture.away_team.name}` : "Chưa có trận nổi bật."}
            />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-col gap-2">
              <span className="section-label">Nhận định mới nhất</span>
              <h2 className="text-3xl font-black tracking-tight text-white">Phân tích trước giờ bóng lăn</h2>
            </div>

            {previews.length === 0 ? (
              <div className="site-panel px-6 py-10 text-center">
                <h3 className="text-2xl font-black tracking-tight text-white">Chưa có bài nhận định nào.</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  Nhận định sẽ xuất hiện tại đây trước các trận đấu lớn.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {previews.map((item) => (
                  <PublishedPreviewCard key={`${item.fixture_id}-${item.generated_at}`} item={item} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex flex-col gap-2">
              <span className="section-label">Sắp diễn ra</span>
              <h2 className="text-3xl font-black tracking-tight text-white">Trận đáng theo dõi</h2>
            </div>

            {queuedFixtures.length === 0 ? (
              <div className="site-panel px-6 py-10 text-center">
                <h3 className="text-2xl font-black tracking-tight text-white">Không có trận nào sắp diễn ra.</h3>
                <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  Quay lại khi có lịch thi đấu mới.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {queuedFixtures.map((fixture) => (
                  <UpcomingAnalysisCard key={fixture.id} fixture={fixture} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-[92px] xl:self-start">
          <div className="site-panel p-5">
            <span className="section-label">Điểm vào nhanh</span>
            <div className="mt-4 flex flex-col gap-3">
              <Link href="/lich-thi-dau" className="action-secondary justify-center">
                Xem lịch thi đấu
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
