// 알림이 적재된 후 NotificationStream(SSE)이 클라에 push할 신호를 흘려보내기 위한
// 내부 이벤트. NotificationObserver가 DB 적재 직후 emit 한다(같은 트랜잭션 외부).

export const NOTIFICATION_EVENTS = {
  CREATED: "notification.created",
} as const;

export class NotificationCreatedEvent {
  constructor(
    public readonly userId: bigint,
    public readonly type: string,
    public readonly title: string,
    public readonly message: string,
    public readonly linkPath: string | null,
  ) {}
}
