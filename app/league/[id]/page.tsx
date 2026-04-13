import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import LogoMark from "@/components/LogoMark";
import MatchCard from "@/components/MatchCard";
import TopPlayersWidget, { type TopPlayersTabId } from "@/components/league/TopPlayersWidget";
import WorldCupGroupsBoard from "@/components/league/WorldCupGroupsBoard";
import {
  formatSeasonLabel,
  getLeagueAllRounds,
  getLeagueCurrentRound,
  getLeagueFixturesByRoundPrefix,
  getLeagueRoundFixtures,
  getStandingsFromDB,
  type DbStanding,
} from "@/lib/db-queries";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ section?: string; tab?: string; round?: string }>;
}

type LeagueRow = {
  id: number;
  name: string;
  logo_url: string | null;
  type: string;
  country: { name: string } | null;
};

type SeasonInfo = {
  season_year: number;
  start_date: string | null;
  end_date: string | null;
};

type SectionId = "overview" | "fixtures" | "standings";

async function getLeague(leagueId: number): Promise<LeagueRow | null> {
  const { data, error } = await getSupabaseAdmin()
    .from("leagues")
    .select("id,name,logo_url,type,country:countries!country_id(name)")
    .eq("id", leagueId)
    .maybeSingle();

  if (error) {
    console.error("[league page] getLeague:", error.message);
    return null;
  }

  return data as unknown as LeagueRow | null;
}

