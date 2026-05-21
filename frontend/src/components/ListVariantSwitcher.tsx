import { useNavigate } from "react-router-dom";
import type { Palette } from "@/lib/tokens";

type Active = "grid" | "row" | "timeline";

const ROUTES: Record<Active, string> = {
  grid: "/auction",
  row: "/auction/row",
  timeline: "/auction/timeline",
};

export function ListVariantSwitcher({ p, active }: { p: Palette; active: Active }) {
  const navigate = useNavigate();
  const items: { id: Active; label: string }[] = [
    { id: "grid", label: "그리드" },
    { id: "row", label: "리스트" },
    { id: "timeline", label: "타임라인" },
  ];
  return (
    <div
      style={{
        display: "flex",
        background: p.surface,
        borderRadius: 12,
        padding: 4,
        border: `1px solid ${p.line}`,
      }}
    >
      {items.map((it) => (
        <div
          key={it.id}
          onClick={() => navigate(ROUTES[it.id])}
          style={{
            padding: "8px 14px",
            fontSize: 13,
            fontWeight: 600,
            background: active === it.id ? p.ink : "transparent",
            color: active === it.id ? "#fff" : p.inkMuted,
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {it.label}
        </div>
      ))}
    </div>
  );
}
