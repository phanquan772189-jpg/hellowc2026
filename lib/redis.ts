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

let redisClient: Redis | null = null;

export function isRedisConfigured() {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis() {
  if (redisClient) return redisClient;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error("Missing Upstash Redis environment variables");
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

export function getRedisOrNull() {
  return isRedisConfigured() ? getRedis() : null;
}

// ─── TTL constants (giây) ────────────────────────────────────────────────────
export const TTL = {
  LIVE_SCORE: 150,         // sync chạy mỗi 2 phút → max stale 30s ngoài window
  LIVE_EVENTS: 90,         // events ít thay đổi hơn tỉ số
  STANDINGS: 900,          // sync mỗi 8h, nhưng cache ngắn hơn để phản ánh kết quả trận live
  STANDINGS_MULTI: 600,    // widget trang chủ — chấp nhận lệch tối đa 10 phút
  TODAY_FIXTURES: 300,     // sync mỗi 6h
  UPCOMING_FIXTURES: 600,  // lịch 7 ngày tới, ít thay đổi
  RECENT_FIXTURES: 600,    // kết quả 7 ngày trước, gần như bất biến
  LIVE_LIST: 30,           // danh sách trận live — ngắn nhất
  H2H: 3600,               // lịch sử đối đầu thay đổi rất ít, cache 1 tiếng
  TRACKED_LEAGUES: 900,    // danh sách giải theo dõi — 15 phút, dữ liệu cấu hình
  TEAM_DETAIL: 3600,       // info cơ bản của đội (tên, logo, sân) rất hiếm khi đổi
  LATEST_PREVIEWS: 600,    // danh sách bài preview mới nhất
} as const;

// ─── Key builders ─────────────────────────────────────────────────────────────
export const cacheKey = {
  liveScore:  (fixtureId: number) => `live:score:${fixtureId}`,
  liveEvents: (fixtureId: number) => `live:events:${fixtureId}`,
  standings:  (leagueId: number, season: number) => `standings:${leagueId}:${season}`,
  standingsMulti: (leagueIds: number[]) =>
    `standings-multi:${[...leagueIds].sort((a, b) => a - b).join(",")}`,
  todayFixtures: () => "fixtures:today",
  upcomingFixtures: (days: number) => `fixtures:upcoming:${days}`,
  recentFixtures: (days: number) => `fixtures:recent:${days}`,
  liveList:   () => "fixtures:live",
  trackedLeagues: () => "tracked-leagues",
  teamDetail: (teamId: number) => `team-detail:${teamId}`,
  latestPreviews: (limit: number) => `latest-previews:${limit}`,
} as const;
