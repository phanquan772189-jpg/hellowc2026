/**
 * GET /api/live/[fixtureId]
 *
 * Endpoint polling cho trang chi tiết trận đấu đang diễn ra.
 * Client Component gọi mỗi 30 giây — không reload trang.
 *
 * Luồng dữ liệu (đúng theo kiến trúc livescore chuyên nghiệp):
 *   sync-live cron (2 phút) → DB + Redis.liveScore
 *   Browser poll → Redis (cache hit ≈ 5ms) → DB (cache miss ≈ 80ms)
 *
 * Redis keys:
 *   live:score:{id}   — sync job ghi proactive, TTL 150s
 *   live:events:{id}  — API route ghi khi cache miss, TTL 90s
 */

import { NextResponse } from "next/server";

import { getFixtureByIdFromDB, getFixtureEventsFromDB, type LiveScoreState } from "@/lib/db-queries";
import type { DbEvent } from "@/lib/db-queries";
import { cacheKey, redis, TTL } from "@/lib/redis";

export const dynamic = "force-dynamic";

type LivePayload = { score: LiveScoreState; events: DbEvent[] };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ fixtureId: string }> }
) {
  const { fixtureId } = await params;
  const id = parseInt(fixtureId, 10);

  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid fixture ID" }, { status: 400 });
  }

  // ── 1. Đọc song song từ Redis ──────────────────────────────────────────────
  const [cachedScore, cachedEvents] = await Promise.all([
    redis.get<LiveScoreState>(cacheKey.liveScore(id)).catch(() => null),
    redis.get<DbEvent[]>(cacheKey.liveEvents(id)).catch(() => null),
  ]);

  if (cachedScore && cachedEvents) {
    // Cache hit hoàn toàn — phản hồi trong ~5ms, không chạm DB
    return NextResponse.json(
      { score: cachedScore, events: cachedEvents, _cache: "hit" },
      { headers: { "X-Cache": "HIT" } }
    );
  }

  // ── 2. DB fallback — chỉ fetch những gì còn thiếu ─────────────────────────
  const [fixture, events] = await Promise.all([
    cachedScore ? null : getFixtureByIdFromDB(id).catch(() => null),
    cachedEvents ? Promise.resolve(cachedEvents) : getFixtureEventsFromDB(id).catch(() => []),
  ]);

  if (!cachedScore && !fixture) {
    return NextResponse.json({ error: "Fixture not found" }, { status: 404 });
  }

  const score: LiveScoreState = cachedScore ?? {
    goalsHome:     fixture!.goals_home,
    goalsAway:     fixture!.goals_away,
    statusShort:   fixture!.status_short,
    statusElapsed: fixture!.status_elapsed,
    scoreHtHome:   fixture!.score_ht_home,
    scoreHtAway:   fixture!.score_ht_away,
  };

  // ── 3. Ghi phần còn thiếu vào Redis (non-blocking) ─────────────────────────
  const writes: Promise<unknown>[] = [];
  if (!cachedScore)  writes.push(redis.setex(cacheKey.liveScore(id),  TTL.LIVE_SCORE,  score).catch(() => {}));
  if (!cachedEvents) writes.push(redis.setex(cacheKey.liveEvents(id), TTL.LIVE_EVENTS, events).catch(() => {}));
  void Promise.all(writes); // fire-and-forget, không block response

  const payload: LivePayload = { score, events };
  return NextResponse.json(payload, { headers: { "X-Cache": "MISS" } });
}
