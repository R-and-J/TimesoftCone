// RedemptionChannel — outbound port for "fulfilling" a redemption order
// (ADR-023). 내부 카탈로그(쿠폰 즉시 발급)과 외부 기프트 API(예: KakaoGift)를
// 같은 인터페이스 뒤로 격리한다. 외부 호출 어댑터는 ADR-005 Outbox 경유.

export const REDEMPTION_CHANNEL = Symbol("REDEMPTION_CHANNEL");

export type RedemptionDelivery = {
  /** 쿠폰 코드/외부 tx id 등 발송 참조. */
  ref: string;
  /** 즉시 발송(FULFILLED) vs 비동기(PENDING — outbox 처리). */
  status: "FULFILLED" | "PENDING" | "FAILED";
  /** 실패 시 사유. */
  error?: string;
};

export interface RedemptionChannel {
  deliver(input: {
    orderId: number;
    userId: bigint;
    itemSku: string;
    itemName: string;
    priceP: bigint;
  }): Promise<RedemptionDelivery>;
}
