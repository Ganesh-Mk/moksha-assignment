/**
 * The single place this application talks to the backend.
 *
 * Everything network-related lives here so there is one implementation of the
 * three things that are easy to get subtly wrong in a dozen call sites:
 *
 *   1. Attaching the access token.
 *   2. Refreshing it exactly once when it expires, with concurrent requests
 *      waiting on that one refresh rather than each firing their own.
 *   3. Turning the backend's error envelope into a typed `ApiError` that
 *      carries the correlation id, so a user can quote one value that pulls up
 *      the whole server-side trace.
 */

import type { ApiErrorBody } from "@/types/api";

const BASE_URL = (import.meta.env["VITE_API_URL"] as string | undefined) ?? "/api/v1";

const ACCESS_TOKEN_KEY = "moksha.access_token";
const REFRESH_TOKEN_KEY = "moksha.refresh_token";

/**
 * Tokens live in localStorage, and that is a real trade-off worth being able to
 * defend rather than hiding.
 *
 * The safer option is a httpOnly, SameSite cookie, which JavaScript cannot read
 * and so cannot be exfiltrated by an XSS payload. It is not used here because
 * the frontend and API are deployed to different origins (Vercel and Render),
 * which makes cookie auth a CORS-credentials and CSRF-token exercise that
 * would add more surface than it removes at this size.
 *
 * What that buys, and what it costs: an XSS bug in this app can steal a token.
 * The mitigations actually in place are a short access-token lifetime, a `type`
 * claim so a stolen access token cannot be traded for a fresh pair, and React's
 * default escaping with no `dangerouslySetInnerHTML` anywhere in the codebase.
 */
export const tokenStore = {
  access: (): string | null => localStorage.getItem(ACCESS_TOKEN_KEY),
  refresh: (): string | null => localStorage.getItem(REFRESH_TOKEN_KEY),
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;
  readonly requestId: string | null;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId: string | null,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.details = details;
  }

  /** 401 means the session is gone; anything else is a normal failure to show. */
  get isAuthError(): boolean {
    return this.status === 401;
  }

  /** 503 from a phase-gated feature: the deployment is missing a credential. */
  get isUnconfigured(): boolean {
    return this.code === "feature_unconfigured";
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const requestId = response.headers.get("X-Request-ID");
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (body.error) {
      return new ApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.request_id ?? requestId,
        body.error.details,
      );
    }
  } catch {
    // A non-JSON error body — a proxy timeout page, or Render's cold-start
    // holding page. Fall through to a generic message rather than throwing a
    // parse error that hides the real status.
  }
  return new ApiError(
    response.status,
    "http_error",
    response.status === 0 || response.status >= 500
      ? "The server is not responding. It may be waking up — try again in a moment."
      : `Request failed (${response.status}).`,
    requestId,
  );
}

/**
 * One in-flight refresh, shared.
 *
 * Without this, a page that fires four queries on load and finds the token
 * expired would run four refreshes. Three of them race, and whichever finishes
 * last overwrites the tokens the others already rotated — logging the user out
 * on what should have been a silent renewal.
 */
let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStore.refresh();
  if (!refreshToken) return false;

  refreshInFlight ??= (async () => {
    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) {
        tokenStore.clear();
        return false;
      }
      const data = (await response.json()) as { access_token: string; refresh_token: string };
      tokenStore.set(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  /** Skip the token entirely — used by sign-in, which has none yet. */
  anonymous?: boolean;
  signal?: AbortSignal;
}

async function send(path: string, options: RequestOptions, retrying = false): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  const token = tokenStore.access();
  if (token && !options.anonymous) headers["Authorization"] = `Bearer ${token}`;

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  // Retry once, and only once. `retrying` is the guard: a 401 that survives a
  // successful refresh means the session is genuinely dead, and looping would
  // hammer the endpoint.
  if (response.status === 401 && !retrying && !options.anonymous && tokenStore.refresh()) {
    if (await refreshAccessToken()) return send(path, options, true);
  }

  return response;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(path, options);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    // A network-level failure has no status and no body. On the free Render
    // tier this is usually a cold start, so the message says so.
    throw new ApiError(
      0,
      "network_error",
      "Could not reach the server. It may be waking from sleep — try again shortly.",
      null,
    );
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

/** Query-string builder that drops empty values instead of sending `?q=`. */
export function query(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Base URL for endpoints that are read directly rather than through `request` — the SSE stream. */
export const apiBaseUrl = BASE_URL;
