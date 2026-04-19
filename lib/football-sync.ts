import "server-only";

import type { ApiCountry, ApiLeagueCatalog, ApiTeamWithVenue, RawFixture, StandingEntry } from "@/lib/api";
import {
  fetchCountriesCatalog,
  fetchFixturesByLeagueSeason,
  fetchFixturesByLeagueSeasonRange,
  fetchLeagueCatalog,
  fetchLeagueSeasonsCatalog,
  fetchLiveRawFixtures,
  fetchPlayersSquad,
  fetchStandings,
  fetchTeamsByLeagueSeason,
} from "@/lib/api";
import { FOOTBALL_TIMEZONE, getFixtureSyncWindow, getTrackedLeagueIds } from "@/lib/football-sync-config";
import { cacheKey, redis, TTL } from "@/lib/redis";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-admin";

type SyncMode = "foundation" | "squads" | "fixtures" | "bootstrap" | "standings" | "live";

type LeagueContext = {
  leagueId: number;
  seasonYear: number;
};

type CountryRow = {
  name: string;
  code: string | null;
  flag_url: string | null;
  kind: "country" | "region" | "international";
};

type SyncCounts = {
  countries: number;
  seasons: number;
  leagues: number;
  leagueSeasons: number;
  venues: number;
  teams: number;
  teamLeagueSeasons: number;
  players: number;
  squads: number;
  fixtures: number;
  standings: number;
};

export type SyncReport = {
  mode: SyncMode;
  startedAt: string;
  finishedAt?: string;
  trackedLeagueIds: number[];
  window?: {
    from: string;
    to: string;
    timeZone: string;
  };
  counts: SyncCounts;
  warnings: string[];
};

const REGION_NAMES = new Set([
  "World",
  "Europe",
  "Asia",
  "Africa",
  "Oceania",
  "North-America",
  "South-America",
]);

function createReport(mode: SyncMode): SyncReport {
  return {
    mode,
    startedAt: new Date().toISOString(),
    trackedLeagueIds: getTrackedLeagueIds(),
    counts: {
      countries: 0,
      seasons: 0,
      leagues: 0,
      leagueSeasons: 0,
      venues: 0,
      teams: 0,
      teamLeagueSeasons: 0,
      players: 0,
      squads: 0,
      fixtures: 0,
      standings: 0,
    },
    warnings: [],
  };
}

function finishReport(report: SyncReport) {
  report.finishedAt = new Date().toISOString();
  return report;
}

function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function ensureSupabaseReady() {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string | number | null | undefined) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (key === null || key === undefined) continue;
    const normalized = String(key);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(item);
  }

  return result;
}

function chunk<T>(items: T[], size = 200) {
  const groups: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }

  return groups;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  handler: (item: T, index: number) => Promise<R>
) {
  if (items.length === 0) return [] as R[];

  const results = new Array<R>(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const current = cursor;
      cursor += 1;
      if (current >= items.length) return;
      results[current] = await handler(items[current], current);
    }
  });

  await Promise.all(workers);
  return results;
}

function inferCountryKind(name: string, code: string | null) {
  if (REGION_NAMES.has(name)) return "region" as const;
  if (code) return "country" as const;
  return "international" as const;
}

function countryRowFromApiCountry(country: ApiCountry): CountryRow | null {
  if (!country.name) return null;

  return {
    name: country.name,
    code: country.code ?? null,
    flag_url: country.flag ?? null,
    kind: inferCountryKind(country.name, country.code ?? null),
  };
}

function countryRowFromName(name: string | null | undefined): CountryRow | null {
  if (!name) return null;

  return {
    name,
    code: null,
    flag_url: null,
    kind: inferCountryKind(name, null),
  };
}

function normalizeLeagueType(type: string) {
  return type === "Cup" ? "Cup" : "League";
}

function normalizeFoundedYear(value: number | null | undefined) {
  if (!value) return null;
  return value >= 1800 && value <= 2100 ? value : null;
}

function dedupeCountryCodes(rows: CountryRow[]) {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.code) continue;
    counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
  }

  return rows.map((row) => ({
    ...row,
    code: row.code && (counts.get(row.code) ?? 0) > 1 ? null : row.code,
  }));
}

