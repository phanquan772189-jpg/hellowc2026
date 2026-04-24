/**
 * Barrel re-export for DB queries.
 *
 * Domain query modules live under `lib/queries/`:
 *   - types.ts        - shared DB-facing types
 *   - status.ts       - status helpers
 *   - fixtures.ts     - fixture lists, detail, h2h, slugs
 *   - standings.ts    - standings, tracked leagues, rounds
 *   - match-detail.ts - events, lineups, stats, players, previews
 */

export * from "./queries/types";
export * from "./queries/status";
export {
  getTodayFixturesFromDB,
  getLiveFixturesFromDB,
  getH2HFixturesFromDB,
  getFixtureByIdFromDB,
  getTodayFixtureSlugsFromDB,
  getAllFixtureSlugsFromDB,
  getUpcomingFixturesFromDB,
  getRecentFinishedFixturesFromDB,
} from "./queries/fixtures";
export {
  getStandingsFromDB,
  formatSeasonLabel,
  getTrackedLeaguesFromDB,
  getLeagueCurrentRound,
  getLeagueAllRounds,
  getLeagueRoundFixtures,
  getLeagueFixturesByRoundPrefix,
} from "./queries/standings";
export {
  getFixtureEventsFromDB,
  getFixtureLineupsFromDB,
  getFixtureStatisticsFromDB,
  getTopPlayersFromDB,
  getMatchPreviewFromDB,
  getLatestMatchPreviewsFromDB,
} from "./queries/match-detail";
