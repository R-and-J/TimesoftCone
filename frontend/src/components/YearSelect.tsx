// 경매 목록 연도 필터(CUT-9 LeavePool 부활 후 익년도 매물이 대량 생성될 수 있어
// 기본은 올해로 끊고, 선택으로 익년/전체 전환). 매우 얇은 컨트롤 — 페이지마다 동일.
import type { CSSProperties } from "react";
import type { Palette } from "@/lib/tokens";

type Props = {
  p: Palette;
  /** 선택된 연도. undefined = 전체. */
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  /** 표시할 연도 옵션. 기본 [올해, 올해+1]. */
  years?: number[];
  style?: CSSProperties;
};

export function YearSelect({ p, value, onChange, years, style }: Props) {
  const now = new Date().getFullYear();
  const opts = years ?? [now, now + 1];
  return (
    <select
      value={value === undefined ? "all" : String(value)}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "all" ? undefined : Number(v));
      }}
      style={{
        height: 36,
        padding: "0 28px 0 12px",
        fontSize: 13,
        fontWeight: 600,
        color: p.inkSoft,
        background: "transparent",
        border: `1px solid ${p.line}`,
        borderRadius: 10,
        cursor: "pointer",
        letterSpacing: "-0.01em",
        ...style,
      }}
      aria-label="연도 필터"
    >
      {opts.map((y) => (
        <option key={y} value={String(y)}>{y}년</option>
      ))}
      <option value="all">전체</option>
    </select>
  );
}
