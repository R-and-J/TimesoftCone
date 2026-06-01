import { describe, expect, it } from "@jest/globals";
import { planRelease, type ReleasePolicy } from "./release-plan";

// 결정적 테스트 — baseDate를 명시(now() 의존 X).
const base = new Date("2026-01-01T00:00:00.000Z");

describe("planRelease", () => {
  it("count=0이면 빈 배열", () => {
    expect(planRelease({ cadence: "daily", timeOfDay: "09:00", quantity: 5 }, 0, base)).toEqual([]);
  });

  it("daily: 매일 hh:mm에 qty개씩 — 7개면 3일이면 됨(3,3,1)", () => {
    const p: ReleasePolicy = { cadence: "daily", timeOfDay: "09:00", quantity: 3 };
    const r = planRelease(p, 7, base);
    expect(r.length).toBe(7);
    // 그룹별로 같은 시각이어야 함
    expect(r[0]).toEqual(r[1]);
    expect(r[0]).toEqual(r[2]);
    expect(r[3]).toEqual(r[4]);
    expect(r[3]).toEqual(r[5]);
    expect(r[6].getTime()).toBeGreaterThan(r[3].getTime());
    // 각 회차 사이 1일
    expect(r[3].getTime() - r[0].getTime()).toBe(24 * 3600_000);
    expect(r[6].getTime() - r[3].getTime()).toBe(24 * 3600_000);
  });

  it("weekly: 매주 화요일 — base가 1/1 목이면 첫 회차는 1/6 화", () => {
    // 화=2
    const p: ReleasePolicy = { cadence: "weekly", dayOfWeek: 2, timeOfDay: "09:00", quantity: 5 };
    const r = planRelease(p, 12, base);
    expect(r.length).toBe(12);
    // 첫 5개 같은 시각
    for (let i = 1; i < 5; i++) expect(r[i]).toEqual(r[0]);
    expect(r[0].getDay()).toBe(2); // 화
    // 다음 회차는 다음 주 화
    expect(r[5].getTime() - r[0].getTime()).toBe(7 * 24 * 3600_000);
    expect(r[10].getTime() - r[5].getTime()).toBe(7 * 24 * 3600_000);
  });

  it("monthly: 매월 3일 09:00 5개씩 — 첫 회차는 base 다음 1월 3일", () => {
    const p: ReleasePolicy = { cadence: "monthly", dayOfMonth: 3, timeOfDay: "09:00", quantity: 5 };
    const r = planRelease(p, 13, base);
    expect(r.length).toBe(13);
    // 첫 회차: 1월 3일 09:00 (시스템 로컬 기준)
    expect(r[0].getDate()).toBe(3);
    expect(r[0].getMonth()).toBe(0);
    // 다음 회차: 2월 3일
    expect(r[5].getMonth()).toBe(1);
    expect(r[5].getDate()).toBe(3);
    // 마지막 1개는 3월 3일
    expect(r[12].getMonth()).toBe(2);
    expect(r[12].getDate()).toBe(3);
  });

  it("monthly dayOfMonth=31 — 2월은 마지막 날로 EOM 폴백", () => {
    const p: ReleasePolicy = { cadence: "monthly", dayOfMonth: 31, timeOfDay: "00:00", quantity: 1 };
    // 1/15부터 — 첫 회차는 1/31
    const r = planRelease(p, 3, new Date(2026, 0, 15));
    expect(r[0].getMonth()).toBe(0);
    expect(r[0].getDate()).toBe(31);
    expect(r[1].getMonth()).toBe(1); // 2월
    expect(r[1].getDate()).toBe(28); // 2026 2월 28일(평년)
    expect(r[2].getMonth()).toBe(2); // 3월
    expect(r[2].getDate()).toBe(31);
  });

  it("같은 시각이 quantity개에 매겨짐 — 첫 회차 == 두번째 매물", () => {
    const p: ReleasePolicy = { cadence: "weekly", dayOfWeek: 1, timeOfDay: "12:00", quantity: 4 };
    const r = planRelease(p, 4, base);
    for (let i = 1; i < 4; i++) expect(r[i]).toEqual(r[0]);
  });

  it("timeOfDay 잘못된 형식 → throw", () => {
    expect(() =>
      planRelease({ cadence: "daily", timeOfDay: "25:00", quantity: 1 }, 1, base),
    ).toThrow(/timeOfDay/);
  });

  it("quantity=0 → throw(무한루프 방지)", () => {
    expect(() =>
      planRelease({ cadence: "daily", timeOfDay: "09:00", quantity: 0 }, 5, base),
    ).toThrow(/quantity/);
  });

  it("none: 모든 슬롯이 baseDate(분산 비활성)", () => {
    const r = planRelease({ cadence: "none" }, 5, base);
    expect(r.length).toBe(5);
    for (const d of r) expect(d.getTime()).toBe(base.getTime());
  });
});
