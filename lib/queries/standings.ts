import "server-only";

import { getTrackedLeagueIds } from "@/lib/football-sync-config";
import { cacheKey, getRedisOrNull, TTL } from "@/lib/redis";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

import { FIXTURE_SELECT, enrichFixture, type RawFixtureRow } from "./_shared";
import type { DbFixture, DbStanding, DbTrackedLeague } from "./types";

export async function getStandingsFromDB(leagueId: number, seasonYear: number): Promise<DbStanding[]> {
  const key = cacheKey.standings(leagueId, seasonYear);
  const redis = getRedisOrNull();
  const cached = redis ? await redis.get<DbStanding[]>(key).catch(() => null) : null;
  if (cached) return cached;

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
          "team:teams!team_id(id,name,logo_url)",
        ].join(",")
      )
      .eq("league_id", leagueId)
      .eq("season_year", seasonYear)
      .order("rank", { ascending: true });

    if (error) throw error;
    const result = (data ?? []) as unknown as DbStanding[];
    void redis?.setex(key, TTL.STANDINGS, result).catch(() => {});
    return result;
  } catch (err) {
    console.error("[DB] getStandingsFromDB:", err);
    return [];
  }
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

    return trackedLeagueIds
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
  } catch (err) {
    console.error("[DB] getTrackedLeaguesFromDB:", err);
    return [];
  }
}

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
