// InternalCatalogRedemption — 자립형 배포 기본 발송 채널(ADR-023).
// 외부 시스템 호출 없음. 쿠폰 참조 코드를 즉시 발급하고 FULFILLED로 반환한다.
// 실제 배포에서 코드 발행 정책(QR/외부 코드체계)이 정해지면 여기만 교체.

import { Injectable } from "@nestjs/common";
import type { RedemptionChannel, RedemptionDelivery } from "@/ports/redemption-channel.port";

@Injectable()
export class InternalCatalogRedemption implements RedemptionChannel {
  async deliver(input: {
    orderId: number;
    userId: bigint;
    itemSku: string;
    itemName: string;
    priceP: bigint;
  }): Promise<RedemptionDelivery> {
    const rand = Math.random().toString(36).slice(2, 10).toUpperCase();
    return { ref: `RDM-${input.orderId}-${rand}`, status: "FULFILLED" };
  }
}
