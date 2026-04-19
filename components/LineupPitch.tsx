"use client";

import type { DbLineup, DbLineupPlayer } from "@/lib/db-queries";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlayerRating {
  player_id: number;
  rating: string | null;
}

interface LineupPitchProps {
  lineups: DbLineup[];
  players: DbLineupPlayer[];
  homeTeamId: number;
  /** Optional: pass ratings from /fixtures/players. Key = player_id, value = rating string e.g. "7.5" */
  ratings?: PlayerRating[];
}

interface PlacedPlayer {
  xPct: number;
  yPct: number;
  player: DbLineupPlayer;
  isHome: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseGrid(pos: string | null): { row: number; col: number } | null {
  if (!pos) return null;
  const parts = pos.split(":");
  if (parts.length !== 2) return null;
  const row = parseInt(parts[0], 10);
  const col = parseInt(parts[1], 10);
  if (!Number.isFinite(row) || !Number.isFinite(col) || row < 1 || col < 1) return null;
  return { row, col };
}

function ratingStyle(rating: string | null | undefined): string {
  if (!rating) return "hidden";
  const r = parseFloat(rating);
  if (r >= 7.5) return "bg-emerald-500 text-white";
  if (r >= 6.5) return "bg-amber-400 text-black";
  return "bg-red-500 text-white";
}

function lastName(name: string): string {
  const parts = name.trim().split(" ");
  return parts.length > 1 ? parts[parts.length - 1] : name;
}

/** Tính tọa độ % cho tất cả cầu thủ xuất phát của một đội */
function computePositions(
  starters: DbLineupPlayer[],
  isHome: boolean
): Omit<PlacedPlayer, "isHome">[] {
  // Nhóm cầu thủ theo row
  const byRow = new Map<number, { col: number; player: DbLineupPlayer }[]>();

  for (const p of starters) {
    const grid = parseGrid(p.grid_position);
    if (!grid) continue;
    if (!byRow.has(grid.row)) byRow.set(grid.row, []);
    byRow.get(grid.row)!.push({ col: grid.col, player: p });
  }

  if (byRow.size === 0) return [];

  // Sắp xếp từng row theo col
  for (const cols of byRow.values()) cols.sort((a, b) => a.col - b.col);

  const maxRow = Math.max(...byRow.keys());
  const results: Omit<PlacedPlayer, "isHome">[] = [];

  for (const [row, cols] of byRow) {
    cols.forEach(({ player }, idx) => {
      // X: phân bố đều theo chiều ngang (margin 8-92%)
      const xPct = ((idx + 1) / (cols.length + 1)) * 100;

      // Y: home team = thủ môn ở dưới cùng (~90%), tấn công lên trên (~52%)
      //    away team = thủ môn ở trên cùng (~10%), tấn công xuống dưới (~48%)
      const depthPct = (row - 1) / Math.max(maxRow - 1, 1); // 0 = GK, 1 = forward

      const yPct = isHome
        ? 90 - depthPct * 40  // home: 90% → 50%
        : 10 + depthPct * 40; // away: 10% → 50%

      results.push({ xPct, yPct, player });
    });
  }

  return results;
}

// ─── Pitch SVG ────────────────────────────────────────────────────────────────

function PitchZoneLabels() {
  return (
    <>
      {/* Home zones (bottom half) */}
      <div className="absolute right-1 z-10 flex flex-col items-end gap-0" style={{ top: "52%", bottom: "3%" }}>
        <span className="text-[7px] font-bold uppercase tracking-widest text-white/25 md:text-[8px]" style={{ marginTop: "0%", position: "absolute", top: "5%" }}>ATK</span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-white/25 md:text-[8px]" style={{ position: "absolute", top: "40%" }}>MID</span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-white/25 md:text-[8px]" style={{ position: "absolute", top: "75%" }}>DEF</span>
      </div>
      {/* Away zones (top half) */}
      <div className="absolute right-1 z-10" style={{ top: "3%", bottom: "52%" }}>
        <span className="text-[7px] font-bold uppercase tracking-widest text-white/25 md:text-[8px]" style={{ position: "absolute", top: "5%" }}>DEF</span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-white/25 md:text-[8px]" style={{ position: "absolute", top: "40%" }}>MID</span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-white/25 md:text-[8px]" style={{ position: "absolute", top: "75%" }}>ATK</span>
      </div>
    </>
  );
}

function PitchSVG() {
  const s = "rgba(255,255,255,0.55)"; // stroke color
  const w = 0.6;                       // stroke width

  return (
    <svg
      viewBox="0 0 68 105"
      className="absolute inset-0 h-full w-full"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Striped grass */}
      <defs>
        <pattern id="lp-grass" x="0" y="0" width="68" height="12" patternUnits="userSpaceOnUse">
          <rect width="68" height="12" fill="#276843" />
          <rect width="68" height="6" fill="#2d7a4f" />
        </pattern>
      </defs>
      <rect width="68" height="105" fill="url(#lp-grass)" />

      {/* Boundary */}
      <rect x="2" y="2" width="64" height="101" fill="none" stroke={s} strokeWidth={w} />

      {/* Center line */}
      <line x1="2" y1="52.5" x2="66" y2="52.5" stroke={s} strokeWidth={w} />

      {/* Center circle + spot */}
      <circle cx="34" cy="52.5" r="9.15" fill="none" stroke={s} strokeWidth={w} />
      <circle cx="34" cy="52.5" r="0.7" fill={s} />

      {/* Away penalty area (top) */}
      <rect x="13.8" y="2" width="40.4" height="18.6" fill="none" stroke={s} strokeWidth={w} />
      {/* Away 6-yard box */}
      <rect x="24.5" y="2" width="19" height="6.5" fill="none" stroke={s} strokeWidth={w} />
      {/* Away penalty spot */}
      <circle cx="34" cy="14.6" r="0.6" fill={s} />
      {/* Away penalty arc */}
      <path d="M 22 20.6 A 9.15 9.15 0 0 1 46 20.6" fill="none" stroke={s} strokeWidth={w} />
      {/* Away goal */}
      <rect x="26" y="0.5" width="16" height="2" fill="none" stroke={s} strokeWidth={w} />

      {/* Home penalty area (bottom) */}
      <rect x="13.8" y="84.4" width="40.4" height="18.6" fill="none" stroke={s} strokeWidth={w} />
      {/* Home 6-yard box */}
      <rect x="24.5" y="96.5" width="19" height="6.5" fill="none" stroke={s} strokeWidth={w} />
      {/* Home penalty spot */}
      <circle cx="34" cy="90.4" r="0.6" fill={s} />
      {/* Home penalty arc */}
      <path d="M 22 84.4 A 9.15 9.15 0 0 0 46 84.4" fill="none" stroke={s} strokeWidth={w} />
      {/* Home goal */}
      <rect x="26" y="102.5" width="16" height="2" fill="none" stroke={s} strokeWidth={w} />

      {/* Corner arcs */}
      <path d="M 2 5.5 A 3.5 3.5 0 0 0 5.5 2" fill="none" stroke={s} strokeWidth={w} />
      <path d="M 62.5 2 A 3.5 3.5 0 0 0 66 5.5" fill="none" stroke={s} strokeWidth={w} />
      <path d="M 66 99.5 A 3.5 3.5 0 0 0 62.5 103" fill="none" stroke={s} strokeWidth={w} />
      <path d="M 5.5 103 A 3.5 3.5 0 0 0 2 99.5" fill="none" stroke={s} strokeWidth={w} />
    </svg>
  );
}

