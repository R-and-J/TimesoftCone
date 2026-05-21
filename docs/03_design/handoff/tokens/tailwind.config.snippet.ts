/**
 * TimesoftCone · tailwind.config.ts 확장 스니펫
 *
 * shadcn CLI가 만든 tailwind.config.ts 의 `theme.extend` 안에 아래 내용을
 * 머지하세요. (shadcn 기본 색상 정의 + 도메인 추가 컬러)
 */

import type { Config } from "tailwindcss";

export default {
  // ...
  theme: {
    extend: {
      colors: {
        // ── shadcn 표준 ─────────────────────────────────────
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },

        // ── 도메인 추가 ─────────────────────────────────────
        ink: {
          DEFAULT: "hsl(var(--ink))",
          soft: "hsl(var(--ink-soft))",
          muted: "hsl(var(--ink-muted))",
        },
        brand: {
          DEFAULT: "hsl(var(--primary))",        // = #1B64DA
          deep: "hsl(var(--accent-deep))",       // = #0E4BB0
          soft: "hsl(var(--accent-soft))",       // = #eef4ff
        },
        surface: "hsl(var(--card))",             // = #ffffff
        line: "hsl(var(--border))",              // = #dde6f3
        bgDeep: "hsl(var(--bg-deep))",           // = #cfe2ff
        success: "hsl(var(--success))",
        warn: "hsl(var(--warn))",
        danger: "hsl(var(--danger))",
      },
      borderRadius: {
        // RADIUS scale from src/tokens.jsx
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
        // shadcn defaults still work via --radius
      },
      fontFamily: {
        sans: [
          '"Pretendard Variable"',
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "sans-serif",
        ],
        mono: [
          '"JetBrains Mono"',
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 0 rgba(11,25,41,0.04), 0 8px 24px rgba(11,25,41,0.04)",
        "card-hover":
          "0 1px 0 rgba(11,25,41,0.04), 0 14px 32px rgba(11,25,41,0.08)",
      },
      keyframes: {
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
      animation: {
        pulse: "pulse 1.4s infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
