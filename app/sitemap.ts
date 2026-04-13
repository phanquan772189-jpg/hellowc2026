/**
 * app/sitemap.ts
 * ============================================================
 * DYNAMIC SITEMAP - Tự động tạo sitemap.xml cho Google
 *
 * Next.js sẽ serve file này tại /sitemap.xml
 * Google Search Console cần URL này để cào toàn bộ site.
 * ============================================================
 */

import type { MetadataRoute } from "next";
import { getTodayFixtureSlugsFromDB } from "@/lib/db-queries";
import { getTrackedLeagueIds } from "@/lib/football-sync-config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ketquawc.vn";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const leaguePages: MetadataRoute.Sitemap = getTrackedLeagueIds().map((leagueId) => ({
    url: `${SITE_URL}/league/${leagueId}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "always", priority: 1.0 },
    ...leaguePages,
  ];

  let matchPages: MetadataRoute.Sitemap = [];
  try {
    const slugs = await getTodayFixtureSlugsFromDB();
    matchPages = slugs.map((row) => ({
      url: `${SITE_URL}/match/${row.slug}`,
      lastModified: new Date(),
      changeFrequency: "always" as const,
      priority: 0.9,
    }));
  } catch {
    // Nếu Supabase lỗi, sitemap vẫn trả về static pages
  }

  return [...staticPages, ...matchPages];
}
