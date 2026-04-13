import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Tắt optimization cho external images (logo CLB từ api-sports.io chậm)
    // Dùng unoptimized=true trực tiếp trên từng <Image> để tránh proxy timeout
    unoptimized: true,
    remotePatterns: [
      { protocol: "https", hostname: "media.api-sports.io" },
      { protocol: "https", hostname: "media-3.api-sports.io" },
    ],
  },
  // Headers bảo mật cơ bản
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
