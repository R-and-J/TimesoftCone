// 관리자 교환 신청 워크플로(ADR-023 v2) — PENDING 처리(승인+쿠폰/반려), RECEIVED 종결 확인.

import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { DataGrid } from "@/components/DataGrid";
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
          toast.push("error", "안내문을 입력해주세요");
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
        toast.push("success", `반려 — ${fmt.point(Number(r.refundedP))}콘 환불됨`);
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
                승인 시 안내문 발급 → 요청자가 [수령 완료]를 누르면 종결. 반려 시 자동 환불.
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["ALL", "PENDING", "APPROVED", "RECEIVED", "REJECTED"] as FilterStatus[]).map((s) => {
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

          {/* KPI 4칸 — 카드 클릭 시 해당 상태로 필터, 같은 카드 재클릭 시 전체로 해제 */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
            <SummaryCard
              p={p}
              label="대기"
              value={summaryQ.data?.pending ?? "—"}
              tone={(summaryQ.data?.pending ?? 0) > 0 ? "alert" : "neutral"}
              active={filter === "PENDING"}
              onClick={() => setFilter((f) => (f === "PENDING" ? "ALL" : "PENDING"))}
            />
            <SummaryCard
              p={p}
              label="승인 (수령 대기)"
              value={summaryQ.data?.approved ?? "—"}
              tone="accent"
              active={filter === "APPROVED"}
              onClick={() => setFilter((f) => (f === "APPROVED" ? "ALL" : "APPROVED"))}
            />
            <SummaryCard
              p={p}
              label="수령 완료"
              value={summaryQ.data?.received ?? "—"}
              tone="success"
              active={filter === "RECEIVED"}
              onClick={() => setFilter((f) => (f === "RECEIVED" ? "ALL" : "RECEIVED"))}
            />
            <SummaryCard
              p={p}
              label="반려 (환불)"
              value={summaryQ.data?.rejected ?? "—"}
              tone="warn"
              active={filter === "REJECTED"}
              onClick={() => setFilter((f) => (f === "REJECTED" ? "ALL" : "REJECTED"))}
            />
          </div>

          <DataGrid<RedemptionRequestRow>
            p={p}
            rows={reqsQ.data ?? []}
            rowKey={(r) => r.id}
            loading={reqsQ.loading}
            error={reqsQ.error}
            emptyText={filter === "PENDING" ? "대기 중인 신청이 없습니다." : "신청이 없습니다."}
            maxHeight={600}
            rowAlign="start"
            columnGap={20}
            rowPadding="14px 20px"
            columns={[
              {
                key: "id",
                header: "#",
                width: "60px",
                render: (r) => (
                  <span className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>#{r.id}</span>
                ),
              },
              {
                key: "user",
                header: "요청자",
                width: "1.1fr",
                render: (r) => (
                  <>
                    <div style={{ color: p.ink, fontWeight: 700 }}>{r.userName}</div>
                    <div className="mono" style={{ color: p.inkMuted, fontSize: 10, marginTop: 2 }}>
                      {new Date(r.createdAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </>
                ),
              },
              {
                key: "item",
                header: "상품",
                width: "1.2fr",
                render: (r) => <span style={{ color: p.ink, fontWeight: 600 }}>{r.itemName}</span>,
              },
              {
                key: "price",
                header: "가격",
                width: "120px",
                align: "left",
                render: (r) => (
                  <span className="mono" style={{ color: p.ink, fontWeight: 700 }}>
                    {fmt.point(Number(r.pricePAtRequest))}콘
                  </span>
                ),
              },
              {
                key: "note",
                header: "사용자 요청",
                width: "1fr",
                render: (r) => (
                  <div style={{ color: p.inkSoft, fontSize: 11, lineHeight: 1.5, wordBreak: "keep-all", overflowWrap: "break-word" }}>
                    {r.note || <span style={{ color: p.inkMuted }}>—</span>}
                  </div>
                ),
              },
              {
                key: "coupon",
                // 승인 행: 안내문/쿠폰코드(r.couponCode). 반려 행: 반려 사유(r.decisionNote).
                // keep-all + overflow-wrap 으로 한글은 어절 단위로 자연스럽게 줄바꿈.
                header: "안내문",
                width: "1.6fr",
                render: (r) => {
                  const text = r.status === "REJECTED" ? r.decisionNote : r.couponCode;
                  return (
                    <div style={{ color: p.ink, fontSize: 11, lineHeight: 1.5, wordBreak: "keep-all", overflowWrap: "anywhere" }}>
                      {text || <span style={{ color: p.inkMuted }}>—</span>}
                    </div>
                  );
                },
              },
              {
                key: "status",
                header: "상태",
                width: "180px",
                render: (r) => (
                  <div style={{ display: "inline-flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
                    <Pill p={p} tone={statusTone(r.status)} size="sm" style={{ fontSize: 10, fontWeight: 700 }}>
                      {STATUS_LABEL[r.status]}
                    </Pill>
                    {r.receivedAt ? (
                      <span style={{ color: p.success, fontSize: 10, fontWeight: 700 }}>
                        수령 {new Date(r.receivedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    ) : r.decidedByName ? (
                      <span style={{ color: p.inkMuted, fontSize: 10 }}>
                        by {r.decidedByName}
                        {r.decidedAt && ` · ${new Date(r.decidedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}`}
                      </span>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "actions",
                header: "작업",
                width: "200px",
                align: "right",
                render: (r) =>
                  r.status === "PENDING" ? (
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                      <Btn p={p} variant="primary" size="sm" disabled={acting === r.id} onClick={() => openModal(r, "approve")}>승인</Btn>
                      <Btn p={p} variant="ghost" size="sm" disabled={acting === r.id} onClick={() => openModal(r, "reject")}>반려</Btn>
                    </span>
                  ) : (
                    <span style={{ color: p.inkMuted, fontSize: 11 }}>—</span>
                  ),
              },
            ]}
          />
        </div>
      </div>

      {modal && (
        <div
          onClick={() => acting !== modal.id && setModal(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 440, background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)" }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 4 }}>
              {modal.mode === "approve" ? "교환 승인" : "교환 반려"}
            </div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 14 }}>
              신청 #{modal.id} · {modal.mode === "approve" ? "입력한 내용이 그대로 사용자에게 전달됨" : "콘 자동 환불"}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>
              {modal.mode === "approve" ? (
                <>안내문 <span style={{ color: p.danger }}>*</span></>
              ) : (
                <>반려 사유 <span style={{ color: p.danger }}>*</span></>
              )}
            </div>
            <textarea
              value={modal.mode === "approve" ? coupon : note}
              onChange={(e) => modal.mode === "approve" ? setCoupon(e.target.value) : setNote(e.target.value)}
              placeholder={modal.mode === "approve"
                ? "쿠폰 코드 또는 안내문 (예: ABCD-1234 / ID·PW / 외부 결제 링크 등)"
                : "예: 재고 변경으로 발급 불가"}
              rows={3}
              maxLength={modal.mode === "approve" ? 500 : 200}
              style={{
                width: "100%", padding: "10px 12px", borderRadius: 9,
                border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.bg,
                boxSizing: "border-box",
                fontFamily: modal.mode === "approve" ? "ui-monospace, SF Mono, Consolas, monospace" : "inherit",
                resize: "vertical",
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
                {acting === modal.id ? "처리 중…" : modal.mode === "approve" ? "승인" : "반려"}
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
    </Card>
  );
}
