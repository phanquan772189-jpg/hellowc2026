import "server-only";

import { getSupabaseAdmin } from "@/lib/supabase-admin";

import { enrichFixture, takeFirstRelation, type RawFixtureRow } from "./_shared";
import type {
  DbEvent,
  DbLeague,
  DbLineup,
  DbLineupPlayer,
  DbMatchPreview,
  DbMatchStatistic,
  DbPreviewIndexItem,
  DbTeam,
  DbTopPlayer,
} from "./types";

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

export async function getLatestMatchPreviewsFromDB(limit = 12): Promise<DbPreviewIndexItem[]> {
  try {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("match_previews")
      .select(PREVIEW_INDEX_SELECT)
      .order("generated_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return ((data ?? []) as unknown as RawPreviewIndexRow[])
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
  } catch (err) {
    console.error("[DB] getLatestMatchPreviewsFromDB:", err);
    return [];
  }
}