// ─── Player Dot ───────────────────────────────────────────────────────────────

function PlayerDot({
  placed,
  rating,
}: {
  placed: PlacedPlayer;
  rating: string | null | undefined;
}) {
  const { player, xPct, yPct, isHome } = placed;
  const dotColor = isHome
    ? "bg-blue-600 border-blue-300"
    : "bg-red-600 border-rose-300";

  return (
    <div
      className="absolute flex flex-col items-center"
      style={{
        left: `${xPct}%`,
        top: `${yPct}%`,
        transform: "translate(-50%, -50%)",
        zIndex: 10,
      }}
    >
      {/* Circle */}
      <div className="relative">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-[11px] font-bold text-white shadow-lg md:h-9 md:w-9 md:text-xs ${dotColor}`}
        >
          {player.jersey_number ?? ""}
        </div>

        {/* Rating badge */}
        {rating && (
          <span
            className={`absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[7px] font-bold shadow ${ratingStyle(rating)}`}
          >
            {parseFloat(rating).toFixed(1).replace(".0", "")}
          </span>
        )}
      </div>

      {/* Player name */}
      <span
        className="mt-0.5 max-w-[58px] truncate text-center text-[9px] font-semibold leading-tight text-white md:text-[10px]"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8)" }}
      >
        {lastName(player.player.name)}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LineupPitch({
  lineups,
  players,
  homeTeamId,
  ratings = [],
}: LineupPitchProps) {
  const ratingMap = new Map(ratings.map((r) => [r.player_id, r.rating]));

  const startingHome = players.filter((p) => p.is_starting && p.team_id === homeTeamId);
  const startingAway = players.filter((p) => p.is_starting && p.team_id !== homeTeamId);

  const homePlaced: PlacedPlayer[] = computePositions(startingHome, true).map((p) => ({
    ...p,
    isHome: true,
  }));
  const awayPlaced: PlacedPlayer[] = computePositions(startingAway, false).map((p) => ({
    ...p,
    isHome: false,
  }));

  const allPlaced = [...homePlaced, ...awayPlaced];

  const homeLineup = lineups.find((l) => l.team_id === homeTeamId);
  const awayLineup = lineups.find((l) => l.team_id !== homeTeamId);

  if (allPlaced.length === 0) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-sm text-slate-400">
        Chưa có dữ liệu đội hình xuất phát.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Formation header */}
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-blue-500" />
          <span className="text-sm font-semibold text-white">{homeLineup?.team.name}</span>
          <span className="font-mono text-xs text-slate-400">
            {homeLineup?.formation ?? "—"}
          </span>
        </div>
        <span className="text-xs text-slate-500">vs</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-400">
            {awayLineup?.formation ?? "—"}
          </span>
          <span className="text-sm font-semibold text-white">{awayLineup?.team.name}</span>
          <span className="h-3 w-3 rounded-full bg-red-500" />
        </div>
      </div>

      {/* Pitch */}
      <div
        className="relative w-full overflow-hidden rounded-2xl shadow-xl"
        style={{ aspectRatio: "68 / 105" }}
      >
        <PitchSVG />
        <PitchZoneLabels />

        {/* Away team label (top) */}
        <div className="absolute left-1/2 top-1.5 z-20 -translate-x-1/2 rounded-full bg-red-600/80 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          ▼ {awayLineup?.team.name}
        </div>

        {/* Home team label (bottom) */}
        <div className="absolute bottom-1.5 left-1/2 z-20 -translate-x-1/2 rounded-full bg-blue-600/80 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
          ▲ {homeLineup?.team.name}
        </div>

        {/* Players */}
        {allPlaced.map((placed) => (
          <PlayerDot
            key={`${placed.player.team_id}-${placed.player.player_id}`}
            placed={placed}
            rating={ratingMap.get(placed.player.player_id)}
          />
        ))}
      </div>

      {/* Rating legend */}
      {ratings.length > 0 && (
        <div className="flex items-center justify-center gap-3 text-[10px] text-slate-400">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            ≥ 7.5
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />
            6.5–7.4
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            &lt; 6.5
          </span>
        </div>
      )}

      {/* Coach */}
      <div className="flex justify-between text-[11px] text-slate-500">
        <span>HLV: {homeLineup?.coach_name ?? "—"}</span>
        <span>HLV: {awayLineup?.coach_name ?? "—"}</span>
      </div>
    </div>
  );
}
