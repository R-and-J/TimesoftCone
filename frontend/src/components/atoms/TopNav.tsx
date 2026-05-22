import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Palette } from "@/lib/tokens";
import { Brand } from "./Brand";
import { Avatar } from "./Avatar";
import { Icon } from "../icons";
import { useCurrentUser } from "@/lib/current-user";

type Props = {
  p: Palette;
  active?: "dashboard" | "auction" | "activity" | "dividend" | "admin";
  /** Override the displayed user (admin screens use this for "박부장"). */
  user?: string;
  role?: string;
};

const NAV_ROUTES: Record<NonNullable<Props["active"]>, string> = {
  dashboard: "/dashboard",
  auction: "/auction",
  activity: "/activity",
  dividend: "/dividend",
  admin: "/admin/ops",
};

export function TopNav({ p, active = "dashboard", user, role }: Props) {
  const navigate = useNavigate();
  const { user: current, logout } = useCurrentUser();
  const [open, setOpen] = useState(false);

  const displayName = user ?? current.name;
  const displayRole = role ?? (current.role === "ADMIN" ? "관리자" : "사원");

  const items: { id: NonNullable<Props["active"]>; label: string }[] = [
    { id: "dashboard", label: "홈" },
    { id: "auction", label: "경매장" },
    { id: "activity", label: "내 활동" },
    { id: "dividend", label: "연말 배당" },
    { id: "admin", label: "관리" },
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
        <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <Icon.search />
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
          <Icon.bell />
          <div style={{ position: "absolute", top: 8, right: 8, width: 7, height: 7, background: p.danger, borderRadius: "50%" }} />
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
                  <div className="mono" style={{ fontSize: 10, color: p.inkMuted }}>
                    {current.email ?? current.empId} · {current.role}
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
