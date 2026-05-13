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
| [005](ADR-005-hr-api-timing.md) | HR API 호출 시점 (Outbox vs Saga) | 🔴 **Proposed** | **시작 전 반드시 결정** |
| [006](ADR-006-redis-lock.md) | Redis 분산 락 선택 | 🟡 Proposed | PG advisory lock과의 비교 |
| [007](ADR-007-one-day-unit.md) | 경매 단위 "1일권" 고정 | 🟡 Proposed | 연속 N일권 불가 근거 |
| [008](ADR-008-year-end-dividend.md) | 연말 일괄 배당 (즉시 분배 불가) | 🟡 Proposed | 001의 자연 귀결 명문화 |
| [009](ADR-009-point-reuse.md) | 기존 복지 포인트 재활용 | 🟡 Proposed | 신규 화폐 미발행 근거 |

## 의존 관계

```
ADR-001 (Escrow 모델)
  ├─ ADR-008 (연말 일괄 배당)           ← 001의 필연적 결과
  └─ ADR-009 (포인트 재활용)            ← 001의 재화 선택

ADR-002 (3-flag 분리)
  └─ ADR-003 (강제 우선순위)            ← 002의 운영 규칙

ADR-004 (Year 파티셔닝)                 ← 002와 연계 (AUCTION/EVENT 소멸)

ADR-005 (HR API 타이밍) 🔴             ← 전체 트랜잭션 설계의 핵심
ADR-006 (Redis 락)                     ← NFR-1 구현 수단
ADR-007 (1일권 고정)                   ← 004와 연계
```

## 새 ADR 작성 가이드

1. 기존 번호 중복 없이 새 번호 부여 (`ADR-010-xxx.md`)
2. 위 포맷 준수
3. 본 README 표에 추가
4. 영향받는 기존 ADR은 `Superseded by` 또는 `Related` 섹션으로 연결
