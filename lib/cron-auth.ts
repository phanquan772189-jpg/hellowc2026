import { NextRequest } from "next/server";

export function isAuthorizedCronRequest(request: NextRequest) {
  if (process.env.NODE_ENV === "development") {
    return true;
  }

  if (request.headers.get("x-vercel-cron") === "1") {
    return true;
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron-auth] Missing CRON_SECRET in production.");
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}
