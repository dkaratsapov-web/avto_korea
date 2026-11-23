/**
 * Тема CRM: светлая, тёмная и «как в системе».
 *
 * Выбор хранится в браузере сотрудника, а не в базе: тема — свойство
 * конкретного устройства. Днём за ноутбуком и вечером с телефона удобны
 * разные, и синхронизировать их между устройствами было бы вредно.
 *
 * Пока выбор не сделан, атрибут не проставляется вовсе — работает системная
 * настройка через prefers-color-scheme (см. index.css).
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemeChoice = "system" | "light" | "dark";

const KEY = "diauto:crm-theme";

function read(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

type ThemeState = {
  choice: ThemeChoice;
  /** Что показывается прямо сейчас — с учётом системной настройки. */
  resolved: "light" | "dark";
  setChoice: (next: ThemeChoice) => void;
  /** Переключение по кругу: система → светлая → тёмная → система. */
  cycle: () => void;
};

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(read);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches,
  );

  // Системную настройку слушаем всегда: сотрудник может переключить её,
  // не трогая CRM, и интерфейс должен отреагировать сразу.
  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    try {
      if (next === "system") window.localStorage.removeItem(KEY);
      else window.localStorage.setItem(KEY, next);
    } catch {
      /* приватный режим — тема просто не переживёт перезагрузку */
    }
  }, []);

  const value = useMemo<ThemeState>(() => {
    const resolved: "light" | "dark" =
      choice === "system" ? (systemDark ? "dark" : "light") : choice;

    return {
      choice,
      resolved,
      setChoice,
      cycle: () =>
        setChoice(choice === "system" ? "light" : choice === "light" ? "dark" : "system"),
    };
  }, [choice, systemDark, setChoice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme должен вызываться внутри ThemeProvider");
  return ctx;
}

/** Значение атрибута для корня CRM. Для «как в системе» атрибута нет. */
export function themeAttribute(choice: ThemeChoice): string | undefined {
  return choice === "system" ? undefined : choice;
}
