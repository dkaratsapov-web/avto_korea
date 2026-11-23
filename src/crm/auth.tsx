/**
 * Контекст текущего сотрудника.
 *
 * Отдельный от всего остального в проекте: сайт и мини-апп бота ничего не
 * знают о пользователях CRM, а CRM — о них. Единственная общая вещь — домен.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./lib/api";
import type { User } from "./lib/types";

type AuthState = {
  user: User | null;
  /** Пока не знаем, вошёл человек или нет, показывать интерфейс рано. */
  loading: boolean;
  /** В базе нет ни одного сотрудника — нужен экран первичной настройки. */
  needsSetup: boolean;
  isOwner: boolean;
  signIn: (user: User) => void;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setUser(data.user);
      setNeedsSetup(data.needsSetup);
    } catch {
      // Сеть недоступна или сервер не отвечает — считаем, что не вошли.
      // Экран входа сам покажет ошибку при попытке авторизации.
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      needsSetup,
      isOwner: user?.role === "OWNER",
      signIn: (next: User) => {
        setUser(next);
        setNeedsSetup(false);
      },
      signOut,
      refresh,
    }),
    [user, loading, needsSetup, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth должен вызываться внутри AuthProvider");
  return ctx;
}
