import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import LogoMark from "@/components/LogoMark";
import TopPlayersWidget, { type TopPlayersTabId } from "@/components/league/TopPlayersWidget";
import { getStandingsFromDB, type DbStanding } from "@/lib/db-queries";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}

type LeagueRow = {
  id: number;
  name: string;
  logo_url: string | null;
  type: string;
  country: { name: string } | null;
};

type SeasonRow = { season_year: number };

// ─── Data helpers ─────────────────────────────────────────────────────────────

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

async function getCurrentSeason(leagueId: number): Promise<number> {
  const { data } = await getSupabaseAdmin()
    .from("league_seasons")
    .select("season_year")
    .eq("league_id", leagueId)
    .eq("is_current", true)
    .maybeSingle();

  if (data) return (data as unknown as SeasonRow).season_year;

  // Fallback: lấy mùa mới nhất
  const { data: latest } = await getSupabaseAdmin()
    .from("league_seasons")
    .select("season_year")
    .eq("league_id", leagueId)
    .order("season_year", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latest ? (latest as unknown as SeasonRow).season_year : new Date().getFullYear();
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const leagueId = parseInt(id, 10);
  if (!Number.isFinite(leagueId)) return { title: "Giải đấu" };

  const league = await getLeague(leagueId);
  if (!league) return { title: "Giải đấu không tìm thấy" };

  return {
    title: `${league.name} — Bảng xếp hạng & Thống kê`,
    description: `Bảng xếp hạng, vua phá lưới và thống kê cầu thủ giải ${league.name}${league.country ? ` (${league.country.name})` : ""}.`,
    alternates: { canonical: `/league/${leagueId}` },
  };
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function StandingsSkeleton() {
  return (
    <div className="site-panel overflow-hidden">
      <div className="h-14 animate-pulse bg-white/[0.04]" />
      <div className="divide-y divide-white/[0.05]">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="h-4 w-5 animate-pulse rounded bg-white/10" />
            <div className="h-5 w-5 animate-pulse rounded-full bg-white/10" />
            <div className="h-3 w-28 animate-pulse rounded bg-white/10" />
            <div className="ml-auto flex gap-4">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-3 w-6 animate-pulse rounded bg-white/[0.06]" />
              ))}
            </div>
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
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
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

// ─── Standings Table ──────────────────────────────────────────────────────────

function DescriptionBadge({ desc }: { desc: string | null }) {
  if (!desc) return null;
  const lower = desc.toLowerCase();
  const color = lower.includes("champion") || lower.includes("promotion")
    ? "bg-emerald-500/20 text-emerald-300"
    : lower.includes("relegation")
    ? "bg-red-500/20 text-red-300"
    : lower.includes("europa") || lower.includes("qualification")
    ? "bg-orange-500/20 text-orange-300"
    : null;

  if (!color) return null;
  return <span className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-sm ${color.split(" ")[0]}`} />;
}

async function StandingsSection({ leagueId, season }: { leagueId: number; season: number }) {
  const standings = await getStandingsFromDB(leagueId, season);

  if (standings.length === 0) {
    return (
      <div className="site-panel px-5 py-10 text-center">
        <p className="text-sm text-slate-400">
          Chưa có dữ liệu bảng xếp hạng. Chạy{" "}
          <code className="rounded bg-white/10 px-1 py-0.5 text-xs text-orange-300">
            /api/cron/sync-standings
          </code>{" "}
          để đồng bộ.
        </p>
      </div>
    );
  }

  return (
    <div className="site-panel overflow-hidden">
      {/* Table header */}
      <div
        className="border-b border-white/10 px-4 py-3"
        style={{
          background:
            "linear-gradient(135deg, rgba(56,189,248,0.14), rgba(255,255,255,0.03) 65%, rgba(15,23,42,0.12))",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Mùa {season}
        </p>
        <h2 className="mt-1 text-lg font-bold text-white">Bảng xếp hạng</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-white/10 text-slate-500">
              <th className="w-8 px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">#</th>
              <th className="py-2.5 text-left text-[10px] font-semibold uppercase tracking-widest">Đội</th>
              <th className="w-10 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest">Đ</th>
              <th className="w-10 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest">T</th>
              <th className="w-10 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest">H</th>
              <th className="w-10 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest">B</th>
              <th className="w-12 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest">HS</th>
              <th className="w-14 px-4 py-2.5 text-center text-[10px] font-semibold uppercase tracking-widest text-orange-300">PT</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry: DbStanding) => (
              <tr
                key={entry.team_id}
                className="relative border-b border-white/[0.05] transition hover:bg-white/[0.03]"
              >
                <DescriptionBadge desc={entry.form} />
                <td className="px-4 py-3 text-sm text-slate-400">{entry.rank}</td>
                <td className="py-3 pr-2">
                  <div className="flex items-center gap-2">
                    <LogoMark src={entry.team.logo_url ?? ""} alt="" size={18} />
                    <span className="max-w-[180px] truncate font-medium text-slate-100">
                      {entry.team.name}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-center text-slate-300">{entry.played}</td>
                <td className="py-3 text-center text-slate-300">{entry.win}</td>
                <td className="py-3 text-center text-slate-300">{entry.draw}</td>
                <td className="py-3 text-center text-slate-300">{entry.lose}</td>
                <td
                  className={`py-3 text-center text-sm ${
                    entry.goals_diff > 0
                      ? "text-emerald-300"
                      : entry.goals_diff < 0
                      ? "text-red-300"
                      : "text-slate-500"
                  }`}
                >
                  {entry.goals_diff > 0 ? `+${entry.goals_diff}` : entry.goals_diff}
                </td>
                <td className="px-4 py-3 text-center text-base font-black text-white">
                  {entry.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LeaguePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const rawTab = resolvedSearchParams?.tab;
  const activeTab: TopPlayersTabId =
    rawTab === "assists" || rawTab === "cards" ? rawTab : "scorers";
  const leagueId = parseInt(id, 10);
  if (!Number.isFinite(leagueId)) notFound();

  const [league, season] = await Promise.all([
    getLeague(leagueId),
    getCurrentSeason(leagueId),
  ]);

  if (!league) notFound();

  return (
    <div className="mx-auto max-w-screen-xl px-4 pb-16 pt-6">
      {/* League header */}
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
              <Image
                src={league.logo_url}
                alt={league.name}
                width={44}
                height={44}
                className="object-contain"
                unoptimized
              />
            </div>
          ) : null}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="section-label">Giải đấu</span>
              <span className="fact-chip">{league.type}</span>
              {league.country && (
                <span className="fact-chip">{league.country.name}</span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {league.name}
            </h1>
            <p className="mt-1 text-sm text-slate-400">Mùa {season}</p>
          </div>
        </div>
      </div>

      {/* Main layout */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
        {/* Standings column */}
        <Suspense fallback={<StandingsSkeleton />}>
          <StandingsSection leagueId={leagueId} season={season} />
        </Suspense>

        {/* Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-[92px] lg:self-start">
          <Suspense fallback={<SidebarSkeleton />}>
            <TopPlayersWidget leagueId={leagueId} season={season} activeTab={activeTab} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
