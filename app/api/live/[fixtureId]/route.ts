/**
 * GET /api/live/[fixtureId]
 *
 * Endpoint polling nhẹ cho trang chi tiết trận đấu đang diễn ra.
 * Client Component gọi mỗi 30 giây để cập nhật tỉ số + sự kiện
 * mà không cần reload trang — tương đương "Streaming Service" trong kiến trúc livescore.
 *
 * Không cần auth: dữ liệu công khai.
 * maxDuration không cần thiết vì chỉ đọc DB.
 */

import { NextResponse } from "next/server";

import { getFixtureByIdFromDB, getFixtureEventsFromDB } from "@/lib/db-queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const id = parseInt(fixtureId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid fixture ID" }, { status: 400 });
  }

  const [fixture, events] = await Promise.all([
    getFixtureByIdFromDB(id).catch(() => null),
    getFixtureEventsFromDB(id).catch(() => []),
  ]);

  if (!fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      score: {
        goalsHome: fixture.goals_home,
        goalsAway: fixture.goals_away,
        statusShort: fixture.status_short,
        statusElapsed: fixture.status_elapsed,
        scoreHtHome: fixture.score_ht_home,
        scoreHtAway: fixture.score_ht_away,
      },
      events,
    },
    {
      // Cache ngắn — chỉ 10s để Vercel Edge không serve stale data
      headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" },
    }
  );
}
