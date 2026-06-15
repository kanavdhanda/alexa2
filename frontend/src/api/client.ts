// Base HTTP client — all API modules use this instead of raw fetch.
// Handles: base URL injection, timeout, JSON serialisation, error normalisation, debug logging.

import { env } from '../config/env';

export class ApiError extends Error {
  status: number;
  statusText: string;
  body: unknown;
  url: string;

  constructor(status: number, statusText: string, body: unknown, url: string) {
    super(`API ${status} ${statusText} — ${url}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.url = url;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeoutMs?: number;
  // Pass raw FormData directly when uploading audio
  rawBody?: FormData;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, timeoutMs = 10_000, rawBody, headers: extraHeaders, ...rest } = options;

  const url = `${env.BACKEND_URL}${path}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {};
  if (body !== undefined && rawBody === undefined) {
    headers['Content-Type'] = 'application/json';
  }
  Object.assign(headers, extraHeaders as Record<string, string>);

  if (env.API_DEBUG) {
    console.debug(`[API] ${rest.method ?? 'GET'} ${url}`, body ?? rawBody ?? '');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers,
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  let parsed: unknown;
  const ct = response.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    parsed = await response.json();
  } else {
    parsed = await response.text();
  }

  if (env.API_DEBUG) {
    console.debug(`[API] ← ${response.status}`, parsed);
  }

  if (!response.ok) {
    throw new ApiError(response.status, response.statusText, parsed, url);
  }

  return parsed as T;
}

export const apiClient = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'body' | 'rawBody'>) =>
    request<T>(path, { ...opts, method: 'GET' }),

  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body }),

  postForm: <T>(path: string, form: FormData, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', rawBody: form }),

  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PATCH', body }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),
};