async function upsertRows(table: string, rows: Record<string, unknown>[], onConflict: string, batchSize = 200) {
  if (rows.length === 0) return;

  const supabase = getSupabaseAdmin();

  for (const batch of chunk(rows, batchSize)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw new Error(`${table} upsert failed: ${error.message}`);
    }
  }
}

async function insertRows(table: string, rows: Record<string, unknown>[], batchSize = 200) {
  if (rows.length === 0) return;

  const supabase = getSupabaseAdmin();

  for (const batch of chunk(rows, batchSize)) {
    const { error } = await supabase.from(table).insert(batch);
    if (error) {
      throw new Error(`${table} insert failed: ${error.message}`);
    }
  }
}

async function loadCountryIdMap(names: string[]) {
  const uniqueNames = [...new Set(names.filter(Boolean))];
  const map = new Map<string, number>();

  if (uniqueNames.length === 0) return map;

  const supabase = getSupabaseAdmin();

  for (const batch of chunk(uniqueNames, 100)) {
    const { data, error } = await supabase.from("countries").select("id,name").in("name", batch);
    if (error) {
      throw new Error(`Failed to load countries: ${error.message}`);
    }

    for (const row of data ?? []) {
      map.set(row.name as string, row.id as number);
    }
  }

  return map;
}

async function syncGlobalCatalogs(report: SyncReport) {
  const countries = await fetchCountriesCatalog();
  const countryRows = dedupeCountryCodes(
    uniqueBy(
      countries
        .map(countryRowFromApiCountry)
        .filter((row): row is CountryRow => Boolean(row)),
      (row) => row.name
    )
  );

  await upsertRows("countries", countryRows, "name");
  report.counts.countries += countryRows.length;

  const seasons = await fetchLeagueSeasonsCatalog();
  const seasonRows = uniqueBy(seasons.map((year) => ({ year })), (row) => row.year);

  await upsertRows("seasons", seasonRows, "year");
  report.counts.seasons += seasonRows.length;
}

async function syncLeagueCatalogs(leagueIds: number[], report: SyncReport) {
  const catalogs = await mapWithConcurrency(leagueIds, 4, async (leagueId) => {
    try {
      return await fetchLeagueCatalog(leagueId);
    } catch (error: unknown) {
      report.warnings.push(`League ${leagueId} metadata sync failed: ${formatError(error)}`);
      return null;
    }
  });

  const availableCatalogs = catalogs.filter((catalog): catalog is ApiLeagueCatalog => Boolean(catalog));
  const supplementalCountries = uniqueBy(
    availableCatalogs
      .map((catalog) => countryRowFromApiCountry(catalog.country))
      .filter((row): row is CountryRow => Boolean(row)),
    (row) => row.name
  );

  await upsertRows("countries", supplementalCountries, "name");
  report.counts.countries += supplementalCountries.length;

  const catalogSeasonRows = uniqueBy(
    availableCatalogs.flatMap((catalog) => catalog.seasons.map((season) => ({ year: season.year }))),
    (row) => row.year
  );
  await upsertRows("seasons", catalogSeasonRows, "year");
  report.counts.seasons += catalogSeasonRows.length;

  const countryIdMap = await loadCountryIdMap(supplementalCountries.map((row) => row.name));

  const leagueRows = availableCatalogs.map((catalog) => ({
    id: catalog.league.id,
    name: catalog.league.name,
    type: normalizeLeagueType(catalog.league.type),
    country_id: countryIdMap.get(catalog.country.name) ?? null,
    logo_url: catalog.league.logo ?? null,
  }));

  await upsertRows("leagues", leagueRows, "id");
  report.counts.leagues += leagueRows.length;

  const contexts: LeagueContext[] = [];
  const supabase = getSupabaseAdmin();

  for (const catalog of availableCatalogs) {
    const seasons = catalog.seasons;
    if (seasons.length === 0) {
      report.warnings.push(`League ${catalog.league.id} has no seasons in API-Football response.`);
      continue;
    }

    const currentSeason =
      seasons.find((season) => season.current) ??
      [...seasons].sort((left, right) => right.year - left.year)[0];

    const { error: resetError } = await supabase
      .from("league_seasons")
      .update({ is_current: false })
      .eq("league_id", catalog.league.id);

    if (resetError) {
      throw new Error(`Failed to reset current season for league ${catalog.league.id}: ${resetError.message}`);
    }

    const rows = seasons.map((season) => ({
      league_id: catalog.league.id,
      season_year: season.year,
      start_date: season.start,
      end_date: season.end,
      is_current: season.year === currentSeason.year,
      coverage: season.coverage ?? null,
    }));

    await upsertRows("league_seasons", rows, "league_id,season_year");
    report.counts.leagueSeasons += rows.length;
    contexts.push({ leagueId: catalog.league.id, seasonYear: currentSeason.year });
  }

  return contexts;
}

