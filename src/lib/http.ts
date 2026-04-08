import { loadConfig } from './appConfig';

const AUTH_TOKEN_KEY = 'vsro_auth_token';
const API_TIMEOUT_MS = 10_000;

export function getApiBaseUrl(): string {
  return loadConfig().apiBaseUrl.trim().replace(/\/+$/, '');
}

function normalizeApiPath(path: string): string {
  const apiBase = getApiBaseUrl();

  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/api')) {
    return `${apiBase}${path.slice('/api'.length)}`;
  }
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function createHeaders(options?: RequestInit): Headers {
  const headers = new Headers(options?.headers);

  if (!(options?.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let token: string | null = null;
  try {
    token = localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    token = null;
  }

  console.log(`[api] token ${token ? 'found' : 'not found'}`);

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return headers;
}

async function getErrorMessage(response: Response): Promise<string> {
  let errorMsg = `API Error ${response.status}`;

  try {
    const text = await response.text();
    if (!text) return errorMsg;

    try {
      const body = JSON.parse(text);
      if (body?.detail) return typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
      if (body?.message) return body.message;
      return `${errorMsg}: ${text}`;
    } catch {
      return `${errorMsg}: ${text}`;
    }
  } catch {
    return errorMsg;
  }
}

export function buildApiUrl(path: string): string {
  return normalizeApiPath(path);
}

export async function fetchApi(path: string, options: RequestInit = {}): Promise<Response> {
  const url = buildApiUrl(path);
  const method = options.method ?? 'GET';
  console.log(`[api] ${method} ${url}`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      headers: createHeaders(options),
      signal: options.signal ?? controller.signal,
    });

    console.log(`[api] ${method} ${url} → ${response.status} ok=${response.ok}`);
    return response;
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      console.error(`[api] ${method} ${url} timed out after ${API_TIMEOUT_MS}ms`);
      throw new Error('Request timeout – check API connection');
    }

    console.error(`[api] ${method} ${url} failed`, error);
    throw error instanceof Error ? error : new Error('Network request failed');
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchApiJson<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetchApi(path, options);

  if (!response.ok) {
    throw new Error(await getErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}