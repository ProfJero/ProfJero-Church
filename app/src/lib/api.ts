import { auth } from './firebase';
import { config } from '@/config';

/** Error from the CWC Worker (or ProfJero Connect, relayed through it). */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public requestId?: string) {
    super(message);
  }
}

export function apiConfigured() {
  return Boolean(config.apiUrl);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown; idempotencyKey?: string } = {}): Promise<T> {
  if (!config.apiUrl) throw new ApiError(0, 'The CWC API is not configured. Set VITE_API_URL (see README).', 'not_configured');
  const headers = new Headers(init.headers);
  const token = await auth?.currentUser?.getIdToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.json !== undefined) headers.set('Content-Type', 'application/json');
  if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey);
  let res: Response;
  try {
    res = await fetch(config.apiUrl + path, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your internet connection.', 'network');
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string; requestId?: string } })?.error;
    throw new ApiError(res.status, err?.message || friendlyStatus(res.status), err?.code, err?.requestId);
  }
  return body as T;
}

function friendlyStatus(status: number) {
  switch (status) {
    case 401: return 'Your session has expired. Please sign in again.';
    case 402: return 'Not enough SMS units. Top up your wallet and retry.';
    case 403: return 'You don’t have permission to do that.';
    case 404: return 'Not found.';
    case 409: return 'This request conflicts with an earlier one.';
    case 429: return 'Too many requests. Please wait a moment and retry.';
    default: return status >= 500 ? 'The service is having trouble. Please retry shortly.' : 'Request failed.';
  }
}
