// 경매 실시간 업데이트 구독(CUT-6). 백엔드 SSE(GET /api/auctions/:id/stream)에
// 네이티브 EventSource로 붙어, 남이 입찰하거나 경매가 정산되면 즉시 신호를 받는다.
// 신호는 "무엇이 바뀌었다"만 담으므로(민감정보 없음), 받은 쪽은 인증된 상세 조회로
// 정본 상태를 다시 읽는다 — 서버가 단일 진실원천(폴링 지연만 제거).

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

export type AuctionUpdate =
  | { auctionId: string; type: "bid"; highest: string }
  | { auctionId: string; type: "settled" };

/**
 * 경매 스트림 구독. onUpdate는 업데이트 신호마다 호출된다(보통 refetch 트리거).
 * 반환된 함수를 호출하면 연결을 닫는다(useEffect cleanup용).
 * EventSource는 끊기면 자동 재연결하므로 일시적 네트워크 단절에 강하다.
 */
export function subscribeAuction(
  auctionId: string,
  onUpdate: (u: AuctionUpdate) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/auctions/${auctionId}/stream`);

  es.onopen = () => onStatus?.(true);
  es.onmessage = (ev) => {
    try {
      onUpdate(JSON.parse(ev.data) as AuctionUpdate);
    } catch {
      /* 형식이 안 맞는 메시지는 무시 */
    }
  };
  es.onerror = () => onStatus?.(false); // 브라우저가 자동 재연결 시도

  return () => es.close();
}
