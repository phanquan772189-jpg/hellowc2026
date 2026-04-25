import "server-only";

import { makeSlug, todayInTimeZone } from "@/lib/api";
import { getTrackedLeagueIds } from "@/lib/football-sync-config";
import { cacheKey, redis, TTL } from "@/lib/redis";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// ─────────────────────────────────────────────
// Status helpers (DB-native, no FixtureStatus object)
// ─────────────────────────────────────────────

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const NOT_STARTED_STATUSES = new Set(["NS", "TBD"]);

export const isDbLive = (s: string) => LIVE_STATUSES.has(s);
export const isDbFinished = (s: string) => FINISHED_STATUSES.has(s);
export const isDbNotStarted = (s: string) => NOT_STARTED_STATUSES.has(s);

export function dbStatusLabel(statusShort: string, statusElapsed: number | null): string {
  if (statusShort === "HT") return "Nghỉ giữa hiệp";
  if (isDbLive(statusShort)) return statusElapsed ? `${statusElapsed}'` : "LIVE";
  if (isDbFinished(statusShort)) return "KT";
  if (statusShort === "PST") return "Hoãn";
  if (statusShort === "CANC") return "Huỷ";
  return "";
}

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type DbTeam = {
  id: number;
  name: string;
  logo_url: string | null;
};

export type DbLeague = {
  id: number;
  name: string;
  logo_url: string | null;
  country: { name: string } | null;
};

export type DbFixture = {
  id: number;
  kickoff_at: string;
  season_year: number;
  status_short: string;
  status_long: string;
  status_elapsed: number | null;
  goals_home: number | null;
  goals_away: number | null;
  round: string | null;
  /** Computed from home/away team names + id via makeSlug */
  slug: string;
  home_team: DbTeam;
  away_team: DbTeam;
  league: DbLeague;
};

export type DbStanding = {
  league_id: number;
  season_year: number;
  team_id: number;
  rank: number;
  points: number;
  goals_diff: number;
  played: number;
  win: number;
  draw: number;
  lose: number;
  form: string | null;
  group_label: string | null;
  team: DbTeam;
};

export type DbStandingsGroup = {
  label: string | null;
  entries: DbStanding[];
};

/** Full fixture row for match detail page (includes score breakdown, referee, venue) */
export type DbFixtureDetail = DbFixture & {
  referee: string | null;
  venue_name: string | null;
  venue_city: string | null;
  score_ht_home: number | null;
  score_ht_away: number | null;
  score_ft_home: number | null;
  score_ft_away: number | null;
  score_et_home: number | null;
  score_et_away: number | null;
  score_pen_home: number | null;
  score_pen_away: number | null;
};

export type DbEvent = {
  id: number;
  fixture_id: number;
  team_id: number;
  player_id: number | null;
  assist_player_id: number | null;
  type: string;
  detail: string | null;
  time_elapsed: number;
  time_extra: number | null;
  sort_order: number;
  /** Tỉ số tại thời điểm bàn thắng, vd "1-0", "2-1". Chỉ có giá trị cho Goal. */
  score_snapshot: string | null;
  team: DbTeam;
  player: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
};

export type DbLineup = {
  fixture_id: number;
  team_id: number;
  formation: string | null;
  coach_name: string | null;
  team: DbTeam;
};

export type DbLineupPlayer = {
  fixture_id: number;
  team_id: number;
  player_id: number;
  is_starting: boolean;
  jersey_number: number | null;
  grid_position: string | null;
  player: { id: number; name: string; photo_url: string | null };
};

export type DbMatchStatistic = {
  team: { id: number; name: string; logo: string };
  statistics: { type: string; value: number | string | null }[];
};

export type DbTopPlayer = {
  rank: number;
  stat_value: number;
  games: number | null;
  player: { id: number; name: string; photo_url: string | null };
  team: { id: number; name: string; logo_url: string | null } | null;
};

export type DbMatchPreview = {
  fixture_id: number;
  content: string;
  generated_at: string;
};

/** Re-export từ match-shared để tránh duplicate type definition */
export type { LiveScoreState } from "@/lib/match-shared";

export type DbTrackedLeague = {
  id: number;
  name: string;
  logo_url: string | null;
  type: string;
  country: { name: string } | null;
  season_year: number | null;
  season_start_date: string | null;
  season_end_date: string | null;
};

export type DbLeagueStandings = {
  league: DbTrackedLeague;
  standings: DbStanding[];
  groups: DbStandingsGroup[];
};

export type DbTeamDetail = {
  id: number;
  name: string;
  code: string | null;
  founded: number | null;
  logo_url: string | null;
  country: { name: string } | null;
  venue: { name: string; city: string | null; capacity: number | null; image_url: string | null } | null;
};

export type DbTeamStandingContext = {
  league: DbTrackedLeague;
  entry: DbStanding;
};

export type DbSquadPlayer = {
  player_id: number;
  squad_number: number | null;
  position: string | null;
  player: {
    id: number;
    name: string;
    photo_url: string | null;
    first_name: string | null;
    last_name: string | null;
    birth_date: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    nationality: { name: string; flag_url: string | null } | null;
  };
};

export type DbSquadGroup = {
  position: string;
  players: DbSquadPlayer[];
};

export type DbPreviewIndexItem = {
  fixture_id: number;
  content: string;
  generated_at: string;
  fixture: DbFixture;
};

// ─────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────

