import "server-only";

export interface Goals {
  home: number | null;
  away: number | null;
}

export interface MatchEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string; logo: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: "Goal" | "Card" | "subst" | "Var";
  detail: string;
  comments: string | null;
}

export interface StatisticItem {
  type: string;
  value: number | string | null;
}

export interface MatchStatistic {
  team: { id: number; name: string; logo: string };
  statistics: StatisticItem[];
}

export interface StandingEntry {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  form: string | null;
  description: string | null;
  all: { played: number; win: number; draw: number; lose: number; goals: Goals };
  home: { played: number; win: number; draw: number; lose: number; goals: Goals };
  away: { played: number; win: number; draw: number; lose: number; goals: Goals };
}

export interface ApiCountry {
  name: string;
  code: string | null;
  flag: string | null;
}

export interface ApiLeagueSeason {
  year: number;
  start: string | null;
  end: string | null;
  current: boolean;
  coverage: Record<string, unknown> | null;
}

export interface ApiLeagueCatalog {
  league: {
    id: number;
    name: string;
    type: string;
    logo: string | null;
  };
  country: ApiCountry;
  seasons: ApiLeagueSeason[];
}

export interface ApiTeamWithVenue {
  team: {
    id: number;
    name: string;
    code: string | null;
    country: string | null;
    founded: number | null;
    national: boolean;
    logo: string | null;
  };
  venue: {
    id: number | null;
    name: string | null;
    address: string | null;
    city: string | null;
    capacity: number | null;
    surface: string | null;
    image: string | null;
  };
}

export interface ApiSquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string | null;
  photo: string | null;
}

export interface ApiSquadResponse {
  team: { id: number; name: string; logo: string | null };
  players: ApiSquadPlayer[];
}

export interface ApiLineupPlayer {
  player: {
    id: number;
    name: string;
    number: number | null;
    pos: string | null;
    grid: string | null;
  };
}

export interface ApiFixtureLineup {
  team: {
    id: number;
    name: string;
    logo: string | null;
  };
  formation: string | null;
  startXI: ApiLineupPlayer[];
  substitutes: ApiLineupPlayer[];
  coach: {
    id: number | null;
    name: string | null;
    photo: string | null;
  } | null;
}

export interface RawFixture {
  fixture: {
    id: number;
    referee: string | null;
    date: string;
    venue: { id: number | null; name: string | null; city: string | null } | null;
    status: { long: string; short: string; elapsed: number | null };
  };
  league: {
    id: number;
    name: string;
    logo: string;
    round: string;
    country: string;
    flag: string | null;
    season?: number;
    standings?: boolean;
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: Goals;
    fulltime: Goals;
    extratime: Goals | null;
    penalty: Goals | null;
  };
  events?: any[];
  lineups?: any[];
}

interface ApiEnvelope<T> {
  errors?: Record<string, string> | string[] | null;
  response: T;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function makeSlug(home: string, away: string, id: number) {
  return `${slugify(home)}-vs-${slugify(away)}-${id}`;
}

export function todayInTimeZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export function buildQuery(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }

  const query = search.toString();
  return query ? `?${query}` : "";
}

function getApiKeys(): string[] {
  const keys: string[] = [];

  if (process.env.API_FOOTBALL_KEY) keys.push(process.env.API_FOOTBALL_KEY);

  let index = 2;
  while (true) {
    const key = process.env[`API_FOOTBALL_KEY_${index}`];
    if (!key) break;
    keys.push(key);
    index += 1;
  }

  return keys;
}

const exhaustedKeys = new Set<string>();

function maskKey(key: string): string {
  return key.length > 6 ? `...${key.slice(-6)}` : "***";
}

function normalizeErrors(errors: ApiEnvelope<unknown>["errors"]): Record<string, string> {
  if (!errors) return {};
  if (Array.isArray(errors)) {
    return errors.reduce<Record<string, string>>((acc, value, index) => {
      acc[String(index)] = value;
      return acc;
    }, {});
  }
  return errors;
}

function isKeyUnavailable(errors: Record<string, string>): boolean {
  if (Object.keys(errors).length === 0) return false;

  const keys = Object.keys(errors).map((key) => key.toLowerCase());
  const values = Object.values(errors).join(" ").toLowerCase();

  return (
    values.includes("request limit") ||
    values.includes("rate limit") ||
    values.includes("quota") ||
    values.includes("suspended") ||
    keys.includes("access") ||
    keys.includes("token") ||
    keys.includes("subscription")
  );
}

const API_TIMEOUT_MS = 8000;
const DEFAULT_API_MAX_RPM = 280;
let nextAllowedRequestAt = 0;
let requestSchedule = Promise.resolve();