async function syncTeamsForLeagueContexts(contexts: LeagueContext[], report: SyncReport) {
  if (contexts.length === 0) return;

  const responses = await mapWithConcurrency(contexts, 4, async (context) => {
    try {
      const teams = await fetchTeamsByLeagueSeason(context.leagueId, context.seasonYear);
      return { ...context, teams };
    } catch (error: unknown) {
      report.warnings.push(
        `League ${context.leagueId} teams sync failed for season ${context.seasonYear}: ${formatError(error)}`
      );
      return { ...context, teams: [] as ApiTeamWithVenue[] };
    }
  });

  const countryRows = uniqueBy(
    responses
      .flatMap((entry) => entry.teams.map((team) => countryRowFromName(team.team.country)))
      .filter((row): row is CountryRow => Boolean(row)),
    (row) => row.name
  );

  await upsertRows("countries", countryRows, "name");
  report.counts.countries += countryRows.length;

  const countryIdMap = await loadCountryIdMap(countryRows.map((row) => row.name));

  const venueRows = uniqueBy(
    responses.flatMap((entry) =>
      entry.teams
        .filter((team) => team.venue.id && team.venue.name)
        .map((team) => ({
          id: team.venue.id as number,
          name: team.venue.name as string,
          city: team.venue.city ?? null,
          capacity: team.venue.capacity ?? null,
          image_url: team.venue.image ?? null,
        }))
    ),
    (row) => row.id
  );

  await upsertRows("venues", venueRows, "id");
  report.counts.venues += venueRows.length;

  const teamRows = uniqueBy(
    responses.flatMap((entry) =>
      entry.teams.map((team) => ({
        id: team.team.id,
        name: team.team.name,
        code: team.team.code ?? null,
        country_id: team.team.country ? countryIdMap.get(team.team.country) ?? null : null,
        founded: normalizeFoundedYear(team.team.founded),
        logo_url: team.team.logo ?? null,
        venue_id: team.venue.id ?? null,
      }))
    ),
    (row) => row.id
  );

  await upsertRows("teams", teamRows, "id");
  report.counts.teams += teamRows.length;

  const membershipRows = uniqueBy(
    responses.flatMap((entry) =>
      entry.teams.map((team) => ({
        team_id: team.team.id,
        league_id: entry.leagueId,
        season_year: entry.seasonYear,
      }))
    ),
    (row) => `${row.team_id}:${row.league_id}:${row.season_year}`
  );

  await upsertRows("team_league_seasons", membershipRows, "team_id,league_id,season_year");
  report.counts.teamLeagueSeasons += membershipRows.length;
}

async function loadCurrentLeagueContextsFromDb(leagueIds: number[]) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("league_seasons")
    .select("league_id,season_year")
    .in("league_id", leagueIds)
    .eq("is_current", true);

  if (error) {
    throw new Error(`Failed to load current league seasons: ${error.message}`);
  }

  return new Map<number, number>(
    (data ?? []).map((row) => [row.league_id as number, row.season_year as number])
  );
}

async function ensureTrackedLeagueContexts(report: SyncReport) {
  const leagueIds = getTrackedLeagueIds();
  const byLeagueId = await loadCurrentLeagueContextsFromDb(leagueIds);
  const missing = leagueIds.filter((leagueId) => !byLeagueId.has(leagueId));

  if (missing.length > 0) {
    const syncedContexts = await syncLeagueCatalogs(missing, report);
    await syncTeamsForLeagueContexts(syncedContexts, report);

    for (const context of syncedContexts) {
      byLeagueId.set(context.leagueId, context.seasonYear);
    }
  }

  return leagueIds
    .map((leagueId) => {
      const seasonYear = byLeagueId.get(leagueId);
      if (!seasonYear) {
        report.warnings.push(`League ${leagueId} is missing a current season in Supabase.`);
        return null;
      }
      return { leagueId, seasonYear };
    })
    .filter((context): context is LeagueContext => Boolean(context));
}

