// 분산 오픈 정책(ADR-025) — 순수 함수.
// 관리자가 정한 cadence(daily/weekly/monthly + 시각 + 수량)대로,
// baseDate부터 count개의 startedAt를 결정적으로 생성한다.
// 외부 의존 0(인바리언트 #7). 재현 테스트는 baseDate를 인자로 줘서 결정적.

/** 정책별 발행 매물 시작가(콘). null/undefined면 ENV/기본값 사용. */
export type PolicyStartPrice = { startPrice?: bigint | null };

export type ReleasePolicy =
  | ({ cadence: "none" } & PolicyStartPrice)
  | ({ cadence: "daily"; timeOfDay: string; quantity: number } & PolicyStartPrice)
  | ({ cadence: "weekly"; dayOfWeek: number; timeOfDay: string; quantity: number } & PolicyStartPrice) // 0=일 … 6=토
  | ({ cadence: "monthly"; dayOfMonth: number; timeOfDay: string; quantity: number } & PolicyStartPrice); // 1..31, 월말 EOM 폴백

/**
 * baseDate(이후)부터 정책대로 발행 시각을 채워 count개의 startedAt 배열을 반환.
 * 같은 발행 시각이 N개 매물에 매겨질 수 있음(quantity가 그만큼이면).
 */
export function planRelease(policy: ReleasePolicy, count: number, baseDate: Date): Date[] {
  if (count <= 0) return [];
  if (policy.cadence === "none") {
    // 모든 매물을 baseDate로(자동 분산 비활성). CollectLeavePool에서 분기해서
    // 이 함수를 안 부르는 게 정상 경로지만, 안전망으로 처리도 해 둔다.
    return Array.from({ length: count }, () => new Date(baseDate.getTime()));
  }
  const [hh, mm] = parseTimeOfDay(policy.timeOfDay);
  if (policy.quantity <= 0) throw new Error("quantity must be positive");

  const result: Date[] = [];
  let cursor = new Date(baseDate.getTime());
  // 안전장치 — 무한루프 방지(정책상 1회 발행이 매물 ≥1 이므로 count tick 안에 끝나야 함).
  const maxOccurrences = count + 5;
  let occ: Date;
  for (let i = 0; i < maxOccurrences && result.length < count; i++) {
    if (policy.cadence === "daily") {
      occ = nextDaily(cursor, hh, mm);
    } else if (policy.cadence === "weekly") {
      occ = nextWeekly(cursor, policy.dayOfWeek, hh, mm);
    } else {
      occ = nextMonthly(cursor, policy.dayOfMonth, hh, mm);
    }
    const take = Math.min(policy.quantity, count - result.length);
    for (let j = 0; j < take; j++) result.push(new Date(occ.getTime()));
    cursor = new Date(occ.getTime() + 1); // 다음 회차 검색을 위해 한 ms 뒤로
  }
  if (result.length !== count) {
    throw new Error(`planRelease: 발행 회차가 부족합니다 (생성=${result.length}/요청=${count})`);
  }
  return result;
}

// ── 보조: 다음 회차 ────────────────────────────────────────────────

function nextDaily(after: Date, hh: number, mm: number): Date {
  const d = new Date(after);
  d.setHours(hh, mm, 0, 0);
  if (d.getTime() <= after.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

function nextWeekly(after: Date, dayOfWeek: number, hh: number, mm: number): Date {
  const d = new Date(after);
  d.setHours(hh, mm, 0, 0);
  const diff = (dayOfWeek - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  if (d.getTime() <= after.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

function nextMonthly(after: Date, dayOfMonth: number, hh: number, mm: number): Date {
  let y = after.getFullYear();
  let m = after.getMonth();
  // 이 달부터 차례로 시도 — dayOfMonth가 그 달 마지막 날보다 크면 EOM 폴백.
  for (let attempts = 0; attempts < 13; attempts++) {
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = Math.min(dayOfMonth, lastDay);
    const candidate = new Date(y, m, day, hh, mm, 0, 0);
    if (candidate.getTime() > after.getTime()) return candidate;
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  throw new Error("nextMonthly: 적합한 다음 회차를 찾지 못함");
}

function parseTimeOfDay(s: string): [number, number] {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) throw new Error(`timeOfDay invalid: ${s} (expected HH:MM 24h)`);
  return [Number(m[1]), Number(m[2])];
}
