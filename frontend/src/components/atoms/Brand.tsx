import type { Palette } from "@/lib/tokens";

type GlyphProps = { color?: string; size?: number };
export function BrandGlyph({ color = "#1B64DA", size = 32 }: GlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="10" fill={color} />
      <path d="M12 10h16l-7 9 7 11H12l7-11-7-9z" fill="#fff" />
      <circle cx="20" cy="20" r="2" fill={color} />
    </svg>
  );
}

type BrandProps = { p: Palette; compact?: boolean; color?: string };
export function Brand({ p, compact = false, color }: BrandProps) {
  const c = color || p.ink;
  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <BrandGlyph color={p.accent} size={26} />
        <div
          style={{
            fontWeight: 800,
            fontSize: 16,
            color: c,
            letterSpacing: "-0.025em",
          }}
        >
          타임소프트콘
        </div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <BrandGlyph color={p.accent} size={40} />
      <div>
        <div
          style={{
            fontWeight: 800,
            fontSize: 22,
            color: c,
            letterSpacing: "-0.03em",
            lineHeight: 1,
          }}
        >
          타임소프트콘
        </div>
        <div
          style={{
            fontSize: 12,
            color: p.inkMuted,
            marginTop: 4,
            letterSpacing: 0.4,
          }}
        >
          TIMESOFT·CONE
        </div>
      </div>
    </div>
  );
}
