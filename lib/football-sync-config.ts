import "server-only";

import { todayInTimeZone } from "@/lib/api";

export const FOOTBALL_TIMEZONE = "Asia/Ho_Chi_Minh";

const DEFAULT_TRACKED_LEAGUE_IDS = [
  1, 2, 3, 848,
  39, 140, 78, 135, 61,
  94, 88, 203, 144,
  253, 262, 71,
  128, 13,
  340, 341,
];

function parsePositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function shiftDateString(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getTrackedLeagueIds() {
  const raw = process.env.FOOTBALL_SYNC_LEAGUE_IDS;
  if (!raw) return DEFAULT_TRACKED_LEAGUE_IDS;

  const parsed = raw
    .split(",")
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value));

  return parsed.length > 0 ? [...new Set(parsed)] : DEFAULT_TRACKED_LEAGUE_IDS;
}

export function getFixtureSyncWindow() {
  const today = todayInTimeZone(FOOTBALL_TIMEZONE);
  const pastDays = parsePositiveInteger(process.env.FOOTBALL_SYNC_PAST_DAYS, 3);
  const futureDays = parsePositiveInteger(process.env.FOOTBALL_SYNC_FUTURE_DAYS, 10);

  return {
    from: shiftDateString(today, -pastDays),
    to: shiftDateString(today, futureDays),
    timeZone: FOOTBALL_TIMEZONE,
  };
}
