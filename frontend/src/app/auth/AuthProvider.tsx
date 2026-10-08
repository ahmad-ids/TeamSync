import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { clearStoredSession, readStoredSession, storeSession } from '../../services/authStorage';
import { exchangeOAuthTicket, getCurrentUser, isRetryableAuthStartupError, login as loginRequest } from '../../services/authService';
import type { AuthSession, AuthUser, LoginResponse } from '../../types/auth';

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  session: AuthSession | null;
  login: (email: string, password: string, rememberMe: boolean) => Promise<AuthUser>;
  completeOAuthSignIn: (ticket: string, rememberMe?: boolean) => Promise<AuthUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function hydrateSession() {
      const storedSession = readStoredSession();
      if (!storedSession) {
        if (isMounted) {
          setStatus('unauthenticated');
        }
        return;
      }

      if (new Date(storedSession.expiresAt).getTime() <= Date.now()) {
        clearStoredSession();
        if (isMounted) {
          setStatus('unauthenticated');
        }
        return;
      }

      try {
        const currentUser = await getCurrentUserWithRetry();
        if (!isMounted) {
          return;
        }

        setSession(storedSession);
        setUser(currentUser);
        setStatus('authenticated');
      } catch {
        clearStoredSession();
        if (isMounted) {
          setStatus('unauthenticated');
        }
      }
    }

    void hydrateSession();

    return () => {
      isMounted = false;
    };
  }, []);

  async function establishSession(response: LoginResponse, rememberMe: boolean) {
    const nextSession: AuthSession = {
      token: response.token,
      expiresAt: response.expiresAt,
      role: response.role,
      email: response.email,
      rememberMe,
    };

    storeSession(nextSession);

    try {
      const currentUser = await getCurrentUserWithRetry();
      setSession(nextSession);
      setUser(currentUser);
      setStatus('authenticated');
      return currentUser;
    } catch (error) {
      clearStoredSession();
      setSession(null);
      setUser(null);
      setStatus('unauthenticated');
      throw error;
    }
  }

  async function login(email: string, password: string, rememberMe: boolean) {
    const response = await loginRequest({ email, password, rememberMe });
    return establishSession(response, rememberMe);
  }

  async function completeOAuthSignIn(ticket: string, rememberMe = true) {
    const response = await exchangeOAuthTicket({ ticket });
    return establishSession(response, rememberMe);
  }

  function logout() {
    clearStoredSession();
    setSession(null);
    setUser(null);
    setStatus('unauthenticated');
  }

  async function getCurrentUserWithRetry() {
    const retryDelaysMs = [0, 250, 750];
    let lastError: unknown = null;

    for (const delayMs of retryDelaysMs) {
      if (delayMs > 0) {
        await pause(delayMs);
      }

      try {
        return await getCurrentUser();
      } catch (error) {
        lastError = error;
        if (!isRetryableAuthStartupError(error)) {
          throw error;
        }
      }
    }

    throw lastError ?? new Error('Unable to load the current user.');
  }

  function pause(durationMs: number) {
    return new Promise<void>((resolve) => {
      window.setTimeout(resolve, durationMs);
    });
  }

  return (
    <AuthContext.Provider value={{ status, user, session, login, completeOAuthSignIn, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }

  return context;
}
