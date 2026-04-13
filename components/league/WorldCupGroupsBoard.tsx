import Link from "next/link";

import LogoMark from "@/components/LogoMark";
import { isDbNotStarted, type DbFixture, type DbTeam } from "@/lib/db-queries";

type GroupTeamRow = {
  team: DbTeam;
  played: number;
  win: number;
  draw: number;
  lose: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

type WorldCupGroup = {
  id: string;
  teams: GroupTeamRow[];
  fixtures: DbFixture[];
  playedMatches: number;
  totalMatches: number;
};

function toGroupLabel(index: number) {
  return String.fromCharCode(65 + index);
}

function hasStartedFixture(fixture: DbFixture) {
  return fixture.goals_home !== null && fixture.goals_away !== null && !isDbNotStarted(fixture.status_short);
}

function createEmptyRow(team: DbTeam): GroupTeamRow {
  return {
    team,
    played: 0,
    win: 0,
    draw: 0,
    lose: 0,
    gf: 0,
    ga: 0,
    gd: 0,
    points: 0,
  };
}

function getTeamRows(fixtures: DbFixture[]) {
  const rows = new Map<number, GroupTeamRow>();

  for (const fixture of fixtures) {
    if (!rows.has(fixture.home_team.id)) rows.set(fixture.home_team.id, createEmptyRow(fixture.home_team));
    if (!rows.has(fixture.away_team.id)) rows.set(fixture.away_team.id, createEmptyRow(fixture.away_team));

    if (!hasStartedFixture(fixture)) continue;

    const home = rows.get(fixture.home_team.id);
    const away = rows.get(fixture.away_team.id);
    if (!home || !away) continue;

    const homeGoals = fixture.goals_home ?? 0;
    const awayGoals = fixture.goals_away ?? 0;

    home.played += 1;
    away.played += 1;
    home.gf += homeGoals;
    home.ga += awayGoals;
    away.gf += awayGoals;
    away.ga += homeGoals;

    if (homeGoals > awayGoals) {
      home.win += 1;
      away.lose += 1;
      home.points += 3;
    } else if (homeGoals < awayGoals) {
      away.win += 1;
      home.lose += 1;
      away.points += 3;
    } else {
      home.draw += 1;
      away.draw += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  return [...rows.values()]
    .map((row) => ({ ...row, gd: row.gf - row.ga }))
    .sort((left, right) => {
      if (left.points !== right.points) return right.points - left.points;
      if (left.gd !== right.gd) return right.gd - left.gd;
      if (left.gf !== right.gf) return right.gf - left.gf;
      return left.team.name.localeCompare(right.team.name);
    });
}

function getConnectedGroups(fixtures: DbFixture[]) {
  const teamById = new Map<number, DbTeam>();
  const graph = new Map<number, Set<number>>();

  for (const fixture of fixtures) {
    teamById.set(fixture.home_team.id, fixture.home_team);
    teamById.set(fixture.away_team.id, fixture.away_team);

    if (!graph.has(fixture.home_team.id)) graph.set(fixture.home_team.id, new Set());
    if (!graph.has(fixture.away_team.id)) graph.set(fixture.away_team.id, new Set());

    graph.get(fixture.home_team.id)?.add(fixture.away_team.id);
    graph.get(fixture.away_team.id)?.add(fixture.home_team.id);
  }

  const visited = new Set<number>();
  const groups: WorldCupGroup[] = [];

  for (const teamId of graph.keys()) {
    if (visited.has(teamId)) continue;

    const queue = [teamId];
    const members = new Set<number>();
    visited.add(teamId);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) continue;
      members.add(current);

      for (const next of graph.get(current) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }

    const groupFixtures = fixtures.filter(
      (fixture) => members.has(fixture.home_team.id) && members.has(fixture.away_team.id)
    );

    groups.push({
      id: "",
      teams: getTeamRows(groupFixtures),
      fixtures: groupFixtures.sort(
        (left, right) => new Date(left.kickoff_at).getTime() - new Date(right.kickoff_at).getTime()
      ),
      playedMatches: groupFixtures.filter(hasStartedFixture).length,
      totalMatches: groupFixtures.length,
    });
  }

  return groups
    .sort((left, right) => {
      const leftTime = new Date(left.fixtures[0]?.kickoff_at ?? 0).getTime();
      const rightTime = new Date(right.fixtures[0]?.kickoff_at ?? 0).getTime();
      return leftTime - rightTime;
    })
    .map((group, index) => ({ ...group, id: toGroupLabel(index) }));
}

function formatKickoff(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function GroupFixtureRow({ fixture }: { fixture: DbFixture }) {
  return (
    <Link
      href={`/match/${fixture.slug}`}
      className="flex items-center gap-3 px-3 py-3 transition hover:bg-white/[0.03]"
    >
      <div className="w-16 shrink-0 text-xs font-semibold text-slate-400">{formatKickoff(fixture.kickoff_at)}</div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <LogoMark src={fixture.home_team.logo_url ?? ""} alt="" size={16} />
          <span className="truncate text-sm font-medium text-white">{fixture.home_team.name}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <LogoMark src={fixture.away_team.logo_url ?? ""} alt="" size={16} />
          <span className="truncate text-sm font-medium text-white">{fixture.away_team.name}</span>
        </div>
      </div>

      <div className="w-12 shrink-0 text-right">
        {fixture.goals_home !== null ? (
          <div className="score text-sm font-black text-white">
            {fixture.goals_home}-{fixture.goals_away}
          </div>
        ) : (
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">VS</div>
        )}
      </div>
    </Link>
  );
}

export default function WorldCupGroupsBoard({ fixtures }: { fixtures: DbFixture[] }) {
  const groups = getConnectedGroups(
    fixtures.filter((fixture) => fixture.round?.toLowerCase().startsWith("group stage"))
  );

  if (groups.length === 0) {
    return (
      <div className="site-panel px-5 py-12 text-center">
        <p className="text-sm text-slate-400">Chưa có đủ fixture group stage để dựng bảng đấu World Cup.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="site-panel px-5 py-5">
        <span className="section-label">Bảng đấu World Cup</span>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white">Các bảng World Cup 2026</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
          Phần này được dựng trực tiếp từ fixture group stage trong DB. Khi standing chính thức của World Cup chưa được sync, site vẫn hiển thị được cấu trúc bảng và lịch từng bảng.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {groups.map((group) => (
          <section key={group.id} className="site-panel overflow-hidden">
            <div
              className="border-b border-white/10 px-5 py-4"
              style={{
                background:
                  "linear-gradient(135deg, rgba(251,146,60,0.14), rgba(56,189,248,0.08) 60%, rgba(255,255,255,0.02))",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="section-label">Bảng {group.id}</span>
                  <p className="mt-3 text-sm text-slate-300">{group.teams.length} đội · {group.totalMatches} trận</p>
                </div>

                <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-200">
                  {group.playedMatches}/{group.totalMatches} trận đã có tỷ số
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-slate-500">
                    <th className="w-8 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">#</th>
                    <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.24em]">Đội</th>
                    <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">Đ</th>
                    <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">T</th>
                    <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">H</th>
                    <th className="w-9 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">B</th>
                    <th className="w-12 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em]">HS</th>
                    <th className="w-12 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-200">PT</th>
                  </tr>
                </thead>
                <tbody>
                  {group.teams.map((entry, index) => (
                    <tr key={entry.team.id} className="border-b border-white/[0.05] transition hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-sm text-slate-400">{index + 1}</td>
                      <td className="py-3 pr-2">
                        <div className="flex items-center gap-2">
                          <LogoMark src={entry.team.logo_url ?? ""} alt="" size={18} />
                          <span className="truncate font-medium text-white">{entry.team.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-center text-slate-300">{entry.played}</td>
                      <td className="py-3 text-center text-slate-300">{entry.win}</td>
                      <td className="py-3 text-center text-slate-300">{entry.draw}</td>
                      <td className="py-3 text-center text-slate-300">{entry.lose}</td>
                      <td className={`py-3 text-center ${entry.gd > 0 ? "text-emerald-300" : entry.gd < 0 ? "text-red-300" : "text-slate-500"}`}>
                        {entry.gd > 0 ? `+${entry.gd}` : entry.gd}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-white">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t border-white/10 px-3 py-3">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Lịch trong bảng</p>
              <div className="mt-2 divide-y divide-white/[0.05]">
                {group.fixtures.map((fixture) => (
                  <GroupFixtureRow key={fixture.id} fixture={fixture} />
                ))}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
