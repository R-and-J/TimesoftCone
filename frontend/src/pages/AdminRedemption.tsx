// 관리자 교환 신청 워크플로(ADR-023 v2) — PENDING 처리(승인+쿠폰/반려), RECEIVED 종결 확인.

import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import {
  listAdminRedemptionRequests,
  approveRedemptionRequest,
  rejectRedemptionRequest,
  getRedemptionSummary,
  type RedemptionRequestRow,
  type RedemptionRequestStatus,
} from "@/lib/queries";

type FilterStatus = RedemptionRequestStatus | "ALL";

const STATUS_LABEL: Record<RedemptionRequestStatus, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  RECEIVED: "수령 완료",
  REJECTED: "반려",
};

const COLS = "60px 1.1fr 1.2fr 110px 1.4fr 120px 200px";

export default function AdminRedemptionPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const reqsQ = useQuery(
    () => listAdminRedemptionRequests(filter === "ALL" ? undefined : filter),
    [filter],
  );
  const summaryQ = useQuery(() => getRedemptionSummary(), []);
  const [acting, setActing] = useState<number | null>(null);
  const [modal, setModal] = useState<{ id: number; mode: "approve" | "reject" } | null>(null);
  const [coupon, setCoupon] = useState("");
  const [note, setNote] = useState("");

  const statusTone = (s: RedemptionRequestStatus): "neutral" | "accent" | "warn" | "success" => {
    if (s === "PENDING") return "neutral";
    if (s === "APPROVED") return "accent";
    if (s === "RECEIVED") return "success";
    return "warn";
  };

  const openModal = (req: RedemptionRequestRow, mode: "approve" | "reject") => {
    setModal({ id: req.id, mode });
    setCoupon("");
    setNote("");
  };

  const decide = async () => {
    if (!modal) return;
    setActing(modal.id);
    try {
      if (modal.mode === "approve") {
        if (!coupon.trim()) {
          toast.push("error", "쿠폰/안내문을 입력해주세요");
          setActing(null);
          return;
        }
        await approveRedemptionRequest(modal.id, coupon.trim(), note.trim() || undefined);
        toast.push("success", "승인됨 — 요청자에게 쿠폰 알림");
      } else {
        if (!note.trim()) {
          toast.push("error", "반려 사유를 입력해주세요");
          setActing(null);
          return;
        }
        const r = await rejectRedemptionRequest(modal.id, note.trim());
        toast.push("success", `반려 — ${fmt.point(Number(r.refundedP))}P 환불됨`);
      }
      setModal(null);
      setCoupon("");
      setNote("");
      await Promise.all([reqsQ.refetch(), summaryQ.refetch()]);
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setActing(null);
    }
  };

  return (
    <ScreenFrame>
      <div style={{ width: "100%", minHeight: 900, background: p.bg, fontFamily: FONT.sans, display: "flex", flexDirection: "column" }}>
        <TopNav p={p} active="admin" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <AdminTabs p={p} active="redemption" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.shield size={14} /> 교환 신청
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em", marginTop: 4 }}>
                교환 신청 처리
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                승인 시 쿠폰/안내문을 박아 발급 → 요청자가 [수령 완료]를 누르면 종결. 반려 시 자동 환불.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["PENDING", "APPROVED", "RECEIVED", "REJECTED", "ALL"] as FilterStatus[]).map((s) => {
                const on = s === filter;
                return (
                  <div
                    key={s}
                    onClick={() => !on && setFilter(s)}
                    style={{
                      padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 700,
                      color: on ? p.surface : p.inkMuted, background: on ? p.ink : p.surface,
                      border: `1px solid ${on ? p.ink : p.line}`, cursor: on ? "default" : "pointer",
                    }}
                  >
                    {s === "ALL" ? "전체" : STATUS_LABEL[s as RedemptionRequestStatus]}
                  </div>
                );
              })}
            </div>
          </div>

          {/* KPI 4칸 — 카드 클릭 시 해당 상태로 필터 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <SummaryCard
              p={p}
              label="대기"
              value={summaryQ.data?.pending ?? "—"}
              tone={(summaryQ.data?.pending ?? 0) > 0 ? "alert" : "neutral"}
              active={filter === "PENDING"}
              onClick={() => setFilter("PENDING")}
            />
            <SummaryCard
              p={p}
              label="승인 (수령 대기)"
              value={summaryQ.data?.approved ?? "—"}
              tone="accent"
              active={filter === "APPROVED"}
              onClick={() => setFilter("APPROVED")}
            />
            <SummaryCard
              p={p}
              label="수령 완료"
              value={summaryQ.data?.received ?? "—"}
              tone="success"
              active={filter === "RECEIVED"}
              onClick={() => setFilter("RECEIVED")}
            />
            <SummaryCard
              p={p}
              label="반려 (환불)"
              value={summaryQ.data?.rejected ?? "—"}
              tone="warn"
              active={filter === "REJECTED"}
              onClick={() => setFilter("REJECTED")}
            />
          </div>

          <Card p={p} padding={0}>
            <div
              style={{
                display: "grid", gridTemplateColumns: COLS,
                padding: "12px 20px", fontSize: 11, color: p.inkMuted,
                fontWeight: 700, letterSpacing: 0.4,
                borderBottom: `1px solid ${p.line}`, background: p.bg,
              }}
            >
              <div>#</div>
              <div>요청자</div>
              <div>상품</div>
              <div style={{ textAlign: "right" }}>가격</div>
              <div>메모 / 쿠폰 / 결정</div>
              <div>상태</div>
              <div style={{ textAlign: "right" }}>작업</div>
            </div>
            <div style={{ maxHeight: 600, overflow: "auto" }}>
              {reqsQ.error && (
                <div style={{ padding: 24, color: p.danger, fontSize: 13, fontWeight: 700 }}>{reqsQ.error.message}</div>
              )}
              {!reqsQ.error && reqsQ.data?.length === 0 && !reqsQ.loading && (
                <div style={{ padding: 24, color: p.inkMuted, fontSize: 13, textAlign: "center" }}>
                  {filter === "PENDING" ? "대기 중인 신청이 없습니다." : "신청이 없습니다."}
                </div>
              )}
              {reqsQ.data?.map((r, i) => {
                const zebra = i % 2 === 1;
                const isPending = r.status === "PENDING";
                return (
                  <div
                    key={r.id}
                    style={{
                      display: "grid", gridTemplateColumns: COLS,
                      padding: "13px 20px", fontSize: 12, alignItems: "center",
                      background: zebra ? p.bg : p.surface,
                      borderBottom: `1px solid ${p.line}`,
                    }}
                  >
                    <div className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>#{r.id}</div>
                    <div>
                      <div style={{ color: p.ink, fontWeight: 700 }}>{r.userName}</div>
                      <div className="mono" style={{ color: p.inkMuted, fontSize: 10, marginTop: 2 }}>
                        {new Date(r.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                    <div style={{ color: p.ink, fontWeight: 600 }}>{r.itemName}</div>
                    <div className="mono" style={{ textAlign: "right", color: p.ink, fontWeight: 700 }}>
                      {fmt.point(Number(r.pricePAtRequest))}P
                    </div>
                    <div style={{ color: p.inkSoft, fontSize: 11, lineHeight: 1.4 }}>
                      {r.note && <div>메모: {r.note}</div>}
                      {r.couponCode && (
                        <div className="mono" style={{ color: p.ink, marginTop: 3, wordBreak: "break-all" }}>
                          쿠폰: {r.couponCode}
                        </div>
                      )}
                      {r.decisionNote && <div style={{ color: p.inkMuted, marginTop: 3 }}>결정: {r.decisionNote}</div>}
                      {r.decidedByName && (
                        <div style={{ color: p.inkMuted, fontSize: 10, marginTop: 3 }}>
                          by {r.decidedByName} · {r.decidedAt ? new Date(r.decidedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      )}
                      {r.receivedAt && (
                        <div style={{ color: p.success, fontSize: 10, marginTop: 3, fontWeight: 700 }}>
                          수령 {new Date(r.receivedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      )}
                    </div>
                    <div>
                      <Pill p={p} tone={statusTone(r.status)} size="sm" style={{ fontSize: 10, fontWeight: 700 }}>
                        {STATUS_LABEL[r.status]}
                      </Pill>
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {isPending ? (
                        <>
                          <Btn p={p} variant="primary" size="sm" disabled={acting === r.id} onClick={() => openModal(r, "approve")}>승인</Btn>
                          <Btn p={p} variant="ghost" size="sm" disabled={acting === r.id} onClick={() => openModal(r, "reject")}>반려</Btn>
                        </>
                      ) : (
                        <span style={{ color: p.inkMuted, fontSize: 11 }}>—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {modal && (
        <div
          onClick={() => acting !== modal.id && setModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 460, background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)" }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 6 }}>
              {modal.mode === "approve" ? "교환 승인 + 쿠폰 발급" : "교환 반려 + 환불"}
            </div>
            <div style={{ fontSize: 13, color: p.inkSoft, marginBottom: 14 }}>
              신청 #{modal.id} — {modal.mode === "approve" ? "쿠폰 텍스트가 사용자에게 그대로 전달됩니다." : "포인트 환불 + 사유 전달."}
            </div>

            {modal.mode === "approve" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>
                  쿠폰 / 안내문 <span style={{ color: p.danger }}>*</span>
                </div>
                <textarea
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder={"예: ABCD-1234-EFGH-5678\n또는 외부 플랫폼에서 결제 후 받은 쿠폰번호/링크"}
                  rows={3}
                  maxLength={500}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 9,
                    border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.bg,
                    boxSizing: "border-box", fontFamily: "ui-monospace, SF Mono, Consolas, monospace", resize: "vertical",
                  }}
                />
              </div>
            )}

            <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>
              {modal.mode === "approve" ? "비고 (선택)" : (
                <>반려 사유 <span style={{ color: p.danger }}>*</span></>
              )}
            </div>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={modal.mode === "approve" ? "예: 사이즈 L 확인됨" : "예: 재고 변경으로 발급 불가"}
              rows={2}
              maxLength={200}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 9,
                border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.bg,
                boxSizing: "border-box", fontFamily: "inherit", resize: "vertical",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Btn p={p} variant="ghost" size="md" disabled={acting === modal.id} onClick={() => setModal(null)}>취소</Btn>
              <Btn
                p={p}
                variant={modal.mode === "approve" ? "primary" : "dark"}
                size="md"
                disabled={acting === modal.id}
                onClick={decide}
              >
                {acting === modal.id ? "처리 중…" : modal.mode === "approve" ? "승인 + 발급" : "반려 + 환불"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}

type Palette = typeof PALETTES.cobalt;

function SummaryCard({
  p,
  label,
  value,
  tone,
  active,
  onClick,
}: {
  p: Palette;
  label: string;
  value: string | number;
  tone: "neutral" | "accent" | "success" | "warn" | "alert";
  active?: boolean;
  onClick: () => void;
}) {
  const valueColor =
    tone === "alert"
      ? p.warn
      : tone === "accent"
        ? p.accent
        : tone === "success"
          ? p.success
          : tone === "warn"
            ? p.warn
            : p.ink;
  return (
    <Card
      p={p}
      padding={16}
      onClick={onClick}
      style={{
        cursor: "pointer",
        outline: active ? `2px solid ${p.ink}` : "none",
        outlineOffset: -1,
      }}
    >
      <div style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>{label}</div>
      <div
        className="mono"
        style={{ fontSize: 26, fontWeight: 800, color: valueColor, marginTop: 4, letterSpacing: "-0.02em" }}
      >
        {value}
      </div>
      <div style={{ fontSize: 10, color: p.inkMuted, marginTop: 2 }}>
        {active ? "선택됨 · 클릭으로 필터 유지" : "클릭하면 이 상태만 보기"}
      </div>
    </Card>
  );
}
