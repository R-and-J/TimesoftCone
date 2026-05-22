// "현재 사용자" — 로그인 응답으로 받은 실제 프로필을 localStorage에 저장한다.
// (이전: id 1~9 하드코딩 DEMO_USERS. 중앙 인증(ADR-019)으로 ezpass 임의 계정도
//  로그인되므로, 프로필을 API 응답에서 받아 그대로 사용한다.)

import { createContext, useContext, useState, type ReactNode } from "react";

export type CurrentUser = {
  id: number;
  name: string;
  empId: string;
  role: "EMPLOYEE" | "ADMIN";
  team: string | null;
  email: string | null;
};

const STORAGE_KEY = "timesoftcone.currentUser";

function loadUser(): CurrentUser | null {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return null;
    const u = JSON.parse(raw) as CurrentUser;
    return u && typeof u.id === "number" ? u : null;
  } catch {
    return null;
  }
}

type AuthCtx = {
  user: CurrentUser | null;
  setUser: (u: CurrentUser) => void;
  logout: () => void;
};

const CurrentUserContext = createContext<AuthCtx | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<CurrentUser | null>(loadUser);

  const setUser = (u: CurrentUser) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUserState(u);
  };
  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  };

  return (
    <CurrentUserContext.Provider value={{ user, setUser, logout }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

/** 인증 여부와 무관하게 접근 (로그인 페이지·라우트 가드용). */
export function useAuth(): AuthCtx {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useAuth must be used inside CurrentUserProvider");
  return ctx;
}

/** 보호된 페이지용 — 로그인된 사용자를 보장(없으면 throw, 라우트 가드가 선행). */
export function useCurrentUser(): {
  user: CurrentUser;
  setUser: (u: CurrentUser) => void;
  logout: () => void;
} {
  const ctx = useAuth();
  if (!ctx.user) throw new Error("not authenticated");
  return { user: ctx.user, setUser: ctx.setUser, logout: ctx.logout };
}
