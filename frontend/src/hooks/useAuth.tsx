import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { User } from '../types';
import { logout as apiLogout, getMe, refreshTokens } from '../api/auth';
import { setAccessToken } from '../api/axios';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginWithSso: (accessToken: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const hasLoggedIn            = useRef(false);

  // On mount: restore session via httpOnly cookie (works for both SSO and password login)
  useEffect(() => {
    refreshTokens()
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return getMe();
      })
      .then((res) => setUser(res.data))
      .catch(() => {
        if (!hasLoggedIn.current) setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const loginWithSso = useCallback(async (accessToken: string) => {
    hasLoggedIn.current = true;
    setAccessToken(accessToken);
    const { data } = await getMe();
    setUser(data);
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    await apiLogout().catch(() => {});
    setAccessToken(null);
    localStorage.removeItem('dh_sso_refresh'); // clean up legacy key if present
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginWithSso, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
