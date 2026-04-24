import "server-only";

export const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);
export const NOT_STARTED_STATUSES = new Set(["NS", "TBD"]);

export const isDbLive = (s: string) => LIVE_STATUSES.has(s);
export const isDbFinished = (s: string) => FINISHED_STATUSES.has(s);
export const isDbNotStarted = (s: string) => NOT_STARTED_STATUSES.has(s);

export function dbStatusLabel(statusShort: string, statusElapsed: number | null): string {
  if (statusShort === "HT") return "Nghỉ giữa hiệp";
  if (isDbLive(statusShort)) return statusElapsed ? `${statusElapsed}'` : "LIVE";
  if (isDbFinished(statusShort)) return "KT";
  if (statusShort === "PST") return "Hoãn";
  if (statusShort === "CANC") return "Huỷ";
  return "";
}
