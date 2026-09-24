/**
 * API client for Class Up. Uses EXPO_PUBLIC_BACKEND_URL and Bearer token from
 * AuthContext. Never contact demobackend.emergentagent.com from the frontend.
 */
export const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api`;

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken() {
  return inMemoryToken;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (inMemoryToken) headers.Authorization = `Bearer ${inMemoryToken}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail: any = null;
    try {
      detail = await res.json();
    } catch {}
    const err: any = new Error(detail?.detail || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T,>(p: string) => request<T>(p),
  post: <T,>(p: string, body?: any) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: <T,>(p: string, body?: any) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: <T,>(p: string) => request<T>(p, { method: "DELETE" }),
};
