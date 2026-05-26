# ADR-021: 이식형 플랫폼 + 데이터 핸드오프(Export) — HR 연동은 도입사 책임

- **상태**: ✅ Accepted
- **결정일**: 2026-05-26
- **결정자**: 타임소프트콘

## 컨텍스트

낙찰로 획득한 연차를 직원의 *실제* HR/근태 시스템(예: ezpass)에 어떻게 반영할지 논의했다([[ADR-002]] 3-flag, [[ADR-016]] 연차 마스터). 후보:

- **A. 자기완결** — 연차를 우리 DB(`leave_balance` AUCTION)에만. 견고하지만 실제 HR에선 못 씀.
- **B/C. ezpass에 직접 쓰기** — 평면 연차로 넣고 연말에 우리 자료로 수당 제외. 실사용 가능하지만 ezpass에 AUCTION 타입이 없어 이중보상 위험 + HR측 협의 필요(ADR-002 경고).

근본 인식: **이 시스템은 "어느 회사나 쉽게 도입하는 이식형 B2E 플랫폼"**이다. 특정 HR 시스템(ezpass)에 직접 결합하면 이식성이 깨지고, 더블딥 같은 *각 사 급여/노무 정합성*까지 우리가 책임지게 된다.

## 결정

1. **코어는 자기완결**(A안): 경매·escrow·배당·**AUCTION 연차**는 전부 우리 DB가 마스터. 특정 HR에 직접 쓰지 않는다.
2. **연동 경계 = 데이터 핸드오프**: 정산 결과를 **CSV·JSON으로 export**하고, 각 도입사가 자사 HR/급여에 반영한다. 더블딥 제외 등 *노무 정합성은 도입사 HR의 책임* — 우리는 `leave_type=AUCTION`(비법정) **태그가 붙은 자료**를 제공해 판단 근거만 준다.
   - **낙찰 연차부여 내역**: `empId, 이름, email, 연도, leave_type(AUCTION), days, 출처 경매id, 지불포인트, 부여일시`
   - **연말 배당 내역**: `empId, 이름, 기여일수, 지분율, 배당금액`
   - 엔드포인트: `GET /api/admin/export/leave-grants`, `GET /api/admin/export/dividends` (`?format=csv|json`)
3. **ezpass 연동은 보너스 데모(PoC)**: 사내 ezpass에 읽기/쓰기로 연동 가능함을 스크립트로 시연(회원/조직/연차 시드). 코어 의존이 아니라 "연동도 된다"는 부가가치.

## 결과 및 트레이드오프

- ✅ **이식성** — 어떤 HR 시스템이든 표준 파일(CSV/JSON)로 받아 적용. 결합도 0.
- ✅ **책임 경계 명확** — 더블딥/수당 정합성은 도입사 HR 소관, 우리는 태그된 사실만 제공(우리 법적 리스크 축소).
- ✅ **코어 견고성 유지** — 정산은 단일 로컬 트랜잭션([[ADR-016]]), 외부 쓰기 의존 없음.
- ⚠️ **실시간 반영 아님** — 도입사가 export를 주기적으로 ingest해야 직원 HR에 연차가 잡힘(배치성).
- ⚠️ **태그 존중 전제** — 도입사 HR이 `leave_type=AUCTION`을 "연차수당 제외"로 해석해줘야 더블딥이 안 남(우리 책임 밖, 문서로 안내).

## 관련 문서
- [[ADR-002]] 3-flag(AUCTION 비법정) · [[ADR-016]] 연차 마스터 · [[ADR-020]] 회원=ezpass/연차=우리 · [[ADR-005]] HR API 타이밍(휴면)
- 코드: `backend/src/application/admin/export-settlement.use-case.ts`, `backend/src/interfaces/http/admin-export.controller.ts`
