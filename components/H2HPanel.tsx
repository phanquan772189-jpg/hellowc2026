import LogoMark from "@/components/LogoMark";
import type { DbH2HFixture } from "@/lib/db-queries";

interface Props {
  fixtures: DbH2HFixture[];
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;
  awayTeamName: string;
}

function formatMatchDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export default function H2HPanel({
  fixtures,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
}: Props) {
  if (fixtures.length === 0) {
    return (
      <div className="px-4 py-5 sm:px-6 sm:py-6">
        <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
            Lịch sử đối đầu
          </p>
          <div className="mt-4 rounded-[20px] border border-white/8 bg-black/10 px-4 py-6 text-center">
            <p className="text-sm text-slate-400">Không có dữ liệu đối đầu</p>
          </div>
        </div>
      </div>
    );
  }

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;

  for (const fix of fixtures) {
    const gh = fix.goals_home ?? 0;
    const ga = fix.goals_away ?? 0;
    if (gh === ga) {
      draws++;
    } else if (gh > ga) {
      // home team in this fixture won
      if (fix.home_team.id === homeTeamId) homeWins++;
      else awayWins++;
    } else {
      // away team in this fixture won
      if (fix.away_team.id === homeTeamId) homeWins++;
      else awayWins++;
    }
  }

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6">
      <div className="rounded-[26px] border border-white/10 bg-white/[0.04] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
          Lịch sử đối đầu
        </p>

        {/* Summary row */}
        <div className="mt-4 rounded-[20px] border border-white/8 bg-black/10 px-4 py-4">
          <div className="grid grid-cols-3 items-center gap-2 text-center">
            <div>
              <p className="text-xs text-slate-400 truncate">{homeTeamName}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-emerald-400">{homeWins}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Thắng
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Hòa</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-slate-300">{draws}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Trận
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 truncate">{awayTeamName}</p>
              <p className="mt-1 text-3xl font-black tabular-nums text-sky-400">{awayWins}</p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
                Thắng
              </p>
            </div>
          </div>
        </div>

        {/* Match list */}
        <div className="mt-3 space-y-2">
          {fixtures.map((fix) => {
            const gh = fix.goals_home ?? 0;
            const ga = fix.goals_away ?? 0;
            const homeWon = gh > ga;
            const awayWon = ga > gh;

            return (
              <div
                key={fix.id}
                className="rounded-[20px] border border-white/8 bg-black/10 px-4 py-3"
              >
                <p className="mb-2 text-xs text-slate-400">{formatMatchDate(fix.kickoff_at)}</p>
                <div className="flex items-center gap-2">
                  {/* Home team */}
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/10">
                      <LogoMark
                        src={fix.home_team.logo_url ?? ""}
                        alt={fix.home_team.name}
                        size={18}
                      />
                    </div>
                    <span
                      className={`truncate text-sm font-semibold ${homeWon ? "text-white" : "text-slate-400"}`}
                    >
                      {fix.home_team.name}
                    </span>
                  </div>

                  {/* Score */}
                  <div className="shrink-0 text-center">
                    <span className="text-sm font-black tabular-nums text-white">
                      {fix.goals_home ?? "–"}&nbsp;–&nbsp;{fix.goals_away ?? "–"}
                    </span>
                    {fix.score_ht_home !== null && (
                      <p className="mt-0.5 text-[10px] text-slate-500">
                        HT {fix.score_ht_home}–{fix.score_ht_away}
                      </p>
                    )}
                  </div>

                  {/* Away team */}
                  <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                    <span
                      className={`truncate text-right text-sm font-semibold ${awayWon ? "text-white" : "text-slate-400"}`}
                    >
                      {fix.away_team.name}
                    </span>
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/10">
                      <LogoMark
                        src={fix.away_team.logo_url ?? ""}
                        alt={fix.away_team.name}
                        size={18}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
