import type { Metadata } from "next";
import { Be_Vietnam_Pro, Roboto_Mono } from "next/font/google";
import Script from "next/script";

import Footer from "@/components/Footer";
import Header from "@/components/Header";
import { WebSiteSchema } from "@/components/SchemaMarkup";

import "./globals.css";

const sans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const mono = Roboto_Mono({
  subsets: ["latin", "vietnamese"],
  variable: "--font-mono",
  weight: ["500", "700"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://ketquawc.vn";
const SITE_NAME = process.env.NEXT_PUBLIC_SITE_NAME ?? "KetquaWC.vn";
const GOOGLE_SITE_VERIFICATION = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Tỷ số World Cup trực tiếp`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Theo dõi tỷ số World Cup 2026 trực tiếp, lịch thi đấu, bảng xếp hạng và phân tích trận đấu trong một giao diện tối ưu cho matchday.",
  keywords: ["world cup 2026", "tỷ số bóng đá", "livescore", "kết quả bóng đá", "lịch thi đấu world cup"],
  openGraph: {
    type: "website",
    locale: "vi_VN",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Tỷ số World Cup trực tiếp`,
    description: "Theo dõi tỷ số World Cup 2026 trực tiếp, lịch thi đấu và phân tích trận đấu.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Tỷ số World Cup trực tiếp`,
    description: "Theo dõi tỷ số World Cup 2026 trực tiếp.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  verification: GOOGLE_SITE_VERIFICATION ? { google: GOOGLE_SITE_VERIFICATION } : undefined,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <WebSiteSchema siteUrl={SITE_URL} siteName={SITE_NAME} />
        {GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA_ID}');`}
            </Script>
          </>
        )}
      </head>
      <body className={`${sans.variable} ${mono.variable} font-sans antialiased`}>
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <div className="site-grid" />
          <div className="site-glow-a" />
          <div className="site-glow-b" />
          <div className="site-glow-c" />
        </div>
        <div className="relative min-h-screen">
          <Header />
          <main id="main-content" tabIndex={-1} className="relative">
            {children}
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
