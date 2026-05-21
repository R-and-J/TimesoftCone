// Tiny fetch wrapper. The backend stringifies bigints (BigIntInterceptor),
// so every numeric *amount/balance* field arrives as a JSON string and we
// keep it as a string in the type. UI code converts via Number() at display
// time (our amounts top out around 10^7 so float64 is safe).

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";

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

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return res.json() as Promise<T>;
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
  return fetch(`${API_BASE}${path}`).then(handle<T>);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(handle<T>);
}
