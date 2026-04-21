/**
 * Barrel re-export for DB queries.
 *
 * Các module được tách theo domain dưới `lib/queries/`:
 *   - types.ts         — DbFixture, DbStanding, DbEvent, ...
 *   - status.ts        — isDbLive / isDbFinished / dbStatusLabel
 *   - fixtures.ts      — today/live/h2h/by-id/slugs/upcoming/recent
 *   - standings.ts     — standings + tracked leagues + rounds
 *   - match-detail.ts  — events / lineups / stats / top players / previews
 *
 * File này giữ lại như entry point duy nhất để giảm thay đổi ở consumers.
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
