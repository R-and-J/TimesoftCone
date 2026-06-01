// 사용자 역할.
//   ADMIN        — 최고관리자(ezpass·exam 둘 다 관리).
//   EZPASS_ADMIN — ezpass 영역 관리자.
//   EXAM_ADMIN   — exam 영역 관리자.
//   EZPASS       — 회사 도메인 연동 일반 사용자(회원정보·연차 ezpass 동기화).
//   EXAM         — 비연동 독립 일반 사용자(우리 DB 자체 데이터).
// 일반(EZPASS/EXAM)은 로그인 시 이메일 도메인으로 분기, 관리자 계열은 고정.
export type Role = "ADMIN" | "EZPASS_ADMIN" | "EXAM_ADMIN" | "EZPASS" | "EXAM";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "최고관리자",
  EZPASS_ADMIN: "ezpass 관리자",
  EXAM_ADMIN: "exam 관리자",
  EZPASS: "ezpass",
  EXAM: "exam",
};

export function roleLabel(role: string): string {
  return ROLE_LABEL[role as Role] ?? role;
}

/** 관리자 계열 — /admin 영역 접근 가능. */
export const ADMIN_ROLES: Role[] = ["ADMIN", "EZPASS_ADMIN", "EXAM_ADMIN"];

export const isAdmin = (role: string): boolean => (ADMIN_ROLES as string[]).includes(role);

/** ezpass 회원 영역 관리 권한(읽기/동기화/ezpass 화면 유도). */
export const canManageEzpass = (role: string): boolean => role === "ADMIN" || role === "EZPASS_ADMIN";

/** exam(비연동) 회원 영역 관리 권한(로컬 CRUD). */
export const canManageExam = (role: string): boolean => role === "ADMIN" || role === "EXAM_ADMIN";
