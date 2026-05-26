# ADR-019: 사내 중앙 인증 위임 (ezpass Login API)

- **상태**: ✅ Accepted (구현·검증 완료 2026-05-21)
- **결정일**: 2026-05-21
- **결정자**: 타임소프트콘

## 컨텍스트

로그인을 실제 인증으로 구현해야 했다(scope-cuts CUT-8 "전원 ADMIN 데모 모드"의 부활). 후보:

1. **외부 SSO (OIDC/SAML)** — 회사 IdP가 있어야 하고 리다이렉트 흐름. 팀이 SSO 작동 원리에 익숙치 않음.
2. **자체 비밀번호 저장** — 우리 DB에 해시 저장. 사내 계정 체계와 이중 관리.
3. **사내 중앙 인증 API에 위임** — 회사에 이미 `ezpass` 로그인 API가 존재.

사내 ezpass(`dev.performax.timesoft.internal`, eGovFrame Cloud + Spring)가 `LgnBfe0020M/login` 자격증명 검증 API를 제공하므로, **여기에 위임**하는 것이 가장 현실적·안전(비밀번호 우리가 저장 안 함)이다.

> ⚠️ 용어 주의: 이것은 **SSO가 아니다**. 사용자가 *우리 폼*에 비번을 입력하고 우리가 ezpass로 *전달*하는 **중앙 인증 위임(credential delegation)**이다. 발표·문서에선 "SSO"가 아니라 "사내 통합 계정 인증 연동"으로 표기.

## 결정

**`AuthProvider` 포트 + `EzpassAuthProvider` 어댑터로 ezpass에 인증 위임.** (Hexagonal — [[ADR-012]])

### 흐름

```
[프론트: 이메일(id)+비번] → 우리 /api/auth/login
  → EzpassAuthProvider:
      1) selectCmpnyInfo {id, password}  → 회사번호(cmpnyNo) 자동 조회
      2) LgnBfe0020M/login {id, password, cmpnyNo} → 200 + userToken(JWT)
  → LoginUseCase: 이메일로 우리 users 매핑 (없으면 자동 프로비저닝)
  → 우리 사용자 정보 반환 (프론트는 userId 저장 — 기존 흐름 유지)
```

### ezpass API 계약 (코드 분석 + 실측으로 확정)

| 항목 | 값 |
|---|---|
| 요청 헤더 | `locale: ko-KR` (필수 — 없으면 500), `Content-Type: application/json` |
| 요청 바디 | `{ id(이메일), password, cmpnyNo }` — 필드명 `email` 아님 **`id`** |
| 회사번호 | **selectCmpnyInfo로 자동 조회** (같은 이메일이 여러 회사 가능 — 로그인 화면이 "회사 선택"). 예: `admin@timesoftcon.co.kr` → `cmpnyNo=7`(타임소프트콘) |
| selectCmpnyInfo | 같은 VO(`@NotBlank id+password`) 사용 → **password도 같이 보내야** 검증 통과 |
| 성공 응답 (200) | `{ userToken(JWT), tokenEndDt, cmpnyNo }` — 신원은 JWT claims 안 |
| 실패 응답 (422) | `{ code, type, message, detail }` |

### 사용자 매핑

- `users.email` 컬럼 추가(unique). ezpass 이메일 ↔ 우리 사용자.
- 테스트 계정 `admin@timesoftcon.co.kr` → 우리 관리자 **박부장(TS-2024-099)** 에 매핑(시드 데이터 활용).
- **자동 프로비저닝**: 매칭되는 행이 없으면 첫 로그인 시 `EMPLOYEE`로 생성.

### TLS

ezpass dev는 사내 자체서명 CA → Node가 신뢰 거부. `EZPASS_TLS_INSECURE=true` 환경변수로 *이 호출에 한해* 검증 비활성(전역 아님, `https.Agent({rejectUnauthorized:false})`). 운영은 `false` + 사내 CA 신뢰 설치.

### 우리 자체 JWT/가드는 아직 없음

현재 앱은 가드가 없으므로(CUT-8), ezpass 검증만 끼우고 기존 "userId 저장" 흐름을 유지. 우리 자체 JWT 발급 + `JwtAuthGuard` + RBAC 강제는 **후속 과제**.

## 결과 및 트레이드오프

### ✅ 긍정적 결과
- **비밀번호 비저장** — 사내 계정 체계 단일화, 우리 DB에 비번 없음
- **검증 완료** — 실제 ezpass dev + 우리 DB(SQLite)로 end-to-end 동작 확인 (`admin@timesoftcon.co.kr` → 박부장)
- **교체 가능** — `AuthProvider` 포트라 추후 진짜 OIDC SSO 어댑터로 교체 가능
- **회사번호 자동 조회** — 하드코딩 없이 이메일로 cmpnyNo 해결

### ⚠️ 트레이드오프
- **SSO 아님** — 비번이 우리 백엔드를 거쳐감 (위 용어 주의)
- **JWT/가드 미구현** — `/api/admin/*`가 여전히 무방비 (CUT-8 잔여)
- ~~**프론트 하드코딩 잔재**~~ ✅ 해소(2026-05-22) — `current-user.tsx`가 `DEMO_USERS` 대신 **로그인 응답 프로필**을 localStorage에 저장·사용. `useAuth`(가드용)/`useCurrentUser`(로그인 보장) 분리 + `App.tsx` 라우트 가드(`RequireAuth`) + TopNav 데모 전환 → 로그아웃. 이제 자동 프로비저닝된 임의 ezpass 계정도 UI에 본인으로 표시됨
- **ezpass 의존** — ezpass dev 다운 시 로그인 불가

### 🛡️ 제약
- ezpass 호출은 `EZPASS_*` 환경변수로 설정. 실 자격증명·URL은 `.env`(gitignore)에만
- `locale` 헤더는 `ko-KR` 형식 (단순 `ko` 아님)
- 운영 전환 시 `EZPASS_TLS_INSECURE=false` + CA 신뢰 필수

## 관련 문서
- [[ADR-022]] 신원 어댑터화 & 배포 모드 — 본 ADR(위임형)을 모드 A로 일반화. 위 "초기 아이디어 2(자체 비밀번호 저장)"는 모드 B(자립형, LocalAuthProvider)로 실현됨
- [[ADR-012]] Hexagonal — AuthProvider 포트 / EzpassAuthProvider 어댑터
- [[ADR-011]] wallet 자체 보유 — 인증과 별개로 잔액은 우리 마스터
- scope-cuts.md CUT-8 — 본 ADR이 부활시킨 항목
- 코드: `backend/src/ports/auth-provider.ts`, `backend/src/adapters/auth/ezpass-auth.provider.ts`, `backend/src/application/auth/login.use-case.ts`
