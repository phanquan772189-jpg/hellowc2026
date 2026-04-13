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
  title: "Góc chuyên gia",
  description:
    "Tổng hợp các bài nhận định đã sinh và danh sách trận sắp có preview. Mở trực tiếp tab phân tích của từng trận để theo dõi nội dung chuyên gia.",
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

        <div className="shrink-0 rounded-[20px] border border-white/10 bg-black/15 px-4 py-3 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">Preview</p>
          <p className="mt-1 text-xs text-slate-400">Đang chờ job sinh nội dung</p>
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
          <span className="section-label">Góc chuyên gia</span>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-400">
            <span className="fact-chip">Index các tab phân tích</span>
            <span className="fact-chip">Ưu tiên trận lớn và trận sắp diễn ra</span>
          </div>

          <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight text-white sm:text-5xl">
            Nơi gom toàn bộ nhận định và trận sắp có preview
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
            Trang này là lớp điều hướng cho nội dung phân tích. Khi preview đã được sinh, bạn đọc trực tiếp từ đây; khi chưa có, bạn vẫn có thể mở sẵn tab phân tích của trận để theo dõi ngay lúc nội dung xuất hiện.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <SnapshotMetric label="Preview đã có" value={previews.length} hint="Bài phân tích đã được lưu vào DB." />
            <SnapshotMetric label="Đang chờ sinh" value={queuedFixtures.length} hint="Trận ưu tiên tiếp theo cho job preview." />
            <SnapshotMetric
              label="Trọng tâm"
              value={headlineFixture ? headlineFixture.league.name : "—"}
              hint={headlineFixture ? `${headlineFixture.home_team.name} vs ${headlineFixture.away_team.name}` : "Chưa có fixture nổi bật."}
            />
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex flex-col gap-2">
              <span className="section-label">Đã xuất bản</span>
              <h2 className="text-3xl font-black tracking-tight text-white">Preview đã sẵn sàng</h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                Các bài dưới đây đã được sinh và có thể mở trực tiếp vào tab phân tích của từng trận.
              </p>
            </div>

            {previews.length === 0 ? (
              <div className="site-panel px-6 py-10 text-center">
                <h3 className="text-2xl font-black tracking-tight text-white">Chưa có bài nhận định nào được lưu.</h3>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  Hệ thống đã có sẵn tab phân tích trong từng match page. Khi cron tạo preview chạy xong, danh sách bài sẽ tự hiện tại đây.
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
              <span className="section-label">Hàng chờ</span>
              <h2 className="text-3xl font-black tracking-tight text-white">Trận nên theo dõi tiếp theo</h2>
              <p className="max-w-2xl text-sm leading-7 text-slate-300">
                Đây là các cặp đấu được xếp ưu tiên theo độ quan trọng để mở nhanh tab phân tích, kể cả khi bài preview chưa được sinh xong.
              </p>
            </div>

            {queuedFixtures.length === 0 ? (
              <div className="site-panel px-6 py-10 text-center">
                <h3 className="text-2xl font-black tracking-tight text-white">Hiện không có trận nào trong hàng chờ.</h3>
                <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                  Khi lịch thi đấu mới được đồng bộ hoặc khi một trận được đánh giá quan trọng hơn, danh sách ưu tiên sẽ xuất hiện ở đây.
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

          <div className="site-panel p-5">
            <span className="section-label">Luồng nội dung</span>
            <div className="mt-4 space-y-3 text-sm leading-7 text-slate-300">
              <p>1. Lịch thi đấu chọn ra cặp đấu quan trọng.</p>
              <p>2. Job preview sinh nội dung và lưu vào `match_previews`.</p>
              <p>3. Match page hiển thị nội dung trong tab phân tích.</p>
              <p>4. Trang này gom lại thành index để điều hướng theo intent đọc nhận định.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
