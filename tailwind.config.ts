import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: {
          base: "#07131f",
          card: "#0e1b2b",
          raised: "#15273b",
          overlay: "#1b324c",
        },
        brand: {
          DEFAULT: "#fb923c",
          dim: "#ea580c",
          glow: "#fdba74",
        },
        line: {
          DEFAULT: "rgba(255,255,255,0.12)",
          subtle: "rgba(255,255,255,0.08)",
          strong: "rgba(255,255,255,0.20)",
        },
        live: "#ef4444",
        win: "#22c55e",
        draw: "#94a3b8",
        loss: "#ef4444",
        goal: "#22c55e",
        card_y: "#facc15",
        card_r: "#f87171",
        sub: "#38bdf8",
      },
      backgroundImage: {
        "stadium-gradient":
          "linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(251,146,60,0.2) 100%)",
        "live-gradient":
          "linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(249,115,22,0.18) 100%)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      fontSize: {
        "score-xl": ["2.75rem", { lineHeight: "1", fontWeight: "800", letterSpacing: "-0.05em" }],
        "score-lg": ["2.125rem", { lineHeight: "1", fontWeight: "800", letterSpacing: "-0.04em" }],
        "score-md": ["1.5rem", { lineHeight: "1", fontWeight: "700", letterSpacing: "-0.03em" }],
        "score-sm": ["1.125rem", { lineHeight: "1", fontWeight: "700" }],
      },
      boxShadow: {
        card: "0 24px 60px rgba(3, 10, 20, 0.34)",
        "card-strong": "0 30px 80px rgba(3, 10, 20, 0.42)",
        glow: "0 0 0 1px rgba(255,255,255,0.08), 0 18px 50px rgba(251,146,60,0.12)",
      },
      animation: {
        ticker: "tickerScroll 60s linear infinite",
        "slide-up": "slideUp 0.2s ease-out",
        "fade-in": "fadeIn 0.25s ease-out",
        "pulse-soft": "pulseSoft 1.6s ease-in-out infinite",
      },
      keyframes: {
        tickerScroll: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.75" },
        },
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
};

export default config;
