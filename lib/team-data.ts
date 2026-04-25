import "server-only";

import {
  fetchCoachByTeam,
  fetchInjuriesByTeamSeason,
  type ApiCoach,
  type ApiInjuryEntry,
} from "@/lib/api";
import {
  getTeamCoachFromDB,
  getTeamInjuriesFromDB,
  type DbTeamCoach,
  type DbTeamInjury,
} from "@/lib/db-queries";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// TTL helpers — chấp nhận lệch tối đa nhiêu lâu trước khi gọi lại API.
const COACH_REFRESH_HOURS = 24 * 7;       // HLV thay đổi hiếm — 1 tuần đủ.
const INJURIES_REFRESH_HOURS = 6;          // Chấn thương đổi theo ngày.

function isStale(timestamp: string | null | undefined, refreshHours: number) {
  if (!timestamp) return true;
  const ageMs = Date.now() - new Date(timestamp).getTime();
  return ageMs > refreshHours * 60 * 60 * 1000;
}

// ─── Injuries ─────────────────────────────────────────────────────────────────

function parseHeightCm(value: string | null): number | null {
  if (!value) return null;
  const num = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(num) ? num : null;
}

function parseWeightKg(value: string | null): number | null {
  if (!value) return null;
  const num = Number.parseInt(value.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(num) ? num : null;
}

/**
 * Lazy-fetch danh sách chấn thương / treo giò cho một đội ở một mùa.
 * Nếu data trong DB còn tươi (< 6 giờ) thì trả luôn, không gọi API.
 */
export async function ensureTeamInjuriesInDb(
  teamId: number,
  seasonYear: number
): Promise<DbTeamInjury[]> {
  const existing = await getTeamInjuriesFromDB(teamId, seasonYear);
  const latestUpdate = existing[0]?.updated_at ?? null;

  if (existing.length > 0 && !isStale(latestUpdate, INJURIES_REFRESH_HOURS)) {
    return existing;
  }

  let payload: ApiInjuryEntry[];
  try {
    payload = await fetchInjuriesByTeamSeason(teamId, seasonYear);
  } catch (err) {
    console.warn(`[injuries] fetch failed for team=${teamId} season=${seasonYear}:`, err);
    return existing;
  }

  const supabase = getSupabaseAdmin();
  const nowIso = new Date().toISOString();

  // Truncate-and-insert: xoá toàn bộ entry cũ cho team+season để tránh stale rows.
  const { error: deleteError } = await supabase
    .from("team_injuries")
    .delete()
    .eq("team_id", teamId)
    .eq("season_year", seasonYear);

  if (deleteError) {
    console.error(`[injuries] delete failed for team=${teamId} season=${seasonYear}:`, deleteError);
    return existing;
  }

  if (payload.length === 0) {
    // API trả rỗng cũng là 1 trạng thái — vẫn cần "trống" hợp lệ.
    return [];
  }

  const rows = payload
    .filter((entry) => entry.player?.id && entry.team?.id === teamId)
    .map((entry) => ({
      player_id: entry.player.id,
      team_id: teamId,
      league_id: entry.league.id,
      season_year: seasonYear,
      fixture_id: entry.fixture?.id ?? null,
      type: entry.player.type ?? "Missing Fixture",
      reason: entry.player.reason ?? null,
      player_name: entry.player.name,
      player_photo_url: entry.player.photo ?? null,
      updated_at: nowIso,
    }));

  if (rows.length === 0) return [];

  const { error: insertError } = await supabase.from("team_injuries").insert(rows);
  if (insertError) {
    console.error(`[injuries] insert failed for team=${teamId} season=${seasonYear}:`, insertError);
    return existing;
  }

  return getTeamInjuriesFromDB(teamId, seasonYear);
}

// ─── Coach ────────────────────────────────────────────────────────────────────

function buildCoachRow(teamId: number, coach: ApiCoach): DbTeamCoach {
  return {
    team_id: teamId,
    coach_id: coach.id,
    name: coach.name,
    first_name: coach.firstname,
    last_name: coach.lastname,
    birth_date: coach.birth?.date ?? null,
    birth_place: coach.birth?.place ?? null,
    birth_country: coach.birth?.country ?? null,
    nationality: coach.nationality,
    height_cm: parseHeightCm(coach.height),
    weight_kg: parseWeightKg(coach.weight),
    photo_url: coach.photo,
    career: coach.career
      ? coach.career.map((entry) => ({
          team: {
            id: entry.team.id,
            name: entry.team.name,
            logo: entry.team.logo,
          },
          start: entry.start,
          end: entry.end,
        }))
      : null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Lazy-fetch HLV trưởng cho một đội. TTL 7 ngày — coach hiếm khi đổi.
 */
export async function ensureTeamCoachInDb(teamId: number): Promise<DbTeamCoach | null> {
  const existing = await getTeamCoachFromDB(teamId);

  if (existing && !isStale(existing.updated_at, COACH_REFRESH_HOURS)) {
    return existing;
  }

  let coach: ApiCoach | null;
  try {
    coach = await fetchCoachByTeam(teamId);
  } catch (err) {
    console.warn(`[coach] fetch failed for team=${teamId}:`, err);
    return existing;
  }

  if (!coach) return existing;

  const row = buildCoachRow(teamId, coach);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("team_coaches")
    .upsert(row, { onConflict: "team_id" });

  if (error) {
    console.error(`[coach] upsert failed for team=${teamId}:`, error);
    return existing;
  }

  return row;
}
