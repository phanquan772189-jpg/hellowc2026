import LogoMark from "@/components/LogoMark";
import type { DbLineup, DbLineupPlayer } from "@/lib/db-queries";

const POS_COLOR: Record<string, string> = {
  G: "bg-yellow-500/20 text-yellow-400",
  D: "bg-blue-500/20 text-blue-400",
  M: "bg-emerald-500/20 text-emerald-400",
  F: "bg-red-500/20 text-red-400",
};

const POS_LABEL: Record<string, string> = {
  G: "TM",
  D: "HV",
  M: "TV",
  F: "TI",
};

/** Infer position from grid row: row 1 = G, 2-3 = D, 4-5 = M, 6+ = F */
function inferPosition(grid: string | null): string {
  if (!grid) return "";
  const row = parseInt(grid.split(":")[0] ?? "", 10);
  if (row === 1) return "G";
  if (row <= 3) return "D";
  if (row <= 5) return "M";
  return "F";
}

function PlayerRow({ player, reverse = false }: { player: DbLineupPlayer; reverse?: boolean }) {
  const position = inferPosition(player.grid_position);

  return (
    <div
      className={`flex items-center gap-3 rounded-[20px] border border-white/10 bg-black/10 px-3 py-2.5 ${
        reverse ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-xs font-mono text-slate-300">
        {player.jersey_number ?? "?"}
      </span>
      {position && (
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${POS_COLOR[position] ?? "bg-white/10 text-slate-300"}`}>
          {POS_LABEL[position] ?? position}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{player.player.name}</span>
    </div>
  );
}

function TeamColumn({
  lineup,
  players,
  side,
}: {
  lineup: DbLineup;
  players: DbLineupPlayer[];
  side: "home" | "away";
}) {
  const isAway = side === "away";
  const starters = players.filter((p) => p.is_starting);
  const subs = players.filter((p) => !p.is_starting);

  return (
    <div className="site-panel-soft p-4 sm:p-5">
      <div className={`flex items-center gap-3 ${isAway ? "" : "flex-row-reverse"}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10">
          <LogoMark src={lineup.team.logo_url ?? ""} alt={lineup.team.name} size={26} />
        </div>
        <div className={`min-w-0 flex-1 ${isAway ? "" : "text-right"}`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            {isAway ? "Đội khách" : "Chủ nhà"}
          </p>
          <p className="mt-1 truncate text-base font-semibold text-white">{lineup.team.name}</p>
          {lineup.formation && <p className="mt-1 text-sm text-slate-400">Sơ đồ {lineup.formation}</p>}
        </div>
      </div>

      <div className="mt-5">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 ${isAway ? "" : "text-right"}`}>
          Đội hình chính
        </p>
      </div>

      <div className={`mt-3 space-y-2 ${isAway ? "" : "flex flex-col items-end"}`}>
        {starters.map((p) => (
          <div key={p.player_id} className={isAway ? "" : "w-full"}>
            <PlayerRow player={p} reverse={!isAway} />
          </div>
        ))}
      </div>

      {subs.length > 0 && (
        <>
          <p className={`mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500 ${isAway ? "" : "text-right"}`}>
            Dự bị
          </p>
          <div className={`mt-3 space-y-2 ${isAway ? "" : "flex flex-col items-end"}`}>
            {subs.map((p) => (
              <div key={p.player_id} className={`opacity-70 ${isAway ? "" : "w-full"}`}>
                <PlayerRow player={p} reverse={!isAway} />
              </div>
            ))}
          </div>
        </>
      )}

      {lineup.coach_name && (
        <div className={`mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300 ${isAway ? "" : "text-right"}`}>
          HLV: <span className="font-medium text-white">{lineup.coach_name}</span>
        </div>
      )}
    </div>
  );
}

interface Props {
  lineups: DbLineup[];
  players: DbLineupPlayer[];
}

export default function LineupGrid({ lineups, players }: Props) {
  if (!lineups || lineups.length < 2) {
    return (
      <div className="px-4 py-12 text-center text-sm text-slate-400 sm:px-6">
        Đội hình chưa được công bố, thường xuất hiện trước giờ bóng lăn khoảng 30 phút.
      </div>
    );
  }

  const [home, away] = lineups;
  const homePlayers = players.filter((p) => p.team_id === home.team_id);
  const awayPlayers = players.filter((p) => p.team_id === away.team_id);

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <div
        className="overflow-hidden rounded-[28px] border border-white/10 px-5 py-5"
        style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(56,189,248,0.10) 55%, rgba(251,146,60,0.08))" }}
      >
        <span className="section-label">Formation board</span>
        <div className="mt-4 flex items-center justify-center gap-4 text-center">
          <span className="score text-3xl font-black text-white">{home.formation ?? "—"}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">vs</span>
          <span className="score text-3xl font-black text-white">{away.formation ?? "—"}</span>
        </div>
        <p className="mt-3 text-center text-sm text-slate-300">
          Sơ đồ chiến thuật giúp người xem định hình nhịp trận trước khi đi sâu vào từng vị trí.
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TeamColumn lineup={home} players={homePlayers} side="home" />
        <TeamColumn lineup={away} players={awayPlayers} side="away" />
      </div>
    </div>
  );
}
