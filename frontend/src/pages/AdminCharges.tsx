// 관리자 충전 요청 워크플로(ADR-024) — 사용자 요청 PENDING 처리(승인/반려).

import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import {
  listAdminChargeRequests,
  approveChargeRequest,
  rejectChargeRequest,
  type ChargeRequestRow,
} from "@/lib/queries";

type FilterStatus = "PENDING" | "APPROVED" | "REJECTED" | "ALL";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기",
  APPROVED: "승인",
  REJECTED: "반려",
};

const COLS = "60px 1.2fr 130px 1.5fr 130px 220px";

export default function AdminChargesPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const [filter, setFilter] = useState<FilterStatus>("PENDING");
  const reqsQ = useQuery(
    () => listAdminChargeRequests(filter === "ALL" ? undefined : filter),
    [filter],
  );
  const [acting, setActing] = useState<number | null>(null); // request id being acted on
  const [noteFor, setNoteFor] = useState<{ id: number; mode: "approve" | "reject" } | null>(null);
  const [noteInput, setNoteInput] = useState("");

  const decide = async (id: number, mode: "approve" | "reject", note: string) => {
    setActing(id);
    try {
      if (mode === "approve") {
        const r = await approveChargeRequest(id, note || undefined);
        toast.push("success", `승인됨 — 요청자 잔액 ${fmt.point(Number(r.newBalance))}P`);
      } else {
        await rejectChargeRequest(id, note || undefined);
        toast.push("success", "반려 처리됨");
      }
      setNoteFor(null);
      setNoteInput("");
      await reqsQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setActing(null);
    }
  };

  const openDecide = (req: ChargeRequestRow, mode: "approve" | "reject") => {
    setNoteFor({ id: req.id, mode });
    setNoteInput("");
  };

  return (
    <ScreenFrame>
      <div style={{ width: "100%", minHeight: 900, background: p.bg, fontFamily: FONT.sans, display: "flex", flexDirection: "column" }}>
        <TopNav p={p} active="admin" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <AdminTabs p={p} active="charges" />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                <Icon.shield size={14} /> 충전 요청 (ADR-024)
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: p.ink, letterSpacing: "-0.025em", marginTop: 4 }}>
                포인트 충전 요청 처리
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                승인 시 자동으로 wallet에 적립 + CREDIT_ADMIN 원장 적재 + 요청자 알림. 정산은 별도(외부).
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(["PENDING", "APPROVED", "REJECTED", "ALL"] as FilterStatus[]).map((s) => {
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
                    {s === "ALL" ? "전체" : STATUS_LABEL[s]}
                  </div>
                );
              })}
            </div>
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
              <div style={{ textAlign: "right" }}>금액</div>
              <div>사유 / 결정</div>
              <div>상태</div>
              <div style={{ textAlign: "right" }}>작업</div>
            </div>
            <div style={{ maxHeight: 600, overflow: "auto" }}>
              {reqsQ.error && (
                <div style={{ padding: 24, color: p.danger, fontSize: 13, fontWeight: 700 }}>{reqsQ.error.message}</div>
              )}
              {!reqsQ.error && reqsQ.data?.length === 0 && !reqsQ.loading && (
                <div style={{ padding: 24, color: p.inkMuted, fontSize: 13, textAlign: "center" }}>
                  {filter === "PENDING" ? "대기 중인 요청이 없습니다." : "요청이 없습니다."}
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
                    <div className="mono" style={{ textAlign: "right", color: p.ink, fontWeight: 700 }}>
                      {fmt.point(Number(r.amount))}P
                    </div>
                    <div style={{ color: p.inkSoft, fontSize: 11, lineHeight: 1.4 }}>
                      {r.note && <div>요청: {r.note}</div>}
                      {!isPending && r.decisionNote && <div style={{ color: p.inkMuted, marginTop: 3 }}>결정: {r.decisionNote}</div>}
                      {!isPending && r.decidedByName && (
                        <div style={{ color: p.inkMuted, fontSize: 10, marginTop: 3 }}>
                          by {r.decidedByName} · {r.decidedAt ? new Date(r.decidedAt).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                        </div>
                      )}
                    </div>
                    <div>
                      <Pill
                        p={p}
                        tone={r.status === "APPROVED" ? "accent" : r.status === "REJECTED" ? "warn" : "neutral"}
                        size="sm"
                        style={{ fontSize: 10, fontWeight: 700 }}
                      >
                        {STATUS_LABEL[r.status]}
                      </Pill>
                    </div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      {isPending ? (
                        <>
                          <Btn p={p} variant="primary" size="sm" disabled={acting === r.id} onClick={() => openDecide(r, "approve")}>승인</Btn>
                          <Btn p={p} variant="ghost" size="sm" disabled={acting === r.id} onClick={() => openDecide(r, "reject")}>반려</Btn>
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

      {/* 결정 모달(승인/반려 공용) */}
      {noteFor && (
        <div
          onClick={() => acting !== noteFor.id && setNoteFor(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(11,25,41,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 420, background: p.surface, borderRadius: 16, padding: 24, boxShadow: "0 20px 60px rgba(11,25,41,0.25)" }}
          >
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 6 }}>
              {noteFor.mode === "approve" ? "충전 승인" : "충전 반려"}
            </div>
            <div style={{ fontSize: 13, color: p.inkSoft, marginBottom: 14 }}>
              요청 #{noteFor.id} — {noteFor.mode === "approve" ? "잔액 적립 + 알림" : "잔액 변화 없음 + 알림"}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>
              결정 사유 (선택, 요청자에게 표시됨)
            </div>
            <textarea
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder={noteFor.mode === "approve" ? "예: 회식비 OK" : "예: 한도 초과로 반려"}
              rows={3}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 9,
                border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.bg,
                boxSizing: "border-box", fontFamily: "inherit", resize: "vertical",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <Btn p={p} variant="ghost" size="md" disabled={acting === noteFor.id} onClick={() => setNoteFor(null)}>취소</Btn>
              <Btn
                p={p}
                variant={noteFor.mode === "approve" ? "primary" : "dark"}
                size="md"
                disabled={acting === noteFor.id}
                onClick={() => decide(noteFor.id, noteFor.mode, noteInput.trim())}
              >
                {acting === noteFor.id ? "처리 중…" : noteFor.mode === "approve" ? "승인" : "반려"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}
