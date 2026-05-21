import type { Palette } from "@/lib/tokens";

type Props = {
  p: Palette;
  name: string;
  size?: number;
  bg?: string;
};

export function Avatar({ p, name, size = 36, bg }: Props) {
  const initial = (name || "?")[0];
  const palette = [p.accent, p.success, p.warn, "#8B5CF6", "#EC4899", "#0EA5E9"];
  const color = bg || palette[(name?.charCodeAt(0) || 0) % palette.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        color: "#fff",
        fontWeight: 700,
        fontSize: size * 0.42,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        letterSpacing: "-0.01em",
        flex: "0 0 auto",
      }}
    >
      {initial}
    </div>
  );
}
