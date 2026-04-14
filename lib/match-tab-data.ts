import "server-only";

import {
  fetchMatchLineups,
  fetchMatchStats,
  type ApiFixtureLineup,
  type ApiLineupPlayer,
} from "@/lib/api";
import {
  getFixtureLineupsFromDB,
  getFixtureStatisticsFromDB,
  getH2HFixturesFromDB,
  getMatchPreviewFromDB,
  getStandingsFromDB,
  isDbFinished,
  isDbNotStarted,
  type DbFixtureDetail,
  type DbH2HFixture,
  type DbLineup,
  type DbLineupPlayer,
  type DbMatchPreview,
  type DbMatchStatistic,
  type DbStanding,
} from "@/lib/db-queries";
import { generatePreviewForFixture } from "@/lib/preview-generator";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

type EnsureLineupsOptions = {
  forceRefresh?: boolean;
};

function chunk<T>(items: T[], size = 200) {
  const groups: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size));
  }
  return groups;
}

async function upsertRows(table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (rows.length === 0) return;

  const supabase = getSupabaseAdmin();

  for (const batch of chunk(rows)) {
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      throw error;
    }
  }
}

function mapLineupPlayer(
  fixtureId: number,
  teamId: number,
  item: ApiLineupPlayer,
  isStarting: boolean
): DbLineupPlayer | null {
  const player = item.player;
  if (!player?.id || !player.name) return null;

  return {
    fixture_id: fixtureId,
    team_id: teamId,
    player_id: player.id,
    is_starting: isStarting,
    jersey_number: player.number ?? null,
    grid_position: player.grid ?? null,
    player: {
      id: player.id,
      name: player.name,
      photo_url: null,
    },
  };
}

function buildLineupPayload(fixtureId: number, apiLineups: ApiFixtureLineup[]) {
  const lineups: DbLineup[] = [];
  const players: DbLineupPlayer[] = [];

  for (const lineup of apiLineups) {
    if (!lineup.team?.id || !lineup.team.name) continue;

    lineups.push({
      fixture_id: fixtureId,
      team_id: lineup.team.id,
      formation: lineup.formation ?? null,
      coach_name: lineup.coach?.name ?? null,
      team: {
        id: lineup.team.id,
        name: lineup.team.name,
        logo_url: lineup.team.logo ?? null,
      },
    });

    for (const player of lineup.startXI ?? []) {
      const mapped = mapLineupPlayer(fixtureId, lineup.team.id, player, true);
      if (mapped) players.push(mapped);
    }

    for (const player of lineup.substitutes ?? []) {
      const mapped = mapLineupPlayer(fixtureId, lineup.team.id, player, false);
      if (mapped) players.push(mapped);
    }
  }

  return {
    lineups,
    players,
    playerRows: [...new Map(players.map((player) => [player.player_id, { id: player.player_id, name: player.player.name }])).values()],
    teamRows: [
      ...new Map(
        lineups.map((lineup) => [
          lineup.team_id,
          { id: lineup.team_id, name: lineup.team.name, logo_url: lineup.team.logo_url },
        ])
      ).values(),
    ],
    lineupRows: lineups.map((lineup) => ({
      fixture_id: lineup.fixture_id,
      team_id: lineup.team_id,
      formation: lineup.formation,
      coach_name: lineup.coach_name,
    })),
    lineupPlayerRows: players.map((player) => ({
      fixture_id: player.fixture_id,
      team_id: player.team_id,
      player_id: player.player_id,
      is_starting: player.is_starting,
      jersey_number: player.jersey_number,
      grid_position: player.grid_position,
    })),
  };
}

export async function ensureFixtureLineupsInDb(
  fixtureId: number,
  options: EnsureLineupsOptions = {}
): Promise<{ lineups: DbLineup[]; players: DbLineupPlayer[] }> {
  const existing = await getFixtureLineupsFromDB(fixtureId);
  if (!options.forceRefresh && existing.lineups.length >= 2 && existing.players.length > 0) {
    return existing;
  }

  const apiLineups = await fetchMatchLineups(fixtureId);
  if ((apiLineups?.length ?? 0) < 2) {
    return existing;
  }

  const payload = buildLineupPayload(fixtureId, apiLineups);
  if (payload.lineups.length < 2 || payload.players.length === 0) {
    return existing;
  }

  const supabase = getSupabaseAdmin();

  if (payload.teamRows.length > 0) {
    await upsertRows("teams", payload.teamRows, "id");
  }
  if (payload.playerRows.length > 0) {
    await upsertRows("players", payload.playerRows, "id");
  }

  const { error: deleteError } = await supabase.from("fixture_lineups").delete().eq("fixture_id", fixtureId);
  if (deleteError) {
    throw deleteError;
  }

  await upsertRows("fixture_lineups", payload.lineupRows, "fixture_id,team_id");
  await upsertRows("fixture_lineup_players", payload.lineupPlayerRows, "fixture_id,team_id,player_id");

  return {
    lineups: payload.lineups,
    players: payload.players,
  };
}

