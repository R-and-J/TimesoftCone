// AuthProvider — outbound port for credential verification.
//
// 중앙 인증 위임(ADR-019): 우리는 비밀번호를 저장/검증하지 않고, 외부 인증
// 서버(사내 ezpass)에 위임한다. 현재 구현체는 EzpassAuthProvider 하나.
// 진짜 SSO(OIDC)로 가더라도 이 포트만 교체하면 됨 (Hexagonal).

export const AUTH_PROVIDER = Symbol("AUTH_PROVIDER");

/** 외부 인증 서버가 검증해준 사용자 신원. */
export type ExternalIdentity = {
  /** 로그인 ID = 이메일. 우리 users.email 매핑 키. */
  email: string;
  /** 표시 이름 (없으면 null — 매핑된 우리 사용자 이름을 우선 사용). */
  name: string | null;
  /** 관리자 여부 (best-effort). */
  isAdmin: boolean;
  /** 외부 시스템의 사용자 식별자 (있으면 자동 프로비저닝 emp_id 생성에 사용). */
  externalUserNo: string | null;
};

export class AuthFailedError extends Error {}

export interface AuthProvider {
  /**
   * 자격증명을 외부 서버로 검증. 성공 시 신원 반환, 실패 시 AuthFailedError throw.
   * @param id 로그인 ID(이메일)
   * @param password 평문 비밀번호 (저장하지 않고 전달만)
   * @param cmpnyNo 회사번호 (미지정 시 기본값 사용)
   */
  authenticate(id: string, password: string, cmpnyNo?: string): Promise<ExternalIdentity>;
}
