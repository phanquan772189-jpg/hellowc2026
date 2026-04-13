import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { apiFetch, buildQuery } from "@/lib/api";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getTrackedLeaguesFromDB } from "@/lib/db-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiTopPlayerStats {
  team: { id: number; name: string; logo: string };
  games: { appearances: number | null };
  goals: { total: number | null; assists: number | null };
  cards: { yellow: number | null; red: number | null };
}

interface ApiTopPlayer {
  player: { id: number; name: string; photo: string | null };
  statistics: ApiTopPlayerStats[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STAT_TYPES = [
  { type: "scorer",    endpoint: "/players/topscorers",    getValue: (s: ApiTopPlayerStats) => s.goals.total ?? 0 },
  { type: "assist",    endpoint: "/players/topassists",    getValue: (s: ApiTopPlayerStats) => s.goals.assists ?? 0 },
  { type: "yellowcard",endpoint: "/players/topyellowcards",getValue: (s: ApiTopPlayerStats) => s.cards.yellow ?? 0 },
] as const;

// ─── Route ────────────────────────────────────────────────────────────────────

/**
 * Sync top scorers / assists / yellow cards cho tất cả giải đang theo dõi.
 * 20 leagues × 3 endpoints = 60 req/ngày.
 * Chạy 1 lần/ngày lúc 3:00 UTC qua Supabase pg_cron.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();

  try {
    // Lấy danh sách giải đang theo dõi kèm season hiện tại từ DB
    const leagues = await getTrackedLeaguesFromDB();
    const activeLeagues = leagues.filter((l) => l.season_year !== null);

    if (!activeLeagues.length) {
      return NextResponse.json({ message: "Không có giải nào active", synced: 0 });
    }

    let totalSynced = 0;
    let totalErrors = 0;

    for (const league of activeLeagues) {
      for (const { type, endpoint, getValue } of STAT_TYPES) {
        try {
          const players = await apiFetch<ApiTopPlayer[]>(
            `${endpoint}${buildQuery({ league: league.id, season: league.season_year })}`
          );

          if (!players?.length) continue;

          // Upsert players (đảm bảo FK không bị lỗi)
          const playerRows = players.slice(0, 20).map((p) => ({
            id: p.player.id,
            name: p.player.name,
            photo_url: p.player.photo ?? null,
          }));
          await supabase
            .from("players")
            .upsert(playerRows, { onConflict: "id", ignoreDuplicates: false });

          // Upsert teams nếu chưa có
          const teamRows = players
            .slice(0, 20)
            .map((p) => p.statistics[0]?.team)
            .filter(Boolean)
            .filter((t, i, arr) => arr.findIndex((x) => x!.id === t!.id) === i)
            .map((t) => ({ id: t!.id, name: t!.name, logo_url: t!.logo ?? null }));
          if (teamRows.length > 0) {
            await supabase
              .from("teams")
              .upsert(teamRows, { onConflict: "id", ignoreDuplicates: true });
          }

          // Upsert player_season_stats
          const statRows = players.slice(0, 20).map((p, i) => {
            const stats = p.statistics[0];
            return {
              player_id: p.player.id,
              team_id: stats?.team?.id ?? null,
              league_id: league.id,
              season_year: league.season_year!,
              stat_type: type,
              stat_value: getValue(stats),
              games: stats?.games?.appearances ?? null,
              rank: i + 1,
              synced_at: new Date().toISOString(),
            };
          });

          const { error } = await supabase
            .from("player_season_stats")
            .upsert(statRows, { onConflict: "player_id,league_id,season_year,stat_type" });

          if (error) throw error;
          totalSynced += statRows.length;
        } catch (err) {
          console.error(`[sync-topscorers] league=${league.id} type=${type}:`, err);
          totalErrors++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      leagues: activeLeagues.length,
      api_calls: activeLeagues.length * 3,
      records_synced: totalSynced,
      errors: totalErrors,
    });
  } catch (error) {
    console.error("[sync-topscorers]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
