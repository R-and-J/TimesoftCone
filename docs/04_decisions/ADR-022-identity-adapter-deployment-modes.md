# ADR-022: 신원 어댑터화 & 배포 모드 (위임형 / 자립형)

- **상태**: ✅ Accepted (모드 A 운영 중, 모드 B 구현·검증 2026-05-26)
- **결정일**: 2026-05-26
- **결정자**: 타임소프트콘

## 컨텍스트

[[ADR-019]](중앙 인증 위임)·[[ADR-020]](신원=ezpass / 연차·경매금=우리 DB)으로 현재 배포는 사내 ezpass에 로그인을 위임하고 회원 명단을 미러한다. 여기서 제기된 우려:

> "회원 신원을 ezpass에 의존하면, 이 시스템은 **독립 제품**이라기보다 ezpass 부속물 아닌가? 그룹웨어가 없는 회사는 아예 못 쓰나? 그러면 **자체 회원관리**가 따로 있어야 하나?"

이 시스템의 가치 제안은 "**아무 회사나 도입 가능한 이식형 B2E 연차경매 플랫폼**"이다([[ADR-021]] export 핸드오프와 같은 맥락). 신원 시스템 유무가 도입 가능 여부를 가르면 그 가치가 깨진다.

## 결정

**신원(인증·회원 명단)은 본체가 아니라 포트 뒤의 *교체 가능한 어댑터*다.** 본체(경매/에스크로/배당/지갑/연차)는 신원 시스템을 전혀 모른다([[ADR-012]] Hexagonal — 통화 [[ADR-010]]·연차 [[ADR-016]]에 이미 적용한 패턴과 동일).

신원 포트는 둘:
- `AuthProvider` — 자격증명 검증 (이미 존재, [[ADR-019]]).
- `MemberDirectory` — 회원 명단 읽기 (회원관리 탭용, 본 ADR에서 추가).

그리고 **두 배포 모드**를 `AUTH_MODE` 환경변수로 전환한다:

| | **모드 A — 위임형 (`AUTH_MODE=ezpass`, 기본)** | **모드 B — 자립형 (`AUTH_MODE=local`)** |
|---|---|---|
| 대상 | 이미 그룹웨어/SSO 있는 회사 | 그룹웨어 없는 회사 |
| `AuthProvider` | `CompositeAuthProvider` (로컬 우선 → ezpass 위임) | `LocalAuthProvider` (우리 DB + bcrypt) |
| 신원 정본 | ezpass (미러) | 우리 `users` 테이블 |
| 회원관리 탭 | **읽기 전용 + 「지금 동기화」** | **CRUD** (추가/수정/비번/비활성) |
| 외부 의존 | ezpass dev 서버 (단, 로컬 비번 계정은 예외) | **없음** (단독 동작) |

> **로컬 우선 합성 인증 (2026-05-27 추가)**: 위임형의 기본 `AuthProvider`는 순수 `EzpassAuthProvider`가 아니라 **`CompositeAuthProvider`** 다 — `users.password_hash`가 있는 계정은 우리가 bcrypt로 로컬 검증하고, 그 외는 ezpass에 위임. 덕분에 **단일 ezpass 데모를 유지하면서도 외부 IdP에 의존하지 않는 전용 관리자**(`admin@timesoftcon.co.kr`)를 우리 쪽에서 운용한다. role도 우리 DB 소유([[ADR-020]] 개정)라, 외부 ezpass admin 데이터가 깨져도 우리 관리자 로그인은 영향 없음. (실제로 ezpass admin 인증이 외부 사유로 깨진 사고가 이 설계의 계기.)

**핵심**: 두 모드 모두 본체는 그대로다. ezpass 연동은 "기존 인프라에 붙는다"의 *증명 사례*지 제품 전제가 아니다. 자립형은 "그룹웨어 0으로도 돈다"를 보장한다.

### 회원관리 탭이 모드별로 갈리는 이유

위임형에서 회원을 로컬 CRUD로 추가/수정하면 ezpass와 **이중 진실 원본**이 된다(미러는 스냅샷 → 다음 동기화에 덮어써지고, 인증은 ezpass라 로컬 계정으로 로그인도 안 됨). 그래서 위임형 탭은 **읽기 전용 + 동기화**로 제한하고, CRUD는 자립형(우리 테이블이 정본)에서만 연다. 한 플래그가 (1) `AuthProvider` 어댑터와 (2) 탭의 읽기전용/CRUD를 동시에 결정한다.

### 구현

- 스키마: `users.password_hash`(bcrypt, local 전용), `users.active`(비활성 플래그) 추가.
- `LocalAuthProvider`: email로 우리 `users` 조회 → `bcrypt.compare` → `ExternalIdentity` 반환. 비활성/해시없음/불일치는 `AuthFailedError`. (자동 프로비저닝 안 함 — 없는 계정은 로그인 실패.)
- `app.module`: `AUTH_PROVIDER`를 `AUTH_MODE`로 팩토리 분기(ezpass↔local).
- 회원 CRUD(`POST /api/admin/members`, `PATCH /api/admin/members/:id`): **`AUTH_MODE=local`에서만 허용**, 위임형이면 409 거부.
- `GET /api/admin/members` 응답에 `mode` 포함 → 프론트 탭이 읽기전용/CRUD 분기.

### role 처리

- 위임형: role(EMP/ADM)은 ezpass `mngrAuthorAt`로 매 로그인 재동기화([[ADR-020]]) — 탭에선 읽기전용.
- 자립형: role은 관리자가 CRUD로 직접 토글.

## 결과 및 트레이드오프

### ✅ 긍정적 결과
- **독립성 회복** — 본체는 신원 시스템을 모름. ezpass는 어댑터 하나. 자립형으로 외부 의존 0 가능.
- **도입 유연성** — 그룹웨어 있는 회사는 위임형, 없는 회사는 자립형. 한 코드베이스, 한 플래그.
- **방어 논리** — "ezpass 연동은 필수가 아니라 한 사례"가 코드·UI로 증명됨.

### ⚠️ 트레이드오프
- **자립형은 비밀번호를 우리가 저장** — bcrypt 해시(평문 아님)지만 위임형의 "비번 비저장" 장점은 포기. 모드 선택의 본질적 대가.
- **모드 전환은 재배포** — 런타임 토글 아님(`AUTH_MODE`는 부팅 시 결정). 한 배포는 한 모드.
- **혼합 모드 없음** — 같은 배포에서 ezpass+local 동시 사용은 미지원(이중 원본 회피).

### 🛡️ 제약
- 자립형 회원 CRUD는 ADMIN 전용(현재 RBAC 가드 미구현 — CUT-8 잔여, [[ADR-019]]와 동일 한계).
- 위임형에서 CRUD 엔드포인트 호출 시 409로 차단.

## 관련 문서
- [[ADR-019]] 중앙 인증 위임 — `AuthProvider`/`EzpassAuthProvider` (모드 A)
- [[ADR-020]] 신원=ezpass / 연차·경매금=우리 DB
- [[ADR-021]] 이식형 핸드오프 export — 같은 "어느 회사나 도입" 철학
- [[ADR-012]] Hexagonal — 신원을 포트 뒤로 격리
- 코드: `backend/src/ports/{auth-provider,member-directory}.ts`, `backend/src/adapters/auth/{ezpass-auth,local-auth}.provider.ts`, `backend/src/adapters/directory/msaportal-member-directory.adapter.ts`, `backend/src/application/admin/manage-members.use-case.ts`
