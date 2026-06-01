# 아키텍처 결정 기록 (ADR) 인덱스

본 디렉토리는 프로젝트의 주요 설계 결정을 **Why** 중심으로 기록한다.

## ADR 포맷

각 ADR은 다음 구조를 따른다:

```markdown
# ADR-XXX: 제목

- **상태**: Proposed | Accepted | Deprecated | Superseded by ADR-YYY
- **결정일**: YYYY-MM-DD
- **결정자**: 타임소프트콘 (김기철, 오지석)

## 컨텍스트 (Context)
## 초기 아이디어 (Considered but Rejected)
## 회피한 리스크 (Risks Avoided)
## 결정 (Decision)
## 결과 및 트레이드오프 (Consequences)
## 관련 문서
```

## ADR 목록

| ID | 제목 | 상태 | 비고 |
|---|---|---|---|
| [001](ADR-001-escrow-model.md) | Escrow 후 배당 모델 채택 | ✅ Accepted | 재무 리스크 0% 핵심 |
| [002](ADR-002-leave-type-flag.md) | 휴가 속성 3-flag 분리 | ✅ Accepted | 이중 보상 사고 방지 |
| [003](ADR-003-forced-priority.md) | 백엔드 강제 차감 우선순위 | ✅ Accepted | UX 사고 방지 |
| [004](ADR-004-year-partitioning.md) | Year 기준 파티셔닝 | ✅ Accepted | 오버엔지니어링 방지 |
| [005](ADR-005-hr-api-timing.md) | HR API 호출 시점 (Outbox vs Saga) | ✅ Accepted | Outbox 채택 + InternalLeaveAdapter로 분산 트랜잭션 회피 |
| [006](ADR-006-redis-lock.md) | Redis 분산 락 선택 | ⛔ Superseded | CUT-1(SQLite write 락)로 대체 |
| [007](ADR-007-one-day-unit.md) | 경매 단위 "1일권" 고정 | 🟡 Proposed | 연속 N일권 불가 근거 |
| [008](ADR-008-year-end-dividend.md) | 연말 일괄 배당 (즉시 분배 불가) | 🟡 Proposed | 001의 자연 귀결 명문화 |
| [009](ADR-009-point-reuse.md) | 기존 복지 포인트 재활용 | ✅ Accepted (v2) | 정책 결정 (구조는 010, 보완은 011) |
| [010](ADR-010-currency-abstraction.md) | 통화 추상화 (CurrencyProvider) | ✅ Accepted | OCP — 화폐 교체 가능성 흡수 |
| [011](ADR-011-welfare-point-ownership.md) | 복지 포인트 시스템 자체 보유 | ✅ Accepted | wallet 마스터 본 시스템 보유 |
| [012](ADR-012-hexagonal-architecture.md) | Hexagonal Architecture | ✅ Accepted | 도메인 코어 격리 |
| [013](ADR-013-domain-event.md) | Domain Event 기반 처리 | ✅ Accepted | 횡단 관심사 분리 |
| [014](ADR-014-auction-state-pattern.md) | Auction State 패턴 | ✅ Accepted | 상태 전이 코드화 |
| [015](ADR-015-value-object.md) | Value Object 도입 정책 | ✅ Accepted | Primitive Obsession 회피 |
| [016](ADR-016-internal-leave-system.md) | 자체 휴가 관리 시스템 보유 | ✅ Accepted | leave_balance 마스터 본 시스템 보유 (011의 휴가 버전) |
| [017](ADR-017-leave-pool-context.md) | 휴가 풀/경매 인벤토리 분리 컨텍스트 | ✅ Accepted | 연말 풀 수집을 별도 Bounded Context로 |
| [018](ADR-018-auction-settlement-rules.md) | 경매 정산 규칙 (패자 환불·입찰 취소) | ✅ Accepted | 밀리는 즉시 환불 + 입찰 취소 불가 |
| [019](ADR-019-central-auth-delegation.md) | 사내 중앙 인증 위임 (ezpass) | ✅ Accepted | 로그인을 ezpass에 위임 (SSO 아님), 검증 완료 |
| [020](ADR-020-member-identity-ezpass-leave-internal.md) | 신원=ezpass / 연차·경매금=우리 DB | ✅ Accepted | 회원 신원·조직·role은 ezpass, 연차·지갑은 우리 마스터 |
| [021](ADR-021-portable-handoff-export.md) | 이식형 핸드오프 export | ✅ Accepted | 정산 데이터를 CSV/MD/JSON/xlsx로 내보내 각 사 HR가 반영 |
| [022](ADR-022-identity-adapter-deployment-modes.md) | 신원 어댑터화 & 배포 모드 (위임형/자립형) | ✅ Accepted | AUTH_MODE로 ezpass 위임↔LocalAuthProvider 자립 전환, 회원관리 탭 모드별 |
| [023](ADR-023-internal-redemption-channels.md) | 자립형 배포 — 내부 포인트 소모처(스토어) | ✅ Accepted | UI는 "스토어"로 표기. 카탈로그·교환(REDEEM)·`RedemptionChannel` 포트 MVP 구현. 회사 복지몰 없는 환경용 |
| [024](ADR-024-user-initiated-charge-request.md) | 사용자 주도 충전 요청 — 관리자 매개 | ✅ Accepted | "후불 느낌"을 관리자 매개로 — P2P 회피 + 인바리언트 0 깨짐. EventBus가 첫 다회 구독자 |

