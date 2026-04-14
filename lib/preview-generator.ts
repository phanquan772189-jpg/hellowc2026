import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";

import { apiFetch, buildQuery } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const PREVIEW_MIN_CHARS = 900;
const PREVIEW_MIN_SECTION_HEADINGS = 3;

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

type ExistingPreviewRow = {
  id: number;
  content: string;
};

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

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

export function isPreviewContentComplete(content: string | null | undefined) {
  if (!content) return false;

  const normalized = content.trim();
  if (normalized.length < PREVIEW_MIN_CHARS) {
    return false;
  }

  const sectionHeadings = normalized.match(/^###\s+/gm)?.length ?? 0;
  return sectionHeadings >= PREVIEW_MIN_SECTION_HEADINGS;
}

function buildPreviewPrompt(params: {
  homeName: string;
  awayName: string;
  leagueName: string;
  promptPayload: Record<string, unknown>;
}) {
  const { homeName, awayName, leagueName, promptPayload } = params;

  return `Bạn là nhà báo thể thao chuyên nghiệp viết cho trang livescore bóng đá Việt Nam.
Dựa trên dữ liệu thống kê dưới đây, viết bài nhận định trước trận bằng tiếng Việt có dấu, tối thiểu 450 từ và ưu tiên khoảng 500-650 từ, định dạng Markdown.

QUY TẮC BẮT BUỘC:
- Phân tích khách quan dựa trên số liệu thực tế
- Đề cập đến cầu thủ vắng mặt do chấn thương nếu có
- Nếu có xác suất phân tích (%), dùng để đánh giá thế mạnh/yếu của hai đội, KHÔNG gợi ý cá cược
- TUYỆT ĐỐI không đề cập đến: tỷ lệ kèo, cá cược, tài xỉu, cá độ, hay bất kỳ hình thức đặt cược nào
- Phải viết trọn vẹn 4 mục bên dưới, không được dừng giữa câu
- Chỉ trả về bài Markdown hoàn chỉnh, không thêm lời mở đầu kiểu trợ lý AI

CẤU TRÚC BÀI VIẾT:
## Nhận định ${homeName} vs ${awayName}

### Phong độ & Thành tích
[Ít nhất 2 đoạn, phân tích form gần đây và thống kê mùa giải của cả 2 đội]

### Lịch sử đối đầu
[Ít nhất 1 đoạn, phân tích 5 trận gần nhất giữa 2 đội]

### Tình hình lực lượng
[Ít nhất 1 đoạn. Cầu thủ vắng mặt, chấn thương nếu có. Nếu không có dữ liệu thì nêu rõ chưa ghi nhận ca vắng mặt đáng chú ý.]

### Nhận định & Dự báo
[Ít nhất 2 đoạn, tổng hợp thế trận, điểm mạnh/yếu và dự đoán diễn biến]

DỮ LIỆU THỐNG KÊ:
${JSON.stringify(
  {
    tran_dau: `${homeName} vs ${awayName}`,
    giai_dau: leagueName,
    ...promptPayload,
  },
  null,
  2
)}`;
}

function createPreviewModel(apiKey: string, modelName: string) {
  const genAI = new GoogleGenerativeAI(apiKey);

  const generationConfig: Record<string, unknown> = {
    maxOutputTokens: 4096,
    temperature: 0.5,
  };

  // Gemini 2.5 defaults can burn the output budget on reasoning and return a
  // visibly truncated article. Disable thinking for this long-form writing job.
  if (modelName.startsWith("gemini-2.5")) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: generationConfig as never,
  } as never);
}

async function generatePreviewMarkdown(apiKey: string, modelName: string, prompt: string) {
  const model = createPreviewModel(apiKey, modelName);
  const result = await model.generateContent(prompt);
  const response = result.response;

  return {
    content: response.text().trim(),
    finishReason: response.candidates?.[0]?.finishReason ?? "UNKNOWN",
  };
}

