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

export function setAuthToken(token: string): void {
  try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
}
export function clearAuthToken(): void {
  try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ }
}
function getAuthToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...(extra ?? {}) };
  const token = getAuthToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
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
