type Segment = { value: number; color: string; cap?: "butt" | "round" };

type Props = {
  size?: number;
  thickness?: number;
  segments: Segment[];
  ringBg?: string;
};

export function Donut({
  size = 200,
  thickness = 32,
  segments,
  ringBg = "#eef0f3",
}: Props) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={ringBg}
        strokeWidth={thickness}
      />
      {segments.map((seg, i) => {
        const dash = c * seg.value;
        const el = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={thickness}
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeLinecap={seg.cap || "butt"}
          />
        );
        offset += dash;
        return el;
      })}
    </svg>
  );
}
