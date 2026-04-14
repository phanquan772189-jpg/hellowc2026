import type { MetadataRoute } from "next";

import { getTrackedLeagueIds } from "@/lib/football-sync-config";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ketquawc.vn";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const contentPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, lastModified: now, changeFrequency: "always", priority: 1.0 },
    { url: `${SITE_URL}/ket-qua`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/lich-thi-dau`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${SITE_URL}/bang-xep-hang`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/goc-chuyen-gia`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
  ];

  const legalPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/chinh-sach-bao-mat`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/dieu-khoan-su-dung`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${SITE_URL}/lien-he`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const leaguePages: MetadataRoute.Sitemap = getTrackedLeagueIds().map((leagueId) => ({
    url: `${SITE_URL}/league/${leagueId}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Match pages are served by the dedicated /sitemap-matches sitemap
  // to avoid bloating this file and to support proper per-URL change frequencies.

  return [...contentPages, ...legalPages, ...leaguePages];
}