export async function ensureFixtureStatisticsInDb(fixtureId: number): Promise<DbMatchStatistic[]> {
  const existing = await getFixtureStatisticsFromDB(fixtureId);
  if (existing.length >= 2) {
    return existing;
  }

  const stats = await fetchMatchStats(fixtureId);
  if ((stats?.length ?? 0) < 2) {
    return existing;
  }

  const rows = stats.flatMap((teamStats) =>
    teamStats.statistics
      .filter((stat) => stat.value !== null && stat.value !== undefined)
      .map((stat) => ({
        fixture_id: fixtureId,
        team_id: teamStats.team.id,
        stat_type: stat.type,
        stat_value: String(stat.value),
        synced_at: new Date().toISOString(),
      }))
  );

  if (rows.length > 0) {
    await upsertRows("fixture_statistics", rows, "fixture_id,team_id,stat_type");
  }

  return stats as DbMatchStatistic[];
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

function summarizeStandings(
  standings: DbStanding[],
  fixture: DbFixtureDetail
) {
  const home = standings.find((row) => row.team_id === fixture.home_team.id);
  const away = standings.find((row) => row.team_id === fixture.away_team.id);

  if (!home && !away) {
    return "Chưa có snapshot bảng xếp hạng cho cặp đấu này.";
  }

  const parts: string[] = [];
  if (home) {
    parts.push(
      `${fixture.home_team.name} đang đứng hạng ${home.rank} với ${home.points} điểm sau ${home.played} trận.`
    );
  }
  if (away) {
    parts.push(
      `${fixture.away_team.name} đang đứng hạng ${away.rank} với ${away.points} điểm sau ${away.played} trận.`
    );
  }
  return parts.join(" ");
}

function summarizeH2H(
  h2h: DbH2HFixture[],
  fixture: DbFixtureDetail
) {
  if (h2h.length === 0) {
    return "Chưa có dữ liệu đối đầu gần đây giữa hai đội trong kho hệ thống.";
  }

  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;

  for (const match of h2h) {
    if (match.goals_home === null || match.goals_away === null) continue;

    const homeGoals =
      match.home_team.id === fixture.home_team.id ? match.goals_home : match.goals_away;
    const awayGoals =
      match.home_team.id === fixture.home_team.id ? match.goals_away : match.goals_home;

    if (homeGoals > awayGoals) homeWins += 1;
    else if (homeGoals < awayGoals) awayWins += 1;
    else draws += 1;
  }

  const latest = h2h[0];
  const latestScore =
    latest.goals_home === null || latest.goals_away === null
      ? "chưa rõ tỷ số"
      : `${latest.home_team.name} ${latest.goals_home}-${latest.goals_away} ${latest.away_team.name}`;

  return `${h2h.length} trận gần nhất: ${fixture.home_team.name} thắng ${homeWins}, ${fixture.away_team.name} thắng ${awayWins}, hòa ${draws}. Trận mới nhất: ${latestScore}.`;
}

function getStatValue(stats: DbMatchStatistic[], teamId: number, type: string) {
  const team = stats.find((item) => item.team.id === teamId);
  return team?.statistics.find((item) => item.type === type)?.value ?? null;
}

function summarizeStats(
  stats: DbMatchStatistic[],
  fixture: DbFixtureDetail
) {
  if (stats.length < 2) {
    return "Chưa có snapshot thống kê chi tiết để kết luận về thế trận.";
  }

  const metrics = [
    { type: "Ball Possession", label: "kiểm soát bóng" },
    { type: "Total Shots", label: "tổng cú sút" },
    { type: "Shots on Goal", label: "sút trúng đích" },
    { type: "Corner Kicks", label: "phạt góc" },
    { type: "expected_goals", label: "xG" },
  ];

  const parts = metrics
    .map((metric) => {
      const home = getStatValue(stats, fixture.home_team.id, metric.type);
      const away = getStatValue(stats, fixture.away_team.id, metric.type);
      if (home === null && away === null) return null;
      return `${metric.label}: ${fixture.home_team.name} ${home ?? "—"} - ${away ?? "—"} ${fixture.away_team.name}`;
    })
    .filter((value): value is string => Boolean(value));

  return parts.length > 0
    ? parts.join(". ") + "."
    : "Chưa có snapshot thống kê chi tiết để kết luận về thế trận.";
}

function buildFallbackPreview(params: {
  fixture: DbFixtureDetail;
  standings: DbStanding[];
  h2h: DbH2HFixture[];
  stats: DbMatchStatistic[];
}): DbMatchPreview {
  const { fixture, standings, h2h, stats } = params;
  const liveState = isDbFinished(fixture.status_short)
    ? `Trận đấu đã khép lại với tỷ số ${fixture.goals_home ?? "?"}-${fixture.goals_away ?? "?"}.`
    : isDbNotStarted(fixture.status_short)
      ? `Trận đấu dự kiến diễn ra lúc ${formatKickoff(fixture.kickoff_at)}.`
      : `Trận đấu đang ở trạng thái ${fixture.status_short} với tỷ số tạm thời ${fixture.goals_home ?? "?"}-${fixture.goals_away ?? "?"}.`;

  const content = [
    `## Nhận định ${fixture.home_team.name} vs ${fixture.away_team.name}`,
    "",
    "### Bối cảnh trận đấu",
    `${liveState} Đây là bản phân tích nhanh dựng từ dữ liệu hệ thống khi bài preview đầy đủ chưa có sẵn.`,
    `${fixture.league.name}${fixture.round ? ` - ${fixture.round}` : ""}, mùa ${fixture.season_year}.`,
    "",
    "### Tương quan vị trí",
    summarizeStandings(standings, fixture),
    "",
    "### Đối đầu gần đây",
    summarizeH2H(h2h, fixture),
    "",
    "### Dấu hiệu từ dữ liệu trận",
    summarizeStats(stats, fixture),
    "",
    "### Kết luận nhanh",
    isDbFinished(fixture.status_short)
      ? `Kết quả cuối cùng nghiêng về ${fixture.goals_home === fixture.goals_away ? "một thế trận cân bằng" : fixture.goals_home! > fixture.goals_away! ? fixture.home_team.name : fixture.away_team.name}. Khi job phân tích đầy đủ chạy xong, tab này sẽ tự được thay bằng bài viết chi tiết hơn.`
      : isDbNotStarted(fixture.status_short)
        ? "Nếu đội hình chính thức và preview AI được đồng bộ kịp trước giờ bóng lăn, tab này sẽ tự nâng cấp từ bản tóm tắt nhanh sang bài nhận định đầy đủ."
        : "Tab này đang dùng bản tóm tắt nhanh trong lúc chờ dữ liệu sâu hơn từ pipeline nền.",
  ].join("\n");

  return {
    fixture_id: fixture.id,
    content,
    generated_at: new Date().toISOString(),
  };
}

export async function getMatchPreviewWithFallback(
  fixture: DbFixtureDetail
): Promise<DbMatchPreview | null> {
  const existing = await getMatchPreviewFromDB(fixture.id);
  if (existing) {
    return existing;
  }

  if (isDbNotStarted(fixture.status_short)) {
    const generation = await generatePreviewForFixture(fixture.id);
    if ("error" in generation) {
      console.warn(`[preview] fixture ${fixture.id}: ${generation.error}`);
    }

    const generated = await getMatchPreviewFromDB(fixture.id);
    if (generated) {
      return generated;
    }
  }

  const [standings, h2h, stats] = await Promise.all([
    getStandingsFromDB(fixture.league.id, fixture.season_year).catch(() => [] as DbStanding[]),
    getH2HFixturesFromDB(fixture.home_team.id, fixture.away_team.id, 5).catch(() => [] as DbH2HFixture[]),
    ensureFixtureStatisticsInDb(fixture.id).catch(() => [] as DbMatchStatistic[]),
  ]);

  return buildFallbackPreview({ fixture, standings, h2h, stats });
}
