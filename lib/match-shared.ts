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
  slug: string;
  home_team: DbTeam;
  away_team: DbTeam;
  league: DbLeague;
};

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
  score_snapshot: string | null;
  team: DbTeam;
  player: { id: number; name: string } | null;
  assist: { id: number; name: string } | null;
};

export type LiveScoreState = {
  goalsHome: number | null;
  goalsAway: number | null;
  statusShort: string;
  statusElapsed: number | null;
  scoreHtHome: number | null;
  scoreHtAway: number | null;
};

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
const NOT_STARTED_STATUSES = new Set(["NS", "TBD"]);

export const isDbLive = (statusShort: string) => LIVE_STATUSES.has(statusShort);
export const isDbFinished = (statusShort: string) => FINISHED_STATUSES.has(statusShort);
export const isDbNotStarted = (statusShort: string) => NOT_STARTED_STATUSES.has(statusShort);

export function dbStatusLabel(statusShort: string, statusElapsed: number | null) {
  if (statusShort === "HT") return "Nghi giua hiep";
  if (isDbLive(statusShort)) return statusElapsed ? `${statusElapsed}'` : "LIVE";
  if (isDbFinished(statusShort)) return "KT";
  if (statusShort === "PST") return "Hoan";
  if (statusShort === "CANC") return "Huy";
  return "";
}
