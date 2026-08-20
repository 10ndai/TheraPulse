'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { SafeUser } from '@therapulse/shared';

interface AuthContextValue {
  user: SafeUser | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<SafeUser | null> {
  const response = await fetch('/api/auth/me');
  if (!response.ok) return null;
  const body = (await response.json()) as { success: boolean; data?: SafeUser };
  return body.success && body.data ? body.data : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      const fetched = await fetchCurrentUser();
      setUser(fetched);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return (
    <AuthContext.Provider value={{ user, isLoading, refetch }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
