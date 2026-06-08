// Tiny fetch wrapper. The backend stringifies bigints (BigIntInterceptor),
// so every numeric *amount/balance* field arrives as a JSON string and we
// keep it as a string in the type. UI code converts via Number() at display
// time (our amounts top out around 10^7 so float64 is safe).

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

// ── Auth token (RBAC) ─────────────────────────────────────────────
// 로그인 시 백엔드가 발급한 자체 JWT를 저장하고, 모든 요청에 Bearer로 붙인다.
// current-user(localStorage)와 별개 키 — 토큰은 자격증명, 프로필은 표시용.
const TOKEN_KEY = "timesoftcone.token";
const USER_KEY = "timesoftcone.currentUser";
// 멀티테넌시 회사 스위처(super ADMIN 전용). 선택한 회사 id를 모든 요청에 X-Company-Id로 첨부.
// 일반 사용자는 백엔드가 이 헤더를 무시(JWT 회사로 고정)하므로 항상 보내도 안전.
const COMPANY_KEY = "timesoftcone.companyScope";

export function setAuthToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearAuthToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
export function getAuthToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

/** super ADMIN 회사 스위처 선택값 저장. null이면 "전 회사". */
export function setCompanyScope(companyId: string | null): void {
  try {
    if (companyId) localStorage.setItem(COMPANY_KEY, companyId);
    else localStorage.removeItem(COMPANY_KEY);
  } catch { /* ignore */ }
}
export function getCompanyScope(): string | null {
  try { return localStorage.getItem(COMPANY_KEY); } catch { return null; }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const company = getCompanyScope();
  if (company) headers["X-Company-Id"] = company;
  return headers;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// 토큰을 들고 보낸 요청이 401이면 = 만료/무효 → 세션 정리 후 로그인으로.
// (토큰 없이 받은 401은 로그인 시도 자체이므로 페이지가 메시지를 처리하게 둔다.)
function onUnauthorized(): void {
  clearAuthToken();
  try { localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
  if (typeof window !== "undefined" && !window.location.hash.startsWith("#/login")) {
    window.location.hash = "/login";
    window.location.reload();
  }
}

async function handle<T>(res: Response, hadToken: boolean): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
  if (res.status === 401 && hadToken) onUnauthorized();
  const text = await res.text();
  let body: unknown = text;
  let message = text;
  try {
    const json = JSON.parse(text);
    body = json;
    if (typeof json === "object" && json !== null && "message" in json) {
      const m = (json as { message: unknown }).message;
      message = typeof m === "string" ? m : JSON.stringify(m);
    }
  } catch {
    /* keep raw text */
  }
  throw new ApiError(res.status, message || res.statusText, body);
}

export function apiGet<T>(path: string): Promise<T> {
  const hadToken = getAuthToken() !== null;
  return fetch(`${API_BASE}${path}`, { headers: authHeaders() }).then((r) =>
    handle<T>(r, hadToken),
  );
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  const hadToken = getAuthToken() !== null;
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }).then((r) => handle<T>(r, hadToken));
}

export function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const hadToken = getAuthToken() !== null;
  return fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  }).then((r) => handle<T>(r, hadToken));
}

/** Content-Disposition에서 파일명 추출 (RFC 5987 filename*=UTF-8'' 우선, 없으면 filename=). */
function parseFilename(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (star) {
    try { return decodeURIComponent(star[1]); } catch { /* fall through */ }
  }
  const plain = /filename="?([^";]+)"?/i.exec(disposition);
  return plain ? plain[1] : fallback;
}

/**
 * 첨부파일(Content-Disposition) 다운로드. <a href> 직접 이동과 달리 인증 헤더(Bearer)를
 * 실어 보내므로 ADMIN 가드 라우트(/api/admin/export 등)에서도 동작한다. 페이지 이동/새 탭 없음.
 */
export async function downloadFile(path: string, fallbackName = "download"): Promise<void> {
  const hadToken = getAuthToken() !== null;
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders() });
  if (!res.ok) {
    // 에러 응답은 JSON일 가능성이 높으니 handle로 메시지 추출 + 401 세션 정리 재사용.
    await handle(res, hadToken);
    return;
  }
  const blob = await res.blob();
  const name = parseFilename(res.headers.get("Content-Disposition"), fallbackName);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
