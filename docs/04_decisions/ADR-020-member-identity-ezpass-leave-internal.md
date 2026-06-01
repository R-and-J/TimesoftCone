# ADR-020: 회원 신원은 ezpass, 연차·경매는 우리 DB (회원정보 체제 정렬)

- **상태**: ✅ Accepted
- **결정일**: 2026-05-26
- **결정자**: 타임소프트콘

## 컨텍스트

사내 ezpass(`msaportal`)에는 회사별 회원·조직(부서/직급/직책)과 연차(`tbl_user_yryc`) 데이터가 이미 풍부하게 들어있다. 반면 연차경매 앱은:
- 로그인 시 ezpass로 검증만 위임([[ADR-019]])하고, 우리 `users`에 `EMPLOYEE`로 자동 프로비저닝 → **직급/부서 미반영**(이사인 사용자가 앱에선 "사원"으로 표시).
- 연차는 `users`의 평면 컬럼(`regular/auction/event_leave_days`) 읽기 전용([[ADR-002]], scope-cuts CUT-9).

"회원정보 체제를 ezpass에 맞추고, 연차 조정 같은 걸 하려면 어디가 주인인가"를 정해야 했다.

## 결정

1. **회원 신원/조직 = ezpass 기준 (읽기)** — 이름·부서·직급(clsf)·직책(ofcsprtps)은 ezpass에서 가져온다. (직급/직책은 ezpass 토큰에 없어 `msaportal` 조회 필요; 부서명은 토큰에 있음.)

   > **개정 (2026-05-27): `role(EMPLOYEE/ADMIN)`은 우리 시스템이 소유한다.** 처음엔 ezpass `mngrAuthorAt`로 매 로그인 재동기화했으나, **권한(authorization)은 앱 고유 관심사**라 ezpass의 관리자 플래그와 분리한다. 현재 동작: **최초 자동 프로비저닝 시에만** ezpass `mngrAuthorAt`를 초기값 힌트로 쓰고, 이후 role은 우리 `users.role`이 정본 — 로그인 시 덮어쓰지 않는다. 관리자 지정/해제는 우리 쪽(시드·회원관리)에서 한다.
   > **계기**: ezpass 데모 admin 계정(`admin@timesoftcon.co.kr`)이 외부 데이터 이슈로 인증 불가가 되자, "관리자를 우리가 독립적으로 통제"할 필요가 명확해짐. 해결: 전용 관리자는 `admin@timesoftcon.co.kr` 하나로 두고, 우리 DB에 **로컬 비번(bcrypt)** 을 부여(시드 `setupDemoAdmin`). `CompositeAuthProvider`(로컬 비번 보유 계정은 로컬 검증, 나머지는 ezpass 위임 — [[ADR-022]])가 이 계정을 ezpass와 무관하게 인증한다. 직원(`user001~038@exam.com`)은 그대로 ezpass. 이는 세션 초기 사용자 의도("EMP/ADM 구분은 우리쪽 관리자 권한으로")와도 일치.
2. **연차 = 우리 DB가 마스터** ([[ADR-016]] 유지) — 단 평면 컬럼을 ezpass `tbl_user_yryc`를 본뜬 **`leave_balance`(user×year×휴가유형, granted/adjusted/used)** 구조로 승격. 휴가유형으로 **3-flag(REGULAR/AUCTION/EVENT) 분리 유지**(근로기준법 명분). 초기 잔여는 ezpass에서 **시드**.
3. **경매금(지갑)·입찰·escrow·배당 = 우리 DB.**
4. **ezpass의 실제 연차 테이블은 쓰지 않는다(읽기만).** 진짜 HR 연차에 경매분을 써넣는 위험을 피함. 경매 낙찰 연차는 우리 `leave_balance.adjustedDays`(= ezpass `mdat_yryc_day_qty` 대응)에 적립.

   > **개정 (2026-06-01, [[ADR-025]]): §4 완화** — 낙찰 정산 후 Outbox 경유로 ezpass `mdat_yryc_day_qty`에 +N 쓰게 허용(opt-in, `HR_LEAVE_CLIENT_KIND=ezpass`). **쓰기 경로는 정식 REST API**(`AdmDlz0070M/streYryc` + `CmnDlz0020P/selectUserYrycInfo`)만 — DB 직쓰기 금지. cmpny 가드는 시스템 토큰에서 자동. 우리 `leave_balance(AUCTION)`은 그대로 마스터. 자세한 트레이드오프와 안전장치는 [[ADR-025]] 참조.

## 결과 및 트레이드오프

- ✅ **정산 원자성 유지** — 연차 부여가 우리 로컬 트랜잭션 안에서 끝나 [[ADR-005]] Outbox를 깨우지 않음(휴면 유지).
- ✅ **3-flag·근로기준법 명분 유지** — 휴가유형을 우리가 소유.
- ✅ **직급/직책 정확 표시** — "사원" 일괄 표기 해소.
- ⚠️ **회원 신원은 ezpass 의존** — 로그인 시 `msaportal` 조회 결합. ezpass 다운 시 신원 보강 불가(로그인 자체도 ezpass 의존이라 동일선상).
- ⚠️ **시드 전제** — ezpass 잔여 시드는 우리 `users`가 ezpass 회원과 매핑(이메일)되어 있어야 폭넓게 동작 → ezpass cmpny 회원 미러(회원 동기화)가 후속 과제.

## 관련 문서
- [[ADR-019]] 중앙 인증 위임 / [[ADR-016]] 연차 마스터 / [[ADR-002]] 3-flag / [[ADR-005]] HR API 타이밍(휴면)
- 코드: `backend/prisma/schema.prisma`(`LeaveBalance`/`LeaveType`), 마이그레이션 `20260526000000_promote_leave_balance`, `application/user/get-user-leave.use-case.ts`, `prisma/seed.ts`, `scripts/seed-leave-from-ezpass.ts`
