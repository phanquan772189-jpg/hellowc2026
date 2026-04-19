"use client";

type AdSlot = "leaderboard" | "mpu" | "mobile-banner" | "billboard" | "affiliate-shirt";

interface AdBannerProps {
  slot: AdSlot;
  className?: string;
}

export default function AdBanner({ slot, className = "" }: AdBannerProps) {
  const pid = process.env.NEXT_PUBLIC_ADSENSE_PID;

  if (!pid) return null;

  if (slot === "affiliate-shirt") return null;

  const slotMap: Record<AdSlot, { w: number; h: number }> = {
    leaderboard:       { w: 728, h: 90 },
    mpu:               { w: 300, h: 250 },
    "mobile-banner":   { w: 320, h: 50 },
    billboard:         { w: 970, h: 250 },
    "affiliate-shirt": { w: 300, h: 250 },
  };

  const { w, h } = slotMap[slot];

  return (
    <div className={className} style={{ maxWidth: w }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block", width: w, height: h }}
        data-ad-client={pid}
        data-ad-slot=""
      />
    </div>
  );
}
