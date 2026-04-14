import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

import { apiFetch, buildQuery } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

// ─── API-Football Types ───────────────────────────────────────────────────────

interface PredictionItem {
  predictions: {
    winner: { id: number | null; name: string | null } | null;
    percent: { home: string; draw: string; away: string };
  };
}

interface H2HFixture {
  fixture: { id: number; date: string; status: { short: string } };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

interface TeamStats {
  team: { id: number; name: string };
  form: string | null;
  fixtures: {
    played: { total: number };
    wins: { total: number };
    draws: { total: number };
    loses: { total: number };
  };
  goals: {
    for: { average: { total: string } };
    against: { average: { total: string } };
  };
}

interface InjuryItem {
  player: { id: number; name: string; type: string; reason: string };
  team: { id: number; name: string };
}

export type FixtureRow = {
  id: number;
  kickoff_at: string;
  home_team_id: number;
  away_team_id: number;
  league_id: number;
  season_year: number;
  home_team: { name: string } | null;
  away_team: { name: string } | null;
  league: { name: string } | null;
};

export type PreviewResult =
  | { success: true; fixture_id: number; fixture: string; league: string; content_chars: number }
  | { skipped: true; fixture_id: number; reason: string }
  | { error: string; fixture_id: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

// ─── Core preview generator ───────────────────────────────────────────────────

export async function generatePreviewForFixture(fixtureId: number): Promise<PreviewResult> {
  const googleApiKey = process.env.GOOGLE_AI_API_KEY;
  const googleModel = process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash";
  if (!googleApiKey) {
    return { error: "GOOGLE_AI_API_KEY not configured", fixture_id: fixtureId };
  }

  const supabase = getSupabaseAdmin();

  // 1. Lấy thông tin trận đấu
  const { data: fixture, error: dbErr } = await supabase
    .from("fixtures")
    .select(
      "id,kickoff_at,home_team_id,away_team_id,league_id,season_year," +
      "home_team:teams!home_team_id(name)," +
      "away_team:teams!away_team_id(name)," +
      "league:leagues!league_id(name)"
    )
    .eq("id", fixtureId)
    .maybeSingle();

  if (dbErr) return { error: dbErr.message, fixture_id: fixtureId };
  if (!fixture) return { error: "Fixture not found", fixture_id: fixtureId };

  const row = fixture as unknown as FixtureRow;
  const homeName = row.home_team?.name ?? "Đội nhà";
  const awayName = row.away_team?.name ?? "Đội khách";
  const leagueName = row.league?.name ?? "Giải đấu";

  // 2. Kiểm tra đã có preview chưa
  const { data: existing } = await supabase
    .from("match_previews")
    .select("id")
    .eq("fixture_id", fixtureId)
    .maybeSingle();

  if (existing) {
    return { skipped: true, fixture_id: fixtureId, reason: "Preview already exists" };
  }

  // 3. Fetch song song dữ liệu từ API-Football
  const [predictionsRes, h2hRes, homeStatsRes, awayStatsRes, injuriesRes] =
    await Promise.allSettled([
      apiFetch<PredictionItem[]>(`/predictions${buildQuery({ fixture: fixtureId })}`),
      apiFetch<H2HFixture[]>(
        `/fixtures/headtohead${buildQuery({ h2h: `${row.home_team_id}-${row.away_team_id}`, last: 5 })}`
      ),
      apiFetch<TeamStats>(
        `/teams/statistics${buildQuery({ team: row.home_team_id, league: row.league_id, season: row.season_year })}`
      ),
      apiFetch<TeamStats>(
        `/teams/statistics${buildQuery({ team: row.away_team_id, league: row.league_id, season: row.season_year })}`
      ),
      apiFetch<InjuryItem[]>(`/injuries${buildQuery({ fixture: fixtureId })}`),
    ]);

  const predictions = settled(predictionsRes, [])[0]?.predictions ?? null;
  const h2h = settled(h2hRes, []).slice(0, 5);
  const homeStats = settled<TeamStats | null>(homeStatsRes, null);
  const awayStats = settled<TeamStats | null>(awayStatsRes, null);
  const injuries = settled(injuriesRes, []);

  // 4. Xây dựng dữ liệu prompt (không có kèo/odds)
  const promptPayload = {
    tran_dau: `${homeName} vs ${awayName}`,
    giai_dau: leagueName,
    gio_da_utc: row.kickoff_at,
    xac_suat_phan_tich: predictions
      ? {
          doi_nha_thang_pct: predictions.percent.home,
          hoa_pct: predictions.percent.draw,
          doi_khach_thang_pct: predictions.percent.away,
        }
      : null,
    thanh_tich_doi_nha: homeStats
      ? {
          ten: homeName,
          tran_da: homeStats.fixtures.played.total,
          thang: homeStats.fixtures.wins.total,
          hoa: homeStats.fixtures.draws.total,
          thua: homeStats.fixtures.loses.total,
          tb_ban_thang_tran: homeStats.goals.for.average.total,
          tb_thung_tran: homeStats.goals.against.average.total,
          phong_do_5_tran_gan_nhat: homeStats.form?.slice(-5) ?? null,
        }
      : null,
    thanh_tich_doi_khach: awayStats
      ? {
          ten: awayName,
          tran_da: awayStats.fixtures.played.total,
          thang: awayStats.fixtures.wins.total,
          hoa: awayStats.fixtures.draws.total,
          thua: awayStats.fixtures.loses.total,
          tb_ban_thang_tran: awayStats.goals.for.average.total,
          tb_thung_tran: awayStats.goals.against.average.total,
          phong_do_5_tran_gan_nhat: awayStats.form?.slice(-5) ?? null,
        }
      : null,
    lich_su_doi_dau_5_tran: h2h.map((m) => ({
      ngay: m.fixture.date.slice(0, 10),
      doi_nha_api: m.teams.home.name,
      doi_khach_api: m.teams.away.name,
      ti_so: `${m.goals.home ?? "?"} - ${m.goals.away ?? "?"}`,
      trang_thai: m.fixture.status.short,
    })),
    chan_thuong_vang_mat: injuries.map((i) => ({
      doi: i.team.name,
      cau_thu: i.player.name,
      ly_do: i.player.reason,
      loai: i.player.type,
    })),
  };

  // 5. Gọi Google Generative AI
  const genAI = new GoogleGenerativeAI(googleApiKey);
  const model = genAI.getGenerativeModel({
    model: googleModel,
    generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
  });

  const prompt = `Bạn là nhà báo thể thao chuyên nghiệp viết cho trang livescore bóng đá Việt Nam.
Dựa trên dữ liệu thống kê dưới đây, viết bài nhận định TRƯỚC TRẬN bằng tiếng Việt, khoảng 500 chữ, định dạng Markdown.

QUY TẮC BẮT BUỘC:
- Phân tích khách quan dựa trên số liệu thực tế
- Đề cập đến cầu thủ vắng mặt do chấn thương nếu có
- Nếu có xác suất phân tích (%), dùng để đánh giá thế mạnh/yếu của hai đội, KHÔNG gợi ý cá cược
- TUYỆT ĐỐI không đề cập đến: tỷ lệ kèo, cá cược, tài xỉu, cá độ, hay bất kỳ hình thức đặt cược nào

CẤU TRÚC BÀI VIẾT:
## Nhận định ${homeName} vs ${awayName}

### Phong độ & Thành tích
[Phân tích form gần đây và thống kê mùa giải của cả 2 đội]

### Lịch sử đối đầu
[Phân tích 5 trận gần nhất giữa 2 đội]

### Tình hình lực lượng
[Cầu thủ vắng mặt, chấn thương nếu có. Bỏ qua nếu không có dữ liệu.]

### Nhận định & Dự báo
[Tổng hợp và nhận định diễn biến, xu hướng trận đấu]

DỮ LIỆU THỐNG KÊ:
${JSON.stringify(promptPayload, null, 2)}`;

  const aiResult = await model.generateContent(prompt);
  const content = aiResult.response.text();

  // 6. Lưu vào Supabase
  const { error: insertErr } = await supabase.from("match_previews").insert({
    fixture_id: fixtureId,
    home_team_name: homeName,
    away_team_name: awayName,
    league_name: leagueName,
    content,
    generated_at: new Date().toISOString(),
  });

  if (insertErr) return { error: insertErr.message, fixture_id: fixtureId };

  return {
    success: true,
    fixture_id: fixtureId,
    fixture: `${homeName} vs ${awayName}`,
    league: leagueName,
    content_chars: content.length,
  };
}
