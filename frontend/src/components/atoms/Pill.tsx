import type { CSSProperties, ReactNode } from "react";
import type { Palette } from "@/lib/tokens";

type Tone = "neutral" | "accent" | "success" | "warn" | "danger" | "live" | "dark";
type Size = "sm" | "md";

type Props = {
  p: Palette;
  tone?: Tone;
  size?: Size;
  style?: CSSProperties;
  children?: ReactNode;
};

export function Pill({ p, tone = "neutral", size = "md", style, children }: Props) {
  const tones: Record<Tone, { bg: string; fg: string }> = {
    neutral: { bg: "#F3F5F8", fg: p.inkSoft },
    accent: { bg: p.accentSoft, fg: p.accent },
    success: { bg: "#E6F6F0", fg: p.success },
    warn: { bg: "#FFF4E0", fg: p.warn },
    danger: { bg: "#FDECEE", fg: p.danger },
    live: { bg: p.danger, fg: "#fff" },
    dark: { bg: p.ink, fg: "#fff" },
  };
  const t = tones[tone];
  const sz = size === "sm" ? { fs: 11, px: 8, h: 20 } : { fs: 12, px: 10, h: 24 };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: t.bg,
        color: t.fg,
        fontSize: sz.fs,
        fontWeight: 600,
        height: sz.h,
        padding: `0 ${sz.px}px`,
        borderRadius: 999,
        letterSpacing: "-0.01em",
        ...style,
      }}
    >
      {children}
    </span>
  );
}
