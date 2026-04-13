import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          position: "relative",
          height: "100%",
          width: "100%",
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.28), transparent 28%), radial-gradient(circle at right, rgba(251,146,60,0.24), transparent 30%), linear-gradient(135deg, #07131f 0%, #0f2438 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            position: "absolute",
            inset: 32,
            borderRadius: 32,
            border: "1px solid rgba(255,255,255,0.1)",
            background: "rgba(255,255,255,0.04)",
          }}
        />

        <div
          style={{
            display: "flex",
            width: "100%",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "56px 64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div
              style={{
                display: "flex",
                height: 72,
                width: 72,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 20,
                background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
                fontSize: 36,
                fontWeight: 800,
              }}
            >
              ⚽
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: 24, letterSpacing: 4, textTransform: "uppercase", color: "#fdba74" }}>
                KetquaWC.vn
              </div>
              <div style={{ fontSize: 18, color: "#94a3b8" }}>World Cup 2026 Match Center</div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 820 }}>
            <div style={{ fontSize: 68, lineHeight: 1.05, fontWeight: 900 }}>
              Tỷ số bóng đá trực tiếp hôm nay
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.4, color: "#cbd5e1" }}>
              Live score, lịch trong ngày, bảng xếp hạng và phân tích trận đấu trong một giao diện tối ưu cho matchday.
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid rgba(239,68,68,0.25)",
                background: "rgba(239,68,68,0.12)",
                padding: "10px 18px",
                fontSize: 22,
                fontWeight: 700,
                color: "#fecaca",
              }}
            >
              LIVE SCORE
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                padding: "10px 18px",
                fontSize: 22,
                fontWeight: 600,
                color: "#e2e8f0",
              }}
            >
              World Cup 2026
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
