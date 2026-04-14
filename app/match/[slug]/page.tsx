import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import EventTimeline from "@/components/EventTimeline";
import LineupGrid from "@/components/LineupGrid";
import LiveEventsPanel from "@/components/LiveEventsPanel";
import LiveScoreArea from "@/components/LiveScoreArea";
import LogoMark from "@/components/LogoMark";
import MatchTabs, { type TabId } from "@/components/MatchTabs";
import { BreadcrumbSchema, SportsEventSchema } from "@/components/SchemaMarkup";
import StatsBars from "@/components/StatsBars";
import {
  dbStatusLabel,
  getFixtureByIdFromDB,
  getFixtureEventsFromDB,
  getFixtureLineupsFromDB,
  getFixtureStatisticsFromDB,
  getMatchPreviewFromDB,
  isDbFinished,
  isDbLive,
  type DbEvent,
  type DbFixtureDetail,
  type DbLineup,
  type DbLineupPlayer,
  type DbMatchPreview,
  type DbMatchStatistic,
} from "@/lib/db-queries";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ketquawc.vn";

export const dynamic = "force-dynamic";

function idFromSlug(slug: string): number | null {
  const value = parseInt(slug.split("-").pop() ?? "", 10);
  return Number.isNaN(value) ? null : value;
}