async function ensureTrackedTeamMemberships(contexts: LeagueContext[], report: SyncReport) {
  if (contexts.length === 0) return;

  const supabase = getSupabaseAdmin();
  const leagueIds = [...new Set(contexts.map((context) => context.leagueId))];
  const currentSeasonByLeague = new Map(contexts.map((context) => [context.leagueId, context.seasonYear]));

  const { data, error } = await supabase
    .from("team_league_seasons")
    .select("league_id,season_year")
    .in("league_id", leagueIds);

  if (error) {
    throw new Error(`Failed to load team league memberships: ${error.message}`);
  }

  const availableKeys = new Set(
    (data ?? [])
      .filter((row) => currentSeasonByLeague.get(row.league_id as number) === (row.season_year as number))
      .map((row) => `${row.league_id}:${row.season_year}`)
  );

  const missingContexts = contexts.filter(
    (context) => !availableKeys.has(`${context.leagueId}:${context.seasonYear}`)
  );

  if (missingContexts.length > 0) {
    await syncTeamsForLeagueContexts(missingContexts, report);
  }
}

async function loadTrackedTeamSeasonPairs(contexts: LeagueContext[]) {
  const supabase = getSupabaseAdmin();
  const leagueIds = [...new Set(contexts.map((context) => context.leagueId))];
  const currentSeasonByLeague = new Map(contexts.map((context) => [context.leagueId, context.seasonYear]));

  // Bước 1: Lấy tất cả (team_id, season_year) của các giải đấu hiện tại
  const { data: membershipData, error: membershipError } = await supabase
    .from("team_league_seasons")
    .select("team_id,league_id,season_year")
    .in("league_id", leagueIds);

  if (membershipError) {
    throw new Error(`Failed to load tracked teams: ${membershipError.message}`);
  }

  const allPairs = uniqueBy(
    (membershipData ?? [])
      .filter((row) => currentSeasonByLeague.get(row.league_id as number) === (row.season_year as number))
      .map((row) => ({
        teamId: row.team_id as number,
        seasonYear: row.season_year as number,
      })),
    (row) => `${row.teamId}:${row.seasonYear}`
  );

  if (allPairs.length === 0) return [];

  // Bước 2: Lấy danh sách team_id đã có dữ liệu squad
  const seasonYears = [...new Set(allPairs.map((pair) => pair.seasonYear))];

  const { data: squadData, error: squadError } = await supabase
    .from("squads")
    .select("team_id")
    .in("season_year", seasonYears);

  if (squadError) {
    throw new Error(`Failed to load existing squads: ${squadError.message}`);
  }

  const syncedTeamIds = new Set<number>(
    (squadData ?? []).map((row) => row.team_id as number)
  );

  // Bước 3 & 4: Chỉ giữ đội chưa có squad, tối đa 50
  return allPairs
    .filter((pair) => !syncedTeamIds.has(pair.teamId))
    .slice(0, 50);
}

async function syncSquadsForTeamSeasonPairs(
  teamSeasonPairs: Array<{ teamId: number; seasonYear: number }>,
  report: SyncReport
) {
  const supabase = getSupabaseAdmin();

  await mapWithConcurrency(teamSeasonPairs, 4, async ({ teamId, seasonYear }) => {
    try {
      const squad = await fetchPlayersSquad(teamId);
      if (!squad || squad.players.length === 0) {
        report.warnings.push(`Team ${teamId} returned an empty squad.`);
        return;
      }

      const playerRows = uniqueBy(
        squad.players.map((player) => ({
          id: player.id,
          name: player.name,
          photo_url: player.photo ?? null,
        })),
        (row) => row.id
      );

      await upsertRows("players", playerRows, "id");
      report.counts.players += playerRows.length;

      const { error: resetError } = await supabase
        .from("squads")
        .update({ is_active: false })
        .eq("team_id", teamId)
        .eq("season_year", seasonYear);

      if (resetError) {
        throw new Error(`Failed to reset squad for team ${teamId}: ${resetError.message}`);
      }

      const squadRows = squad.players.map((player) => ({
        team_id: teamId,
        player_id: player.id,
        season_year: seasonYear,
        squad_number: player.number ?? null,
        position: player.position ?? null,
        is_active: true,
      }));

      await upsertRows("squads", squadRows, "team_id,player_id,season_year");
      report.counts.squads += squadRows.length;
    } catch (error: unknown) {
      report.warnings.push(`Squad sync failed for team ${teamId}: ${formatError(error)}`);
    }
  });
}