async function getCurrentSeasonInfo(leagueId: number): Promise<SeasonInfo> {
  const { data } = await getSupabaseAdmin()
    .from("league_seasons")
    .select("season_year,start_date,end_date")
    .eq("league_id", leagueId)
    .eq("is_current", true)
    .maybeSingle();

  if (data) return data as unknown as SeasonInfo;

  const { data: latest } = await getSupabaseAdmin()
    .from("league_seasons")
    .select("season_year,start_date,end_date")
    .eq("league_id", leagueId)
    .order("season_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest) return latest as unknown as SeasonInfo;

  return {
    season_year: new Date().getFullYear(),
    start_date: null,
    end_date: null,
  };
}

function formatRoundBase(base: string) {
  const lower = base.toLowerCase();

  if (lower === "regular season") return "Vòng";
  if (lower === "group stage") return "Vòng bảng";
  if (lower === "league stage") return "League stage";
  if (lower === "play-offs") return "Play-off";
  if (lower === "round of 16") return "Vòng 1/8";
  if (lower === "round of 32") return "Vòng 1/16";
  if (lower === "round of 64") return "Vòng 1/32";
  if (lower === "quarter-finals" || lower === "quarter-final") return "Tứ kết";
  if (lower === "semi-finals" || lower === "semi-final") return "Bán kết";
  if (lower === "final") return "Chung kết";
  return base;
}

function formatRoundLabel(round: string): string {
  const parts = round.split(" - ");
  const base = parts[0] ?? round;
  const detail = parts[1];
  const translatedBase = formatRoundBase(base);

  if (!detail) return translatedBase;

  if (/^\d+$/.test(detail)) {
    return translatedBase === "Vòng" ? `${translatedBase} ${detail}` : `${translatedBase} - lượt ${detail}`;
  }

  const lowerDetail = detail.toLowerCase();
  if (lowerDetail === "1st legs") return `${translatedBase} - lượt đi`;
  if (lowerDetail === "2nd legs") return `${translatedBase} - lượt về`;

  return `${translatedBase} - ${detail}`;
}

function buildLeagueHref(
  leagueId: number,
  section: SectionId,
  options?: { tab?: TopPlayersTabId; round?: string }
) {
  const params = new URLSearchParams();

  if (section !== "overview") params.set("section", section);
  if (options?.tab) params.set("tab", options.tab);
  if (options?.round) params.set("round", options.round);

  const query = params.toString();
  return query ? `/league/${leagueId}?${query}` : `/league/${leagueId}`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const leagueId = Number.parseInt(id, 10);
  if (!Number.isFinite(leagueId)) return { title: "Giải đấu" };

  const league = await getLeague(leagueId);
  if (!league) return { title: "Giải đấu không tìm thấy" };

  return {
    title: `${league.name} - lịch, BXH và vòng đấu hiện tại`,
    description: `Theo dõi ${league.name}: vòng đấu hiện tại, bảng xếp hạng hoặc bảng đấu, top cầu thủ và toàn bộ lịch thi đấu theo mùa.`,
    alternates: { canonical: `/league/${leagueId}` },
  };
}

function SectionTabs({
  leagueId,
  activeSection,
  activeTab,
  selectedRound,
}: {
  leagueId: number;
  activeSection: SectionId;
  activeTab: TopPlayersTabId;
  selectedRound?: string;
}) {
  const tabs: { key: SectionId; label: string }[] = [
    { key: "overview", label: "Tổng quan" },
    { key: "fixtures", label: "Vòng đấu" },
    { key: "standings", label: "BXH / Bảng đấu" },
  ];

  return (
    <div className="mb-5 flex gap-0 overflow-x-auto border-b border-white/10">
      {tabs.map((tab) => {
        const isActive = activeSection === tab.key;

        return (
          <Link
            key={tab.key}
            href={buildLeagueHref(leagueId, tab.key, { tab: activeTab, round: selectedRound })}
            className={`relative shrink-0 px-5 py-3 text-sm font-semibold transition-colors ${
              isActive ? "text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.label}
            {isActive ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500" /> : null}
          </Link>
        );
      })}
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="site-panel px-5 py-12 text-center">
      <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-300">{description}</p>
    </div>
  );
}

function Chevron({
  direction,
  disabled,
}: {
  direction: "left" | "right";
  disabled?: boolean;
}) {
  return (
    <span
      className={`flex h-10 w-10 items-center justify-center rounded-2xl border text-lg ${
        disabled
          ? "border-white/5 bg-white/[0.02] text-slate-600"
          : "border-white/10 bg-white/[0.04] text-white"
      }`}
    >
      {direction === "left" ? "←" : "→"}
    </span>
  );
}

function RoundPager({
  leagueId,
  section,
  activeTab,
  rounds,
  activeRound,
}: {
  leagueId: number;
  section: SectionId;
  activeTab: TopPlayersTabId;
  rounds: string[];
  activeRound: string;
}) {
  const activeIndex = rounds.indexOf(activeRound);
  const prevRound = activeIndex > 0 ? rounds[activeIndex - 1] : null;
  const nextRound = activeIndex >= 0 && activeIndex < rounds.length - 1 ? rounds[activeIndex + 1] : null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4">
      {prevRound ? (
        <Link href={buildLeagueHref(leagueId, section, { tab: activeTab, round: prevRound })} scroll={false}>
          <Chevron direction="left" />
        </Link>
      ) : (
        <Chevron direction="left" disabled />
      )}

      <div className="min-w-0 flex-1 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {activeIndex + 1}/{rounds.length}
        </p>
        <h3 className="mt-2 truncate text-xl font-black tracking-tight text-white">
          {formatRoundLabel(activeRound)}
        </h3>
      </div>

      {nextRound ? (
        <Link href={buildLeagueHref(leagueId, section, { tab: activeTab, round: nextRound })} scroll={false}>
          <Chevron direction="right" />
        </Link>
      ) : (
        <Chevron direction="right" disabled />
      )}
    </div>
  );
}

function StandingsTable({
  title,
  description,
  standings,
}: {
  title: string;
  description: string;
  standings: DbStanding[];
}) {
  return (
    <section className="site-panel overflow-hidden">
      <div
        className="border-b border-white/10 px-5 py-4"
        style={{
          background:
            "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))",
        }}
      >
        <span className="section-label">Bảng xếp hạng</span>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">{description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-500">
              <th className="w-8 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">#</th>
              <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">Đội</th>
              <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">Đ</th>
              <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">T</th>
              <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">H</th>
              <th className="w-10 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">B</th>
              <th className="w-12 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">HS</th>
              <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">PT</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry) => (
              <tr key={`${entry.league_id}-${entry.team_id}`} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                <td className="px-4 py-3 text-sm text-slate-400">{entry.rank}</td>
                <td className="py-3 pr-2">
                  <div className="flex items-center gap-2">
                    <LogoMark src={entry.team.logo_url ?? ""} alt="" size={18} />
                    <span className="max-w-[220px] truncate font-medium text-white">{entry.team.name}</span>
                  </div>
                </td>
                <td className="py-3 text-center text-slate-300">{entry.played}</td>
                <td className="py-3 text-center text-slate-300">{entry.win}</td>
                <td className="py-3 text-center text-slate-300">{entry.draw}</td>
                <td className="py-3 text-center text-slate-300">{entry.lose}</td>
                <td className={`py-3 text-center ${entry.goals_diff > 0 ? "text-emerald-300" : entry.goals_diff < 0 ? "text-red-300" : "text-slate-500"}`}>
                  {entry.goals_diff > 0 ? `+${entry.goals_diff}` : entry.goals_diff}
                </td>
                <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function CurrentRoundSection({
  leagueId,
  season,
  seasonLabel,
  activeTab,
  selectedRound,
  compact = false,
}: {
  leagueId: number;
  season: number;
  seasonLabel: string;
  activeTab: TopPlayersTabId;
  selectedRound?: string;
  compact?: boolean;
}) {
  const [allRounds, detectedCurrentRound] = await Promise.all([
    getLeagueAllRounds(leagueId, season),
    getLeagueCurrentRound(leagueId, season),
  ]);

  const candidateRound = selectedRound ? decodeURIComponent(selectedRound) : detectedCurrentRound ?? allRounds.at(-1);
  const activeRound = candidateRound && allRounds.includes(candidateRound) ? candidateRound : allRounds.at(-1);

  if (!activeRound) {
    return (
      <EmptyPanel
        title="Chưa có vòng đấu nào"
        description="Khi fixture của giải được đồng bộ, phần này sẽ tự nhận diện vòng đang diễn ra, sắp diễn ra gần nhất hoặc vòng vừa kết thúc."
      />
    );
  }

  const fixtures = await getLeagueRoundFixtures(leagueId, season, activeRound);

  return (
    <section id="current-round" className="space-y-3">
      <div className="site-panel overflow-hidden">
        <div
          className="border-b border-white/10 px-5 py-4"
          style={{
            background:
              "linear-gradient(135deg, rgba(251,146,60,0.14), rgba(56,189,248,0.08) 60%, rgba(255,255,255,0.02))",
          }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span className="section-label">Vòng đấu hiện tại</span>
              <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
                {compact ? `Điểm vào mùa ${seasonLabel}` : `Điều hướng vòng đấu mùa ${seasonLabel}`}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">
                Các giải league thường sẽ đi theo vòng tuần tự. Các giải như C1, C2 hoặc World Cup có thể đi từ vòng bảng sang knock-out, có lượt đi và lượt về. Phần này dùng chính thứ tự round trong dữ liệu để điều hướng bằng mũi tên trái phải.
              </p>
            </div>

            {!compact ? (
              <Link href={buildLeagueHref(leagueId, "standings", { tab: activeTab })} className="action-secondary">
                Mở BXH / bảng đấu
              </Link>
            ) : null}
          </div>
        </div>

        {allRounds.length > 1 ? (
          <RoundPager
            leagueId={leagueId}
            section={compact ? "overview" : "fixtures"}
            activeTab={activeTab}
            rounds={allRounds}
            activeRound={activeRound}
          />
        ) : null}

        {fixtures.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-400">Không có trận nào trong round này.</p>
        ) : (
          <div className="divide-y divide-white/[0.05] px-2 py-2">
            {fixtures.map((fixture) => (
              <MatchCard key={fixture.id} fixture={fixture} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

async function StandingsSection({
  leagueId,
  season,
  seasonLabel,
  compact = false,
}: {
  leagueId: number;
  season: number;
  seasonLabel: string;
  compact?: boolean;
}) {
  const [standings, worldCupGroupFixtures] = await Promise.all([
    getStandingsFromDB(leagueId, season),
    leagueId === 1 ? getLeagueFixturesByRoundPrefix(leagueId, season, "Group Stage") : Promise.resolve([]),
  ]);

  if (standings.length > 0) {
    return (
      <StandingsTable
        title={compact ? "Bảng xếp hạng hiện tại" : `Bảng xếp hạng mùa ${seasonLabel}`}
        description={
          compact
            ? "Bảng xếp hạng đầy đủ của giải ở mùa hiện tại."
            : "Bạn có thể dùng phần này để xem đầy đủ thứ hạng, hiệu số và số trận đã đá của toàn bộ các đội trong giải."
        }
        standings={standings}
      />
    );
  }

  if (leagueId === 1 && worldCupGroupFixtures.length > 0) {
    return <WorldCupGroupsBoard fixtures={worldCupGroupFixtures} />;
  }

  return (
    <EmptyPanel
      title="Chưa có bảng xếp hạng"
      description={`Giải này hiện chưa có dữ liệu standings cho mùa ${seasonLabel}. Khi job sync standings chạy xong, bảng xếp hạng sẽ xuất hiện tại đây.`}
    />
  );
}

async function OverviewSection({
  leagueId,
  season,
  seasonLabel,
  activeTab,
  selectedRound,
}: {
  leagueId: number;
  season: number;
  seasonLabel: string;
  activeTab: TopPlayersTabId;
  selectedRound?: string;
}) {
  return (
    <div className="space-y-6">
      <CurrentRoundSection
        leagueId={leagueId}
        season={season}
        seasonLabel={seasonLabel}
        activeTab={activeTab}
        selectedRound={selectedRound}
        compact
      />
      <StandingsSection leagueId={leagueId} season={season} seasonLabel={seasonLabel} compact />
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <div className="site-panel overflow-hidden">
      <div className="h-16 animate-pulse bg-white/[0.04]" />
      <div className="divide-y divide-white/[0.05]">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-5 animate-pulse rounded bg-white/10" />
            <div className="h-5 w-5 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
            <div className="ml-auto flex gap-4">
              {Array.from({ length: 5 }).map((_, inner) => (
                <div key={inner} className="h-3 w-6 animate-pulse rounded bg-white/[0.06]" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FixturesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="site-panel h-12 animate-pulse" />
      <div className="site-panel divide-y divide-white/[0.05] overflow-hidden">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-4">
            <div className="h-6 w-14 animate-pulse rounded bg-white/10" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-36 animate-pulse rounded bg-white/10" />
              <div className="h-3 w-28 animate-pulse rounded bg-white/[0.06]" />
            </div>
            <div className="h-8 w-8 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SidebarSkeleton() {
  return (
    <div className="site-panel overflow-hidden">
      <div className="h-20 animate-pulse bg-white/[0.04]" />
      <div className="divide-y divide-white/[0.06]">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-3">
            <div className="h-3 w-5 animate-pulse rounded bg-white/10" />
            <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-white/10" />
              <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.06]" />
            </div>
            <div className="h-5 w-8 animate-pulse rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function LeaguePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const rawTab = resolvedSearchParams?.tab;
  const rawSection = resolvedSearchParams?.section;
  const rawRound = resolvedSearchParams?.round;

  const activeTab: TopPlayersTabId = rawTab === "assists" || rawTab === "cards" ? rawTab : "scorers";
  const activeSection: SectionId =
    rawSection === "fixtures" || rawSection === "standings" ? rawSection : "overview";

  const leagueId = Number.parseInt(id, 10);
  if (!Number.isFinite(leagueId)) notFound();

  const [league, seasonInfo] = await Promise.all([getLeague(leagueId), getCurrentSeasonInfo(leagueId)]);
  if (!league) notFound();

  const seasonLabel =
    formatSeasonLabel(seasonInfo.season_year, seasonInfo.start_date, seasonInfo.end_date) ?? String(seasonInfo.season_year);

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      <div className="site-panel relative mb-6 overflow-hidden px-6 py-6">
        <div
          aria-hidden
          className="absolute inset-0 opacity-80"
          style={{
            background:
              "radial-gradient(circle at top left, rgba(56,189,248,0.2), transparent 40%), linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))",
          }}
        />

        <div className="relative flex items-center gap-5">
          {league.logo_url ? (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/20">
              <Image src={league.logo_url} alt={league.name} width={44} height={44} className="object-contain" unoptimized />
            </div>
          ) : null}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-label">Giải đấu</span>
              <span className="fact-chip">{league.type}</span>
              {league.country ? <span className="fact-chip">{league.country.name}</span> : null}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{league.name}</h1>
            <p className="mt-1 text-sm text-slate-400">Mùa {seasonLabel}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
        <div>
          <SectionTabs
            leagueId={leagueId}
            activeSection={activeSection}
            activeTab={activeTab}
            selectedRound={rawRound}
          />

          {activeSection === "overview" ? (
            <Suspense fallback={<FixturesSkeleton />}>
              <OverviewSection
                leagueId={leagueId}
                season={seasonInfo.season_year}
                seasonLabel={seasonLabel}
                activeTab={activeTab}
                selectedRound={rawRound}
              />
            </Suspense>
          ) : null}

          {activeSection === "fixtures" ? (
            <Suspense fallback={<FixturesSkeleton />}>
              <CurrentRoundSection
                leagueId={leagueId}
                season={seasonInfo.season_year}
                seasonLabel={seasonLabel}
                activeTab={activeTab}
                selectedRound={rawRound}
              />
            </Suspense>
          ) : null}

          {activeSection === "standings" ? (
            <Suspense fallback={<StandingsSkeleton />}>
              <StandingsSection
                leagueId={leagueId}
                season={seasonInfo.season_year}
                seasonLabel={seasonLabel}
              />
            </Suspense>
          ) : null}
        </div>

        <div className="space-y-4 lg:sticky lg:top-[92px] lg:self-start">
          <Suspense fallback={<SidebarSkeleton />}>
            <TopPlayersWidget leagueId={leagueId} season={seasonInfo.season_year} activeTab={activeTab} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
