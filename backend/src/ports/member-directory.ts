// MemberDirectory — outbound port for reading the company's member roster from
// the external identity system (ezpass org DB). 신원 정본은 외부(ADR-019/020);
// 우리는 이 포트로 명단을 읽어 users 테이블에 미러한다.
//
// 현재 구현체는 MsaportalMemberDirectoryAdapter(mysql2) 하나. 다른 그룹웨어/SSO로
// 가더라도 이 포트만 교체하면 된다(Hexagonal). 자립형(LocalAuthProvider) 배포에선
// 이 포트를 안 쓰고 관리자 CRUD가 users의 정본이 된다.

export const MEMBER_DIRECTORY = Symbol("MEMBER_DIRECTORY");

/** 외부 디렉터리(ezpass)가 알려준 회원 1명. */
export type DirectoryMember = {
  /** 외부 시스템 사용자 식별자 (emp_no 없을 때 empId=EZP-{이 값}). */
  externalUserNo: string;
  /** 로그인 ID = 이메일. users.email 매핑 키. */
  email: string;
  name: string;
  /** 사번(emp_no) — 없으면 null. */
  empNo: string | null;
  /** 관리자 권한 보유 여부(mngr_author_no) → role ADMIN, 아니면 EZPASS. */
  isAdmin: boolean;
  team: string | null;
  jobRank: string | null;
  jobTitle: string | null;
  /** 외부 연차(법정/REGULAR) 일수 — 최신 연도 기준. */
  regularLeaveDays: number;
};

export interface MemberDirectory {
  /** 우리 회사(cmpny) 전체 회원 명단을 외부 디렉터리에서 읽어온다. */
  listCompanyMembers(): Promise<DirectoryMember[]>;
}
