// 실시간 경매 업데이트 스트림 포트(CUT-6). 컨트롤러(interfaces)는 이 포트만 알고,
// 구현체(adapters/realtime/AuctionStream)는 app.module에서 심볼로 바인딩한다 —
// interfaces → adapters 직접 의존(boundary 위반)을 피하기 위함(ADR-012).
import type { Observable } from "rxjs";
import type { MessageEvent } from "@nestjs/common";

export const AUCTION_STREAM = Symbol("AUCTION_STREAM");

export interface AuctionStreamPort {
  /** 특정 경매의 실시간 업데이트만 거른 SSE 스트림. */
  streamFor(auctionId: string): Observable<MessageEvent>;
}
