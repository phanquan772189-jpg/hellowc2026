import "server-only";

import { makeSlug, todayInTimeZone } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

import type { DbFixture } from "./types";

export function shiftVietnamDateString(dateString: string, days: number): string {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Returns [start, end) ISO strings spanning a day in Asia/Ho_Chi_Minh */
export function getVietnamDayRange(
  dateString = todayInTimeZone("Asia/Ho_Chi_Minh")
): { start: string; end: string } {
  const start = new Date(`${dateString}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export const FIXTURE_SELECT = [
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

export type RawFixtureRow = Omit<DbFixture, "slug">;

export type FixtureQueryOptions = {
  start?: string;
  end?: string;
  statuses?: string[];
  leagueIds?: number[];
  limit?: number;
  ascending?: boolean;
};

export function enrichFixture(row: RawFixtureRow): DbFixture {
  return {
    ...row,
    slug: makeSlug(row.home_team.name, row.away_team.name, row.id),
  };
}

export async function queryFixturesFromDB(options: FixtureQueryOptions): Promise<DbFixture[]> {
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

export function takeFirstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
