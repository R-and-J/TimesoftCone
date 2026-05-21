import type { CSSProperties, ReactNode, MouseEvent } from "react";
import type { Palette } from "@/lib/tokens";

type Variant = "primary" | "dark" | "soft" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

type Props = {
  p: Palette;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
  children?: ReactNode;
};

const SIZES: Record<Size, { h: number; px: number; fs: number; br: number }> = {
  sm: { h: 36, px: 14, fs: 14, br: 10 },
  md: { h: 44, px: 18, fs: 15, br: 12 },
  lg: { h: 56, px: 24, fs: 17, br: 14 },
  xl: { h: 64, px: 32, fs: 18, br: 16 },
};

export function Btn({
  p,
  variant = "primary",
  size = "md",
  full,
  disabled,
  style,
  onClick,
  children,
}: Props) {
  const s = SIZES[size];
  const variants: Record<Variant, { bg: string; fg: string; border: string }> = {
    primary: { bg: p.accent, fg: "#fff", border: "transparent" },
    dark: { bg: p.ink, fg: "#fff", border: "transparent" },
    soft: { bg: p.accentSoft, fg: p.accent, border: "transparent" },
    ghost: { bg: "transparent", fg: p.inkSoft, border: p.line },
    danger: { bg: p.danger, fg: "#fff", border: "transparent" },
  };
  const v = variants[variant];
  const down = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(0.985)";
  };
  const reset = (e: MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.transform = "scale(1)";
  };
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseDown={down}
      onMouseUp={reset}
      onMouseLeave={reset}
      style={{
        height: s.h,
        padding: `0 ${s.px}px`,
        fontSize: s.fs,
        fontWeight: 600,
        borderRadius: s.br,
        background: v.bg,
        color: v.fg,
        border: `1px solid ${v.border}`,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        width: full ? "100%" : undefined,
        letterSpacing: "-0.01em",
        transition: "filter .12s, transform .08s",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