function formatKickoff(date: string) {
  return new Date(date).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatCalendarDate(date: string) {
  return new Date(date).toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

function formatPreviewTimestamp(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function venueLabel(fixture: DbFixtureDetail) {
  if (!fixture.venue_name) return "Đang cập nhật";
  return fixture.venue_city ? `${fixture.venue_name}, ${fixture.venue_city}` : fixture.venue_name;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const id = idFromSlug(slug);
  if (!id) return { title: "Trận đấu không tìm thấy" };

  const fixture = await getFixtureByIdFromDB(id).catch(() => null);
  if (!fixture) return { title: "Trận đấu không tìm thấy" };

  const home = fixture.home_team;
  const away = fixture.away_team;
  const live = isDbLive(fixture.status_short);
  const finished = isDbFinished(fixture.status_short);
  const score = fixture.goals_home !== null ? `${fixture.goals_home}-${fixture.goals_away}` : "vs";
  const prefix = live ? "LIVE" : finished ? "Kết quả" : "Lịch";
  const title = `${prefix}: ${home.name} ${score} ${away.name} | ${fixture.league.name}`;
  const description = `Theo dõi ${live ? "trực tiếp " : ""}${home.name} vs ${away.name} - ${fixture.league.name} ${fixture.round ?? ""}. Tỷ số, diễn biến, đội hình và thống kê chi tiết.`;

  return {
    title,
    description,
    alternates: { canonical: `/match/${slug}` },
    openGraph: {
      title,
      description,
      type: "article",
      url: `${SITE_URL}/match/${slug}`,
    },
  };
}

function TeamPanel({
  team,
  side,
}: {
  team: DbFixtureDetail["home_team"];
  side: "home" | "away";
}) {
  const isHome = side === "home";

  return (
    <div className={`rounded-[28px] border border-white/10 bg-white/[0.04] p-5 ${isHome ? "xl:text-right" : "xl:text-left"}`}>
      <div className={`flex items-center gap-3 ${isHome ? "xl:flex-row-reverse" : ""}`}>
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] border border-white/10 bg-black/10">
          <LogoMark src={team.logo_url ?? ""} alt={team.name} size={34} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            {isHome ? "Chủ nhà" : "Đội khách"}
          </p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-white">{team.name}</p>
          <p className="mt-2 text-sm text-slate-400">Theo dõi đội hình và nhịp trận</p>
        </div>
      </div>
    </div>
  );
}

function MatchFact({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.04] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{note}</p>
    </div>
  );
}

function ScoreHeader({ fixture }: { fixture: DbFixtureDetail }) {
  const home = fixture.home_team;
  const away = fixture.away_team;
  const live = isDbLive(fixture.status_short);
  const finished = isDbFinished(fixture.status_short);
  const label = dbStatusLabel(fixture.status_short, fixture.status_elapsed);
  const statusText =
    fixture.status_short === "HT"
      ? "Nghỉ giữa hiệp"
      : live
        ? label
        : finished
          ? "Kết thúc"
          : label || `${formatKickoff(fixture.kickoff_at)} · ${formatCalendarDate(fixture.kickoff_at)}`;
  const statusClass =
    fixture.status_short === "HT"
      ? "border-yellow-300/20 bg-yellow-500/10 text-yellow-100"
      : live
        ? "border-red-400/20 bg-red-500/10 text-red-100"
        : finished
          ? "border-white/10 bg-white/[0.06] text-slate-200"
          : label
            ? "border-white/10 bg-white/[0.05] text-slate-300"
            : "border-orange-300/20 bg-orange-500/10 text-orange-100";

  return (
    <section className="site-panel relative overflow-hidden px-6 py-6 sm:px-8 sm:py-8">
      <div
        aria-hidden
        className="absolute inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 28%), radial-gradient(circle at right, rgba(251,146,60,0.16), transparent 32%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
        }}
      />

      <div className="relative">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <span className="section-label">Chi tiết trận đấu</span>
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <Link href="/" className="transition hover:text-white">
                Trang chủ
              </Link>
              <span>/</span>
              <Link href="/#match-center" className="transition hover:text-white">
                Trận hôm nay
              </Link>
              <span>/</span>
              <span className="text-slate-200">
                {home.name} vs {away.name}
              </span>
            </nav>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            <span className="fact-chip">{fixture.league.name}</span>
            <span className="fact-chip">{fixture.round}</span>
            <span className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${statusClass}`}>
              {statusText}
            </span>
          </div>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_auto_1fr] xl:items-center">
          <TeamPanel team={home} side="home" />

          {/* Live match: Client Component tự polling tỉ số mỗi 30s — không cần F5 */}
          {isDbLive(fixture.status_short) ? (
            <LiveScoreArea
              fixtureId={fixture.id}
              kickoffAt={fixture.kickoff_at}
              initial={{
                goalsHome: fixture.goals_home,
                goalsAway: fixture.goals_away,
                statusShort: fixture.status_short,
                statusElapsed: fixture.status_elapsed,
                scoreHtHome: fixture.score_ht_home,
                scoreHtAway: fixture.score_ht_away,
              }}
            />
          ) : (
            <div className="mx-auto w-full max-w-[280px] rounded-[30px] border border-white/10 bg-black/15 px-5 py-6 text-center shadow-card">
              {fixture.goals_home !== null ? (
                <>
                  <div className="flex items-center justify-center gap-3">
                    <span className="score text-5xl font-black text-white">{fixture.goals_home}</span>
                    <span className="text-slate-500">-</span>
                    <span className="score text-5xl font-black text-white">{fixture.goals_away}</span>
                  </div>
                  {fixture.score_ht_home !== null ? (
                    <p className="mt-3 text-sm text-slate-400">
                      HT {fixture.score_ht_home} – {fixture.score_ht_away}
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="score text-4xl font-black text-white">{formatKickoff(fixture.kickoff_at)}</p>
                  <p className="mt-3 text-sm text-slate-400">{formatCalendarDate(fixture.kickoff_at)}</p>
                </>
              )}
            </div>
          )}

          <TeamPanel team={away} side="away" />
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <MatchFact label="Giờ bóng lăn" value={formatKickoff(fixture.kickoff_at)} note={formatCalendarDate(fixture.kickoff_at)} />
          <MatchFact label="Sân vận động" value={venueLabel(fixture)} note={fixture.league.name} />
          <MatchFact
            label="Trọng tài"
            value={fixture.referee ?? "Đang cập nhật"}
            note={live ? "Trận đang diễn ra" : finished ? "Đã có kết quả cuối trận" : "Chờ trước giờ bóng lăn"}
          />
        </div>
      </div>
    </section>
  );
}

function MatchPreviewBody({ content }: { content: string }) {
  const nodes: JSX.Element[] = [];
  const lines = content.split(/\r?\n/);
  let paragraph: string[] = [];
  let listItems: string[] = [];

  function flushParagraph(key: string) {
    if (paragraph.length === 0) return;
    nodes.push(
      <p key={key} className="text-sm leading-7 text-slate-300">
        {paragraph.join(" ")}
      </p>
    );
    paragraph = [];
  }

  function flushList(key: string) {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={key} className="space-y-2 pl-5 text-sm leading-7 text-slate-300">
        {listItems.map((item, index) => (
          <li key={`${key}-${index}`}>{item}</li>
        ))}
      </ul>
    );
    listItems = [];
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph(`paragraph-${index}`);
      flushList(`list-${index}`);
      return;
    }

    if (line.startsWith("## ")) {
      flushParagraph(`paragraph-${index}`);
      flushList(`list-${index}`);
      nodes.push(
        <h2 key={`h2-${index}`} className="text-2xl font-black tracking-tight text-white">
          {line.slice(3)}
        </h2>
      );
      return;
    }

    if (line.startsWith("### ")) {
      flushParagraph(`paragraph-${index}`);
      flushList(`list-${index}`);
      nodes.push(
        <h3 key={`h3-${index}`} className="pt-3 text-lg font-bold text-white">
          {line.slice(4)}
        </h3>
      );
      return;
    }

    if (line.startsWith("- ")) {
      flushParagraph(`paragraph-${index}`);
      listItems.push(line.slice(2));
      return;
    }

    flushList(`list-${index}`);
    paragraph.push(line);
  });

  flushParagraph("paragraph-last");
  flushList("list-last");

  return <div className="space-y-4">{nodes}</div>;
}

function ExpertAnalysis({
  fixture,
  preview,
}: {
  fixture: DbFixtureDetail;
  preview: DbMatchPreview | null;
}) {
  if (preview) {
    return (
      <article className="px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="section-label">Phân tích trận đấu</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-400">
            Cập nhật {formatPreviewTimestamp(preview.generated_at)}
          </span>
        </div>
        <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-6 sm:px-6">
          <MatchPreviewBody content={preview.content} />
        </div>
      </article>
    );
  }

  return (
    <article className="px-4 py-5 sm:px-6 sm:py-6">
      <span className="section-label">Phân tích trận đấu</span>
      <h2 className="mt-4 text-2xl font-black tracking-tight text-white">
        Nhận định {fixture.home_team.name} vs {fixture.away_team.name}
      </h2>
      <div className="mt-5 rounded-[26px] border border-dashed border-white/15 bg-white/[0.03] px-6 py-8 text-center">
        <p className="text-sm leading-7 text-slate-300">
          {isDbFinished(fixture.status_short)
            ? "Bài recap sau trận chưa được tạo. Dữ liệu sẽ xuất hiện ngay khi phần phân tích được đồng bộ."
            : "Bài nhận định trước trận chưa được tạo. Quay lại sau khi job tạo preview chạy xong."}
        </p>
      </div>
    </article>
  );
}

function AdSlot({ label, height }: { label: string; height: number }) {
  return (
    <div style={{ height }} className="ad-shell flex flex-col items-center justify-center text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Inventory</p>
      <p className="mt-3 text-sm font-semibold text-white">{label}</p>
      <p className="mt-2 max-w-[220px] text-xs leading-6 text-slate-400">
        Giữ chỗ cho block tài trợ, partner logo hoặc creative theo từng trận.
      </p>
    </div>
  );
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ tab?: string | string[] }>;
}

export default async function MatchDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const tab = Array.isArray(resolvedSearchParams?.tab) ? resolvedSearchParams.tab[0] : resolvedSearchParams?.tab;
  const activeTab: TabId = tab === "lineups" || tab === "stats" || tab === "analysis" ? tab : "events";
  const fixtureId = idFromSlug(slug);
  if (!fixtureId) notFound();

  const fixture = await getFixtureByIdFromDB(fixtureId).catch(() => null);
  if (!fixture) notFound();

  let events: DbEvent[] = [];
  let lineups: DbLineup[] = [];
  let lineupPlayers: DbLineupPlayer[] = [];
  let stats: DbMatchStatistic[] = [];
  let preview: DbMatchPreview | null = null;

  if (activeTab === "events") {
    events = await getFixtureEventsFromDB(fixtureId).catch(() => []);
  }

  if (activeTab === "lineups") {
    const result = await getFixtureLineupsFromDB(fixtureId).catch(() => ({ lineups: [], players: [] }));
    lineups = result.lineups;
    lineupPlayers = result.players;
  }

  if (activeTab === "stats") {
    stats = await getFixtureStatisticsFromDB(fixtureId).catch(() => []);
  }

  if (activeTab === "analysis") {
    preview = await getMatchPreviewFromDB(fixtureId).catch(() => null);
  }

  return (
    <>
      <SportsEventSchema fixture={fixture} siteUrl={SITE_URL} />
      <BreadcrumbSchema
        siteUrl={SITE_URL}
        items={[
          { name: "Trang chủ", href: "/" },
          { name: "Trung tâm trận đấu", href: "/" },
          { name: `${fixture.home_team.name} vs ${fixture.away_team.name}`, href: `/match/${slug}` },
        ]}
      />

      <div className="px-4 pb-4 pt-6">
        <div className="mx-auto max-w-screen-xl">
          <ScoreHeader fixture={fixture} />
        </div>
      </div>

      <MatchTabs activeTab={activeTab} />

      <div className="px-4 pb-16 pt-4">
        <div className="mx-auto max-w-screen-xl lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-6">
          <div className="site-panel overflow-hidden">
            {activeTab === "events" ? (
              isDbLive(fixture.status_short) ? (
                /* Live match: Client Component polling events mỗi 30s */
                <LiveEventsPanel
                  fixtureId={fixture.id}
                  initialEvents={events}
                  initialFixture={fixture}
                />
              ) : (
                /* Finished / upcoming: Server-rendered tĩnh, tốt cho SEO */
                <EventTimeline events={events} fixture={fixture} />
              )
            ) : null}
            {activeTab === "lineups" ? <LineupGrid lineups={lineups} players={lineupPlayers} /> : null}
            {activeTab === "stats" ? <StatsBars stats={stats} /> : null}
            {activeTab === "analysis" ? <ExpertAnalysis fixture={fixture} preview={preview} /> : null}
          </div>

          <aside className="mt-4 space-y-4 lg:sticky lg:top-[180px] lg:mt-0">
            <div className="site-panel overflow-hidden p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">Match snapshot</p>
              <div className="mt-4 space-y-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Giải đấu</p>
                  <p className="mt-2 font-medium text-white">{fixture.league.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{fixture.round}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Địa điểm</p>
                  <p className="mt-2 font-medium text-white">{venueLabel(fixture)}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Điều hướng nhanh</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link href="/lich-thi-dau" className="flex items-center justify-between text-sm font-medium text-slate-200 transition hover:text-white">
                      Lịch thi đấu <span className="text-slate-500">→</span>
                    </Link>
                    <Link href="/bang-xep-hang" className="flex items-center justify-between text-sm font-medium text-slate-200 transition hover:text-white">
                      Bảng xếp hạng <span className="text-slate-500">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <a href="#affiliate" className="site-panel relative block overflow-hidden p-5 transition duration-200 hover:-translate-y-1 hover:border-white/20">
              <div
                aria-hidden
                className="absolute inset-0 opacity-80"
                style={{ background: "linear-gradient(145deg, rgba(251,146,60,0.16), rgba(34,197,94,0.10) 55%, transparent 100%)" }}
              />

              <div className="relative">
                <span className="section-label">Sponsor module</span>
                <p className="mt-4 text-xl font-bold text-white">Creative theo đúng ngữ cảnh trận đấu</p>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  Dùng cho áo đấu, gói tài trợ hoặc CTA thương mại bám sát đội bóng đang được mở.
                </p>
                <span className="action-secondary mt-5 inline-flex">Mở vị trí tài trợ</span>
              </div>
            </a>

            <AdSlot label="Quảng cáo 300 × 250" height={250} />
          </aside>
        </div>
      </div>
    </>
  );
}
