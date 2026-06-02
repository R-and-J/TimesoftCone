// Release 회차 식별 — ReleasePolicy + 현재 시각 → "이번 회차"의 식별자/도래 시각.
// 멱등 키(periodIndex)는 cadence별 결정적 문자열로:
//   - none:    "ONCE"          (수집 후 1회만 전부 풀어내기)
//   - daily:   "YYYY-MM-DD"
//   - weekly:  ISO 주 "YYYY-Www"
//   - monthly: "YYYY-MM"
// 외부 의존 0.

import type { ReleasePolicy } from "./release-plan";

export type ReleaseWindow = {
  periodIndex: string;
  /** 이번 회차의 도래 시각 — now < occurrenceDate면 아직 기다림. */
  occurrenceDate: Date;
};

export function currentReleaseWindow(policy: ReleasePolicy, now: Date): ReleaseWindow {
  if (policy.cadence === "none") {
    return { periodIndex: "ONCE", occurrenceDate: new Date(now.getTime()) };
  }
  const [hh, mm] = parseTimeOfDay(policy.timeOfDay);
  if (policy.cadence === "daily") {
    const d = new Date(now);
    d.setHours(hh, mm, 0, 0);
    return { periodIndex: ymd(d), occurrenceDate: d };
  }
  if (policy.cadence === "weekly") {
    // 이번 ISO 주의 dayOfWeek 시각. 그 요일이 이미 지난 주라면 다음 회차는 별도로 기다림.
    const d = new Date(now);
    const diff = (policy.dayOfWeek - d.getDay() + 7) % 7;
    d.setDate(d.getDate() + diff);
    d.setHours(hh, mm, 0, 0);
    return { periodIndex: isoWeek(d), occurrenceDate: d };
  }
  // monthly
  const y = now.getFullYear();
  const m = now.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  const day = Math.min(policy.dayOfMonth, lastDay);
  const d = new Date(y, m, day, hh, mm, 0, 0);
  return { periodIndex: `${y}-${pad2(m + 1)}`, occurrenceDate: d };
}

function parseTimeOfDay(s: string): [number, number] {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(s);
  if (!m) throw new Error(`timeOfDay invalid: ${s} (expected HH:MM 24h)`);
  return [Number(m[1]), Number(m[2])];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ISO 8601 주 — 그 해의 첫 목요일이 속한 주를 1주차로(목요일 알고리즘).
function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7; // 월=0 … 일=6
  t.setUTCDate(t.getUTCDate() - dayNum + 3); // 그 주의 목요일
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const weekNo = 1 + Math.round(
    (t.getTime() - firstThursday.getTime()) / (7 * 24 * 60 * 60 * 1000) -
      ((firstThursday.getUTCDay() + 6) % 7) / 7 +
      ((t.getUTCDay() + 6) % 7) / 7,
  );
  return `${t.getUTCFullYear()}-W${pad2(weekNo)}`;
}
