import "server-only";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { apiFetch, buildQuery } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── API-Football Types ──────────────────────────────────────────────────────

interface PredictionPercent {
  home: string;
  draw: string;
  away: string;
}

interface PredictionItem {
  predictions: {
    winner: { id: number | null; name: string | null } | null;
    percent: PredictionPercent;
  };
}

interface H2HFixture {
  fixture: { id: number; date: string; status: { short: string } };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
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

// ─── DB row type for fixture lookup ─────────────────────────────────────────

type FixtureRow = {
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function msgFromError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const googleApiKey = process.env.GOOGLE_AI_API_KEY;
  if (!googleApiKey) {
    return NextResponse.json({ error: "GOOGLE_AI_API_KEY not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const fixtureId = parseInt(searchParams.get("fixture_id") ?? "", 10);

  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ error: "Missing or invalid fixture_id param" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();

    // 1. Lấy thông tin trận đấu từ DB
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

    if (dbErr) throw new Error(`DB: ${dbErr.message}`);
    if (!fixture) return NextResponse.json({ error: "Fixture not found" }, { status: 404 });

    const row = fixture as unknown as FixtureRow;
    const homeName = row.home_team?.name ?? "Đội nhà";
    const awayName = row.away_team?.name ?? "Đội khách";
    const leagueName = row.league?.name ?? "Giải đấu";

    // 2. Kiểm tra preview đã tồn tại chưa
    const { data: existing } = await supabase
      .from("match_previews")
      .select("id")
      .eq("fixture_id", fixtureId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        skipped: true,
        reason: "Preview already exists",
        fixture_id: fixtureId,
      });
    }

    // 3. Fetch song song 4 nguồn dữ liệu từ API-Football
    const [predictionsRes, h2hRes, homeStatsRes, awayStatsRes, injuriesRes] =
      await Promise.allSettled([
        apiFetch<PredictionItem[]>(
          `/predictions${buildQuery({ fixture: fixtureId })}`
        ),
        apiFetch<H2HFixture[]>(
          `/fixtures/headtohead${buildQuery({
            h2h: `${row.home_team_id}-${row.away_team_id}`,
            last: 5,
          })}`
        ),
        apiFetch<TeamStats>(
          `/teams/statistics${buildQuery({
            team: row.home_team_id,
            league: row.league_id,
            season: row.season_year,
          })}`
        ),
        apiFetch<TeamStats>(
          `/teams/statistics${buildQuery({
            team: row.away_team_id,
            league: row.league_id,
            season: row.season_year,
          })}`
        ),
        apiFetch<InjuryItem[]>(
          `/injuries${buildQuery({ fixture: fixtureId })}`
        ),
      ]);

    const predictions = settled(predictionsRes, [])[0]?.predictions ?? null;
    const h2h = settled(h2hRes, []).slice(0, 5);
    const homeStats = settled<TeamStats | null>(homeStatsRes, null);
    const awayStats = settled<TeamStats | null>(awayStatsRes, null);
    const injuries = settled(injuriesRes, []);

    // 4. Xây dựng dữ liệu cho prompt (KHÔNG có kèo/odds/cá cược)
    const promptPayload = {
      tran_dau: `${homeName} vs ${awayName}`,
      giai_dau: leagueName,
      gio_da_utc: row.kickoff_at,
      // Xác suất thống kê thuần túy (không phải tỷ lệ cá cược)
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
      model: "gemini-1.5-flash",
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

    if (insertErr) throw new Error(`Insert: ${insertErr.message}`);

    return NextResponse.json({
      success: true,
      fixture_id: fixtureId,
      fixture: `${homeName} vs ${awayName}`,
      league: leagueName,
      content_chars: content.length,
    });
  } catch (error) {
    console.error("[generate-preview]", error);
    return NextResponse.json({ error: msgFromError(error) }, { status: 500 });
  }
}
