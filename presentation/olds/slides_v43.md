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
  .act5 {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    grid-template-rows: auto auto;
    gap: 10px;
    margin-top: 8px;
  }
  .actbox {
    background:#f8f9fc;
    border:1px solid #dde2ee;
    border-radius:8px;
    padding:10px 12px;
    font-size:15px;
  }
  .actbox.hilite { border:2px solid #a04500; background:#fff7ee; }
  .actbox.span2  { grid-column: span 2; }
  .actbox .hdr   { color:#1f3a93; font-weight:700; font-size:17px; }
  .actbox .sub   { color:#444; font-weight:600; margin-bottom:6px; font-size:14px; }
  .actbox .shot  { height:110px; margin:6px 0; font-size:12px; padding:8px; }
  .actbox .shot small { font-size: 11px; }
  .actbox ul     { margin:4px 0 0 0; padding-left:16px; }
  .actbox li     { margin-bottom:2px; }
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
| **3** | 관리자 — KPI · **유찰 처리(EVENT/REOPEN)** · **스토어 상품관리** <span class="tag-new">NEW</span> | 6분 |
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
<h4>관리자 화면 (8종)</h4>
<ul>
<li>운영 대시보드 (KPI 5칸 + 내보내기)</li>
<li>회원 관리 (ezpass 동기화 / EXAM CRUD)</li>
<li>경매 관리 (생성·스케줄·마감·연장)</li>
<li><b>스토어 상품관리</b> <span class="tag-new">NEW</span> — CRUD + 감사로그</li>
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

## 시연 시작 시점 — 시드 상태

<div class="cols">
<div class="cols-l">

<div class="grid4" style="grid-template-columns: 1fr;">

<div class="box">
<h4>EXAM 회사 (오늘의 메인 무대)</h4>
<ul>
<li>회원 4명 — <code>exam001~003</code> + <code>examadmin</code></li>
<li>각 직원: <b>100,000 콘</b> + REGULAR 15일</li>
</ul>
</div>

<div class="box">
<h4>경매판</h4>
<ul>
<li>진행 중 1일권 매물 (시작가 30,000 콘 고정)</li>
<li>유찰 재고 일부 (액트 3-2 수동 처리용)</li>
</ul>
</div>

<div class="box">
<h4>스토어 카탈로그 + 작년 시드</h4>
<ul>
<li>AI 구독 · 식권 · 카페 · 기프티콘 8종</li>
<li><b>2025년 AWARDED 39건</b> + 10명 stake (액트 4 배당용)</li>
</ul>
</div>

</div>

</div>
<div class="cols-r">

<div class="shot" style="height:160px; margin-bottom:8px">
관리자 운영 대시보드 KPI 캡쳐<br>
(580 × 200)
<small>시연 시작 전 KPI 5칸 상태</small>
</div>

<br>

**시드 = 시연의 출발선**

이 시점에서 사용자창을 열면 *살 매물*이 이미 떠 있다. 관리자는 별도 사전 준비 없이 곧바로 운영에 들어간다.

<span class="xs">⏱ 15초</span>

</div>
</div>

---

## 5막 한눈에 — 라이브 시연 22분

<div class="act5">

<div class="actbox">
<div class="hdr">액트 1 · 5분</div>
<div class="sub">사용자가 1일권을 산다</div>
<div class="shot small">
시퀀스 썸네일<br>
<small>(320×120)<br>입찰→환불→마감→연차</small>
</div>
<ul>
<li>OUTBID <b>자동환불</b></li>
<li>AUCTION 1일 <b>즉시 부여</b></li>
</ul>
</div>

<div class="actbox">
<div class="hdr">액트 2 · 3분</div>
<div class="sub">스토어 → 수령대기 → 보관함</div>
<div class="shot small">
스토어 화면 썸네일<br>
<small>(320×120)<br>수령대기 패널 강조</small>
</div>
<ul>
<li>우상단 <b>「수령 대기」</b></li>
<li>📦 보관함 <b>영구 보존</b></li>
</ul>
</div>

<div class="actbox">
<div class="hdr">액트 3 · 6분</div>
<div class="sub">관리자 운영 5단계</div>
<div class="shot small">
관리자 콘솔 썸네일<br>
<small>(320×120)<br>KPI · 유찰 모달 · 스토어</small>
</div>
<ul>
<li>유찰 <b>EVENT/REOPEN</b> <span class="tag-new" style="font-size:12px">NEW</span></li>
<li>스토어 상품관리 <span class="tag-new" style="font-size:12px">NEW</span></li>
<li>회원관리 두 탭</li>
</ul>
</div>

<div class="actbox hilite span2">
<div class="hdr">액트 4 · 5분 <span class="tag-key">핵심</span></div>
<div class="sub">12/31의 마법 — 풀 수집 + 배당 → 에스크로 0</div>
<div class="shot small" style="height:90px">
풀 수집 + 배당 dryRun 표 썸네일<br>
<small>(640×80)</small>
</div>
<ul style="display:grid;grid-template-columns:1fr 1fr;gap:0 16px">
<li>풀 수집 → 익년도 LP-2026-* 매물</li>
<li>배당 dryRun → 실지급 → <b>에스크로 0</b></li>
<li>NFR-2: Σ(BID+WIN)−Σ(REFUND+DIV) = 0</li>
<li>시드: 작년 39건 + stake 10명</li>
</ul>
</div>

<div class="actbox">
<div class="hdr">액트 5 · 3분</div>
<div class="sub">회사별 완전 독립</div>
<div class="shot small">
회사 격리 다이어그램<br>
<small>(320×120)<br>EZPASS · EXAM 박스</small>
</div>
<ul>
<li>JWT companyId 자동 스코프</li>
<li>ADMIN만 회사 스위처</li>
</ul>
</div>

</div>

---

## 시연 전 한 페이지 요약

| 영역 | 결과 |
|---|---|
| **사용자 화면** | 5종 — 입찰부터 쿠폰 수령까지 풀 동작 |
| **관리자 화면** | 8종 — 운영·회원·경매·**스토어**·교환·원장·알림·풀정책 풀 동작 |
| **백그라운드 스케줄러** | 5종 — 자동 마감·점진발행·연말배당·풀수집·유찰퍼지 |
| **회사 격리** | JWT 클레임 기반, 코드 변경 0으로 새 회사 추가 |
| **연말 정산** | 단일 트랜잭션 · 멱등 · **에스크로 0 정합 검증** |

<br>

<div class="stagebox" style="text-align:center; font-size:22px">
<b>"P2P 위법이라, 회사가 중개하고 연말에 돌려준다 — 9주에 완성"</b>
</div>

---

<!-- _class: lead -->

# 지금부터 라이브 시연

<br>

**5막 · 약 22분 · 브라우저 화면 중심**
**액트 1 → 2 → 3 → 4 → 5 연속**

<br>

<div class="stagebox" style="font-size:18px">
PPT는 여기서 닫고 브라우저로 — 시연 끝나면 곧바로 <b>Q&A</b>
</div>

<br>

<span class="xs">시연 실패 시 부록 A3(백업 캡쳐)로 복귀</span>

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
- `BiddingCurrency` (입찰 통화 · 콘)
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
