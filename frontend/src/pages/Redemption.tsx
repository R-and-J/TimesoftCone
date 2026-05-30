// 복지몰 — 자립형 배포 포인트 소모처(ADR-023).
// 상품 카탈로그 + 교환 + 내 주문 내역.

import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import { useCurrentUser } from "@/lib/current-user";
import {
  listRedemptionItems,
  listMyRedemptionOrders,
  redeemItem,
  getBalance,
  type RedemptionItem,
} from "@/lib/queries";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  FULFILLED: "발급 완료",
  FAILED: "실패",
  REFUNDED: "환불",
};

export default function RedemptionPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const { user } = useCurrentUser();

  const itemsQ = useQuery(() => listRedemptionItems(), []);
  const ordersQ = useQuery(() => listMyRedemptionOrders(user.id), [user.id]);
  const balanceQ = useQuery(() => getBalance(user.id), [user.id]);

  const [confirming, setConfirming] = useState<RedemptionItem | null>(null);
  const [redeeming, setRedeeming] = useState(false);

  const balance = balanceQ.data ? Number(balanceQ.data.balance) : 0;

  // 카테고리별 그룹핑
  const byCategory = new Map<string, RedemptionItem[]>();
  for (const it of itemsQ.data ?? []) {
    const k = it.category ?? "기타";
    if (!byCategory.has(k)) byCategory.set(k, []);
    byCategory.get(k)!.push(it);
  }

  const doRedeem = async () => {
    if (!confirming) return;
    if (balance < Number(confirming.priceP)) {
      toast.push("error", `잔액 부족 (현재 ${fmt.point(balance)}P)`);
      return;
    }
    setRedeeming(true);
    try {
      const r = await redeemItem(confirming.id);
      toast.push("success", `${r.itemName} 교환 완료 — 쿠폰 ${r.deliveryRef}`);
      setConfirming(null);
      await Promise.all([itemsQ.refetch(), ordersQ.refetch(), balanceQ.refetch()]);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setRedeeming(false);
    }
  };

  return (
    <ScreenFrame>
      <div
        style={{
          width: "100%",
          minHeight: 900,
          background: p.bg,
          fontFamily: FONT.sans,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TopNav p={p} active="redemption" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.bolt size={14} /> 복지몰 · 포인트 교환
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em", marginTop: 4 }}>
                내 포인트로 교환
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                자립형 배포 보완(ADR-023) · 복지몰 없는 회사를 위한 내부 소모처
              </div>
            </div>
            <Card p={p} padding={16} style={{ minWidth: 220 }}>
              <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>현재 잔액</div>
              <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: p.ink, marginTop: 2, letterSpacing: "-0.02em" }}>
                {fmt.point(balance)}<span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>P</span>
              </div>
            </Card>
          </div>

          {/* 카탈로그 — 카테고리별 그룹 */}
          {[...byCategory.entries()].map(([cat, list]) => (
            <div key={cat} style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em", marginBottom: 10 }}>
                {cat}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {list.map((it) => {
                  const price = Number(it.priceP);
                  const canBuy = balance >= price && (it.stock === null || it.stock > 0);
                  const outOfStock = it.stock !== null && it.stock <= 0;
                  return (
                    <Card key={it.id} p={p} padding={16} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: p.ink, flex: 1 }}>{it.name}</div>
                        {it.stock !== null && (
                          <Pill p={p} tone={outOfStock ? "warn" : "neutral"} size="sm" style={{ fontSize: 10 }}>
                            {outOfStock ? "품절" : `재고 ${it.stock}`}
                          </Pill>
                        )}
                      </div>
                      {it.description && (
                        <div style={{ fontSize: 11, color: p.inkMuted, lineHeight: 1.5 }}>{it.description}</div>
                      )}
                      <div className="mono" style={{ fontSize: 18, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em", marginTop: 4 }}>
                        {fmt.point(price)}<span style={{ fontSize: 11, color: p.inkMuted, marginLeft: 3 }}>P</span>
                      </div>
                      <Btn
                        p={p}
                        variant="primary"
                        size="md"
                        disabled={!canBuy}
                        onClick={() => setConfirming(it)}
                        style={{ marginTop: 4 }}
                      >
                        {outOfStock ? "품절" : balance < price ? "잔액 부족" : "교환하기"}
                      </Btn>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {/* 내 주문 내역 */}
          <Card p={p} padding={0} style={{ marginTop: 8 }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${p.line}` }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em" }}>내 교환 내역</div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>
                {ordersQ.data?.length ?? 0}건
              </div>
            </div>
            <div>
              {ordersQ.data?.length === 0 && (
                <div style={{ padding: 24, textAlign: "center", color: p.inkMuted, fontSize: 13 }}>
                  아직 교환 내역이 없습니다.
                </div>
              )}
              {ordersQ.data?.map((o, i) => (
                <div
                  key={o.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 140px 130px 110px",
                    padding: "14px 20px",
                    fontSize: 12,
                    alignItems: "center",
                    borderBottom: i === (ordersQ.data?.length ?? 0) - 1 ? "none" : `1px solid ${p.line}`,
                  }}
                >
                  <div>
                    <div style={{ color: p.ink, fontWeight: 700 }}>{o.itemName}</div>
                    <div className="mono" style={{ color: p.inkMuted, fontSize: 10, marginTop: 2 }}>{o.deliveryRef ?? "—"}</div>
                  </div>
                  <div className="mono" style={{ color: p.inkSoft }}>{fmt.point(Number(o.pricePAtRedeem))}P</div>
                  <div style={{ color: p.inkMuted, fontSize: 11 }}>
                    {new Date(o.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <Pill
                      p={p}
                      tone={o.status === "FULFILLED" ? "accent" : o.status === "FAILED" ? "warn" : "neutral"}
                      size="sm"
                      style={{ fontSize: 10, fontWeight: 700 }}
                    >
                      {STATUS_LABEL[o.status] ?? o.status}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* 교환 확인 모달 */}
      {confirming && (
        <div
          onClick={() => !redeeming && setConfirming(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420, background: p.surface, borderRadius: 16, padding: 24,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 6 }}>교환 확인</div>
            <div style={{ fontSize: 13, color: p.inkSoft, marginBottom: 18, lineHeight: 1.5 }}>
              <strong>{confirming.name}</strong>을(를) <span className="mono">{fmt.point(Number(confirming.priceP))}P</span>로 교환합니다.
              {confirming.description && (<><br /><span style={{ fontSize: 12, color: p.inkMuted }}>{confirming.description}</span></>)}
            </div>
            <div style={{ padding: 12, background: p.bg, borderRadius: 10, marginBottom: 18, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.inkSoft, marginBottom: 6 }}>
                <span>교환 전 잔액</span><span className="mono">{fmt.point(balance)}P</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.danger, marginBottom: 6 }}>
                <span>차감</span><span className="mono">−{fmt.point(Number(confirming.priceP))}P</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.ink, fontWeight: 700, borderTop: `1px solid ${p.line}`, paddingTop: 6 }}>
                <span>교환 후 잔액</span><span className="mono">{fmt.point(balance - Number(confirming.priceP))}P</span>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" disabled={redeeming} onClick={() => setConfirming(null)}>취소</Btn>
              <Btn p={p} variant="primary" size="md" disabled={redeeming || balance < Number(confirming.priceP)} onClick={doRedeem}>
                {redeeming ? "교환 중…" : "교환하기"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}
