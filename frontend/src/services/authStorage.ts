import type { AuthSession } from '../types/auth';

const persistentStorageKey = 'ids.auth.persistent';
const sessionStorageKey = 'ids.auth.session';

function getStorage(rememberMe: boolean): Storage {
  return rememberMe ? window.localStorage : window.sessionStorage;
}

function parseSession(value: string | null): AuthSession | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as AuthSession;
  } catch {
    return null;
  }
}

export function readStoredSession(): AuthSession | null {
  return parseSession(window.localStorage.getItem(persistentStorageKey))
    ?? parseSession(window.sessionStorage.getItem(sessionStorageKey));
}

export function storeSession(session: AuthSession): void {
  clearStoredSession();
  getStorage(session.rememberMe).setItem(
    session.rememberMe ? persistentStorageKey : sessionStorageKey,
    JSON.stringify(session),
  );
}

export function clearStoredSession(): void {
  window.localStorage.removeItem(persistentStorageKey);
  window.sessionStorage.removeItem(sessionStorageKey);
}
