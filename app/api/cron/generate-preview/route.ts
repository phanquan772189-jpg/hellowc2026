import "server-only";

import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { generatePreviewForFixture } from "@/lib/preview-generator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const fixtureId = parseInt(searchParams.get("fixture_id") ?? "", 10);

  if (!Number.isFinite(fixtureId)) {
    return NextResponse.json({ error: "Missing or invalid fixture_id param" }, { status: 400 });
  }

  try {
    const result = await generatePreviewForFixture(fixtureId);
    if ("error" in result) {
      return NextResponse.json(result, { status: 500 });
    }
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
