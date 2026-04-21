"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#07131f",
          color: "#f1f5f9",
          fontFamily: "Inter, system-ui, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            textAlign: "center",
            padding: "32px",
            borderRadius: 24,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(14,27,43,0.7)",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "#fb923c",
              margin: 0,
            }}
          >
            Sự cố nghiêm trọng
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 800, margin: "16px 0 12px" }}>
            Trang không thể tải
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#cbd5e1", margin: "0 0 24px" }}>
            Vui lòng thử tải lại trang. Nếu sự cố tiếp diễn, hãy quay lại sau ít phút.
          </p>
          {error.digest ? (
            <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 16px" }}>
              Mã lỗi: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "10px 22px",
              borderRadius: 14,
              border: "none",
              background: "linear-gradient(135deg,#fb923c 0%,#f97316 100%)",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Thử lại
          </button>
        </div>
      </body>
    </html>
  );
}
