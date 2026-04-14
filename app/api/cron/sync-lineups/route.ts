import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getTrackedLeagueIds } from "@/lib/football-sync-config";
import { ensureFixtureLineupsInDb } from "@/lib/match-tab-data";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LIVE_STATUSES = ["1H", "HT", "2H", "ET", "BT", "P"];
const UPCOMING_STATUSES = ["NS", "TBD"];

/**
 * Sync đội hình cho:
 * - Trận sắp diễn ra trong 90 phút tới
 * - Trận đang live
 *
 * Mục tiêu là lấp khoảng trống giữa sync-fixtures và sync-live:
 * lineups thường chỉ xuất hiện sát giờ bóng lăn nên cần job riêng.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const trackedIds = getTrackedLeagueIds();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 90 * 60 * 1000).toISOString();

  try {
    const [liveRes, upcomingRes] = await Promise.all([
      supabase
        .from("fixtures")
        .select("id,status_short,kickoff_at")
        .in("league_id", trackedIds)
        .in("status_short", LIVE_STATUSES),
      supabase
        .from("fixtures")
        .select("id,status_short,kickoff_at")
        .in("league_id", trackedIds)
        .in("status_short", UPCOMING_STATUSES)
        .gte("kickoff_at", windowStart)
        .lte("kickoff_at", windowEnd)
        .order("kickoff_at", { ascending: true }),
    ]);

    if (liveRes.error) throw liveRes.error;
    if (upcomingRes.error) throw upcomingRes.error;

    const fixtures = [
      ...((liveRes.data ?? []) as { id: number; status_short: string; kickoff_at: string }[]),
      ...((upcomingRes.data ?? []) as { id: number; status_short: string; kickoff_at: string }[]),
    ].filter((fixture, index, items) => items.findIndex((item) => item.id === fixture.id) === index);

    if (fixtures.length === 0) {
      return NextResponse.json({
        message: "Khong co tran nao can sync lineups",
        synced: 0,
      });
    }

    let synced = 0;
    let empty = 0;
    let errors = 0;

    for (const fixture of fixtures) {
      try {
        const result = await ensureFixtureLineupsInDb(fixture.id, { forceRefresh: true });
        if (result.lineups.length >= 2) {
          synced += 1;
        } else {
          empty += 1;
        }
      } catch (error) {
        console.error(`[sync-lineups] fixture ${fixture.id}:`, error);
        errors += 1;
      }
    }

    return NextResponse.json({
      success: true,
      total: fixtures.length,
      synced,
      empty,
      errors,
      window: { from: windowStart, to: windowEnd },
    });
  } catch (error) {
    console.error("[sync-lineups]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
