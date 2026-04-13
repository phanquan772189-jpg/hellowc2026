import { ImageResponse } from "next/og";

export const size = {
  width: 128,
  height: 128,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #07131f 0%, #10273d 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            height: 92,
            width: 92,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 24,
            background: "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)",
            color: "white",
            fontSize: 48,
            fontWeight: 800,
          }}
        >
          ⚽
        </div>
      </div>
    ),
    size
  );
}
