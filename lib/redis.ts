/**
 * Upstash Redis client — "Trái Tim Hệ Thống" theo kiến trúc livescore chuyên nghiệp.
 *
 * Vai trò trong luồng dữ liệu:
 *   API-Football → sync cron → DB (Supabase) → Redis ← API routes ← Browser polling
 *
 * Upstash dùng HTTP REST (không phải TCP), hoàn toàn tương thích với Vercel Serverless / Edge.
 * Không cần connection pool, mỗi request tự kết nối.
 *
 * Key structure:
 *   live:score:{fixtureId}    TTL 150s  — tỉ số + trạng thái (sync job ghi sau mỗi run)
 *   live:events:{fixtureId}   TTL 90s   — sự kiện có join (API route ghi khi cache miss)
 *   standings:{lid}:{season}  TTL 900s  — bảng xếp hạng (sync job xóa sau khi sync xong)
 *   fixtures:today            TTL 300s  — danh sách trận hôm nay
 *   fixtures:live             TTL 30s   — danh sách trận đang diễn ra
 */

import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ─── TTL constants (giây) ────────────────────────────────────────────────────
export const TTL = {
  LIVE_SCORE: 150,      // sync chạy mỗi 2 phút → max stale 30s ngoài window
  LIVE_EVENTS: 90,      // events ít thay đổi hơn tỉ số
  STANDINGS: 900,       // sync mỗi 8h, nhưng cache ngắn hơn để phản ánh kết quả trận live
  TODAY_FIXTURES: 300,  // sync mỗi 6h
  LIVE_LIST: 30,        // danh sách trận live — ngắn nhất
  H2H: 3600,            // lịch sử đối đầu thay đổi rất ít, cache 1 tiếng
} as const;

// ─── Key builders ─────────────────────────────────────────────────────────────
export const cacheKey = {
  liveScore:  (fixtureId: number) => `live:score:${fixtureId}`,
  liveEvents: (fixtureId: number) => `live:events:${fixtureId}`,
  standings:  (leagueId: number, season: number) => `standings:${leagueId}:${season}`,
  todayFixtures: () => "fixtures:today",
  liveList:   () => "fixtures:live",
} as const;