function minimalTeamRowsFromFixtures(fixtures: RawFixture[]) {
  return uniqueBy(
    fixtures.flatMap((fixture) => [
      {
        id: fixture.teams.home.id,
        name: fixture.teams.home.name,
        logo_url: fixture.teams.home.logo,
      },
      {
        id: fixture.teams.away.id,
        name: fixture.teams.away.name,
        logo_url: fixture.teams.away.logo,
      },
    ]),
    (row) => row.id
  );
}

function minimalVenueRowsFromFixtures(fixtures: RawFixture[]) {
  return uniqueBy(
    fixtures
      .filter((fixture) => fixture.fixture.venue?.id && fixture.fixture.venue?.name)
      .map((fixture) => ({
        id: fixture.fixture.venue?.id as number,
        name: fixture.fixture.venue?.name as string,
        city: fixture.fixture.venue?.city ?? null,
      })),
    (row) => row.id
  );
}

function buildFixtureRow(fixture: RawFixture, seasonYear: number | null) {
  return {
    id: fixture.fixture.id,
    kickoff_at: fixture.fixture.date,
    league_id: fixture.league.id,
    season_year: seasonYear,
    round: fixture.league.round ?? null,
    home_team_id: fixture.teams.home.id,
    away_team_id: fixture.teams.away.id,
    venue_id: fixture.fixture.venue?.id && fixture.fixture.venue?.name ? fixture.fixture.venue.id : null,
    referee: fixture.fixture.referee,
    status_short: fixture.fixture.status.short,
    status_long: fixture.fixture.status.long,
    status_elapsed: fixture.fixture.status.elapsed,
    goals_home: fixture.goals?.home ?? null,
    goals_away: fixture.goals?.away ?? null,
    score_ht_home: fixture.score?.halftime?.home ?? null,
    score_ht_away: fixture.score?.halftime?.away ?? null,
    score_ft_home: fixture.score?.fulltime?.home ?? null,
    score_ft_away: fixture.score?.fulltime?.away ?? null,
    score_et_home: fixture.score?.extratime?.home ?? null,
    score_et_away: fixture.score?.extratime?.away ?? null,
    score_pen_home: fixture.score?.penalty?.home ?? null,
    score_pen_away: fixture.score?.penalty?.away ?? null,
    last_synced_at: new Date().toISOString(),
  };
}

function buildEventRows(fixtures: RawFixture[]) {
  return fixtures.flatMap((fixture) => {
    const homeId = fixture.teams.home.id;
    let homeScore = 0;
    let awayScore = 0;

    return ((fixture.events ?? []) as any[]).map((event: any, index: number) => {
      let scoreSnapshot: string | null = null;

      // Tính tỉ số tích lũy tại thời điểm xảy ra bàn thắng
      if (event.type === "Goal" && event.detail !== "Missed Penalty") {
        const teamId = event.team?.id;
        const isOwnGoal = event.detail === "Own Goal";

        if (isOwnGoal) {
          // Phản lưới: đội gây ra phản lưới mất điểm, đội kia được điểm
          if (teamId === homeId) awayScore++;
          else homeScore++;
        } else {
          if (teamId === homeId) homeScore++;
          else awayScore++;
        }

        scoreSnapshot = `${homeScore}-${awayScore}`;
      }

      return {
        fixture_id: fixture.fixture.id,
        team_id: event.team?.id ?? null,
        player_id: event.player?.id ?? null,
        assist_player_id: event.assist?.id ?? null,
        type: event.type ?? null,
        detail: event.detail ?? null,
        time_elapsed: event.time?.elapsed ?? 0,
        time_extra: event.time?.extra ?? null,
        sort_order: index,
        score_snapshot: scoreSnapshot,
        created_at: new Date().toISOString(),
      };
    });
  });
}

