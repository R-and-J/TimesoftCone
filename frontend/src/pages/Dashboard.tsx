import { useState } from "react";
import { PALETTES, FONT, fmt } from "@/lib/tokens";
import {
  Btn,
  BrandGlyph,
  Card,
  Pill,
  TopNav,
} from "@/components/atoms";
import { Icon } from "@/components/icons";
import { ScreenFrame } from "@/components/ScreenFrame";
import { useCurrentUser } from "@/lib/current-user";
import { useQuery } from "@/lib/use-query";
import { useToast } from "@/lib/toast";
import { getBalance, getLeave, getMyDividend, listAuctions, submitChargeRequest } from "@/lib/queries";
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
  const p = PALETTES.cobalt;
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useCurrentUser();
  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeAmount, setChargeAmount] = useState<string>("");
  const [chargeNote, setChargeNote] = useState("");
  const [charging, setCharging] = useState(false);

  const submitCharge = async () => {
    const amount = Number(chargeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.push("error", "금액은 1P 이상의 숫자여야 합니다");
      return;
    }
    setCharging(true);
    try {
      await submitChargeRequest(amount, chargeNote.trim() || undefined);
      toast.push("success", `${fmt.point(amount)}P 충전 요청 등록 — 관리자 승인 대기`);
      setChargeOpen(false);
      setChargeAmount("");
      setChargeNote("");
    } catch (e) {
      toast.push("error", (e as Error).message);
    } finally {
      setCharging(false);
    }
  };

  const balanceQ = useQuery(() => getBalance(user.id), [user.id]);
  const auctionsQ = useQuery(() => listAuctions(["OPEN"]), []);
  const dividendQ = useQuery(() => getMyDividend(user.id), [user.id]);
  const leaveQ = useQuery(() => getLeave(user.id), [user.id]);

  const openCount = auctionsQ.data?.length ?? 0;
  const balanceNum = balanceQ.data ? Number(balanceQ.data.balance) : null;
  const dividendNum = dividendQ.data ? Number(dividendQ.data.myDividend) : null;
  const escrowNum = dividendQ.data ? Number(dividendQ.data.escrowBalance) : null;
  const stakeRatio = dividendQ.data?.stakeRatio ?? 0;
  const contributedDays = dividendQ.data?.contributedDays ?? 0;

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
        <TopNav p={p} active="dashboard" />

        <div style={{ flex: 1, padding: "32px 40px", overflow: "hidden" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginBottom: 24,
            }}
          >
            <div>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 500 }}>
                {formatDateLabel(new Date())}
              </div>
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 4,
                }}
              >
                안녕하세요, <span style={{ color: p.accent }}>{user.name}</span>님
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn p={p} variant="ghost" size="md">
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon.cal size={16} /> 휴가 사용 신청
                </span>
              </Btn>
              <Btn p={p} variant="dark" size="md" onClick={() => navigate("/auction")}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <Icon.hammer size={16} /> 경매장 입장
                </span>
              </Btn>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr",
              gap: 16,
              marginBottom: 16,
            }}
          >
            {/* Wallet — live */}
            <Card
              p={p}
              padding={28}
              style={{ background: p.ink, color: "#fff", position: "relative", overflow: "hidden" }}
            >
              <div style={{ position: "absolute", right: -40, bottom: -40, opacity: 0.08 }}>
                <BrandGlyph color="#fff" size={220} />
              </div>
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
                  내 복지 포인트
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 56,
                    fontWeight: 800,
                    letterSpacing: "-0.03em",
                    marginTop: 6,
                    lineHeight: 1,
                  }}
                >
                  {balanceQ.loading
                    ? "—"
                    : balanceQ.error
                      ? "오류"
                      : fmt.point(balanceNum ?? 0)}
                  <span
                    style={{
                      fontSize: 24,
                      fontWeight: 600,
                      marginLeft: 6,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    P
                  </span>
                </div>
                {balanceQ.error && (
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
                    백엔드 연결 실패: {balanceQ.error.message}
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                  <Pill
                    p={p}
                    tone="dark"
                    style={{ background: "rgba(255,255,255,0.14)", color: "#fff" }}
                  >
                    실시간 잔액
                  </Pill>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                  <Btn p={p} variant="primary" size="sm" onClick={() => navigate("/activity")}>
                    거래 내역
                  </Btn>
                  <Btn
                    p={p}
                    variant="ghost"
                    size="sm"
                    style={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)" }}
                    onClick={() => setChargeOpen(true)}
                  >
                    충전 요청
                  </Btn>
                  <Btn
                    p={p}
                    variant="ghost"
                    size="sm"
                    style={{ color: "#fff", borderColor: "rgba(255,255,255,0.25)" }}
                    onClick={() => navigate("/admin/ledger")}
                  >
                    전체 원장 보기
                  </Btn>
                </div>
              </div>
            </Card>

            {/* Predicted dividend — live */}
            <Card p={p} padding={24} hover onClick={() => navigate("/dividend")}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 600 }}>
                  예상 연말 배당
                </div>
                <Pill p={p} tone="accent" size="sm">
                  실시간 산정
                </Pill>
              </div>
              <div
                className="mono"
                style={{
                  fontSize: 36,
                  fontWeight: 800,
                  color: p.ink,
                  letterSpacing: "-0.025em",
                  marginTop: 12,
                }}
              >
                <span style={{ color: p.success }}>+</span>
                {dividendQ.loading
                  ? "—"
                  : dividendQ.error
                    ? "오류"
                    : fmt.point(dividendNum ?? 0)}{" "}
                <span style={{ fontSize: 16, color: p.inkMuted }}>P</span>
              </div>
              <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 4 }}>
                지분율 {(stakeRatio * 100).toFixed(1)}% · 기여 {contributedDays}일
              </div>
              <div
                style={{
                  marginTop: 16,
                  height: 8,
                  background: p.bg,
                  borderRadius: 999,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, stakeRatio * 100)}%`,
                    height: "100%",
                    background: p.accent,
                    borderRadius: 999,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginTop: 8,
                  fontSize: 11,
                  color: p.inkMuted,
                }}
              >
                <span>현재 에스크로 {escrowNum !== null ? fmt.point(escrowNum) : "—"} P</span>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {(stakeRatio * 100).toFixed(1)}%
                </span>
              </div>
            </Card>

            {/* Leave balance — live */}
            <Card p={p} padding={24}>
              <div style={{ fontSize: 13, color: p.inkMuted, fontWeight: 600, marginBottom: 12 }}>
                내 휴가 잔여
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { k: "REGULAR", v: leaveQ.data?.regular, label: "법정", color: p.ink },
                  { k: "AUCTION", v: leaveQ.data?.auction, label: "경매", color: p.accent },
                  { k: "EVENT", v: leaveQ.data?.event, label: "포상", color: p.warn },
                ].map((it) => (
                  <div key={it.k} style={{ background: p.bg, borderRadius: 12, padding: 12 }}>
                    <div
                      className="mono"
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: it.color,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {leaveQ.loading ? "—" : (it.v ?? 0)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: it.color, marginTop: -2 }}>
                      {it.k}
                    </div>
                    <div style={{ fontSize: 10, color: p.inkMuted, marginTop: 2 }}>{it.label}일</div>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: 10,
                  background: p.accentSoft,
                  borderRadius: 10,
                  fontSize: 11,
                  color: p.accent,
                  lineHeight: 1.5,
                }}
              >
                <strong>차감 순서:</strong> AUCTION → EVENT → REGULAR
                <br />
                <span style={{ color: p.inkMuted, fontWeight: 500 }}>
                  ADR-003 — 경매 연차부터 자동 차감됩니다.
                </span>
              </div>
            </Card>
          </div>

          {/* LIVE auctions strip */}
          <Card p={p} padding={0} style={{ marginBottom: 16 }}>
            <div
              style={{
                padding: "20px 24px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Pill p={p} tone="live">
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      background: "#fff",
                      borderRadius: "50%",
                      marginRight: 2,
                    }}
                  />
                  LIVE
                </Pill>
                <div
                  style={{
                    fontSize: 17,
                    fontWeight: 700,
                    color: p.ink,
                    letterSpacing: "-0.01em",
                  }}
                >
                  진행 중인 경매 {auctionsQ.loading ? "—" : openCount}건
                </div>
              </div>
              <div
                onClick={() => navigate("/auction")}
                style={{
                  fontSize: 13,
                  color: p.accent,
                  fontWeight: 600,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                }}
              >
                전체보기 <Icon.chev size={14} dir="right" />
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 1,
                background: p.line,
                borderBottomLeftRadius: 20,
                borderBottomRightRadius: 20,
                overflow: "hidden",
                minHeight: 160,
              }}
            >
              {auctionsQ.loading && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: p.surface,
                    padding: 32,
                    textAlign: "center",
                    color: p.inkMuted,
                    fontSize: 13,
                  }}
                >
                  불러오는 중…
                </div>
              )}
              {auctionsQ.error && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: p.surface,
                    padding: 32,
                    textAlign: "center",
                    color: p.danger,
                    fontSize: 13,
                  }}
                >
                  백엔드 연결 실패: {auctionsQ.error.message}
                </div>
              )}
              {auctionsQ.data?.slice(0, 4).map((a) => {
                const highest = Number(a.highest);
                const isHot = new Date(a.endsAt).getTime() - Date.now() < 30 * 60 * 1000;
                return (
                  <div
                    key={a.id}
                    onClick={() => navigate(`/auction/detail/${a.id}`)}
                    style={{
                      background: p.surface,
                      padding: 20,
                      position: "relative",
                      cursor: "pointer",
                    }}
                  >
                    {isHot && (
                      <div style={{ position: "absolute", top: 16, right: 16 }}>
                        <Pill p={p} tone="danger" size="sm">
                          🔥 곧 마감
                        </Pill>
                      </div>
                    )}
                    <div className="mono" style={{ fontSize: 11, color: p.inkMuted, fontWeight: 600 }}>
                      {a.id}
                    </div>
                    <div style={{ fontSize: 13, color: p.ink, fontWeight: 700, marginTop: 4 }}>
                      연차 {a.leaveDays}일권
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: p.ink,
                        letterSpacing: "-0.025em",
                        marginTop: 10,
                      }}
                    >
                      {fmt.point(highest)}
                      <span style={{ fontSize: 14, color: p.inkMuted, marginLeft: 4 }}>P</span>
                    </div>
                    <div style={{ fontSize: 11, color: p.inkMuted, marginTop: 2 }}>
                      입찰 {a.bidCount}회
                    </div>
                    <div
                      style={{
                        marginTop: 14,
                        fontSize: 11,
                        color: isHot ? p.danger : p.inkMuted,
                        fontWeight: 600,
                      }}
                    >
                      마감{" "}
                      {new Date(a.endsAt).toLocaleString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                );
              })}
              {auctionsQ.data && auctionsQ.data.length === 0 && (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    background: p.surface,
                    padding: 32,
                    textAlign: "center",
                    color: p.inkMuted,
                    fontSize: 13,
                  }}
                >
                  진행 중인 경매가 없습니다. (관리자 콘솔에서 OPEN 상태 경매를 만드세요)
                </div>
              )}
            </div>
          </Card>

          {/* Quick links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {[
              {
                i: <Icon.hammer size={22} />,
                t: "경매장 둘러보기",
                s: `오늘 진행 중인 ${openCount}건`,
                tone: p.accent,
                path: "/auction",
              },
              {
                i: <Icon.gift size={22} />,
                t: "연말 배당 시뮬레이션",
                s: `내 지분 ${(stakeRatio * 100).toFixed(1)}% 상세 분석`,
                tone: p.success,
                path: "/dividend",
              },
              {
                i: <Icon.ledger size={22} />,
                t: "내 거래 내역",
                s: "활동 보기",
                tone: p.warn,
                path: "/activity",
              },
              {
                i: <Icon.spark size={22} />,
                t: "연차 사용 신청",
                s: "그룹웨어로 연결",
                tone: p.inkSoft,
                path: "/dashboard",
              },
            ].map((it, i) => (
              <Card key={i} p={p} padding={20} hover onClick={() => navigate(it.path)}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: p.bg,
                      color: it.tone,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {it.i}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: p.ink }}>{it.t}</div>
                    <div style={{ fontSize: 12, color: p.inkMuted, marginTop: 2 }}>{it.s}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* 충전 요청 모달 (ADR-024) */}
      {chargeOpen && (
        <div
          onClick={() => !charging && setChargeOpen(false)}
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
            <div style={{ fontSize: 18, fontWeight: 800, color: p.ink, marginBottom: 6 }}>충전 요청</div>
            <div style={{ fontSize: 12, color: p.inkMuted, marginBottom: 16 }}>
              관리자 승인 시 자동으로 잔액에 적립돼요.
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>금액 (P)</div>
              <input
                type="number"
                value={chargeAmount}
                min={1}
                step={1000}
                onChange={(e) => setChargeAmount(e.target.value)}
                placeholder="예: 50000"
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 9,
                  border: `1px solid ${p.line}`, fontSize: 14, color: p.ink, background: p.bg,
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: p.inkSoft, marginBottom: 6 }}>사유 (선택)</div>
              <textarea
                value={chargeNote}
                onChange={(e) => setChargeNote(e.target.value)}
                placeholder="예: 회식비로 사용 예정"
                rows={3}
                style={{
                  width: "100%", padding: "9px 12px", borderRadius: 9,
                  border: `1px solid ${p.line}`, fontSize: 13, color: p.ink, background: p.bg,
                  boxSizing: "border-box", fontFamily: "inherit", resize: "vertical",
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn p={p} variant="ghost" size="md" disabled={charging} onClick={() => setChargeOpen(false)}>취소</Btn>
              <Btn p={p} variant="primary" size="md" disabled={charging || !chargeAmount} onClick={submitCharge}>
                {charging ? "요청 중…" : "요청하기"}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </ScreenFrame>
  );
}

function formatDateLabel(d: Date): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
}
