import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { fetchRawFixtureById } from "@/lib/api";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { getTrackedLeagueIds } from "@/lib/football-sync-config";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Backfill events cho các trận vừa kết thúc trong 3 giờ qua mà chưa có events trong DB.
 *
 * Lý do cần: sync-live chỉ chạy mỗi 2 phút và dùng ?live=all.
 * Nếu trận kết thúc vào khoảnh khắc giữa 2 lần sync, events có thể không được ghi.
 *
 * Chạy mỗi 15 phút qua Supabase pg_cron.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const trackedIds = getTrackedLeagueIds();
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

  try {
    // Tìm trận vừa kết thúc trong 3 giờ qua chưa có events
    const { data: recentFinished, error: fetchErr } = await supabase
      .from("fixtures")
      .select("id")
      .in("league_id", trackedIds)
      .in("status_short", ["FT", "AET", "PEN"])
      .gte("kickoff_at", threeHoursAgo)
      .order("kickoff_at", { ascending: false })
      .limit(20);

    if (fetchErr) throw fetchErr;
    if (!recentFinished?.length) {
      return NextResponse.json({ message: "Không có trận vừa kết thúc cần backfill", synced: 0 });
    }

    // Lọc ra trận chưa có events
    const fixtureIds = recentFinished.map((f) => f.id as number);
    const { data: existingEvents } = await supabase
      .from("fixture_events")
      .select("fixture_id")
      .in("fixture_id", fixtureIds);

    const alreadyHasEvents = new Set((existingEvents ?? []).map((r) => r.fixture_id as number));
    const toBackfill = fixtureIds.filter((id) => !alreadyHasEvents.has(id));

    if (!toBackfill.length) {
      return NextResponse.json({ message: "Tất cả trận vừa kết thúc đã có events", synced: 0 });
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const fixtureId of toBackfill) {
      try {
        const rawFixture = await fetchRawFixtureById(fixtureId);
        if (!rawFixture || !rawFixture.events?.length) {
          skipped++;
          continue;
        }

        const homeId = rawFixture.teams.home.id;
        let homeScore = 0;
        let awayScore = 0;

        const eventRows = (rawFixture.events as any[]).map((event: any, index: number) => {
          let scoreSnapshot: string | null = null;

          if (event.type === "Goal" && event.detail !== "Missed Penalty") {
            const teamId = event.team?.id;
            const isOwnGoal = event.detail === "Own Goal";
            if (isOwnGoal) {
              if (teamId === homeId) awayScore++;
              else homeScore++;
            } else {
              if (teamId === homeId) homeScore++;
              else awayScore++;
            }
            scoreSnapshot = `${homeScore}-${awayScore}`;
          }

          return {
            fixture_id: fixtureId,
            team_id: event.team?.id ?? null,
            player_id: event.player?.id ?? null,
            assist_player_id: event.assist?.id ?? null,
            type: event.type ?? null,
            detail: event.detail ?? null,
            time_elapsed: event.time?.elapsed ?? 0,
            time_extra: event.time?.extra ?? null,
            sort_order: index,
            score_snapshot: scoreSnapshot,
          };
        });

        if (eventRows.length > 0) {
          // Xóa events cũ (nếu có partial data) rồi insert mới
          await supabase.from("fixture_events").delete().eq("fixture_id", fixtureId);
          const { error: insertErr } = await supabase.from("fixture_events").insert(eventRows);
          if (insertErr) throw insertErr;
          synced++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[sync-events] fixture ${fixtureId}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      checked: fixtureIds.length,
      already_had_events: alreadyHasEvents.size,
      synced,
      skipped,
      errors,
    });
  } catch (error) {
    console.error("[sync-events]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