function buildLineupRows(fixtures: RawFixture[]) {
  const lineupRows: Record<string, unknown>[] = [];
  const lineupPlayerRows: Record<string, unknown>[] = [];

  for (const fixture of fixtures) {
    const lineups = (fixture.lineups ?? []) as any[];

    for (const lineup of lineups) {
      const teamId = lineup.team?.id as number | undefined;
      if (!teamId) continue;

      lineupRows.push({
        fixture_id: fixture.fixture.id,
        team_id: teamId,
        formation: lineup.formation ?? null,
        coach_name: lineup.coach?.name ?? null,
      });

      const starters: any[] = lineup.startXI ?? [];
      const substitutes: any[] = lineup.substitutes ?? [];

      for (const entry of starters) {
        const player = entry.player;
        if (!player?.id) continue;
        lineupPlayerRows.push({
          fixture_id: fixture.fixture.id,
          team_id: teamId,
          player_id: player.id,
          is_starting: true,
          jersey_number: player.number ?? null,
          grid_position: player.grid ?? null,
        });
      }

      for (const entry of substitutes) {
        const player = entry.player;
        if (!player?.id) continue;
        lineupPlayerRows.push({
          fixture_id: fixture.fixture.id,
          team_id: teamId,
          player_id: player.id,
          is_starting: false,
          jersey_number: player.number ?? null,
          grid_position: player.grid ?? null,
        });
      }
    }
  }

  return { lineupRows, lineupPlayerRows };
}

async function syncFixturesForContexts(
  contexts: LeagueContext[],
  report: SyncReport,
  options?: { fullSeason?: boolean }
) {
  const fullSeason = options?.fullSeason ?? false;
  const window = fullSeason ? undefined : getFixtureSyncWindow();

  if (window) {
    report.window = window;
  }

  const fixtureGroups = await mapWithConcurrency(contexts, 4, async (context) => {
    try {
      if (fullSeason) {
        return await fetchFixturesByLeagueSeason(context.leagueId, context.seasonYear, FOOTBALL_TIMEZONE);
      }

      return await fetchFixturesByLeagueSeasonRange(
        context.leagueId,
        context.seasonYear,
        window!.from,
        window!.to,
        window!.timeZone
      );
    } catch (error: unknown) {
      report.warnings.push(
        `Fixtures sync failed for league ${context.leagueId} season ${context.seasonYear}: ${formatError(error)}`
      );
      return [] as RawFixture[];
    }
  });

  const fixtures = uniqueBy(fixtureGroups.flat(), (fixture) => fixture.fixture.id);
  const venueRows = minimalVenueRowsFromFixtures(fixtures);
  const teamRows = minimalTeamRowsFromFixtures(fixtures);

  const fixtureRows = fixtures
    .map((fixture) => {
      const seasonYear =
        fixture.league.season ??
        contexts.find((context) => context.leagueId === fixture.league.id)?.seasonYear ??
        null;
      return buildFixtureRow(fixture, seasonYear);
    })
    .filter((row) => row.season_year !== null);

  await upsertRows("venues", venueRows, "id");
  report.counts.venues += venueRows.length;

  await upsertRows("teams", teamRows, "id");
  report.counts.teams += teamRows.length;

  await upsertRows("fixtures", fixtureRows, "id");
  report.counts.fixtures += fixtureRows.length;

  // Sync events: xoá cũ → insert mới để tránh duplicate
  const fixturesWithEvents = fixtures.filter((f) => (f.events?.length ?? 0) > 0);
  if (fixturesWithEvents.length > 0) {
    const supabase = getSupabaseAdmin();
    const updatedFixtureIds = fixturesWithEvents.map((f) => f.fixture.id);
    const { error: deleteError } = await supabase
      .from("fixture_events")
      .delete()
      .in("fixture_id", updatedFixtureIds);

    if (deleteError) {
      report.warnings.push(`Failed to clear old events: ${deleteError.message}`);
    } else {
      const eventRows = buildEventRows(fixturesWithEvents);
      if (eventRows.length > 0) {
        await insertRows("fixture_events", eventRows);
      }
    }
  }

  // Sync lineups
  const fixturesWithLineups = fixtures.filter((f) => (f.lineups?.length ?? 0) > 0);
  if (fixturesWithLineups.length > 0) {
    const { lineupRows, lineupPlayerRows } = buildLineupRows(fixturesWithLineups);
    if (lineupRows.length > 0) {
      await upsertRows("fixture_lineups", lineupRows, "fixture_id,team_id");
    }
    if (lineupPlayerRows.length > 0) {
      await upsertRows("fixture_lineup_players", lineupPlayerRows, "fixture_id,team_id,player_id");
    }
  }
}

