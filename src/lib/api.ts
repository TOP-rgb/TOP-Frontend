/**
 * API Client — centralised fetch wrapper that automatically attaches
 * the JWT token from localStorage and normalises responses.
 */

const BASE_URL = (import.meta.env.VITE_API_URL as string) || 'https://top-backend-l2ax.onrender.com/api'

// ── Token helpers ─────────────────────────────────────────────────────────────

export const TOKEN_KEY = 'top_jwt_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

// ── Enum normalisation ────────────────────────────────────────────────────────
// Backend stores enums as UPPER_SNAKE_CASE, frontend uses lower_snake_case

export function normStr(s: string | null | undefined): string {
  return (s ?? '').toLowerCase()
}

export function upperStr(s: string): string {
  return s.toUpperCase()
}

// ── Core fetch ────────────────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message = data?.message || data?.error || `Request failed with status ${res.status}`
    throw new Error(message)
  }

  return data as T
}

// ── HTTP verb helpers ─────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// ── Typed response wrappers ───────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  pagination?: {
    total: number
    limit: number
    offset: number
    pages: number
  }
}

export interface ApiError {
  success: false
  error: string
  message: string
}
