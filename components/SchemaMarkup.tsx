/**
 * components/SchemaMarkup.tsx
 * ============================================================
 * SCHEMA MARKUP JSON-LD - Tối ưu SEO kỹ thuật
 *
 * Google sử dụng JSON-LD để hiểu nội dung trang:
 *  - SportsEvent: Cho trang chi tiết trận đấu (hiển thị rich result trên SERP)
 *  - Article:     Cho trang bài viết nhận định chuyên gia
 *  - BreadcrumbList: Cho breadcrumb navigation
 *  - WebSite:     Cho trang chủ (bật sitelinks searchbox)
 * ============================================================
 */

import type { DbFixtureDetail } from "@/lib/db-queries";
import { isDbFinished, isDbLive } from "@/lib/db-queries";

// ============================================================
// Schema: SportsEvent - Trận đấu bóng đá
// ============================================================
interface SportsEventSchemaProps {
  fixture: DbFixtureDetail;
  siteUrl: string;
}

export function SportsEventSchema({ fixture, siteUrl }: SportsEventSchemaProps) {
  const live = isDbLive(fixture.status_short);
  const finished = isDbFinished(fixture.status_short);
  const eventStatus = live
    ? "https://schema.org/EventInProgress"
    : finished
      ? "https://schema.org/EventCompleted"
      : "https://schema.org/EventScheduled";

  const schema = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${fixture.home_team.name} vs ${fixture.away_team.name} - ${fixture.league.name}`,
    description: `Theo dõi trực tiếp tỷ số ${fixture.home_team.name} vs ${fixture.away_team.name} tại ${fixture.league.name} ${fixture.round ?? ""}. Cập nhật liên tục các sự kiện, bàn thắng.`,
    startDate: fixture.kickoff_at,
    eventStatus,
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    location: fixture.venue_name
      ? {
          "@type": "Place",
          name: fixture.venue_name,
          address: {
            "@type": "PostalAddress",
            addressLocality: fixture.venue_city,
          },
        }
      : undefined,
    homeTeam: {
      "@type": "SportsTeam",
      name: fixture.home_team.name,
      logo: fixture.home_team.logo_url,
    },
    awayTeam: {
      "@type": "SportsTeam",
      name: fixture.away_team.name,
      logo: fixture.away_team.logo_url,
    },
    ...(fixture.goals_home !== null && {
      sport: "Football",
      competitor: [
        {
          "@type": "SportsTeam",
          name: fixture.home_team.name,
          score: String(fixture.goals_home),
        },
        {
          "@type": "SportsTeam",
          name: fixture.away_team.name,
          score: String(fixture.goals_away),
        },
      ],
    }),
    organizer: {
      "@type": "SportsOrganization",
      name: fixture.league.name,
      logo: fixture.league.logo_url,
    },
    url: `${siteUrl}/match/${fixture.slug}`,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// Schema: Article - Bài viết nhận định chuyên gia
// ============================================================
interface ArticleSchemaProps {
  title: string;
  description: string;
  datePublished: string;
  dateModified: string;
  authorName: string;
  imageUrl: string;
  url: string;
  siteUrl: string;
  siteName: string;
}

export function ArticleSchema({
  title,
  description,
  datePublished,
  dateModified,
  authorName,
  imageUrl,
  url,
  siteUrl,
  siteName,
}: ArticleSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    image: imageUrl,
    datePublished,
    dateModified,
    author: {
      "@type": "Person",
      name: authorName,
      url: siteUrl,
    },
    publisher: {
      "@type": "Organization",
      name: siteName,
      logo: {
        "@type": "ImageObject",
        url: `${siteUrl}/icon`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// Schema: BreadcrumbList - Điều hướng breadcrumb
// ============================================================
interface BreadcrumbItem {
  name: string;
  href: string;
}

interface BreadcrumbSchemaProps {
  items: BreadcrumbItem[];
  siteUrl: string;
}

export function BreadcrumbSchema({ items, siteUrl }: BreadcrumbSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${siteUrl}${item.href}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// ============================================================
// Schema: WebSite - Trang chủ (kích hoạt Sitelinks Searchbox)
// ============================================================
interface WebSiteSchemaProps {
  siteUrl: string;
  siteName: string;
}

export function WebSiteSchema({ siteUrl, siteName }: WebSiteSchemaProps) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteName,
    url: siteUrl,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
