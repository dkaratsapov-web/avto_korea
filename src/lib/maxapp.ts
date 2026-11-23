// Минимальная обёртка над MAX WebApp SDK (мессенджер MAX).
// Скрипт грузится динамически только на странице мини-аппа и только когда
// приложение открыто из MAX, а не из Telegram.
//
// У MAX свой Bot/WebApp API (не телеграмовский): глобальный объект window.WebApp,
// данные запуска в initData/initDataUnsafe, открытие ссылок через openLink /
// openMaxLink. Разворота окна на весь экран MAX не предоставляет вовсе —
// размером окна управляет сам мессенджер. Док: https://dev.max.ru/docs/webapps/bridge

export type MaxApp = {
  /** Подписанная строка для валидации на сервере (аналог Telegram initData). */
  initData?: string;
  initDataUnsafe?: {
    user?: { id?: number; first_name?: string; username?: string };
    chat?: { id?: number; type?: "DIALOG" | "CHAT" | "CHANNEL" };
    /** Метка запуска из диплинка max.ru/<bot>?startapp=... */
    start_param?: string;
    query_id?: string;
  };
  platform?: string;
  version?: string;
  /** Открыть ссылку во внешнем браузере. */
  openLink?: (url: string) => void;
  /** Открыть диплинк вида https://max.ru/... внутри MAX. */
  openMaxLink?: (url: string) => void;
};

declare global {
  interface Window {
    WebApp?: MaxApp;
  }
}

const SRC = "https://st.max.ru/js/max-web-app.js";

// Та же логика ожидания, что у телеграмовской обёртки: заблокированный хост
// чаще молчит, чем отвечает ошибкой, поэтому работаем без SDK по таймауту.
const SDK_TIMEOUT_MS = 2500;

export function loadMax(): Promise<MaxApp | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.WebApp) return Promise.resolve(window.WebApp);
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(window.WebApp ?? null);
    };
    const timer = window.setTimeout(done, SDK_TIMEOUT_MS);

    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SRC}"]`,
    );
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", done);
      if (window.WebApp) done();
      return;
    }
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = done;
    s.onerror = done;
    document.head.appendChild(s);
  });
}

/** Метка запуска из MAX (из диплинка ?startapp=…), очищенная и обрезанная. */
export function maxStartParam(): string {
  if (typeof window === "undefined") return "";
  const sp = window.WebApp?.initDataUnsafe?.start_param || "";
  return sp.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
}
