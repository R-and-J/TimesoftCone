// 스쿱 마켓 — 자립형 배포 콘 소모처(ADR-023 v2 코드명: Redemption).
// 흐름: PENDING(차감/잠금) → APPROVED(쿠폰 발급) → RECEIVED(사용자 수령 컨펌)
//                       ↘ REJECTED(환불)

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
  listMyRedemptionRequests,
  submitRedemptionRequest,
  submitCustomRedemptionRequest,
  confirmRedemptionReceived,
  getBalance,
  type RedemptionItem,
  type RedemptionRequestRow,
} from "@/lib/queries";

const STATUS_LABEL: Record<RedemptionRequestRow["status"], string> = {
  PENDING: "검토 대기",
  APPROVED: "수령 가능",
  RECEIVED: "수령 완료",
  REJECTED: "반려",
};

export default function RedemptionPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const { user } = useCurrentUser();

  const itemsQ = useQuery(() => listRedemptionItems(), []);
  const requestsQ = useQuery(() => listMyRedemptionRequests(), [user.id]);
  const balanceQ = useQuery(() => getBalance(user.id), [user.id]);

  const [confirming, setConfirming] = useState<RedemptionItem | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingReceiptId, setConfirmingReceiptId] = useState<number | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  // 자유 신청("원하는대로 담기") 상태.
  const [wishOpen, setWishOpen] = useState(false);
  const [wishName, setWishName] = useState("");
  const [wishPrice, setWishPrice] = useState("");
  const [wishNote, setWishNote] = useState("");
  const [wishSubmitting, setWishSubmitting] = useState(false);

  const balance = balanceQ.data ? Number(balanceQ.data.balance) : 0;

  // 자유 신청용 placeholder("CUSTOM-WISH")는 카테고리 그룹에서 분리해 페이지 맨 아래에 별도 카드로.
  const allItems = itemsQ.data ?? [];
  const wishItem = allItems.find((it) => it.sku === "CUSTOM-WISH") ?? null;
  const catalogItems = allItems.filter((it) => it.sku !== "CUSTOM-WISH");
  const byCategory = new Map<string, RedemptionItem[]>();
  for (const it of catalogItems) {
    const k = it.category ?? "기타";
    if (!byCategory.has(k)) byCategory.set(k, []);
    byCategory.get(k)!.push(it);
  }

  const doSubmit = async () => {
    if (!confirming) return;
    if (balance < Number(confirming.priceP)) {
      toast.push("error", `잔액 부족 (현재 ${fmt.point(balance)}콘)`);
      return;
    }
    setSubmitting(true);
    try {
      await submitRedemptionRequest(confirming.id, note.trim() || undefined);
      toast.push("success", `${confirming.name} 담기 완료 — 관리자 승인 대기`);
      setConfirming(null);
      setNote("");
      await Promise.all([itemsQ.refetch(), requestsQ.refetch(), balanceQ.refetch()]);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const doSubmitWish = async () => {
    const name = wishName.trim();
    const priceNum = Number(wishPrice);
    if (!name) {
      toast.push("error", "원하는 물품 이름을 적어주세요");
      return;
    }
    if (!Number.isFinite(priceNum) || !Number.isInteger(priceNum) || priceNum <= 0) {
      toast.push("error", "희망 금액은 양의 정수 콘 값이어야 합니다");
      return;
    }
    if (balance < priceNum) {
      toast.push("error", `잔액 부족 (현재 ${fmt.point(balance)}콘)`);
      return;
    }
    setWishSubmitting(true);
    try {
      await submitCustomRedemptionRequest({ customName: name, customPriceP: priceNum, note: wishNote.trim() || undefined });
      toast.push("success", `"${name}" 제안 완료 — 관리자 승인 대기`);
      setWishOpen(false);
      setWishName("");
      setWishPrice("");
      setWishNote("");
      await Promise.all([requestsQ.refetch(), balanceQ.refetch()]);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setWishSubmitting(false);
    }
  };

  const doConfirmReceived = async (id: number) => {
    setConfirmingReceiptId(id);
    try {
      await confirmRedemptionReceived(id);
      toast.push("success", "수령 완료 처리됐어요");
      await requestsQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setConfirmingReceiptId(null);
    }
  };

  const statusTone = (s: RedemptionRequestRow["status"]): "neutral" | "accent" | "warn" | "success" => {
    if (s === "PENDING") return "neutral";
    if (s === "APPROVED") return "accent";
    if (s === "RECEIVED") return "success";
    return "warn"; // REJECTED
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
          {(() => {
            const approved = (requestsQ.data ?? []).filter((r) => r.status === "APPROVED");
            return (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24, marginBottom: 20 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                    🍦 스쿱 마켓
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em", marginTop: 4 }}>
                    내 콘으로 한 스쿱
                  </div>
                  <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                    담으면 콘이 잠기고, 관리자가 승인하면 쿠폰을 발급합니다. 반려 시 자동 환불.
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 320, flexShrink: 0 }}>
                  <Card p={p} padding={16}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>현재 잔액</div>
                        <div className="mono" style={{ fontSize: 28, fontWeight: 800, color: p.ink, marginTop: 2, letterSpacing: "-0.02em" }}>
                          {fmt.point(balance)}<span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>콘</span>
                        </div>
                      </div>
                      <Btn p={p} variant="ghost" size="sm" onClick={() => setHistoryOpen(true)}>
                        📦 보관함 {(requestsQ.data?.length ?? 0) > 0 ? `(${requestsQ.data!.length})` : ""}
                      </Btn>
                    </div>
                  </Card>
                  {approved.length > 0 && (
                    <Card p={p} padding={16} style={{ border: `2px solid ${p.accent}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: p.ink, marginBottom: 10 }}>
                        <span style={{ fontSize: 14 }}>📦</span>
                        수령 대기 {approved.length}건
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {approved.map((r) => (
                          <div key={r.id} style={{ padding: 10, background: p.bg, borderRadius: 8, border: `1px solid ${p.line}` }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: p.ink, marginBottom: 4 }}>{r.itemName}</div>
                            {r.couponCode && (
                              <div className="mono" style={{ fontSize: 11, color: p.inkSoft, wordBreak: "break-all", marginBottom: 8, lineHeight: 1.4 }}>
                                {r.couponCode}
                              </div>
                            )}
                            <Btn
                              p={p}
                              variant="primary"
                              size="sm"
                              disabled={confirmingReceiptId === r.id}
                              onClick={() => doConfirmReceived(r.id)}
                              style={{ width: "100%" }}
                            >
                              {confirmingReceiptId === r.id ? "처리 중…" : "수령 완료"}
                            </Btn>
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                </div>
              </div>
            );
          })()}

          {/* 카탈로그 — 카테고리별로 그룹화, 카테고리 색·이모지 액센트, 카드 호버 강조. */}
          {[...byCategory.entries()].map(([cat, list]) => {
            const accent = categoryAccent(cat);
            return (
              <div key={cat} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{accent.emoji}</span>
                  <div style={{ fontSize: 15, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em" }}>{cat}</div>
                  <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${accent.bg} 0%, transparent 100%)` }} />
                  <span style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{list.length}개</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                  {list.map((it) => {
                    const price = Number(it.priceP);
                    const canBuy = balance >= price && (it.stock === null || it.stock > 0);
                    const outOfStock = it.stock !== null && it.stock <= 0;
                    return (
                      <div
                        key={it.id}
                        onMouseEnter={(e) => {
                          if (!canBuy) return;
                          e.currentTarget.style.transform = "translateY(-2px)";
                          e.currentTarget.style.boxShadow = "0 10px 24px rgba(11,25,41,0.10)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow = "";
                        }}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          overflow: "hidden",
                          borderTop: `3px solid ${accent.bg}`,
                          borderRadius: 12,
                          background: p.surface,
                          border: `1px solid ${p.line}`,
                          transition: "transform 140ms ease, box-shadow 140ms ease",
                        }}
                      >
                        <div style={{ padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {it.brand && (
                                <div style={{ fontSize: 10, fontWeight: 700, color: accent.fg, letterSpacing: 0.3, marginBottom: 2, textTransform: "uppercase" }}>
                                  {it.brand}
                                </div>
                              )}
                              <div style={{ fontSize: 14, fontWeight: 700, color: p.ink, lineHeight: 1.3 }}>{it.name}</div>
                            </div>
                            {it.stock !== null && (
                              <Pill p={p} tone={outOfStock ? "warn" : "neutral"} size="sm" style={{ fontSize: 10, flexShrink: 0 }}>
                                {outOfStock ? "품절" : `재고 ${it.stock}`}
                              </Pill>
                            )}
                          </div>
                          {it.description && (
                            <div style={{ fontSize: 11, color: p.inkMuted, lineHeight: 1.5, wordBreak: "keep-all" }}>{it.description}</div>
                          )}
                          <div style={{ flex: 1 }} />
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginTop: 6 }}>
                            <span className="mono" style={{ fontSize: 22, fontWeight: 800, color: p.ink, letterSpacing: "-0.02em" }}>
                              {fmt.point(price)}
                            </span>
                            <span style={{ fontSize: 12, color: p.inkMuted, fontWeight: 600 }}>콘</span>
                          </div>
                        </div>
                        <div style={{ padding: "0 16px 14px" }}>
                          <Btn
                            p={p}
                            variant="primary"
                            size="md"
                            full
                            disabled={!canBuy}
                            onClick={() => setConfirming(it)}
                          >
                            {outOfStock ? "품절" : balance < price ? "잔액 부족" : "한 스쿱 담기"}
                          </Btn>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* "원하는대로 담기" — 카탈로그 맨 아래 자유 신청 카드. 카테고리 그룹 밖. */}
          {wishItem && (
            <div style={{ marginTop: 8, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>✨</span>
                <div style={{ fontSize: 15, fontWeight: 800, color: p.ink, letterSpacing: "-0.01em" }}>원하는대로 담기</div>
                <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${p.accent} 0%, transparent 100%)` }} />
                <span style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>자유 제안</span>
              </div>
              <div
                onClick={() => setWishOpen(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 10px 24px rgba(11,25,41,0.10)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "";
                }}
                style={{
                  padding: "20px 24px",
                  borderRadius: 14,
                  background: `linear-gradient(135deg, ${p.accentSoft} 0%, ${p.surface} 100%)`,
                  border: `2px dashed ${p.accent}`,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  transition: "transform 140ms ease, box-shadow 140ms ease",
                }}
              >
                <div style={{ fontSize: 32, lineHeight: 1 }}>🍨</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: p.ink, marginBottom: 4 }}>
                    카탈로그에 없는 걸 원하시나요?
                  </div>
                  <div style={{ fontSize: 12, color: p.inkSoft, lineHeight: 1.5 }}>
                    물품 이름과 희망 콘 금액을 직접 적어서 신청해보세요. 관리자가 검토 후 안내문을 발급합니다.
                  </div>
                </div>
                <Btn p={p} variant="primary" size="md" onClick={() => setWishOpen(true)}>
                  직접 제안
                </Btn>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* 자유 신청 모달 */}
      {wishOpen && (
        <div
          onClick={() => !wishSubmitting && setWishOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 460, background: p.surface, borderRadius: 16, padding: 24,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>🍨 원하는대로 담기</div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 16, lineHeight: 1.5 }}>
              희망 금액만큼 콘이 잠기고, 관리자가 승인하면 안내문을 받습니다. 반려 시 자동 환불.
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>물품 이름 *</div>
              <input
                value={wishName}
                onChange={(e) => setWishName(e.target.value)}
                placeholder="예: 무지개 아이스크림 / 헬스장 1개월권"
                maxLength={100}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "inherit",
                  border: `1px solid ${p.line}`, borderRadius: 9, background: p.bg, color: p.ink,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>희망 금액 (콘) *</div>
              <input
                type="number"
                min={1}
                step={100}
                value={wishPrice}
                onChange={(e) => setWishPrice(e.target.value)}
                placeholder="예: 50000"
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "inherit",
                  border: `1px solid ${p.line}`, borderRadius: 9, background: p.bg, color: p.ink,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>요청 사항 (선택)</div>
              <input
                value={wishNote}
                onChange={(e) => setWishNote(e.target.value)}
                placeholder="예: 사이즈 L · 배송지 등"
                maxLength={200}
                style={{
                  width: "100%", padding: "9px 12px", fontSize: 13, fontFamily: "inherit",
                  border: `1px solid ${p.line}`, borderRadius: 9, background: p.bg, color: p.ink,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ padding: 12, background: p.bg, borderRadius: 10, marginBottom: 14, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.inkSoft, marginBottom: 6 }}>
                <span>신청 전 잔액</span><span className="mono">{fmt.point(balance)}콘</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.danger, marginBottom: 6 }}>
                <span>잠금</span>
                <span className="mono">{wishPrice ? `−${fmt.point(Number(wishPrice))}콘` : "—"}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.ink, fontWeight: 700, borderTop: `1px solid ${p.line}`, paddingTop: 6 }}>
                <span>잠금 후 잔액</span>
                <span className="mono">{wishPrice ? `${fmt.point(balance - Number(wishPrice))}콘` : `${fmt.point(balance)}콘`}</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" disabled={wishSubmitting} onClick={() => setWishOpen(false)}>취소</Btn>
              <Btn p={p} variant="primary" size="md" disabled={wishSubmitting} onClick={doSubmitWish}>
                {wishSubmitting ? "담는 중…" : "제안하기"}
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* 보관함 모달 — 모든 신청 내역(PENDING / APPROVED / RECEIVED / REJECTED) */}
      {historyOpen && (
        <div
          onClick={() => setHistoryOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 720, maxWidth: "92vw", maxHeight: "86vh",
              background: p.surface, borderRadius: 16,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
              display: "flex", flexDirection: "column",
            }}
          >
            <div style={{ padding: "18px 22px", borderBottom: `1px solid ${p.line}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: p.ink }}>📦 내 보관함</div>
                <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>
                  전체 {requestsQ.data?.length ?? 0}건 — 신청·승인·수령·반려 내역
                </div>
              </div>
              <Btn p={p} variant="ghost" size="sm" onClick={() => setHistoryOpen(false)}>닫기</Btn>
            </div>
            <div style={{ overflow: "auto", flex: 1 }}>
              {requestsQ.data?.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: p.inkMuted, fontSize: 13 }}>
                  아직 신청 내역이 없습니다.
                </div>
              )}
              {requestsQ.data?.map((r, i) => {
                const isLast = i === (requestsQ.data?.length ?? 0) - 1;
                return (
                  <div
                    key={r.id}
                    style={{
                      padding: "14px 22px",
                      fontSize: 12,
                      borderBottom: isLast ? "none" : `1px solid ${p.line}`,
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 120px 90px", alignItems: "center", gap: 8 }}>
                      <div>
                        <div style={{ color: p.ink, fontWeight: 700 }}>{r.itemName}</div>
                        {r.note && (
                          <div style={{ color: p.inkMuted, fontSize: 11, marginTop: 2 }}>요청: {r.note}</div>
                        )}
                      </div>
                      <div className="mono" style={{ color: p.inkSoft }}>{fmt.point(Number(r.pricePAtRequest))}콘</div>
                      <div style={{ color: p.inkMuted, fontSize: 11 }}>
                        {new Date(r.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <Pill p={p} tone={statusTone(r.status)} size="sm" style={{ fontSize: 10, fontWeight: 700 }}>
                          {STATUS_LABEL[r.status]}
                        </Pill>
                      </div>
                    </div>

                    {r.status === "APPROVED" && (
                      <div style={{ marginTop: 6, fontSize: 11, color: p.inkMuted }}>
                        우상단 「수령 대기」에서 수령 완료를 진행하세요.
                      </div>
                    )}

                    {r.status === "RECEIVED" && (
                      <div style={{ marginTop: 10, padding: 12, background: p.bg, borderRadius: 8, border: `1px solid ${p.line}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: r.couponCode ? 6 : 0 }}>
                          <div style={{ fontSize: 10, color: p.inkMuted, fontWeight: 700 }}>쿠폰/안내</div>
                          {r.receivedAt && (
                            <div style={{ fontSize: 10, color: p.inkMuted }}>
                              수령 {new Date(r.receivedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          )}
                        </div>
                        {r.couponCode && (
                          <div className="mono" style={{ fontSize: 13, color: p.ink, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                            {r.couponCode}
                          </div>
                        )}
                      </div>
                    )}

                    {r.status === "REJECTED" && (
                      <div style={{ marginTop: 8, padding: 10, background: p.bg, borderRadius: 8, fontSize: 11, color: p.inkSoft }}>
                        <span style={{ color: p.danger, fontWeight: 700 }}>반려</span>
                        {r.decisionNote && <> — {r.decisionNote}</>}
                        <span style={{ color: p.inkMuted }}> · {fmt.point(Number(r.pricePAtRequest))}콘 환불됨</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 신청 확인 모달 */}
      {confirming && (
        <div
          onClick={() => !submitting && setConfirming(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440, background: p.surface, borderRadius: 16, padding: 24,
              boxShadow: "0 20px 60px rgba(11,25,41,0.25)",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 6 }}>한 스쿱 담기</div>
            <div style={{ fontSize: 13, color: p.inkSoft, marginBottom: 14, lineHeight: 1.5 }}>
              <strong>{confirming.name}</strong>을(를) <span className="mono">{fmt.point(Number(confirming.priceP))}콘</span>으로 담습니다.
              {confirming.description && (<><br /><span style={{ fontSize: 12, color: p.inkMuted }}>{confirming.description}</span></>)}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600, marginBottom: 6 }}>요청 사항 (선택)</div>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="배송지, 사이즈 등 특이사항"
                maxLength={200}
                style={{
                  width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "inherit",
                  border: `1px solid ${p.line}`, borderRadius: 8, background: p.bg, color: p.ink,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ padding: 12, background: p.bg, borderRadius: 10, marginBottom: 16, fontSize: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.inkSoft, marginBottom: 6 }}>
                <span>신청 전 잔액</span><span className="mono">{fmt.point(balance)}콘</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.danger, marginBottom: 6 }}>
                <span>잠금</span><span className="mono">−{fmt.point(Number(confirming.priceP))}콘</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", color: p.ink, fontWeight: 700, borderTop: `1px solid ${p.line}`, paddingTop: 6 }}>
                <span>잠금 후 잔액</span><span className="mono">{fmt.point(balance - Number(confirming.priceP))}콘</span>
              </div>
              <div style={{ fontSize: 10, color: p.inkMuted, marginTop: 8, lineHeight: 1.5 }}>
                반려되면 자동 환불됩니다. 승인되면 쿠폰이 이 화면에 표시되고 [수령 완료] 버튼을 눌러 마무리하세요.
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" disabled={submitting} onClick={() => { setConfirming(null); setNote(""); }}>취소</Btn>
              <Btn p={p} variant="primary" size="md" disabled={submitting || balance < Number(confirming.priceP)} onClick={doSubmit}>
                {submitting ? "담는 중…" : "한 스쿱 담기"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}

/** 카테고리 라벨에서 색·이모지 추출 — 키워드 단순 매칭. 새 카테고리는 기본 슬롯. */
function categoryAccent(cat: string): { emoji: string; bg: string; fg: string } {
  const c = cat.toLowerCase();
  if (c.includes("디지털") || c.includes("ai") || c.includes("구독")) {
    return { emoji: "✨", bg: "#7C3AED", fg: "#5B21B6" };
  }
  if (c.includes("식권") || c.includes("식사") || c.includes("도시락")) {
    return { emoji: "🍱", bg: "#16A07A", fg: "#0F7257" };
  }
  if (c.includes("카페") || c.includes("커피")) {
    return { emoji: "☕", bg: "#C2410C", fg: "#9A3412" };
  }
  if (c.includes("기프티콘") || c.includes("선물") || c.includes("상품권")) {
    return { emoji: "🎁", bg: "#E08B19", fg: "#92400E" };
  }
  return { emoji: "🛍️", bg: "#1B64DA", fg: "#1E40AF" };
}
