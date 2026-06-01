// 관리자 화면 서브탭 — 운영 / 원장 / 회원. 관리자 페이지들 사이 이동.
import { useNavigate } from "react-router-dom";
import type { Palette } from "@/lib/tokens";

type AdminTab = "ops" | "ledger" | "members" | "charges" | "redemption" | "auctions";

const TABS: { id: AdminTab; label: string; route: string }[] = [
  { id: "ops", label: "운영", route: "/admin/ops" },
  { id: "ledger", label: "원장", route: "/admin/ledger" },
  { id: "members", label: "회원관리", route: "/admin/members" },
  { id: "charges", label: "충전 요청", route: "/admin/charges" },
  { id: "redemption", label: "교환 신청", route: "/admin/redemption" },
  { id: "auctions", label: "경매관리", route: "/admin/auctions" },
];

export function AdminTabs({ p, active }: { p: Palette; active: AdminTab }) {
  const navigate = useNavigate();
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
      {TABS.map((t) => {
        const on = t.id === active;
        return (
          <div
            key={t.id}
            onClick={() => !on && navigate(t.route)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: on ? p.surface : p.inkMuted,
              background: on ? p.ink : p.surface,
              border: `1px solid ${on ? p.ink : p.line}`,
              cursor: on ? "default" : "pointer",
            }}
          >
            {t.label}
          </div>
        );
      })}
    </div>
  );
}