/** Returns [start, end) ISO strings spanning today in Asia/Ho_Chi_Minh */
function shiftVietnamDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getVietnamDayRange(dateString = todayInTimeZone("Asia/Ho_Chi_Minh")): { start: string; end: string } {
  const start = new Date(`${dateString}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

const FIXTURE_SELECT = [
  "id",
  "kickoff_at",
  "status_short",
  "status_long",
  "status_elapsed",
  "goals_home",
  "goals_away",
  "round",
  "home_team:teams!home_team_id(id,name,logo_url)",
  "away_team:teams!away_team_id(id,name,logo_url)",
  "league:leagues!league_id(id,name,logo_url,country:countries!country_id(name))",
].join(",");

type RawFixtureRow = Omit<DbFixture, "slug">;

type FixtureQueryOptions = {
  start?: string;
  end?: string;
  statuses?: string[];
  leagueIds?: number[];
  limit?: number;
  ascending?: boolean;
};

function enrichFixture(row: RawFixtureRow): DbFixture {
  return {
    ...row,
    slug: makeSlug(row.home_team.name, row.away_team.name, row.id),
  };
}

async function queryFixturesFromDB(options: FixtureQueryOptions): Promise<DbFixture[]> {
  try {
    const supabase = getSupabaseAdmin();

    let query = supabase.from("fixtures").select(FIXTURE_SELECT);

    if (options.start) query = query.gte("kickoff_at", options.start);
    if (options.end) query = query.lt("kickoff_at", options.end);
    if (options.statuses?.length) query = query.in("status_short", options.statuses);
    if (options.leagueIds?.length) query = query.in("league_id", options.leagueIds);

    query = query.order("kickoff_at", { ascending: options.ascending ?? true });

    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as unknown as RawFixtureRow[]).map(enrichFixture);
  } catch (err) {
    console.error("[DB] queryFixturesFromDB:", err);
    return [];
  }
}

// ─────────────────────────────────────────────
// Query functions
// ─────────────────────────────────────────────

export async function getTodayFixturesFromDB(): Promise<DbFixture[]> {
  // ── Redis cache read-through ──────────────────────────────────────────────
  const key = cacheKey.todayFixtures();
  const cached = await redis.get<DbFixture[]>(key).catch(() => null);
  if (cached) return cached;

  try {
    const { start, end } = getVietnamDayRange();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .gte("kickoff_at", start)
      .lt("kickoff_at", end)
      .order("kickoff_at", { ascending: true });

    if (error) throw error;
    const result = ((data ?? []) as unknown as RawFixtureRow[]).map(enrichFixture);
    void redis.setex(key, TTL.TODAY_FIXTURES, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getTodayFixturesFromDB:", err);
    return [];
  }
}

export async function getLiveFixturesFromDB(): Promise<DbFixture[]> {
  // ── Redis cache read-through (TTL 30s — danh sách live thay đổi nhanh) ───
  const key = cacheKey.liveList();
  const cached = await redis.get<DbFixture[]>(key).catch(() => null);
  if (cached) return cached;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .in("status_short", ["1H", "HT", "2H", "ET", "BT", "P"])
      .order("kickoff_at", { ascending: true });

    if (error) throw error;
    const result = ((data ?? []) as unknown as RawFixtureRow[]).map(enrichFixture);
    void redis.setex(key, TTL.LIVE_LIST, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getLiveFixturesFromDB:", err);
    return [];
  }
}

export type DbH2HFixture = {
  id: number;
  kickoff_at: string;
  status_short: string;
  goals_home: number | null;
  goals_away: number | null;
  score_ht_home: number | null;
  score_ht_away: number | null;
  home_team: { id: number; name: string; logo_url: string | null };
  away_team: { id: number; name: string; logo_url: string | null };
};

export async function getH2HFixturesFromDB(
  teamAId: number,
  teamBId: number,
  limit = 10
): Promise<DbH2HFixture[]> {
  // cache key uses sorted team IDs to avoid duplication
  const [idA, idB] = [Math.min(teamAId, teamBId), Math.max(teamAId, teamBId)];
  const key = `h2h:${idA}:${idB}`;
  const cached = await redis.get<DbH2HFixture[]>(key).catch(() => null);
  if (cached) return cached;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("fixtures")
      .select(
        [
          "id",
          "kickoff_at",
          "status_short",
          "goals_home",
          "goals_away",
          "score_ht_home",
          "score_ht_away",
          "home_team:teams!home_team_id(id,name,logo_url)",
          "away_team:teams!away_team_id(id,name,logo_url)",
        ].join(",")
      )
      .or(
        `and(home_team_id.eq.${teamAId},away_team_id.eq.${teamBId}),and(home_team_id.eq.${teamBId},away_team_id.eq.${teamAId})`
      )
      .in("status_short", ["FT", "AET", "PEN"])
      .order("kickoff_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const result = (data ?? []) as unknown as DbH2HFixture[];
    void redis.setex(key, TTL.H2H, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getH2HFixturesFromDB:", err);
    return [];
  }
}

export async function getStandingsFromDB(leagueId: number, seasonYear: number): Promise<DbStanding[]> {
  // ── Redis cache read-through (TTL 900s — sync job DEL sau khi cập nhật) ──
  const key = cacheKey.standings(leagueId, seasonYear);
  const cached = await redis.get<DbStanding[]>(key).catch(() => null);
  if (cached) {
    // Backfill group_label cho các bản cache cũ chưa có trường này.
    return cached.map((entry) => ({ ...entry, group_label: entry.group_label ?? null }));
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("standings")
      .select(
        [
          "league_id",
          "season_year",
          "team_id",
          "rank",
          "points",
          "goals_diff",
          "played",
          "win",
          "draw",
          "lose",
          "form",
          "group_label",
          "team:teams!team_id(id,name,logo_url)",
        ].join(",")
      )
      .eq("league_id", leagueId)
      .eq("season_year", seasonYear)
      .order("rank", { ascending: true });

    if (error) throw error;
    const result = (data ?? []) as unknown as DbStanding[];
    void redis.setex(key, TTL.STANDINGS, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getStandingsFromDB:", err);
    return [];
  }
}

/**
 * Gom BXH theo group_label. Giải vô địch quốc gia thường chỉ có 1 nhóm
 * (tất cả cùng group_label hoặc null). Giải cúp vòng bảng (WC, CL…) có
 * nhiều nhóm — mỗi nhóm là 1 bảng đấu riêng, giữ thứ tự rank gốc.
 */
export function groupStandingsByLabel(entries: DbStanding[]): DbStandingsGroup[] {
  if (entries.length === 0) return [];

  const buckets = new Map<string, DbStanding[]>();
  const order: string[] = [];

  for (const entry of entries) {
    const key = entry.group_label ?? "";
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push(entry);
  }

  // Sort nhóm theo label để Group A/B/C luôn xuất hiện đúng thứ tự chữ cái.
  order.sort((left, right) => left.localeCompare(right));

  return order.map((key) => ({
    label: key === "" ? null : key,
    entries: (buckets.get(key) ?? []).slice().sort((a, b) => a.rank - b.rank),
  }));
}

const FIXTURE_DETAIL_SELECT = [
  "id",
  "kickoff_at",
  "season_year",
  "status_short",
  "status_long",
  "status_elapsed",
  "goals_home",
  "goals_away",
  "round",
  "referee",
  "score_ht_home",
  "score_ht_away",
  "score_ft_home",
  "score_ft_away",
  "score_et_home",
  "score_et_away",
  "score_pen_home",
  "score_pen_away",
  "venue:venues!venue_id(name,city)",
  "home_team:teams!home_team_id(id,name,logo_url)",
  "away_team:teams!away_team_id(id,name,logo_url)",
  "league:leagues!league_id(id,name,logo_url,country:countries!country_id(name))",
].join(",");

type RawFixtureDetailRow = {
  id: number;
  kickoff_at: string;
  season_year: number;
  status_short: string;
  status_long: string;
  status_elapsed: number | null;
  goals_home: number | null;
  goals_away: number | null;
  round: string | null;
  referee: string | null;
  score_ht_home: number | null;
  score_ht_away: number | null;
  score_ft_home: number | null;
  score_ft_away: number | null;
  score_et_home: number | null;
  score_et_away: number | null;
  score_pen_home: number | null;
  score_pen_away: number | null;
  venue: { name: string; city: string | null } | null;
  home_team: DbTeam;
  away_team: DbTeam;
  league: DbLeague;
};

function enrichFixtureDetail(row: RawFixtureDetailRow): DbFixtureDetail {
  return {
    id: row.id,
    kickoff_at: row.kickoff_at,
    season_year: row.season_year,
    status_short: row.status_short,
    status_long: row.status_long,
    status_elapsed: row.status_elapsed,
    goals_home: row.goals_home,
    goals_away: row.goals_away,
    round: row.round,
    referee: row.referee,
    score_ht_home: row.score_ht_home,
    score_ht_away: row.score_ht_away,
    score_ft_home: row.score_ft_home,
    score_ft_away: row.score_ft_away,
    score_et_home: row.score_et_home,
    score_et_away: row.score_et_away,
    score_pen_home: row.score_pen_home,
    score_pen_away: row.score_pen_away,
    venue_name: row.venue?.name ?? null,
    venue_city: row.venue?.city ?? null,
    slug: makeSlug(row.home_team.name, row.away_team.name, row.id),
    home_team: row.home_team,
    away_team: row.away_team,
    league: row.league,
  };
}

export async function getFixtureByIdFromDB(id: number): Promise<DbFixtureDetail | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixtures")
      .select(FIXTURE_DETAIL_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return enrichFixtureDetail(data as unknown as RawFixtureDetailRow);
  } catch (err) {
    console.error("[DB] getFixtureByIdFromDB:", err);
    return null;
  }
}

const EVENT_SELECT = [
  "id",
  "fixture_id",
  "team_id",
  "player_id",
  "assist_player_id",
  "type",
  "detail",
  "time_elapsed",
  "time_extra",
  "sort_order",
  "score_snapshot",
  "team:teams!team_id(id,name,logo_url)",
  "player:players!player_id(id,name)",
  "assist:players!assist_player_id(id,name)",
].join(",");

export async function getFixtureEventsFromDB(fixtureId: number): Promise<DbEvent[]> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixture_events")
      .select(EVENT_SELECT)
      .eq("fixture_id", fixtureId)
      .order("time_elapsed", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) throw error;
    return (data ?? []) as unknown as DbEvent[];
  } catch (err) {
    console.error("[DB] getFixtureEventsFromDB:", err);
    return [];
  }
}

export async function getFixtureLineupsFromDB(fixtureId: number): Promise<{
  lineups: DbLineup[];
  players: DbLineupPlayer[];
}> {
  try {
    const supabase = getSupabaseAdmin();

    const [lineupsRes, playersRes] = await Promise.all([
      supabase
        .from("fixture_lineups")
        .select("fixture_id,team_id,formation,coach_name,team:teams!team_id(id,name,logo_url)")
        .eq("fixture_id", fixtureId),
      supabase
        .from("fixture_lineup_players")
        .select("fixture_id,team_id,player_id,is_starting,jersey_number,grid_position,player:players!player_id(id,name,photo_url)")
        .eq("fixture_id", fixtureId)
        .order("is_starting", { ascending: false }),
    ]);

    if (lineupsRes.error) throw lineupsRes.error;
    if (playersRes.error) throw playersRes.error;

    return {
      lineups: (lineupsRes.data ?? []) as unknown as DbLineup[],
      players: (playersRes.data ?? []) as unknown as DbLineupPlayer[],
    };
  } catch (err) {
    console.error("[DB] getFixtureLineupsFromDB:", err);
    return { lineups: [], players: [] };
  }
}

export async function getTodayFixtureSlugsFromDB(): Promise<{ slug: string }[]> {
  try {
    const { start, end } = getVietnamDayRange();
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixtures")
      .select("id,home_team:teams!home_team_id(name),away_team:teams!away_team_id(name)")
      .gte("kickoff_at", start)
      .lt("kickoff_at", end);

    if (error) throw error;

    return ((data ?? []) as unknown as { id: number; home_team: { name: string }; away_team: { name: string } }[])
      .map((row) => ({ slug: makeSlug(row.home_team.name, row.away_team.name, row.id) }));
  } catch (err) {
    console.error("[DB] getTodayFixtureSlugsFromDB:", err);
    return [];
  }
}

/**
 * Trả về slugs của tất cả trận đấu trong 6 tháng qua + 1 tháng tới
 * Dùng cho XML sitemap (SEO crawl budget optimization)
 */
const SITEMAP_FIXTURE_BATCH_SIZE = 1000;

export async function getAllFixtureSlugsFromDB(): Promise<
  { slug: string; updated_at: string; status_short: string }[]
> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oneMonthAhead = new Date(now);
    oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1);

    const rows: {
      id: number;
      updated_at: string;
      status_short: string;
      home_team: { name: string };
      away_team: { name: string };
    }[] = [];

    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("fixtures")
        .select([
          "id",
          "updated_at",
          "status_short",
          "home_team:teams!home_team_id(name)",
          "away_team:teams!away_team_id(name)",
        ].join(","))
        .gte("kickoff_at", sixMonthsAgo.toISOString())
        .lte("kickoff_at", oneMonthAhead.toISOString())
        .order("kickoff_at", { ascending: false })
        .range(offset, offset + SITEMAP_FIXTURE_BATCH_SIZE - 1);

      if (error) throw error;

      const batch = (data ?? []) as unknown as typeof rows;
      rows.push(...batch);

      if (batch.length < SITEMAP_FIXTURE_BATCH_SIZE) break;
      offset += SITEMAP_FIXTURE_BATCH_SIZE;
    }

    return rows.map((row) => ({
      slug: makeSlug(row.home_team.name, row.away_team.name, row.id),
      updated_at: row.updated_at,
      status_short: row.status_short,
    }));
  } catch (err) {
    console.error("[DB] getAllFixtureSlugsFromDB:", err);
    return [];
  }
}

export async function getUpcomingFixturesFromDB(days = 7): Promise<DbFixture[]> {
  const safeDays = Math.max(1, days);

  const key = cacheKey.upcomingFixtures(safeDays);
  const cached = await redis.get<DbFixture[]>(key).catch(() => null);
  if (cached) return cached;

  const today = todayInTimeZone("Asia/Ho_Chi_Minh");
  const start = getVietnamDayRange(today).start;
  const end = getVietnamDayRange(shiftVietnamDateString(today, safeDays)).start;

  const result = await queryFixturesFromDB({
    start,
    end,
    statuses: [...NOT_STARTED_STATUSES],
    ascending: true,
  });

  void redis.setex(key, TTL.UPCOMING_FIXTURES, result).catch(() => {});
  return result;
}

export async function getRecentFinishedFixturesFromDB(days = 7): Promise<DbFixture[]> {
  const safeDays = Math.max(1, days);

  const key = cacheKey.recentFixtures(safeDays);
  const cached = await redis.get<DbFixture[]>(key).catch(() => null);
  if (cached) return cached;

  const today = todayInTimeZone("Asia/Ho_Chi_Minh");
  const startDate = shiftVietnamDateString(today, -(safeDays - 1));
  const start = getVietnamDayRange(startDate).start;
  const end = getVietnamDayRange(shiftVietnamDateString(today, 1)).start;

  const result = await queryFixturesFromDB({
    start,
    end,
    statuses: [...FINISHED_STATUSES],
    ascending: false,
  });

  void redis.setex(key, TTL.RECENT_FIXTURES, result).catch(() => {});
  return result;
}

type RawTrackedLeagueRow = {
  id: number;
  name: string;
  logo_url: string | null;
  type: string;
  country: { name: string } | null;
};

type RawLeagueSeasonRow = {
  league_id: number;
  season_year: number;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
};

export function formatSeasonLabel(
  seasonYear: number | null,
  startDate?: string | null,
  endDate?: string | null
) {
  if (startDate && endDate) {
    const startYear = new Date(startDate).getUTCFullYear();
    const endYear = new Date(endDate).getUTCFullYear();
    if (Number.isFinite(startYear) && Number.isFinite(endYear)) {
      return startYear === endYear ? String(startYear) : `${startYear}-${endYear}`;
    }
  }

  return seasonYear ? String(seasonYear) : null;
}

export async function getTrackedLeaguesFromDB(): Promise<DbTrackedLeague[]> {
  const key = cacheKey.trackedLeagues();
  const cached = await redis.get<DbTrackedLeague[]>(key).catch(() => null);
  if (cached) return cached;

  try {
    const supabase = getSupabaseAdmin();
    const trackedLeagueIds = getTrackedLeagueIds();

    const [leaguesRes, seasonsRes] = await Promise.all([
      supabase
        .from("leagues")
        .select("id,name,logo_url,type,country:countries!country_id(name)")
        .in("id", trackedLeagueIds),
      supabase
        .from("league_seasons")
        .select("league_id,season_year,start_date,end_date,is_current")
        .in("league_id", trackedLeagueIds)
        .order("season_year", { ascending: false }),
    ]);

    if (leaguesRes.error) throw leaguesRes.error;
    if (seasonsRes.error) throw seasonsRes.error;

    const seasonRows = (seasonsRes.data ?? []) as RawLeagueSeasonRow[];
    const currentSeasonByLeague = new Map<number, RawLeagueSeasonRow>();
    const latestSeasonByLeague = new Map<number, RawLeagueSeasonRow>();

    for (const row of seasonRows) {
      if (!latestSeasonByLeague.has(row.league_id)) {
        latestSeasonByLeague.set(row.league_id, row);
      }
      if (row.is_current) {
        currentSeasonByLeague.set(row.league_id, row);
      }
    }

    const leagueById = new Map(
      ((leaguesRes.data ?? []) as unknown as RawTrackedLeagueRow[]).map((league) => [league.id, league])
    );

    const result = trackedLeagueIds
      .map((leagueId) => {
        const league = leagueById.get(leagueId);
        if (!league) return null;
        const seasonInfo = currentSeasonByLeague.get(leagueId) ?? latestSeasonByLeague.get(leagueId);

        return {
          ...league,
          season_year: seasonInfo?.season_year ?? null,
          season_start_date: seasonInfo?.start_date ?? null,
          season_end_date: seasonInfo?.end_date ?? null,
        };
      })
      .filter((league): league is DbTrackedLeague => league !== null);

    void redis.setex(key, TTL.TRACKED_LEAGUES, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getTrackedLeaguesFromDB:", err);
    return [];
  }
}

// ─────────────────────────────────────────────
// League rounds
// ─────────────────────────────────────────────

/**
 * Trả về vòng đấu hiện tại của giải:
 * 1. Vòng đang có trận LIVE
 * 2. Vòng có trận sắp diễn ra gần nhất
 * 3. Vòng gần nhất đã kết thúc
 */
export async function getLeagueCurrentRound(
  leagueId: number,
  seasonYear: number
): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  // 1. Live
  const { data: live } = await supabase
    .from("fixtures")
    .select("round")
    .eq("league_id", leagueId)
    .eq("season_year", seasonYear)
    .in("status_short", ["1H", "HT", "2H", "ET", "BT", "P"])
    .not("round", "is", null)
    .limit(1)
    .maybeSingle();
  if (live?.round) return live.round as string;

  // 2. Upcoming nearest
  const { data: upcoming } = await supabase
    .from("fixtures")
    .select("round")
    .eq("league_id", leagueId)
    .eq("season_year", seasonYear)
    .in("status_short", ["NS", "TBD"])
    .gte("kickoff_at", new Date().toISOString())
    .not("round", "is", null)
    .order("kickoff_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (upcoming?.round) return upcoming.round as string;

  // 3. Most recently played
  const { data: recent } = await supabase
    .from("fixtures")
    .select("round")
    .eq("league_id", leagueId)
    .eq("season_year", seasonYear)
    .in("status_short", ["FT", "AET", "PEN"])
    .not("round", "is", null)
    .order("kickoff_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (recent?.round as string) ?? null;
}

/** Trả về danh sách tất cả vòng đấu theo thứ tự thời gian */
export async function getLeagueAllRounds(
  leagueId: number,
  seasonYear: number
): Promise<string[]> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixtures")
      .select("round,kickoff_at")
      .eq("league_id", leagueId)
      .eq("season_year", seasonYear)
      .not("round", "is", null)
      .order("kickoff_at", { ascending: true });

    if (error) throw error;

    const seen = new Set<string>();
    const rounds: string[] = [];
    for (const row of data ?? []) {
      const r = row.round as string;
      if (r && !seen.has(r)) {
        seen.add(r);
        rounds.push(r);
      }
    }
    return rounds;
  } catch (err) {
    console.error("[DB] getLeagueAllRounds:", err);
    return [];
  }
}

/** Trả về danh sách trận đấu của một vòng cụ thể */
export async function getLeagueRoundFixtures(
  leagueId: number,
  seasonYear: number,
  round: string
): Promise<DbFixture[]> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .eq("league_id", leagueId)
      .eq("season_year", seasonYear)
      .eq("round", round)
      .order("kickoff_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as unknown as RawFixtureRow[]).map(enrichFixture);
  } catch (err) {
    console.error("[DB] getLeagueRoundFixtures:", err);
    return [];
  }
}

export async function getLeagueFixturesByRoundPrefix(
  leagueId: number,
  seasonYear: number,
  roundPrefix: string
): Promise<DbFixture[]> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .eq("league_id", leagueId)
      .eq("season_year", seasonYear)
      .ilike("round", `${roundPrefix}%`)
      .order("kickoff_at", { ascending: true });

    if (error) throw error;
    return ((data ?? []) as unknown as RawFixtureRow[]).map(enrichFixture);
  } catch (err) {
    console.error("[DB] getLeagueFixturesByRoundPrefix:", err);
    return [];
  }
}

export async function getMatchPreviewFromDB(fixtureId: number): Promise<DbMatchPreview | null> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("match_previews")
      .select("fixture_id,content,generated_at")
      .eq("fixture_id", fixtureId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return (data ?? null) as DbMatchPreview | null;
  } catch (err) {
    console.error("[DB] getMatchPreviewFromDB:", err);
    return null;
  }
}

type RawPreviewIndexRow = {
  fixture_id: number;
  content: string;
  generated_at: string;
  fixture:
    | ({
        id: number;
        kickoff_at: string;
        season_year: number;
        status_short: string;
        status_long: string;
        status_elapsed: number | null;
        goals_home: number | null;
        goals_away: number | null;
        round: string | null;
        home_team: DbTeam | DbTeam[];
        away_team: DbTeam | DbTeam[];
        league: DbLeague | DbLeague[];
      } | null)[]
    | {
        id: number;
        kickoff_at: string;
        season_year: number;
        status_short: string;
        status_long: string;
        status_elapsed: number | null;
        goals_home: number | null;
        goals_away: number | null;
        round: string | null;
        home_team: DbTeam | DbTeam[];
        away_team: DbTeam | DbTeam[];
        league: DbLeague | DbLeague[];
      }
    | null;
};

const PREVIEW_INDEX_SELECT = `
  fixture_id,
  content,
  generated_at,
  fixture:fixtures!fixture_id(
    id,
    kickoff_at,
    season_year,
    status_short,
    status_long,
    status_elapsed,
    goals_home,
    goals_away,
    round,
    home_team:teams!home_team_id(id,name,logo_url),
    away_team:teams!away_team_id(id,name,logo_url),
    league:leagues!league_id(id,name,logo_url,country:countries!country_id(name))
  )
`;

function takeFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function normalizePreviewFixture(value: RawPreviewIndexRow["fixture"]): RawFixtureRow | null {
  const fixture = takeFirstRelation(value);
  if (!fixture) return null;

  const homeTeam = takeFirstRelation(fixture.home_team);
  const awayTeam = takeFirstRelation(fixture.away_team);
  const league = takeFirstRelation(fixture.league);

  if (!homeTeam || !awayTeam || !league) return null;

  return {
    id: fixture.id,
    kickoff_at: fixture.kickoff_at,
    season_year: fixture.season_year,
    status_short: fixture.status_short,
    status_long: fixture.status_long,
    status_elapsed: fixture.status_elapsed,
    goals_home: fixture.goals_home,
    goals_away: fixture.goals_away,
    round: fixture.round,
    home_team: homeTeam,
    away_team: awayTeam,
    league,
  };
}

// ─────────────────────────────────────────────
// fixture_statistics
// ─────────────────────────────────────────────

/**
 * Đọc thống kê chi tiết trận từ DB (possession, shots, corners…).
 * Trả về cùng shape với MatchStatistic[] từ API-Football
 * để dùng thẳng với <StatsBars />.
 */
export async function getFixtureStatisticsFromDB(
  fixtureId: number
): Promise<DbMatchStatistic[]> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("fixture_statistics")
      .select("team_id,stat_type,stat_value,team:teams!team_id(id,name,logo_url)")
      .eq("fixture_id", fixtureId)
      .order("team_id", { ascending: true });

    if (error) throw error;
    if (!data?.length) return [];

    // Group by team_id → reconstruct DbMatchStatistic[]
    const byTeam = new Map<number, DbMatchStatistic>();

    for (const row of data as unknown as {
      team_id: number;
      stat_type: string;
      stat_value: string | null;
      team: { id: number; name: string; logo_url: string | null };
    }[]) {
      if (!byTeam.has(row.team_id)) {
        byTeam.set(row.team_id, {
          team: {
            id: row.team.id,
            name: row.team.name,
            logo: row.team.logo_url ?? "",
          },
          statistics: [],
        });
      }
      // Parse stat_value: "45%" stays string, "5" becomes number
      const raw = row.stat_value;
      const parsed =
        raw === null ? null : raw.endsWith("%") ? raw : isNaN(Number(raw)) ? raw : Number(raw);

      byTeam.get(row.team_id)!.statistics.push({ type: row.stat_type, value: parsed });
    }

    return [...byTeam.values()];
  } catch (err) {
    console.error("[DB] getFixtureStatisticsFromDB:", err);
    return [];
  }
}

// ─────────────────────────────────────────────
// player_season_stats
// ─────────────────────────────────────────────

/**
 * Đọc top players từ DB (scorers / assists / yellow cards).
 * Thay thế direct API call ở TopPlayersWidget.
 */
export async function getTopPlayersFromDB(
  leagueId: number,
  seasonYear: number,
  statType: "scorer" | "assist" | "yellowcard"
): Promise<DbTopPlayer[]> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("player_season_stats")
      .select(
        "rank,stat_value,games," +
        "player:players!player_id(id,name,photo_url)," +
        "team:teams!team_id(id,name,logo_url)"
      )
      .eq("league_id", leagueId)
      .eq("season_year", seasonYear)
      .eq("stat_type", statType)
      .order("rank", { ascending: true })
      .limit(10);

    if (error) throw error;
    return (data ?? []) as unknown as DbTopPlayer[];
  } catch (err) {
    console.error("[DB] getTopPlayersFromDB:", err);
    return [];
  }
}

export async function getLatestMatchPreviewsFromDB(limit = 12): Promise<DbPreviewIndexItem[]> {
  const key = cacheKey.latestPreviews(limit);
  const cached = await redis.get<DbPreviewIndexItem[]>(key).catch(() => null);
  if (cached) return cached;

  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("match_previews")
      .select(PREVIEW_INDEX_SELECT)
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const result = ((data ?? []) as unknown as RawPreviewIndexRow[])
      .map((row) => ({
        ...row,
        fixture: normalizePreviewFixture(row.fixture),
      }))
      .map((row) => ({
        fixture_id: row.fixture_id,
        content: row.content,
        generated_at: row.generated_at,
        fixture: row.fixture ? enrichFixture(row.fixture) : null,
      }))
      .filter((row): row is DbPreviewIndexItem => row.fixture !== null);

    void redis.setex(key, TTL.LATEST_PREVIEWS, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getLatestMatchPreviewsFromDB:", err);
    return [];
  }
}

// ─────────────────────────────────────────────
// Homepage multi-league standings
// ─────────────────────────────────────────────

/**
 * Lấy bảng xếp hạng cho nhiều giải trong một truy vấn, kèm thông tin giải +
 * season hiện tại. Dùng cho widget có switcher giải ở trang chủ.
 */
export async function getStandingsForLeaguesFromDB(
  leagueIds: number[]
): Promise<DbLeagueStandings[]> {
  if (leagueIds.length === 0) return [];

  const key = cacheKey.standingsMulti(leagueIds);
  const cached = await redis.get<DbLeagueStandings[]>(key).catch(() => null);
  if (cached) {
    // Backfill groups cho bản cache cũ, tránh crash khi render
    return cached.map((item) => ({
      ...item,
      groups: item.groups ?? groupStandingsByLabel(item.standings),
    }));
  }

  try {
    const tracked = await getTrackedLeaguesFromDB();
    const leagueMap = new Map(tracked.map((league) => [league.id, league]));

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("standings")
      .select(
        [
          "league_id",
          "season_year",
          "team_id",
          "rank",
          "points",
          "goals_diff",
          "played",
          "win",
          "draw",
          "lose",
          "form",
          "group_label",
          "team:teams!team_id(id,name,logo_url)",
        ].join(",")
      )
      .in("league_id", leagueIds)
      .order("league_id", { ascending: true })
      .order("rank", { ascending: true });

    if (error) throw error;

    const rows = (data ?? []) as unknown as DbStanding[];
    const byLeague = new Map<number, DbStanding[]>();

    for (const row of rows) {
      const league = leagueMap.get(row.league_id);
      if (!league) continue;
      if (league.season_year && row.season_year !== league.season_year) continue;

      const bucket = byLeague.get(row.league_id) ?? [];
      bucket.push(row);
      byLeague.set(row.league_id, bucket);
    }

    const result = leagueIds
      .map((id) => {
        const league = leagueMap.get(id);
        if (!league) return null;
        const standings = byLeague.get(id) ?? [];
        return { league, standings, groups: groupStandingsByLabel(standings) };
      })
      .filter((item): item is DbLeagueStandings => item !== null);

    void redis.setex(key, TTL.STANDINGS_MULTI, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getStandingsForLeaguesFromDB:", err);
    return [];
  }
}

// ─────────────────────────────────────────────
// Team detail
// ─────────────────────────────────────────────

type RawTeamDetailRow = {
  id: number;
  name: string;
  code: string | null;
  founded: number | null;
  logo_url: string | null;
  country: { name: string } | null;
  venue: { name: string; city: string | null; capacity: number | null; image_url: string | null } | null;
};

export async function getTeamDetailFromDB(teamId: number): Promise<DbTeamDetail | null> {
  const key = cacheKey.teamDetail(teamId);
  const cached = await redis.get<DbTeamDetail>(key).catch(() => null);
  if (cached) return cached;

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("teams")
      .select(
        [
          "id",
          "name",
          "code",
          "founded",
          "logo_url",
          "country:countries!country_id(name)",
          "venue:venues!venue_id(name,city,capacity,image_url)",
        ].join(",")
      )
      .eq("id", teamId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const result = data as unknown as RawTeamDetailRow;
    void redis.setex(key, TTL.TEAM_DETAIL, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getTeamDetailFromDB:", err);
    return null;
  }
}

export async function getTeamRecentFixturesFromDB(teamId: number, limit = 6): Promise<DbFixture[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in("status_short", [...FINISHED_STATUSES])
      .order("kickoff_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as unknown as RawFixtureRow[]).map(enrichFixture);
  } catch (err) {
    console.error("[DB] getTeamRecentFixturesFromDB:", err);
    return [];
  }
}

export async function getTeamUpcomingFixturesFromDB(teamId: number, limit = 6): Promise<DbFixture[]> {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("fixtures")
      .select(FIXTURE_SELECT)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .in("status_short", [...NOT_STARTED_STATUSES, ...LIVE_STATUSES])
      .order("kickoff_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as unknown as RawFixtureRow[]).map(enrichFixture);
  } catch (err) {
    console.error("[DB] getTeamUpcomingFixturesFromDB:", err);
    return [];
  }
}

/**
 * Trả về các giải hiện tại của đội (từ team_league_seasons với season hiện tại)
 * kèm entry xếp hạng của đội trong giải đó.
 */
export async function getTeamStandingContextsFromDB(teamId: number): Promise<DbTeamStandingContext[]> {
  try {
    const tracked = await getTrackedLeaguesFromDB();
    const byId = new Map(tracked.map((league) => [league.id, league]));
    const trackedIds = tracked.map((l) => l.id);
    if (trackedIds.length === 0) return [];

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("standings")
      .select(
        [
          "league_id",
          "season_year",
          "team_id",
          "rank",
          "points",
          "goals_diff",
          "played",
          "win",
          "draw",
          "lose",
          "form",
          "group_label",
          "team:teams!team_id(id,name,logo_url)",
        ].join(",")
      )
      .eq("team_id", teamId)
      .in("league_id", trackedIds);

    if (error) throw error;

    const rows = (data ?? []) as unknown as DbStanding[];
    const results: DbTeamStandingContext[] = [];

    for (const row of rows) {
      const league = byId.get(row.league_id);
      if (!league) continue;
      if (league.season_year && row.season_year !== league.season_year) continue;
      results.push({ league, entry: row });
    }

    return results;
  } catch (err) {
    console.error("[DB] getTeamStandingContextsFromDB:", err);
    return [];
  }
}

const SQUAD_POSITION_ORDER: Record<string, number> = {
  Goalkeeper: 0,
  Defender: 1,
  Midfielder: 2,
  Attacker: 3,
};

function normalizeSquadPosition(position: string | null) {
  if (!position) return "Khác";
  return position;
}

export async function getTeamSquadFromDB(teamId: number): Promise<DbSquadGroup[]> {
  try {
    const tracked = await getTrackedLeaguesFromDB();
    const supabase = getSupabaseAdmin();

    const { data: membership, error: membershipError } = await supabase
      .from("team_league_seasons")
      .select("season_year,league_id")
      .eq("team_id", teamId);

    if (membershipError) throw membershipError;

    const trackedLeagueIds = new Set(tracked.map((l) => l.id));
    const currentSeasonByLeague = new Map(
      tracked
        .filter((l) => l.season_year !== null)
        .map((l) => [l.id, l.season_year as number])
    );

    const seasonYears = new Set<number>();
    for (const row of membership ?? []) {
      const leagueId = row.league_id as number;
      const seasonYear = row.season_year as number;
      if (!trackedLeagueIds.has(leagueId)) continue;
      if (currentSeasonByLeague.get(leagueId) !== seasonYear) continue;
      seasonYears.add(seasonYear);
    }

    if (seasonYears.size === 0) return [];

    const { data, error } = await supabase
      .from("squads")
      .select(
        [
          "player_id",
          "squad_number",
          "position",
          "player:players!player_id(id,name,photo_url,first_name,last_name,birth_date,height_cm,weight_kg,nationality:countries!nationality_country_id(name,flag_url))",
        ].join(",")
      )
      .eq("team_id", teamId)
      .eq("is_active", true)
      .in("season_year", [...seasonYears]);

    if (error) throw error;

    const rows = (data ?? []) as unknown as DbSquadPlayer[];

    // Dedupe: khi team ở nhiều giải, cùng một player_id có thể xuất hiện nhiều lần
    // (khác season_year). Giữ bản đầu tiên.
    const seenPlayers = new Set<number>();
    const uniqueRows: DbSquadPlayer[] = [];
    for (const row of rows) {
      if (!row.player) continue;
      if (seenPlayers.has(row.player_id)) continue;
      seenPlayers.add(row.player_id);
      uniqueRows.push(row);
    }

    // Dedupe theo squad_number: nếu hai cầu thủ khác nhau cùng số áo
    // (do API trả về dữ liệu cũ), giữ lại cầu thủ có player_id nhỏ hơn để
    // đảm bảo hiển thị ổn định. Các số null vẫn giữ hết.
    const seenNumbers = new Map<number, DbSquadPlayer>();
    const withoutNumber: DbSquadPlayer[] = [];
    for (const row of uniqueRows) {
      if (row.squad_number == null) {
        withoutNumber.push(row);
        continue;
      }
      const existing = seenNumbers.get(row.squad_number);
      if (!existing || row.player_id < existing.player_id) {
        seenNumbers.set(row.squad_number, row);
      }
    }

    const cleanRows = [...seenNumbers.values(), ...withoutNumber];

    const groups = new Map<string, DbSquadPlayer[]>();
    for (const row of cleanRows) {
      const position = normalizeSquadPosition(row.position);
      const list = groups.get(position) ?? [];
      list.push(row);
      groups.set(position, list);
    }

    return [...groups.entries()]
      .map(([position, players]) => ({
        position,
        players: players.sort((left, right) => {
          const leftNumber = left.squad_number ?? 999;
          const rightNumber = right.squad_number ?? 999;
          if (leftNumber !== rightNumber) return leftNumber - rightNumber;
          return left.player.name.localeCompare(right.player.name);
        }),
      }))
      .sort((left, right) => {
        const leftRank = SQUAD_POSITION_ORDER[left.position] ?? 99;
        const rightRank = SQUAD_POSITION_ORDER[right.position] ?? 99;
        return leftRank - rightRank;
      });
  } catch (err) {
    console.error("[DB] getTeamSquadFromDB:", err);
    return [];
  }
}
