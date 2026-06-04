---
marp: true
theme: default
paginate: true
size: 16:9
header: '사내 연차 경매 시스템 · 타임소프트콘 · 14주차 최종 시연'
style: |
  section { font-size: 24px; font-family: 'Malgun Gothic','Noto Sans KR','Apple SD Gothic Neo','Segoe UI',sans-serif; }
  img { display: block; margin: 0 auto; }
  pre, code { font-family: 'D2Coding','Consolas','Malgun Gothic',monospace; }
  h1 { color: #1f3a93; }
  h2 { color: #1f3a93; border-bottom: 2px solid #1f3a93; padding-bottom: 4px; }
  h3 { color: #1f3a93; }
  table { font-size: 19px; }
  td:first-child { white-space: nowrap; }
  code { font-size: 0.9em; }
  .small { font-size: 18px; }
  .xs { font-size: 16px; color: #555; }
  .tag { background:#eef2ff; color:#1f3a93; border-radius:6px; padding:1px 8px; font-size:16px; }
  .tag-new { background:#fff0e0; color:#a04500; border-radius:6px; padding:1px 8px; font-size:16px; font-weight:700; }
  .tag-key { background:#e6f4ea; color:#0d6e2c; border-radius:6px; padding:1px 8px; font-size:16px; font-weight:700; }
  .cols { display: flex; gap: 30px; align-items: flex-start; }
  .cols-l { flex: 0 0 58%; }
  .cols-r { flex: 1; font-size: 21px; }
  .cols-r li { margin-bottom: 14px; }
  .shot {
    border: 2px dashed #1f3a93;
    background: #f5f7fb;
    color: #1f3a93;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 16px;
    font-weight: 700;
    padding: 16px;
    border-radius: 8px;
    margin: 12px auto;
  }
  .shot small { display:block; color:#666; font-weight:400; margin-top:6px; font-size: 13px; }
  .stagebox { background:#f0f4ff; border-left:5px solid #1f3a93; padding:14px 18px; border-radius:6px; margin-top:10px; }
  .stagebox b { color:#1f3a93; }
  .grid4 { display:grid; grid-template-columns: 1fr 1fr; gap:16px; }
  .grid4 .box { background:#f8f9fc; border:1px solid #dde2ee; border-radius:8px; padding:14px; }
  .grid4 .box h4 { margin:0 0 8px 0; color:#1f3a93; font-size:18px; }
  .grid4 .box ul { margin:0; padding-left:18px; font-size:17px; }
  .grid4 .box ul li { margin-bottom:4px; }
---

<!-- _paginate: false -->
<!-- _header: '' -->
<!-- _class: lead -->

# 사내 연차 경매 시스템
### 완성된 제품 — 라이브 시연

**타임소프트콘** · 김기철 · 오지석
14주차 최종 발표

<br>

> 버려지던 연차를 **P2P 없이** 살리는
> **B2E 에스크로 & 배당** 모델 — 9주 만의 완성품

---

## 지난 발표 회상 (10초)

<div class="cols">
<div class="cols-l">

<div class="stagebox">

**13주차에서 다룬 것**
- 문제 정의 (P2P 위법 → B2E)
- 설계 (에스크로 / 3-flag 휴가)
- 헥사고날 + 12 불변식 + UML 8장
- 핵심 ADR 24편

</div>

<br>

<div class="stagebox" style="border-left-color:#a04500;background:#fff7ee">

**오늘(14주차) 다룰 것**
**무엇이 실제로 동작하는가** — 라이브 시연 중심

</div>

</div>
<div class="cols-r">

<div class="shot" style="height:280px">
v40 표지 슬라이드 캡쳐<br>
(1080 × 540)
<small>"이미 다룬 설계는 여기에"<br>참고용 핀 슬라이드</small>
</div>

</div>
</div>

---

## 오늘의 메뉴 (Agenda)

| 액트 | 무엇을 시연 | 시간 |
|---|---|---|
| **1** | 사용자 — 입찰 · 자동환불 · 낙찰 · AUCTION 연차 | 5분 |
| **2** | 사용자 — 스토어 · 수령대기 · 보관함 | 3분 |
| **3** | 관리자 — KPI · **유찰 매물 수동 처리** <span class="tag-new">NEW</span> | 5분 |
| **4** | **연말 — 풀 수집 · 배당 정산 (에스크로 0)** <span class="tag-key">핵심</span> | 5분 |
| **5** | 회사별 완전 독립 — EZPASS ↔ EXAM | 3분 |
| Q&A | | 5분 |

<br>

<span class="xs">슬라이드는 *전환 프레임* — 본 무대는 브라우저. 슬라이드에 머무는 시간은 평균 10–20초.</span>

---

## 시스템 한 줄로

<div class="cols">
<div class="cols-l">

<div class="shot" style="height:340px">
시스템 흐름 다이어그램<br>
(640 × 480)
<small>
직원 콘 → [입찰/낙찰] → 에스크로 잠금<br>
&nbsp; ↓<br>
[12/31 배당 정산]<br>
&nbsp; ↓<br>
기여자 복지카드 크레딧
</small>
</div>

</div>
<div class="cols-r">

**P2P 거래 0건**
*위법(근로기준법 60·61조) 회피*

**회사 신규 지출 0원**
*에스크로 모델 — 콘은 직원 사이를 순환만*

**연말 배당 = 에스크로 정확히 0**
*Σ(BID+WIN) − Σ(REFUND+DIV) = 0*

</div>
</div>

---

## 구현 인벤토리 — 한 페이지로

<div class="grid4">

<div class="box">
<h4>사용자 화면 (5종)</h4>
<ul>
<li>로그인 (도메인 자동 분기)</li>
<li>대시보드 (잔액 · 3-flag 연차 · 진행경매 · 알림)</li>
<li>경매 목록·상세 (폴링 갱신)</li>
<li>스토어 (수령대기 / 📦 보관함)</li>
<li>충전 요청</li>
</ul>
</div>

<div class="box">
<h4>관리자 화면 (7종)</h4>
<ul>
<li>운영 대시보드 (KPI 5칸 + 내보내기)</li>
<li>경매 관리 (생성·스케줄·마감·연장)</li>
<li>회원 관리 (ezpass 동기화 / EXAM CRUD)</li>
<li>교환신청 처리 (승인+쿠폰 / 반려+환불)</li>
<li>원장 조회 · 알림 센터 · 풀 분산 정책</li>
</ul>
</div>

<div class="box">
<h4>백그라운드 스케줄러 (5종)</h4>
<ul>
<li>오픈/마감 자동 정산 (60s)</li>
<li>점진 발행 (분산 오픈)</li>
<li>연말 배당 · 연말 풀 수집 (12/31)</li>
<li>유찰 재고 영구 삭제 (1/1)</li>
</ul>
</div>

<div class="box">
<h4>가로지르는 것 (4)</h4>
<ul>
<li>멀티테넌시 — 회사별 완전 격리</li>
<li>5종 role 게이팅</li>
<li>인증 2모드 — ezpass 위임 / 로컬 bcrypt</li>
<li>정산 내보내기 — Excel/MD/JSON</li>
</ul>
</div>

</div>

---

<!-- _class: lead -->

# 액트 1 · 사용자가 1일권을 산다

**로그인 → 입찰 → OUTBID 자동환불 → 즉시마감 → AUCTION 연차 자동 부여**

<div class="shot" style="width:80%; height:200px">
시퀀스 다이어그램 미리보기<br>
(960 × 220)
<small>4단계 화살표 — 입찰 / 환불 / 마감 / 연차 부여</small>
</div>

<div class="stagebox">
지금부터 <b>브라우저</b>로 — 시크릿창 2개(사용자 / 관리자)
</div>

---

## 액트 1 · 미리보기 화면

<div class="cols">
<div class="cols-l">

<div class="shot" style="height:380px">
경매 상세 페이지 캡쳐<br>
(720 × 430)
<small>현재가 · 최소 입찰단위 · 마감시각 · 입찰 버튼</small>
</div>

</div>
<div class="cols-r">

**짚을 포인트**

- 시작가 **30,000 콘** 고정
- 입찰 즉시 **지갑 차감 + 에스크로 입금**이 **단일 트랜잭션**
- OUTBID → 이전 입찰자에 **자동 환불**
- 알림 옵저버가 토스트까지 자동
- 낙찰 → **AUCTION 1일** 즉시 부여

<br>

<span class="xs">⏱ 5분</span>

</div>
</div>

---

<!-- _class: lead -->

# 액트 2 · 스토어 → 수령대기 → 보관함

**모은 콘을 진짜 쿠폰으로 — 새 UX 패턴 시연**

<div class="shot" style="width:70%; height:240px">
스토어 화면 + 우상단 수령대기 패널 강조 캡쳐<br>
(960 × 300)
<small>잔액카드 · 「📦 수령 대기 N건」 · 「📦 보관함」 버튼</small>
</div>

---

## 액트 2 · 짚을 UX 포인트

<div class="cols">
<div class="cols-l">

<div class="shot" style="height:200px; margin-bottom:8px">
교환 신청 모달 캡쳐<br>
(580 × 200)
</div>

<div class="shot" style="height:200px">
보관함 모달 캡쳐<br>
(580 × 200)
<small>수령 완료한 쿠폰코드 재확인</small>
</div>

</div>
<div class="cols-r">

**왜 이 UX인가**

- 「수령 대기」를 **화면 상단 고정** — 직원이 스크롤 안 해도 놓치지 않음
- 「보관함」 — **이미 수령한 쿠폰도 영구 보존**
- 카탈로그 4종: AI 구독·식권·카페·기프티콘
- 관리자 KPI 카드 **재클릭 시 전체 필터로 토글**

<br>

<span class="xs">⏱ 3분</span>

</div>
</div>

---

<!-- _class: lead -->

# 액트 3 · 관리자 운영

**KPI · 회원관리 · 유찰 매물 수동 처리** <span class="tag-new">NEW</span>

<div class="shot" style="width:75%; height:240px">
운영 대시보드 KPI 5칸 캡쳐<br>
(1000 × 280)
<small>에스크로 잔액 · 진행 · 예정 · 유찰 · 오늘 낙찰</small>
</div>

---

## 액트 3 · 유찰 매물 수동 처리 (신규)

<div class="cols">
<div class="cols-l">

<div class="shot" style="height:420px">
유찰 매물 처리 모달 캡쳐<br>
(700 × 480)
<small>
매물 정보 박스 (ID · 연차일 · 마감)<br>
모드 토글: EVENT 지급 / 재경매<br>
직원 검색 + 리스트 (이름·사번·부서)
</small>
</div>

</div>
<div class="cols-r">

**두 가지 모드**

**① EVENT 휴가 지급**
- 임의 직원에게 EVENT 1일 부여
- 매물 즉시 소진 (DB 삭제)

**② 재경매 (REOPEN)**
- 같은 회사의 새 1일권으로 재오픈
- 시작/마감 시각 즉시 설정
- 원본 매물은 소진

<br>

<span class="xs">⏱ 5분 (모드 양쪽 다 시연)</span>

</div>
</div>

---

## 액트 3 · 회원관리 두 탭 비교

<div class="grid4">

<div class="box">
<h4>EZPASS 탭 (연동)</h4>
<ul>
<li>회원 추가 버튼 <b>없음</b></li>
<li>작업 컬럼(수정·비활성) <b>없음</b></li>
<li>「지금 동기화」 / 「ezpass에서 관리 ↗」</li>
<li>신원 정본: <b>ezpass</b></li>
</ul>
</div>

<div class="box">
<h4>EXAM 탭 (독립)</h4>
<ul>
<li>「회원 추가 (exam)」 <b>있음</b></li>
<li>행별 수정 / 비활성 <b>있음</b></li>
<li>신원 정본: <b>우리 DB</b></li>
<li>로컬 bcrypt 비번</li>
</ul>
</div>

</div>

<div class="shot" style="width:90%; height:200px; margin-top:10px">
회원관리 화면 — 탭 전환 전후 비교 캡쳐 2장 (좌·우)<br>
(960 × 220)
<small>같은 화면, 탭만 다르게 동작하는 모습</small>
</div>

---

<!-- _class: lead -->

# 액트 4 · 12/31의 마법

**작년 39건 시드 데이터로 — 풀 수집 + 배당 → 에스크로 0**

<div class="stagebox" style="font-size:22px; text-align:center">
<b>Σ(BID + WIN) − Σ(REFUND + DIVIDEND) = ESCROW.balance</b><br>
<span class="xs">NFR-2 불변식 — 회계 정합성의 한 줄</span>
</div>

---

## 액트 4 · 시연 순서

<div class="cols">
<div class="cols-l">

<div class="shot" style="height:200px; margin-bottom:6px">
풀 수집 dryRun 모달 캡쳐<br>
(580 × 200)
</div>

<div class="shot" style="height:200px">
배당 정산 dryRun 표 캡쳐<br>
(580 × 200)
<small>사용자별 stake · 비율 · 분배 금액</small>
</div>

</div>
<div class="cols-r">

**6-2. 풀 수집** (1분 30초)
올해 REGULAR 미사용분 → 익년도 1일권 N개 (LP-2026-*)

**6-3. 배당 정산** (2분 30초)
- dryRun 미리보기 → **실지급**
- KPI 에스크로 → **0**
- 원장에 DIVIDEND 10건 INSERT

**6-4. 멱등성 보너스** (30초)
- 한 번 더 누르면 **409**
- 데이터 무변경

<br>

<span class="xs">⏱ 5분 — <b>절대 자르지 않는다</b></span>

</div>
</div>

---

<!-- _class: lead -->

# 액트 5 · 회사별 완전 독립

**JWT(companyId) → @CompanyScope → 모든 쿼리 자동 스코프**

<div class="shot" style="width:80%; height:280px">
회사 격리 다이어그램<br>
(960 × 320)
<small>
EZPASS 박스 (회원·매물·원장) | EXAM 박스 (회원·매물·원장)<br>
super ADMIN만 스위처로 두 박스 모두 접근
</small>
</div>

---

## 액트 5 · 보여줄 차이 3가지

| 차이 축 | EZPASS | EXAM |
|---|---|---|
| **인증** | ezpass 위임 (외부 IdP) | 로컬 bcrypt |
| **신원 정본** | ezpass DB sync | 우리 DB |
| **회원관리 UI** | 동기화 + 외부 링크 | 풀 CRUD |

<div class="cols">
<div class="cols-l">

<div class="shot" style="height:220px">
회사 스위처 드롭다운 캡쳐 (ADMIN 전용)<br>
(580 × 240)
</div>

</div>
<div class="cols-r">

**시연 순서**
1. `super@admin.local` → 스위처로 EZPASS ↔ EXAM 전환
2. 데이터가 완전히 다른 회사로 교체되는 모습
3. `examadmin@exam.com` 로그인 → **스위처 안 보임**
4. EXAM 회사 데이터만 노출

<br>

<span class="xs">⏱ 3분</span>

</div>
</div>

---

## 마무리 — 한 페이지 요약

| 영역 | 결과 |
|---|---|
| **사용자 화면** | 5종 — 입찰부터 쿠폰 수령까지 풀 동작 |
| **관리자 화면** | 7종 — 운영·회원·교환·원장·알림 풀 동작 |
| **백그라운드 스케줄러** | 5종 — 자동 마감·점진발행·연말배당·풀수집·유찰퍼지 |
| **회사 격리** | JWT 클레임 기반, 코드 변경 0으로 새 회사 추가 |
| **연말 정산** | 단일 트랜잭션 · 멱등 · **에스크로 0 정합 검증** |

<br>

<div class="stagebox" style="text-align:center; font-size:22px">
<b>"P2P 위법이라, 회사가 중개하고 연말에 돌려준다 — 9주에 완성"</b>
</div>

---

<!-- _class: lead -->

# Q & A

**아키텍처 · 멀티테넌시 · 확장성 · 테스트 — 무엇이든**

<br>

<span class="xs">부록 슬라이드 (S-A1~A3) 준비됨 — 질문 따라 호출</span>

---

<!-- _header: '부록 · 기술 스택' -->

## (부록 A1) 기술 스택

<div class="grid4">

<div class="box">
<h4>Backend</h4>
<ul>
<li>NestJS 10 · TypeScript</li>
<li>Prisma + <b>SQLite</b> (서버 의존 0)</li>
<li>JWT 자체 발급 (RBAC)</li>
<li>bcrypt 로컬 인증 + ezpass 위임</li>
</ul>
</div>

<div class="box">
<h4>Frontend</h4>
<ul>
<li>React 18 · Vite</li>
<li>TypeScript · Tailwind</li>
<li>폴링 기반 실시간 갱신</li>
<li>BigInt-as-string 직렬화</li>
</ul>
</div>

<div class="box">
<h4>품질 도구</h4>
<ul>
<li>ESLint <b>boundaries</b> — 헥사고날 강제</li>
<li>Zod 입력 검증 (HTTP 경계)</li>
<li>Jest 단위 / E2E</li>
</ul>
</div>

<div class="box">
<h4>운영</h4>
<ul>
<li>5종 스케줄러 (@nestjs/schedule)</li>
<li>@nestjs/event-emitter (옵저버)</li>
<li>SQLite 단일 트랜잭션 + 쓰기락</li>
</ul>
</div>

</div>

---

<!-- _header: '부록 · 구조' -->

## (부록 A2) 헥사고날 한 장

<div class="cols">
<div class="cols-l">

<div class="shot" style="height:380px">
헥사고날 동심원 다이어그램<br>
(presentation/img/clean-arch.png 사용)<br>
(580 × 420)
<small>
domain (중심) → application → ports → adapters → interfaces
</small>
</div>

</div>
<div class="cols-r">

**의존 방향 강제 (ESLint)**
- `domain → domain` only
- `application → domain, ports`
- `adapters → domain, ports`
- `interfaces → domain, ports, application`

**교체 가능한 외부**
- `BiddingCurrency` (포인트망)
- `LeaveGrantPort` (그룹웨어)
- `AuthProvider` (IdP)
- `PayoutChannel` (복지카드)

</div>
</div>

---

<!-- _header: '부록 · 시연 백업' -->

## (부록 A3) 시연 실패 시 백업 캡쳐

<div class="grid4">

<div class="box">
<h4>로그인 직후 대시보드</h4>
<div class="shot" style="height:140px; margin:6px 0">
(460 × 200)
</div>
</div>

<div class="box">
<h4>OUTBID 자동환불 토스트</h4>
<div class="shot" style="height:140px; margin:6px 0">
(460 × 200)
</div>
</div>

<div class="box">
<h4>낙찰 → AUCTION 연차 부여</h4>
<div class="shot" style="height:140px; margin:6px 0">
(460 × 200)
</div>
</div>

<div class="box">
<h4>배당 dryRun → 에스크로 0</h4>
<div class="shot" style="height:140px; margin:6px 0">
(460 × 200)
</div>
</div>

</div>

<span class="xs">백업 5장 모두 `presentation/img/demo-backup/` 폴더에 보관 — 백엔드 죽었을 때 즉시 호출</span>
