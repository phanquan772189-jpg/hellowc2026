import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { apiFetch, buildQuery } from "@/lib/api";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getTrackedLeagueIds } from "@/lib/football-sync-config";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiStatItem {
  type: string;
  value: string | number | null;
}

interface ApiTeamStats {
  team: { id: number; name: string; logo: string };
  statistics: ApiStatItem[];
}

// ─── Route ────────────────────────────────────────────────────────────────────

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P"];
const FINISHED_STATUSES = ["FT", "AET", "PEN"];

/**
 * Sync thống kê chi tiết (possession, shots, corners…) cho:
 * - Các trận đang live   → luôn overwrite
 * - Trận kết thúc 24h    → chỉ sync 1 lần (final stats)
 *
 * Chạy mỗi 5 phút qua Supabase pg_cron.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const trackedIds = getTrackedLeagueIds();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Tìm trận live + kết thúc trong 24h của các giải đang theo dõi
    const { data: fixtures, error: fetchErr } = await supabase
      .from("fixtures")
      .select("id, status_short")
      .in("league_id", trackedIds)
      .or(
        `status_short.in.(${LIVE_STATUSES.join(",")}),` +
        `and(status_short.in.(${FINISHED_STATUSES.join(",")}),kickoff_at.gte.${yesterday})`
      );

    if (fetchErr) throw fetchErr;
    if (!fixtures?.length) {
      return NextResponse.json({ message: "Không có trận active", synced: 0 });
    }

    // 2. Trận đã kết thúc → chỉ sync nếu chưa có trong DB
    const finishedIds = fixtures
      .filter((f) => FINISHED_STATUSES.includes(f.status_short))
      .map((f) => f.id as number);

    let alreadySynced = new Set<number>();
    if (finishedIds.length > 0) {
      const { data: existing } = await supabase
        .from("fixture_statistics")
        .select("fixture_id")
        .in("fixture_id", finishedIds);
      alreadySynced = new Set((existing ?? []).map((r) => r.fixture_id as number));
    }

    const toSync = fixtures.filter(
      (f) => LIVE_STATUSES.includes(f.status_short) || !alreadySynced.has(f.id as number)
    );

    if (!toSync.length) {
      return NextResponse.json({ message: "Tất cả trận đã có stats", synced: 0 });
    }

    // 3. Fetch & upsert từng trận (tuần tự để không bị rate limit)
    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const { id: fixtureId } of toSync) {
      try {
        const teamStats = await apiFetch<ApiTeamStats[]>(
          `/fixtures/statistics${buildQuery({ fixture: fixtureId })}`
        );

        if (!teamStats?.length) {
          skipped++;
          continue;
        }

        const rows = teamStats.flatMap((ts) =>
          ts.statistics
            .filter((s) => s.value !== null && s.value !== undefined)
            .map((s) => ({
              fixture_id: fixtureId,
              team_id: ts.team.id,
              stat_type: s.type,
              stat_value: String(s.value),
              synced_at: new Date().toISOString(),
            }))
        );

        if (rows.length > 0) {
          const { error: upsertErr } = await supabase
            .from("fixture_statistics")
            .upsert(rows, { onConflict: "fixture_id,team_id,stat_type" });

          if (upsertErr) throw upsertErr;
          synced++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[sync-match-stats] fixture ${fixtureId}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      total: toSync.length,
      synced,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[sync-match-stats]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
