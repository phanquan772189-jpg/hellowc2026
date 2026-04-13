import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { generatePreviewForFixture } from "@/lib/preview-generator";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tự động sinh nhận định cho các trận sắp diễn ra trong 30–90 phút tới.
 * Được gọi bởi Supabase pg_cron mỗi 30 phút.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const now = new Date();

  // Cửa sổ: trận bắt đầu trong 20 phút → 100 phút tới
  // Chạy mỗi 30 phút → mỗi trận được check ít nhất 1 lần trong khung 30–90 phút trước giờ đấu
  const windowStart = new Date(now.getTime() + 20 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 100 * 60 * 1000);

  try {
    // Tìm các trận chưa bắt đầu trong cửa sổ thời gian
    const { data: upcoming, error: fetchErr } = await supabase
      .from("fixtures")
      .select("id,kickoff_at")
      .eq("status_short", "NS")
      .gte("kickoff_at", windowStart.toISOString())
      .lte("kickoff_at", windowEnd.toISOString())
      .order("kickoff_at", { ascending: true });

    if (fetchErr) throw fetchErr;

    if (!upcoming?.length) {
      return NextResponse.json({
        message: "Không có trận nào trong cửa sổ thời gian",
        window: { from: windowStart.toISOString(), to: windowEnd.toISOString() },
        count: 0,
      });
    }

    // Lọc các trận đã có preview
    const ids = upcoming.map((f) => f.id);
    const { data: existingPreviews } = await supabase
      .from("match_previews")
      .select("fixture_id")
      .in("fixture_id", ids);

    const existingSet = new Set((existingPreviews ?? []).map((p) => p.fixture_id));
    const toGenerate = ids.filter((id) => !existingSet.has(id));

    if (!toGenerate.length) {
      return NextResponse.json({
        message: "Tất cả trận đã có nhận định",
        window: { from: windowStart.toISOString(), to: windowEnd.toISOString() },
        count: 0,
      });
    }

    // Sinh nhận định tuần tự để tránh rate limit API
    const results = [];
    for (const fixtureId of toGenerate) {
      const result = await generatePreviewForFixture(fixtureId);
      results.push(result);
    }

    const succeeded = results.filter((r) => "success" in r).length;
    const skipped = results.filter((r) => "skipped" in r).length;
    const failed = results.filter((r) => "error" in r).length;

    return NextResponse.json({
      success: true,
      window: { from: windowStart.toISOString(), to: windowEnd.toISOString() },
      total_in_window: upcoming.length,
      already_had_preview: existingSet.size,
      generated: succeeded,
      skipped,
      errors: failed,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