function getApiMaxRequestsPerMinute() {
  const parsed = Number.parseInt(process.env.API_FOOTBALL_MAX_RPM ?? "", 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_API_MAX_RPM;
  return Math.min(parsed, 300);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForApiRateLimitSlot() {
  const minIntervalMs = Math.ceil(60000 / getApiMaxRequestsPerMinute());
  const previous = requestSchedule;

  requestSchedule = previous.then(async () => {
    const now = Date.now();
    const waitMs = Math.max(0, nextAllowedRequestAt - now);
    if (waitMs > 0) {
      await sleep(waitMs);
    }
    nextAllowedRequestAt = Date.now() + minIntervalMs;
  });

  await requestSchedule;
}

export async function apiFetch<T>(endpoint: string): Promise<T> {
  const base = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";
  const keys = getApiKeys();

  if (keys.length === 0) {
    throw new Error("No API_FOOTBALL_KEY configured in the environment.");
  }

  for (const apiKey of keys) {
    if (exhaustedKeys.has(apiKey)) continue;

    await waitForApiRateLimitSlot();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${base}${endpoint}`, {
        headers: { "x-apisports-key": apiKey },
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error: unknown) {
      clearTimeout(timer);
      const isTimeout = error instanceof Error && error.name === "AbortError";
      console.warn(`[API] Key ${maskKey(apiKey)} ${isTimeout ? "timed out" : "network error"} - trying next`);
      continue;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      throw new Error(`API-Football ${response.status}: ${endpoint}`);
    }

    const json = (await response.json()) as ApiEnvelope<T>;
    const errors = normalizeErrors(json.errors);

    if (isKeyUnavailable(errors)) {
      exhaustedKeys.add(apiKey);
      const reason = Object.entries(errors)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      console.warn(`[API] Key ${maskKey(apiKey)} unavailable (${reason}) - trying next key`);
      continue;
    }

    if (Object.keys(errors).length > 0) {
      throw new Error(`API errors: ${JSON.stringify(errors)}`);
    }

    return json.response;
  }

  throw new Error("All API keys have reached their daily request limit.");
}

export async function fetchCountriesCatalog(): Promise<ApiCountry[]> {
  return apiFetch<ApiCountry[]>("/countries");
}

export async function fetchLeagueCatalog(leagueId: number): Promise<ApiLeagueCatalog | null> {
  const raw = await apiFetch<ApiLeagueCatalog[]>(`/leagues${buildQuery({ id: leagueId })}`);
  return raw[0] ?? null;
}

export async function fetchLeagueSeasonsCatalog(): Promise<number[]> {
  return apiFetch<number[]>("/leagues/seasons");
}

export async function fetchTeamsByLeagueSeason(leagueId: number, season: number): Promise<ApiTeamWithVenue[]> {
  return apiFetch<ApiTeamWithVenue[]>(`/teams${buildQuery({ league: leagueId, season })}`);
}

export async function fetchPlayersSquad(teamId: number): Promise<ApiSquadResponse | null> {
  const raw = await apiFetch<ApiSquadResponse[]>(`/players/squads${buildQuery({ team: teamId })}`);
  return raw[0] ?? null;
}

export async function fetchFixturesByLeagueSeasonRange(
  leagueId: number,
  season: number,
  from: string,
  to: string,
  timeZone = "Asia/Ho_Chi_Minh"
): Promise<RawFixture[]> {
  return apiFetch<RawFixture[]>(
    `/fixtures${buildQuery({
      league: leagueId,
      season,
      from,
      to,
      timezone: timeZone,
    })}`
  );
}

export async function fetchFixturesByLeagueSeason(
  leagueId: number,
  season: number,
  timeZone = "Asia/Ho_Chi_Minh"
): Promise<RawFixture[]> {
  return apiFetch<RawFixture[]>(
    `/fixtures${buildQuery({
      league: leagueId,
      season,
      timezone: timeZone,
    })}`
  );
}

/** Raw version for sync pipeline — includes events, lineups, score fields from API-Football */
export async function fetchLiveRawFixtures(timeZone = "Asia/Ho_Chi_Minh"): Promise<RawFixture[]> {
  return apiFetch<RawFixture[]>(`/fixtures?live=all&timezone=${encodeURIComponent(timeZone)}`);
}

/** Fetch events cho một fixture đã kết thúc (dùng để backfill) */
export async function fetchFixtureEvents(fixtureId: number): Promise<MatchEvent[]> {
  return apiFetch<MatchEvent[]>(`/fixtures/events${buildQuery({ fixture: fixtureId })}`);
}

/** Fetch raw fixture by ID (kèm events/score) — dùng để backfill sau trận */
export async function fetchRawFixtureById(fixtureId: number): Promise<RawFixture | null> {
  const results = await apiFetch<RawFixture[]>(`/fixtures${buildQuery({ id: fixtureId })}`);
  return results[0] ?? null;
}

export async function fetchMatchStats(fixtureId: number): Promise<MatchStatistic[]> {
  return apiFetch<MatchStatistic[]>(`/fixtures/statistics${buildQuery({ fixture: fixtureId })}`);
}

export async function fetchMatchLineups(fixtureId: number): Promise<ApiFixtureLineup[]> {
  return apiFetch<ApiFixtureLineup[]>(`/fixtures/lineups${buildQuery({ fixture: fixtureId })}`);
}

export async function fetchStandings(leagueId: number, season: number): Promise<StandingEntry[][]> {
  interface RawStandingResponse {
    league: { standings: StandingEntry[][] };
  }

  const raw = await apiFetch<RawStandingResponse[]>(
    `/standings${buildQuery({ league: leagueId, season })}`
  );
  return raw[0]?.league?.standings ?? [];
}
