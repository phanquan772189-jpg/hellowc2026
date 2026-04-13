/**
 * components/AdBanner.tsx
 * ============================================================
 * PLACEHOLDER QUẢNG CÁO - Tương thích Google AdSense & Affiliate
 *
 * Các slot quảng cáo tiêu chuẩn IAB:
 *  - Leaderboard:  728×90  (top page, desktop)
 *  - MPU / Square: 300×250 (sidebar, in-content)
 *  - Mobile Banner: 320×50 (mobile top)
 *  - Billboard:    970×250 (large screen hero)
 *
 * Cách dùng:
 *  1. Giai đoạn dev: Hiển thị placeholder với kích thước đúng chuẩn.
 *  2. Sau khi AdSense duyệt: Thay thế nội dung bên trong bằng <ins> tag AdSense.
 *  3. Affiliate: Thay bằng banner hình ảnh + link theo dõi affiliate.
 * ============================================================
 */

"use client"; // AdSense script cần client-side

type AdSlot = "leaderboard" | "mpu" | "mobile-banner" | "billboard" | "affiliate-shirt";

interface AdBannerProps {
  slot: AdSlot;
  className?: string;
}

const slotConfig: Record<AdSlot, { width: number; height: number; label: string }> = {
  leaderboard:     { width: 728, height: 90,  label: "Quảng cáo - Leaderboard 728×90" },
  mpu:             { width: 300, height: 250, label: "Quảng cáo - MPU 300×250" },
  "mobile-banner": { width: 320, height: 50,  label: "Quảng cáo - Mobile 320×50" },
  billboard:       { width: 970, height: 250, label: "Quảng cáo - Billboard 970×250" },
  "affiliate-shirt": { width: 300, height: 250, label: "Mua áo đội tuyển - Giá tốt" },
};

export default function AdBanner({ slot, className = "" }: AdBannerProps) {
  const config = slotConfig[slot];

  // ---- Affiliate Banner: Áo bóng đá ----
  if (slot === "affiliate-shirt") {
    return (
      <a
        href="#affiliate-link" // TODO: Thay bằng link affiliate thật (Tiki, Shopee, ...)
        target="_blank"
        rel="noopener noreferrer sponsored"
        className={`block ${className}`}
        aria-label="Mua áo thi đấu World Cup chính hãng"
      >
        {/* TODO: Thay bằng banner hình ảnh affiliate thật */}
        <div
          style={{ width: config.width, height: config.height }}
          className="bg-gradient-to-br from-brand-primary to-green-700 rounded-lg flex flex-col items-center justify-center text-white text-center p-4 cursor-pointer hover:opacity-90 transition-opacity"
        >
          <span className="text-3xl mb-2">⚽</span>
          <p className="font-bold text-sm">Áo World Cup 2026</p>
          <p className="text-xs opacity-80 mt-1">Chính hãng - Giao nhanh</p>
          <span className="mt-2 bg-brand-secondary text-black text-xs font-bold px-3 py-1 rounded-full">
            Mua ngay →
          </span>
        </div>
      </a>
    );
  }

  // ---- Google AdSense Placeholder ----
  return (
    <div
      className={`adsense-container ${className}`}
      style={{ maxWidth: config.width }}
      aria-label={config.label}
    >
      {/* TODO: Khi AdSense duyệt, thay div này bằng:
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: config.width, height: config.height }}
          data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_PID}
          data-ad-slot="YOUR_AD_SLOT_ID"
        />
      */}
      <div
        style={{ width: "100%", maxWidth: config.width, height: config.height }}
        className="bg-brand-card border border-brand-border border-dashed rounded flex items-center justify-center text-gray-500 text-xs"
      >
        {config.label}
      </div>
    </div>
  );
}