export async function runFoundationSync() {
  ensureSupabaseReady();

  const report = createReport("foundation");
  await syncGlobalCatalogs(report);

  const contexts = await syncLeagueCatalogs(report.trackedLeagueIds, report);
  await syncTeamsForLeagueContexts(contexts, report);

  return finishReport(report);
}

export async function runSquadsSync() {
  ensureSupabaseReady();

  const report = createReport("squads");
  const contexts = await ensureTrackedLeagueContexts(report);
  await ensureTrackedTeamMemberships(contexts, report);

  const teamSeasonPairs = await loadTrackedTeamSeasonPairs(contexts);
  await syncSquadsForTeamSeasonPairs(teamSeasonPairs, report);

  return finishReport(report);
}

export async function runFixturesSync() {
  ensureSupabaseReady();

  const report = createReport("fixtures");
  const contexts = await ensureTrackedLeagueContexts(report);
  await syncFixturesForContexts(contexts, report, { fullSeason: false });

  return finishReport(report);
}

export async function runBootstrapSync() {
  ensureSupabaseReady();

  const report = createReport("bootstrap");
  await syncGlobalCatalogs(report);

  const contexts = await syncLeagueCatalogs(report.trackedLeagueIds, report);
  await syncTeamsForLeagueContexts(contexts, report);

  const teamSeasonPairs = await loadTrackedTeamSeasonPairs(contexts);
  await syncSquadsForTeamSeasonPairs(teamSeasonPairs, report);
  await syncFixturesForContexts(contexts, report, { fullSeason: true });

  return finishReport(report);
}

async function syncStandingsForContexts(contexts: LeagueContext[], report: SyncReport) {
  if (contexts.length === 0) return;

  await mapWithConcurrency(contexts, 2, async (context) => {
    try {
      // API-Football trả về mảng 2 chiều (có thể chia group/bảng trong cùng giải)
      const groups: StandingEntry[][] = await fetchStandings(context.leagueId, context.seasonYear);

      if (groups.length === 0) {
        report.warnings.push(
          `Standings empty for league ${context.leagueId} season ${context.seasonYear}.`
        );
        return;
      }

      const standingRows = groups.flat().map((entry) => ({
        league_id: context.leagueId,
        season_year: context.seasonYear,
        team_id: entry.team.id,
        rank: entry.rank,
        points: entry.points,
        goals_diff: entry.goalsDiff,
        played: entry.all.played,
        win: entry.all.win,
        draw: entry.all.draw,
        lose: entry.all.lose,
        form: entry.form ?? null,
        updated_at: new Date().toISOString(),
      }));

      await upsertRows("standings", standingRows, "league_id,season_year,team_id");
      report.counts.standings += standingRows.length;

      // Xóa Redis cache để lần truy vấn tiếp theo fetch dữ liệu mới từ DB
      void redis.del(cacheKey.standings(context.leagueId, context.seasonYear)).catch(() => {});
    } catch (error: unknown) {
      report.warnings.push(
        `Standings sync failed for league ${context.leagueId} season ${context.seasonYear}: ${formatError(error)}`
      );
    }
  });
}

export async function runStandingsSync() {
  ensureSupabaseReady();

  const report = createReport("standings");
  const contexts = await ensureTrackedLeagueContexts(report);
  await syncStandingsForContexts(contexts, report);

  return finishReport(report);
}

