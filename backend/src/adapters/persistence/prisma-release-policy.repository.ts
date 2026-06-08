// PrismaReleasePolicyRepository — ReleasePolicyRepository 구현(싱글톤).
// row id=1 한 줄을 upsert로 갱신. 도메인 union → DB의 (cadence, dayOfWeek, dayOfMonth) 매핑.
import { Injectable } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import type { ReleasePolicyRepository } from "@/ports/release-policy.port";
import type { ReleasePolicy } from "@/domain/leave-pool/release-plan";

@Injectable()
export class PrismaReleasePolicyRepository implements ReleasePolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<ReleasePolicy | null> {
    const row = await this.prisma.releasePolicy.findUnique({ where: { id: 1 } });
    if (!row) return null;
    return rowToPolicy(row);
  }

  async set(policy: ReleasePolicy): Promise<void> {
    const data = policyToRow(policy);
    await this.prisma.releasePolicy.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    });
  }
}

type Row = {
  cadence: string;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string | null;
  quantity: number | null;
  startPrice: bigint | null;
};

function rowToPolicy(r: Row): ReleasePolicy {
  const sp = r.startPrice ?? null;
  if (r.cadence === "none") return { cadence: "none", startPrice: sp };
  if (r.timeOfDay === null || r.quantity === null) {
    throw new Error(`release_policy: cadence=${r.cadence}는 timeOfDay/quantity 필수`);
  }
  if (r.cadence === "daily") {
    return { cadence: "daily", timeOfDay: r.timeOfDay, quantity: r.quantity, startPrice: sp };
  }
  if (r.cadence === "weekly") {
    if (r.dayOfWeek === null) throw new Error("release_policy: weekly missing dayOfWeek");
    return { cadence: "weekly", dayOfWeek: r.dayOfWeek, timeOfDay: r.timeOfDay, quantity: r.quantity, startPrice: sp };
  }
  if (r.cadence === "monthly") {
    if (r.dayOfMonth === null) throw new Error("release_policy: monthly missing dayOfMonth");
    return { cadence: "monthly", dayOfMonth: r.dayOfMonth, timeOfDay: r.timeOfDay, quantity: r.quantity, startPrice: sp };
  }
  throw new Error(`release_policy: cadence invalid: ${r.cadence}`);
}

function policyToRow(p: ReleasePolicy) {
  const startPrice = p.startPrice ?? null;
  if (p.cadence === "none") {
    return { cadence: "none", dayOfWeek: null, dayOfMonth: null, timeOfDay: null, quantity: null, startPrice };
  }
  if (p.cadence === "daily") {
    return { cadence: "daily", dayOfWeek: null, dayOfMonth: null, timeOfDay: p.timeOfDay, quantity: p.quantity, startPrice };
  }
  if (p.cadence === "weekly") {
    return { cadence: "weekly", dayOfWeek: p.dayOfWeek, dayOfMonth: null, timeOfDay: p.timeOfDay, quantity: p.quantity, startPrice };
  }
  return { cadence: "monthly", dayOfWeek: null, dayOfMonth: p.dayOfMonth, timeOfDay: p.timeOfDay, quantity: p.quantity, startPrice };
}
