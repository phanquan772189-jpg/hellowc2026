import { isDbFinished, isDbLive, isDbNotStarted, type DbFixture } from "@/lib/db-queries";

const DEFAULT_LEAGUE_RANK = 99;
const DEFAULT_TEAM_RANK = 80;

const LEAGUE_DISPLAY_RANK: Record<number, number> = {
  1: 1,
  2: 2,
  39: 3,
  140: 4,
  78: 5,
  135: 6,
  61: 7,
  3: 8,
  848: 9,
  128: 10,
  13: 11,
  71: 12,
  253: 13,
  262: 14,
  94: 15,
  88: 16,
  203: 17,
  144: 18,
  340: 19,
  341: 20,
};

const TEAM_RANK_BY_NAME: Record<string, number> = {
  "real madrid": 1,
  "barcelona": 2,
  "manchester city": 3,
  "liverpool": 4,
  "arsenal": 5,
  "bayern munich": 6,
  "paris saint germain": 7,
  "manchester united": 8,
  "chelsea": 9,
  "tottenham": 10,
  "atletico madrid": 11,
  "inter": 12,
  "juventus": 13,
  "ac milan": 14,
  "borussia dortmund": 15,
  "newcastle": 16,
  "napoli": 17,
  "roma": 18,
  "aston villa": 19,
  "bayer leverkusen": 20,
  "sevilla": 21,
  "benfica": 22,
  "porto": 23,
  "ajax": 24,
  "sporting cp": 25,
  "marseille": 26,
  "lyon": 27,
  "monaco": 28,
  "real betis": 29,
  "valencia": 30,
  "west ham": 31,
  "brighton": 32,
  "nottingham forest": 33,
  "lille": 34,
  "real sociedad": 35,
  "athletic club": 36,
  "psv eindhoven": 37,
  "fenerbahce": 38,
  "galatasaray": 39,
  "flamengo": 40,
  "palmeiras": 41,
  "river plate": 42,
  "boca juniors": 43,
  "al nassr": 44,
  "al hilal": 45,
  "brazil": 1,
  "argentina": 2,
  "france": 3,
  "spain": 4,
  "england": 5,
  "germany": 6,
  "portugal": 7,
  "netherlands": 8,
  "belgium": 9,
  "italy": 10,
  "uruguay": 11,
  "croatia": 12,
  "colombia": 13,
  "mexico": 14,
  "united states": 15,
  "japan": 16,
  "denmark": 17,
  "switzerland": 18,
  "senegal": 19,
  "morocco": 20,
};

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function fixtureStateRank(fixture: DbFixture) {
  if (isDbLive(fixture.status_short)) return 0;
  if (isDbNotStarted(fixture.status_short)) return 1;
  if (isDbFinished(fixture.status_short)) return 2;
  return 3;
}

export function getLeagueDisplayRank(leagueId: number) {
  return LEAGUE_DISPLAY_RANK[leagueId] ?? DEFAULT_LEAGUE_RANK;
}

export function getTeamDisplayRank(teamName: string, leagueId: number) {
  const normalized = normalizeName(teamName);
  const mappedRank = TEAM_RANK_BY_NAME[normalized];
  if (mappedRank) return mappedRank;
  return DEFAULT_TEAM_RANK + getLeagueDisplayRank(leagueId);
}

export function getFixtureSpotlightRank(fixture: DbFixture) {
  const leagueRank = getLeagueDisplayRank(fixture.league.id);
  const homeRank = getTeamDisplayRank(fixture.home_team.name, fixture.league.id);
  const awayRank = getTeamDisplayRank(fixture.away_team.name, fixture.league.id);
  const teamAverageRank = (homeRank + awayRank) / 2;
  const stateRank = fixtureStateRank(fixture);
  const kickoff = new Date(fixture.kickoff_at).getTime();

  return { leagueRank, homeRank, awayRank, teamAverageRank, stateRank, kickoff };
}

export function sortFixturesByImportance(fixtures: DbFixture[]) {
  return [...fixtures].sort((left, right) => {
    const leftRank = getFixtureSpotlightRank(left);
    const rightRank = getFixtureSpotlightRank(right);

    if (leftRank.teamAverageRank !== rightRank.teamAverageRank) {
      return leftRank.teamAverageRank - rightRank.teamAverageRank;
    }

    if (leftRank.leagueRank !== rightRank.leagueRank) {
      return leftRank.leagueRank - rightRank.leagueRank;
    }

    if (leftRank.stateRank !== rightRank.stateRank) {
      return leftRank.stateRank - rightRank.stateRank;
    }

    if (
      isDbLive(left.status_short) &&
      isDbLive(right.status_short) &&
      left.status_elapsed !== right.status_elapsed
    ) {
      return (right.status_elapsed ?? 0) - (left.status_elapsed ?? 0);
    }

    if (leftRank.kickoff !== rightRank.kickoff) {
      return leftRank.kickoff - rightRank.kickoff;
    }

    return left.id - right.id;
  });
}
