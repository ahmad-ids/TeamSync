const DEFAULT_API_BASE_URL = 'https://localhost:5202/api';
const DEFAULT_AUTH_BACKEND_ORIGIN = 'https://localhost:5202';
const DEFAULT_LOCAL_API_BASE_PATH = '/api';

export function resolveApiBaseUrl(): string {
  const explicitApiBaseUrl = tryParseAbsoluteUrl(import.meta.env.VITE_API_BASE_URL);
  if (explicitApiBaseUrl) {
    return explicitApiBaseUrl;
  }

  const backendOrigin =
    tryParseAbsoluteOrigin(import.meta.env.VITE_AUTH_BACKEND_URL)
    ?? tryParseAbsoluteOrigin(import.meta.env.VITE_BACKEND_URL);

  if (backendOrigin) {
    return `${backendOrigin}/api`;
  }

  if (shouldUseRelativeApiBaseUrl()) {
    return DEFAULT_LOCAL_API_BASE_PATH;
  }

  return DEFAULT_API_BASE_URL;
}

export function resolveAuthBackendOrigin(): string {
  const apiBaseUrl = resolveApiBaseUrl();
  if (/^https?:\/\//i.test(apiBaseUrl)) {
    const parsed = new URL(apiBaseUrl);
    return `${parsed.protocol}//${parsed.host}`;
  }

  if (shouldUseDirectLocalBackendOrigin()) {
    return DEFAULT_AUTH_BACKEND_ORIGIN;
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return DEFAULT_AUTH_BACKEND_ORIGIN;
}

function tryParseAbsoluteUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

function tryParseAbsoluteOrigin(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

function shouldUseRelativeApiBaseUrl(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

function shouldUseDirectLocalBackendOrigin(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const isBackendPort = window.location.port === '5202' || window.location.port === '5203';

  return isLocalHost && !isBackendPort;
}
