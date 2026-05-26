import { useState } from "react";
import { PALETTES, FONT } from "@/lib/tokens";
import { Btn, Card, Pill, TopNav } from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { AdminTabs } from "@/components/AdminTabs";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import { listMembers, syncMembers } from "@/lib/queries";

const COLS = "120px 1fr 220px 1.2fr 160px 90px";

export default function AdminMembersPage() {
  const p = PALETTES.cobalt;
  const toast = useToast();
  const membersQ = useQuery(() => listMembers(), []);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const doSync = async () => {
    setSyncing(true);
    try {
      const r = await syncMembers();
      setLastSync(new Date(r.at).toLocaleString("ko-KR"));
      toast.push(
        "success",
        `동기화 완료 — 총 ${r.total}명 (신규 ${r.created} · 갱신 ${r.updated})` +
          (r.errors.length ? ` · 오류 ${r.errors.length}` : ""),
      );
      await membersQ.refetch();
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const data = membersQ.data;

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
        <TopNav p={p} active="admin" />
        <div style={{ flex: 1, padding: "24px 40px", overflow: "auto" }}>
          <AdminTabs p={p} active="members" />

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 20,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  color: p.inkMuted,
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Icon.shield size={14} /> 회원관리 · ezpass 미러
              </div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 4,
                }}
              >
                회원 ({data?.total ?? "—"})
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 6 }}>
                신원 정본은 ezpass(ADR-020) · 관리자 {data?.admins ?? "—"}명
                {lastSync ? ` · 마지막 동기화 ${lastSync}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" onClick={() => membersQ.refetch()}>
                새로고침
              </Btn>
              <Btn p={p} variant="dark" size="md" disabled={syncing} onClick={doSync}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Icon.bolt size={14} />
                  {syncing ? "동기화 중…" : "지금 동기화"}
                </span>
              </Btn>
            </div>
          </div>

          <div
            style={{
              padding: 12,
              background: "#FFF4E0",
              borderRadius: 10,
              fontSize: 12,
              color: p.warn,
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            <strong>⚠ 읽기 전용 (위임형)</strong>{" "}
            <span style={{ color: p.inkSoft, fontWeight: 500 }}>
              회원 추가·수정은 ezpass(그룹웨어)에서 합니다. 여기서는 미러된 명단을 보고
              「지금 동기화」로 최신 상태를 당겨옵니다. 연차·경매금은 우리 시스템이 소유합니다.
            </span>
          </div>

          <Card p={p} padding={0} style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                padding: "12px 20px",
                fontSize: 11,
                color: p.inkMuted,
                fontWeight: 700,
                letterSpacing: 0.4,
                borderBottom: `1px solid ${p.line}`,
                background: p.bg,
              }}
            >
              <div>사번</div>
              <div>이름</div>
              <div>이메일</div>
              <div>부서</div>
              <div>직급 / 직책</div>
              <div style={{ textAlign: "right" }}>권한</div>
            </div>
            <div style={{ overflow: "auto", maxHeight: 560 }}>
              {membersQ.error && (
                <div style={{ padding: 24, color: p.danger, fontSize: 13, fontWeight: 700 }}>
                  {membersQ.error.message}
                </div>
              )}
              {!membersQ.error && data?.members.length === 0 && !membersQ.loading && (
                <div style={{ padding: 24, color: p.inkMuted, fontSize: 13, textAlign: "center" }}>
                  미러된 회원이 없습니다. 「지금 동기화」를 눌러 ezpass에서 가져오세요.
                </div>
              )}
              {data?.members.map((m, i) => {
                const zebra = i % 2 === 1;
                const isAdmin = m.role === "ADMIN";
                const rankTitle = [m.jobRank, m.jobTitle].filter(Boolean).join(" / ") || "—";
                return (
                  <div
                    key={m.userId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: COLS,
                      padding: "13px 20px",
                      fontSize: 12,
                      alignItems: "center",
                      background: zebra ? p.bg : p.surface,
                      borderBottom: `1px solid ${p.line}`,
                    }}
                  >
                    <div className="mono" style={{ color: p.inkMuted, fontWeight: 600 }}>
                      {m.empId}
                    </div>
                    <div style={{ color: p.ink, fontWeight: 700 }}>{m.name}</div>
                    <div className="mono" style={{ color: p.inkSoft, fontSize: 11 }}>
                      {m.email ?? "—"}
                    </div>
                    <div style={{ color: p.inkSoft }}>{m.team ?? "—"}</div>
                    <div style={{ color: p.inkSoft }}>{rankTitle}</div>
                    <div style={{ textAlign: "right" }}>
                      <Pill
                        p={p}
                        size="sm"
                        tone={isAdmin ? "accent" : "neutral"}
                        style={{ fontSize: 10, fontWeight: 700 }}
                      >
                        {isAdmin ? "관리자" : "직원"}
                      </Pill>
                    </div>
                  </div>
                );
              })}
              {membersQ.loading && (
                <div style={{ padding: 16, textAlign: "center", color: p.inkMuted, fontSize: 12 }}>
                  불러오는 중…
                </div>
              )}
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: `1px solid ${p.line}`,
                background: p.bg,
                fontSize: 11,
                color: p.inkMuted,
              }}
            >
              총 {data?.total ?? 0}명 · 출처 ezpass 미러
            </div>
          </Card>
        </div>
      </div>
    </ScreenFrame>
  );
}
