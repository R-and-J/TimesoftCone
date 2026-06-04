// 관리자 화면 서브탭 — 운영 / 원장 / 회원 / 충전 / 교환 / 경매. 관리자 페이지들 사이 이동.
// 처리 대기 카운트는 탭 자체에 뱃지로 — 어느 admin 화면에 있든 "할 일"이 보이게.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Palette } from "@/lib/tokens";
import { getAdminStats } from "@/lib/queries";

type AdminTab = "ops" | "ledger" | "members" | "redemption" | "auctions" | "store";

// 사람 → 매물 → 상품(스토어) → 그 후속 신청 → 원장 흐름.
const TABS: { id: AdminTab; label: string; route: string }[] = [
  { id: "ops", label: "운영", route: "/admin/ops" },
  { id: "members", label: "회원관리", route: "/admin/members" },
  { id: "auctions", label: "경매관리", route: "/admin/auctions" },
  { id: "store", label: "스토어", route: "/admin/store" },
  { id: "redemption", label: "교환 신청", route: "/admin/redemption" },
  { id: "ledger", label: "원장", route: "/admin/ledger" },
];

export function AdminTabs({ p, active }: { p: Palette; active: AdminTab }) {
  const navigate = useNavigate();
  // 처리 대기 카운트(현재는 교환 신청만). 다른 탭에 필요해지면 여기서 같이 노출.
  const [redemptionPending, setRedemptionPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const s = await getAdminStats();
        if (!cancelled) setRedemptionPending(s.redemptionPending);
      } catch {
        /* 뱃지 실패는 무시 — 탭 자체는 보여야 함 */
      }
    };
    void load();
    const t = setInterval(load, 30000); // 30초 폴링
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
      {TABS.map((t) => {
        const on = t.id === active;
        const badge = t.id === "redemption" && redemptionPending && redemptionPending > 0 ? redemptionPending : null;
        return (
          <div
            key={t.id}
            onClick={() => !on && navigate(t.route)}
            style={{
              position: "relative",
              padding: "8px 16px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 700,
              color: on ? p.surface : p.inkMuted,
              background: on ? p.ink : p.surface,
              border: `1px solid ${on ? p.ink : p.line}`,
              cursor: on ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {badge != null && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 9,
                  background: p.warn,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
