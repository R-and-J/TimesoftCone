import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Palette } from "@/lib/tokens";
import { Brand } from "./Brand";
import { Avatar } from "./Avatar";
import { Icon } from "../icons";
import { useCurrentUser } from "@/lib/current-user";
import { getAuthToken, getCompanyScope, setCompanyScope } from "@/lib/api";
import { roleLabel, isAdmin } from "@/lib/roles";
import {
  listNotifications,
  markNotificationsRead,
  type NotificationItem,
} from "@/lib/queries";

type Props = {
  p: Palette;
  active?: "dashboard" | "auction" | "activity" | "dividend" | "redemption" | "admin";
  /** Override the displayed user (admin screens use this for "박부장"). */
  user?: string;
  role?: string;
};

const NAV_ROUTES: Record<NonNullable<Props["active"]>, string> = {
  dashboard: "/dashboard",
  auction: "/auction",
  activity: "/activity",
  dividend: "/dividend",
  redemption: "/redemption",
  admin: "/admin/ops",
};

export function TopNav({ p, active = "dashboard", user, role }: Props) {
  const navigate = useNavigate();
  const { user: current, logout } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [bellOpen, setBellOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const r = await listNotifications(current.id);
        if (!cancelled) {
          setNotifs(r.items);
          setUnread(r.unread);
        }
      } catch {
        /* 알림 실패는 무시 — 핵심 흐름 아님 */
      }
    };
    // 1) 첫 로드 + 탭 복귀 시 정본 조회.
    void load();
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // 2) SSE 스트림 — 새 알림 적재 즉시 push 수신, 그때마다 정본 다시 조회.
    //    EventSource는 헤더 못 보내므로 JWT를 ?token= 쿼리로 전달(JwtAuthGuard에서 지원).
    //    연결 끊기면 브라우저가 자동 재연결. 백업으로 60초 폴링도 같이.
    const token = getAuthToken();
    let es: EventSource | null = null;
    if (token) {
      try {
        es = new EventSource(
          `/api/users/${current.id}/notifications/stream?token=${encodeURIComponent(token)}`,
        );
        es.onmessage = () => {
          // 신호 받으면 정본 GET(unread 카운트 + 최신 N개).
          void load();
        };
        es.onerror = () => {
          /* 자동 재연결에 맡김 — 에러 로그 X */
        };
      } catch {
        /* EventSource 미지원/실패 → 폴링만으로 fallback */
      }
    }
    const backupPoll = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(backupPoll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      if (es) es.close();
    };
  }, [current.id]);

  const toggleBell = async () => {
    const next = !bellOpen;
    setBellOpen(next);
    if (next && unread > 0) {
      try {
        await markNotificationsRead(current.id);
        setUnread(0);
        setNotifs((xs) => xs.map((n) => ({ ...n, read: true })));
      } catch {
        /* ignore */
      }
    }
  };

  // 최고관리자(super ADMIN, role=ADMIN·무소속)는 회사 스위처로 전 회사를 넘나든다.
  //   "전체"=null(통합 집계), 이지패스=1, EXAM=2. 선택값은 api.ts가 X-Company-Id로 첨부.
  const isSuper = current.role === "ADMIN";
  const [companyScope, setCompanyScopeState] = useState<string>(getCompanyScope() ?? "");
  const onSwitchCompany = (v: string) => {
    setCompanyScopeState(v);
    setCompanyScope(v || null);
    window.location.reload(); // 스코프 변경을 모든 화면에 즉시 반영
  };

  const displayName = user ?? current.name;
  // 직급(ezpass clsf_nm)을 우선 표시. 없으면 role 라벨로 폴백. (ADR-020)
  const displayRole = role ?? current.jobRank ?? roleLabel(current.role);

  const items: { id: NonNullable<Props["active"]>; label: string }[] = [
    { id: "dashboard", label: "홈" },
    { id: "auction", label: "경매장" },
    { id: "activity", label: "내 활동" },
    { id: "dividend", label: "연말 배당" },
    { id: "redemption", label: "스쿱 마켓" },
    // "관리"는 관리자 계열(ADMIN/EZPASS_ADMIN/EXAM_ADMIN)에게만 노출.
    ...(isAdmin(current.role) ? [{ id: "admin" as const, label: "관리" }] : []),
  ];

  return (
    <div
      style={{
        height: 60,
        background: p.surface,
        borderBottom: `1px solid ${p.line}`,
        display: "flex",
        alignItems: "center",
        padding: "0 28px",
        gap: 32,
      }}
    >
      <Link to="/dashboard" style={{ textDecoration: "none", display: "inline-flex" }}>
        <Brand p={p} compact />
      </Link>
      <div style={{ display: "flex", gap: 4, flex: 1 }}>
        {items.map((it) => (
          <div
            key={it.id}
            onClick={() => navigate(NAV_ROUTES[it.id])}
            style={{
              padding: "0 14px",
              height: 36,
              display: "flex",
              alignItems: "center",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 600,
              color: active === it.id ? p.ink : p.inkMuted,
              background: active === it.id ? p.bg : "transparent",
              cursor: "pointer",
            }}
          >
            {it.label}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 14, color: p.inkSoft }}>
        {isSuper && (
          <select
            value={companyScope}
            onChange={(e) => onSwitchCompany(e.target.value)}
            title="회사 전환(최고관리자)"
            style={{
              height: 34,
              borderRadius: 10,
              border: `1px solid ${p.line}`,
              background: p.bg,
              color: p.ink,
              fontSize: 13,
              fontWeight: 600,
              padding: "0 10px",
              cursor: "pointer",
            }}
          >
            <option value="">전체 회사</option>
            <option value="1">이지패스</option>
            <option value="2">EXAM</option>
          </select>
        )}
        <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Icon.search />
        </div>
        <div style={{ position: "relative" }}>
          <div
            onClick={toggleBell}
            style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", background: bellOpen ? p.bg : "transparent" }}
          >
            <Icon.bell />
            {unread > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  minWidth: 16,
                  height: 16,
                  padding: "0 4px",
                  background: p.danger,
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 10,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxSizing: "border-box",
                }}
              >
                {unread > 9 ? "9+" : unread}
              </div>
            )}
          </div>
          {bellOpen && (
            <div
              onMouseLeave={() => setBellOpen(false)}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                width: 340,
                background: p.surface,
                borderRadius: 12,
                boxShadow: "0 1px 0 rgba(11,25,41,0.04), 0 14px 32px rgba(11,25,41,0.12)",
                padding: 6,
                zIndex: 100,
              }}
            >
              <div style={{ padding: "8px 10px", fontSize: 13, fontWeight: 700, color: p.ink }}>
                알림
              </div>
              <div style={{ height: 1, background: p.line, margin: "2px 0 4px" }} />
              {notifs.length === 0 ? (
                <div style={{ padding: "18px 10px", fontSize: 12, color: p.inkMuted, textAlign: "center" }}>
                  새 알림이 없습니다.
                </div>
              ) : (
                <div style={{ maxHeight: 360, overflow: "auto" }}>
                  {notifs.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        if (!n.linkPath) return;
                        setBellOpen(false);
                        navigate(n.linkPath);
                      }}
                      style={{
                        padding: "10px",
                        borderRadius: 8,
                        display: "flex",
                        gap: 8,
                        alignItems: "flex-start",
                        cursor: n.linkPath ? "pointer" : "default",
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          marginTop: 6,
                          flexShrink: 0,
                          background:
                            n.type === "AUCTION_WON"
                              ? p.success
                              : n.type === "INVENTORY_CREATED"
                                ? p.accent
                                : p.warn,
                        }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: p.ink }}>{n.title}</div>
                        <div style={{ fontSize: 11, color: p.inkSoft, lineHeight: 1.4, marginTop: 2 }}>
                          {n.message}
                        </div>
                        <div style={{ fontSize: 10, color: p.inkMuted, marginTop: 3 }}>
                          {new Date(n.createdAt).toLocaleString("ko-KR", {
                            month: "numeric",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ position: "relative" }}>
          <div
            onClick={() => setOpen((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "4px 12px 4px 4px",
              borderRadius: 22,
              background: p.bg,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <Avatar p={p} name={displayName} size={32} />
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 700, color: p.ink, lineHeight: 1.1 }}>{displayName}</div>
              <div style={{ color: p.inkMuted, fontSize: 11 }}>{displayRole}</div>
            </div>
            <div style={{ marginLeft: 2, color: p.inkMuted }}>
              <Icon.chev size={12} dir="down" />
            </div>
          </div>
          {open && (
            <div
              onMouseLeave={() => setOpen(false)}
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                right: 0,
                background: p.surface,
                borderRadius: 12,
                boxShadow: "0 1px 0 rgba(11,25,41,0.04), 0 14px 32px rgba(11,25,41,0.12)",
                padding: 6,
                minWidth: 220,
                zIndex: 100,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px" }}>
                <Avatar p={p} name={current.name} size={28} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: p.ink, fontWeight: 600 }}>{current.name}</div>
                  {(current.team || current.jobRank || current.jobTitle) && (
                    <div style={{ fontSize: 11, color: p.inkSoft }}>
                      {[current.team, [current.jobRank, current.jobTitle].filter(Boolean).join("/")]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  )}
                  <div className="mono" style={{ fontSize: 10, color: p.inkMuted }}>
                    {current.email ?? current.empId} · {roleLabel(current.role)}
                  </div>
                </div>
              </div>
              <div style={{ height: 1, background: p.line, margin: "4px 0" }} />
              <div
                onClick={() => {
                  logout();
                  setOpen(false);
                  navigate("/login");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  color: p.danger,
                  fontWeight: 600,
                }}
              >
                로그아웃
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
