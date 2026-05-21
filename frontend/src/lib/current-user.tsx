// "현재 사용자" 추상화. 인증이 붙기 전까지 localStorage에 저장한 userId를
// 사용합니다. seed.ts의 4명을 그대로 사용 (id 1~4).

import { createContext, useContext, useState, type ReactNode } from "react";

export type DemoUser = {
  id: number;
  name: string;
  empId: string;
  role: "EMPLOYEE" | "ADMIN";
};

export const DEMO_USERS: DemoUser[] = [
  { id: 1, name: "김기철", empId: "TS-2024-001", role: "EMPLOYEE" },
  { id: 2, name: "오지석", empId: "TS-2024-002", role: "EMPLOYEE" },
  { id: 3, name: "이도현", empId: "TS-2024-003", role: "EMPLOYEE" },
  { id: 4, name: "박서연", empId: "TS-2024-004", role: "EMPLOYEE" },
  { id: 5, name: "정민우", empId: "TS-2024-005", role: "EMPLOYEE" },
  { id: 6, name: "한지윤", empId: "TS-2024-006", role: "EMPLOYEE" },
  { id: 7, name: "최예나", empId: "TS-2024-007", role: "EMPLOYEE" },
  { id: 8, name: "강태오", empId: "TS-2024-008", role: "EMPLOYEE" },
  { id: 9, name: "박부장", empId: "TS-2024-099", role: "ADMIN" },
];

const STORAGE_KEY = "timesoftcone.currentUserId";

function loadUserId(): number {
  const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  const n = raw ? Number(raw) : 1;
  return Number.isFinite(n) && DEMO_USERS.some((u) => u.id === n) ? n : 1;
}

type Ctx = {
  user: DemoUser;
  setUserId: (id: number) => void;
};

const CurrentUserContext = createContext<Ctx | null>(null);

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<number>(loadUserId);
  const user = DEMO_USERS.find((u) => u.id === userId) ?? DEMO_USERS[0];
  const setUserId = (id: number) => {
    localStorage.setItem(STORAGE_KEY, String(id));
    setUserIdState(id);
  };
  return (
    <CurrentUserContext.Provider value={{ user, setUserId }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

export function useCurrentUser(): Ctx {
  const ctx = useContext(CurrentUserContext);
  if (!ctx) throw new Error("useCurrentUser must be used inside CurrentUserProvider");
  return ctx;
}
