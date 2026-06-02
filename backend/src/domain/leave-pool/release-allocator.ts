// Release 할당기 — 한 회차에 풀어낼 quantity를 기여자(supply) 잔여에 분배.
// 라운드 로빈(userId 오름차순)으로 1일씩 차감 → 공평하고 결정적.
// 외부 의존 0. supplies는 호출자가 정렬해 둘 필요 없음(여기서 정렬).

export type SupplyRow = { userId: bigint; remainingDays: number };
export type ReleaseAllocation = { userId: bigint; take: number };

export type ReleaseAllocationResult = {
  /** 실제 빼낼 (userId, take) 매핑 — take > 0 만 포함. */
  allocations: ReleaseAllocation[];
  /** 실제 차감된 일수 합. supply 합계가 quantity보다 적으면 그만큼만. */
  released: number;
};

/**
 * quantity 만큼을 supply에서 라운드 로빈으로 빼낸다. quantity > Σremaining이면
 * 가능한 만큼만(소진까지).
 */
export function allocateRelease(
  supplies: SupplyRow[],
  quantity: number,
): ReleaseAllocationResult {
  if (quantity <= 0) return { allocations: [], released: 0 };
  const cap = supplies
    .filter((s) => s.remainingDays > 0)
    .map((s) => ({ userId: s.userId, remaining: s.remainingDays, take: 0 }))
    .sort((a, b) => (a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0));

  let need = quantity;
  while (need > 0) {
    let progressed = false;
    for (const s of cap) {
      if (s.remaining <= 0) continue;
      s.remaining -= 1;
      s.take += 1;
      need -= 1;
      progressed = true;
      if (need === 0) break;
    }
    if (!progressed) break; // 풀 소진
  }
  const allocations = cap
    .filter((s) => s.take > 0)
    .map((s) => ({ userId: s.userId, take: s.take }));
  const released = allocations.reduce((s, a) => s + a.take, 0);
  return { allocations, released };
}
