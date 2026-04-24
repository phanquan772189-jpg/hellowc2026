import "server-only";

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
  team: DbTeam;
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

export type DbPreviewIndexItem = {
  fixture_id: number;
  content: string;
  generated_at: string;
  fixture: DbFixture;
};

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

/** Re-export từ match-shared để tránh duplicate type definition */
export type { LiveScoreState } from "@/lib/match-shared";
