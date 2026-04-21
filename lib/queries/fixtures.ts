import "server-only";

import { makeSlug, todayInTimeZone } from "@/lib/api";
import { cacheKey, redis, TTL } from "@/lib/redis";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

import {
  FIXTURE_SELECT,
  enrichFixture,
  getVietnamDayRange,
  queryFixturesFromDB,
  shiftVietnamDateString,
  type RawFixtureRow,
} from "./_shared";
import { FINISHED_STATUSES, NOT_STARTED_STATUSES } from "./status";
import type { DbFixture, DbFixtureDetail, DbH2HFixture, DbLeague, DbTeam } from "./types";

export async function getTodayFixturesFromDB(): Promise<DbFixture[]> {
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

export async function getH2HFixturesFromDB(
  teamAId: number,
  teamBId: number,
  limit = 10
): Promise<DbH2HFixture[]> {
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
export async function getAllFixtureSlugsFromDB(): Promise<
  { slug: string; kickoff_at: string; status_short: string }[]
> {
  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const oneMonthAhead = new Date(now);
    oneMonthAhead.setMonth(oneMonthAhead.getMonth() + 1);

    const { data, error } = await supabase
      .from("fixtures")
      .select([
        "id", "kickoff_at", "status_short",
        "home_team:teams!home_team_id(name)",
        "away_team:teams!away_team_id(name)",
      ].join(","))
      .gte("kickoff_at", sixMonthsAgo.toISOString())
      .lte("kickoff_at", oneMonthAhead.toISOString())
      .order("kickoff_at", { ascending: false })
      .limit(5000);

    if (error) throw error;

    return ((data ?? []) as unknown as {
      id: number;
      kickoff_at: string;
      status_short: string;
      home_team: { name: string };
      away_team: { name: string };
    }[]).map((row) => ({
      slug: makeSlug(row.home_team.name, row.away_team.name, row.id),
      kickoff_at: row.kickoff_at,
      status_short: row.status_short,
    }));
  } catch (err) {
    console.error("[DB] getAllFixtureSlugsFromDB:", err);
    return [];
  }
}

export async function getUpcomingFixturesFromDB(days = 7): Promise<DbFixture[]> {
  const safeDays = Math.max(1, days);
  const today = todayInTimeZone("Asia/Ho_Chi_Minh");
  const start = getVietnamDayRange(today).start;
  const end = getVietnamDayRange(shiftVietnamDateString(today, safeDays)).start;

  return queryFixturesFromDB({
    start,
    end,
    statuses: [...NOT_STARTED_STATUSES],
    ascending: true,
  });
}

export async function getRecentFinishedFixturesFromDB(days = 7): Promise<DbFixture[]> {
  const safeDays = Math.max(1, days);
  const today = todayInTimeZone("Asia/Ho_Chi_Minh");
  const startDate = shiftVietnamDateString(today, -(safeDays - 1));
  const start = getVietnamDayRange(startDate).start;
  const end = getVietnamDayRange(shiftVietnamDateString(today, 1)).start;

  return queryFixturesFromDB({
    start,
    end,
    statuses: [...FINISHED_STATUSES],
    ascending: false,
  });
}
