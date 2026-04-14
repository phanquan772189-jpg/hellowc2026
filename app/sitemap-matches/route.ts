import { getAllFixtureSlugsFromDB } from "@/lib/db-queries";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ketquawc.vn";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // Revalidate every hour

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const slugs = await getAllFixtureSlugsFromDB().catch(() => []);
  const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P"]);
  const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

  const entries = slugs.map((row) => {
    const isLive = LIVE_STATUSES.has(row.status_short);
    const isFinished = FINISHED_STATUSES.has(row.status_short);
    const changefreq = isLive ? "always" : isFinished ? "weekly" : "hourly";
    const priority = isLive ? "0.9" : isFinished ? "0.7" : "0.8";
    const lastmod = new Date(row.kickoff_at).toISOString();

    return `  <url>
    <loc>${SITE_URL}/match/${escapeXml(row.slug)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=7200",
    },
  });
}