## 의존 관계

```
[정책 결정]
ADR-001 (Escrow 모델)
  ├─ ADR-008 (연말 일괄 배당)           ← 001의 필연적 결과
  └─ ADR-009 (포인트 재활용)            ← 001의 재화 선택
       └─ ADR-011 (wallet 자체 보유)    ← 009의 전제 충족 불가 시 보완

ADR-002 (3-flag 분리)
  └─ ADR-003 (강제 우선순위)            ← 002의 운영 규칙

ADR-004 (Year 파티셔닝)                 ← 002와 연계 (AUCTION/EVENT 소멸)

ADR-005 (HR API 타이밍) ✅             ← Outbox 채택, 내부화로 분산 트랜잭션 회피
  └─ ADR-016 (자체 휴가 관리 보유)      ← 005의 내부화 결정 상세 (011의 휴가 버전)
       └─ ADR-017 (휴가 풀 분리 컨텍스트) ← 016에서 연말 배치를 분리
ADR-006 (Redis 락, Superseded)         ← CUT-1(SQLite write 락)로 대체
ADR-007 (1일권 고정)                   ← 004와 연계
ADR-018 (경매 정산 규칙)               ← 009의 "즉시 차감/환불"을 패자 환불·입찰 취소로 구체화

[구조 결정 — 정책에 직교]
ADR-012 (Hexagonal Architecture)       ← 상위 구조 결정
  ├─ ADR-010 (Currency 추상화)         ← outbound port 대표 예시
  │    └─ ADR-009의 *구조*적 측면 위임
  ├─ ADR-013 (Domain Event)            ← outbound port: EventBus
  ├─ ADR-014 (Auction State 패턴)      ← 도메인 코어 내부
  ├─ ADR-015 (Value Object 정책)       ← 도메인 코어 내부
  ├─ ADR-016 (자체 휴가 관리)          ← LeaveGrantPort = outbound port
  └─ ADR-017 (휴가 풀 분리)            ← Bounded Context 경계
```

> **패턴 일관성**: ADR-010/011(화폐) · ADR-016(휴가) · ADR-005(HR 타이밍)는 모두 *동일한 결정*의 변주 — "외부 자원을 포트 뒤로 추상화하고, 현재는 내부 어댑터를 기본 구현체로, 실 외부 연동은 추후 어댑터 교체".

## 새 ADR 작성 가이드

1. 기존 번호 중복 없이 새 번호 부여 (`ADR-010-xxx.md`)
2. 위 포맷 준수
3. 본 README 표에 추가
4. 영향받는 기존 ADR은 `Superseded by` 또는 `Related` 섹션으로 연결