async function syncLiveFixturesProcess(report: SyncReport) {
  const rawFixtures = await fetchLiveRawFixtures(FOOTBALL_TIMEZONE);

  // Chỉ xử lý các trận thuộc giải đang theo dõi
  const trackedIds = new Set(report.trackedLeagueIds);
  const fixtures = rawFixtures.filter((f) => trackedIds.has(f.league.id));

  if (fixtures.length === 0) return;

  // Upsert fixture rows (tỷ số + status)
  const fixtureRows = fixtures.map((fixture) =>
    buildFixtureRow(
      fixture,
      fixture.league.season ?? null
    )
  );
  await upsertRows("fixtures", fixtureRows, "id");
  report.counts.fixtures += fixtureRows.length;

  const supabase = getSupabaseAdmin();
  const liveFixtureIds = fixtures.map((f) => f.fixture.id);

  // Sync events: xoá cũ → insert mới
  const fixturesWithEvents = fixtures.filter((f) => (f.events?.length ?? 0) > 0);
  if (fixturesWithEvents.length > 0) {
    const eventFixtureIds = fixturesWithEvents.map((f) => f.fixture.id);
    const { error: deleteError } = await supabase
      .from("fixture_events")
      .delete()
      .in("fixture_id", eventFixtureIds);

    if (deleteError) {
      report.warnings.push(`Live: Failed to clear old events: ${deleteError.message}`);
    } else {
      const eventRows = buildEventRows(fixturesWithEvents);
      if (eventRows.length > 0) {
        await insertRows("fixture_events", eventRows);
      }
    }
  }

  // Sync lineups: chỉ upsert nếu chưa có (lineup không đổi trong trận)
  const fixturesWithLineups = fixtures.filter((f) => (f.lineups?.length ?? 0) > 0);
  if (fixturesWithLineups.length > 0) {
    const lineupFixtureIds = fixturesWithLineups.map((f) => f.fixture.id);
    const { data: existingLineups } = await supabase
      .from("fixture_lineups")
      .select("fixture_id")
      .in("fixture_id", lineupFixtureIds);

    const alreadySynced = new Set((existingLineups ?? []).map((r) => r.fixture_id as number));
    const newLineupFixtures = fixturesWithLineups.filter((f) => !alreadySynced.has(f.fixture.id));

    if (newLineupFixtures.length > 0) {
      const { lineupRows, lineupPlayerRows } = buildLineupRows(newLineupFixtures);
      if (lineupRows.length > 0) {
        await upsertRows("fixture_lineups", lineupRows, "fixture_id,team_id");
      }
      if (lineupPlayerRows.length > 0) {
        await upsertRows("fixture_lineup_players", lineupPlayerRows, "fixture_id,team_id,player_id");
      }
    }
  }

  // ── Ghi tỉ số + trạng thái vào Redis (proactive cache warm-up) ──────────────
  // Giúp /api/live/[id] luôn có cache hit ngay sau mỗi sync run (2 phút/lần).
  // events được cache bởi API route khi có request đầu tiên.
  const redisWrites = fixtures.map((f) =>
    redis
      .setex(cacheKey.liveScore(f.fixture.id), TTL.LIVE_SCORE, {
        goalsHome:     f.goals?.home ?? null,
        goalsAway:     f.goals?.away ?? null,
        statusShort:   f.fixture.status.short,
        statusElapsed: f.fixture.status.elapsed ?? null,
        scoreHtHome:   f.score?.halftime?.home ?? null,
        scoreHtAway:   f.score?.halftime?.away ?? null,
      })
      .catch((err) => console.warn(`[redis] Failed to cache liveScore ${f.fixture.id}:`, err))
  );

  // Khi events thay đổi, xóa events cache để lần poll tiếp theo sẽ fetch lại từ DB
  const eventsInvalidations = fixturesWithEvents.map((f) =>
    redis.del(cacheKey.liveEvents(f.fixture.id)).catch((err) => console.warn(`[redis] Failed to del liveEvents ${f.fixture.id}:`, err))
  );

  await Promise.all([...redisWrites, ...eventsInvalidations]);

  void liveFixtureIds; // used implicitly above
}

export async function runLiveFixturesSync() {
  ensureSupabaseReady();

  const report = createReport("live");
  await syncLiveFixturesProcess(report);

  return finishReport(report);
}