export async function generatePreviewForFixture(fixtureId: number): Promise<PreviewResult> {
  const googleApiKey = process.env.GOOGLE_AI_API_KEY;
  const googleModel = process.env.GOOGLE_AI_MODEL ?? "gemini-2.5-flash";
  if (!googleApiKey) {
    return { error: "GOOGLE_AI_API_KEY not configured", fixture_id: fixtureId };
  }

  const supabase = getSupabaseAdmin();

  const { data: fixture, error: fixtureError } = await supabase
    .from("fixtures")
    .select(
      "id,kickoff_at,home_team_id,away_team_id,league_id,season_year," +
        "home_team:teams!home_team_id(name)," +
        "away_team:teams!away_team_id(name)," +
        "league:leagues!league_id(name)"
    )
    .eq("id", fixtureId)
    .maybeSingle();

  if (fixtureError) {
    return { error: fixtureError.message, fixture_id: fixtureId };
  }
  if (!fixture) {
    return { error: "Fixture not found", fixture_id: fixtureId };
  }

  const row = fixture as unknown as FixtureRow;
  const homeName = row.home_team?.name ?? "Doi nha";
  const awayName = row.away_team?.name ?? "Doi khach";
  const leagueName = row.league?.name ?? "Giai dau";

  const { data: existing, error: existingError } = await supabase
    .from("match_previews")
    .select("id,content")
    .eq("fixture_id", fixtureId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message, fixture_id: fixtureId };
  }

  const existingPreview = (existing ?? null) as ExistingPreviewRow | null;
  if (existingPreview && isPreviewContentComplete(existingPreview.content)) {
    return { skipped: true, fixture_id: fixtureId, reason: "Preview already exists" };
  }

  const [predictionsRes, h2hRes, homeStatsRes, awayStatsRes, injuriesRes] = await Promise.allSettled([
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

  const promptPayload = {
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
    lich_su_doi_dau_5_tran: h2h.map((match) => ({
      ngay: match.fixture.date.slice(0, 10),
      doi_nha_api: match.teams.home.name,
      doi_khach_api: match.teams.away.name,
      ti_so: `${match.goals.home ?? "?"} - ${match.goals.away ?? "?"}`,
      trang_thai: match.fixture.status.short,
    })),
    chan_thuong_vang_mat: injuries.map((injury) => ({
      doi: injury.team.name,
      cau_thu: injury.player.name,
      ly_do: injury.player.reason,
      loai: injury.player.type,
    })),
  };

  const basePrompt = buildPreviewPrompt({
    homeName,
    awayName,
    leagueName,
    promptPayload,
  });

  const attempts = [
    basePrompt,
    `${basePrompt}

YÊU CẦU BỔ SUNG:
- Bài viết phải hoàn chỉnh, không cắt giữa câu
- Tối thiểu 450 từ
- Viết hoàn toàn bằng tiếng Việt có dấu
- Phải có đủ 4 tiêu đề cấp 3 bắt đầu bằng "### "`,
  ];

  let content = "";
  let finishReason = "UNKNOWN";

  for (const prompt of attempts) {
    const result = await generatePreviewMarkdown(googleApiKey, googleModel, prompt);
    content = result.content;
    finishReason = result.finishReason;

    if (finishReason !== "MAX_TOKENS" && isPreviewContentComplete(content)) {
      break;
    }
  }

  if (!isPreviewContentComplete(content)) {
    return {
      error: `Preview generation incomplete (finishReason=${finishReason}, chars=${content.length})`,
      fixture_id: fixtureId,
    };
  }

  const rowToSave = {
    fixture_id: fixtureId,
    home_team_name: homeName,
    away_team_name: awayName,
    league_name: leagueName,
    content,
    generated_at: new Date().toISOString(),
  };

  if (existingPreview?.id) {
    const { error: updateError } = await supabase
      .from("match_previews")
      .update(rowToSave)
      .eq("id", existingPreview.id);

    if (updateError) {
      return { error: updateError.message, fixture_id: fixtureId };
    }
  } else {
    const { error: insertError } = await supabase.from("match_previews").insert(rowToSave);
    if (insertError) {
      return { error: insertError.message, fixture_id: fixtureId };
    }
  }

  return {
    success: true,
    fixture_id: fixtureId,
    fixture: `${homeName} vs ${awayName}`,
    league: leagueName,
    content_chars: content.length,
  };
}
