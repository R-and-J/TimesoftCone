// JSON does not natively support bigint. We serialize bigint → string so
// numbers don't overflow on the client (TypeScript number is float64).

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { map, Observable } from "rxjs";

function stringifyBigInts(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  // Date(및 toJSON 보유 객체)는 재귀로 풀면 own-enumerable 속성이 없어 {}가 된다.
  // 그대로 통과시키면 JSON.stringify가 toJSON으로 직렬화(Date → ISO 문자열).
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(stringifyBigInts);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = stringifyBigInts(v);
    return out;
  }
  return value;
}

@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map(stringifyBigInts));
  }
}
