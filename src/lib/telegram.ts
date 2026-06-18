// Минимальная обёртка над Telegram WebApp SDK.
// Скрипт грузится динамически только на странице мини-аппа.

type Haptic = "light" | "medium" | "heavy" | "rigid" | "soft";

export type TG = {
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (c: string) => void;
  setBackgroundColor: (c: string) => void;
  sendData: (data: string) => void;
  openTelegramLink: (url: string) => void;
  openLink: (url: string) => void;
  colorScheme?: string;
  initDataUnsafe?: { user?: { first_name?: string; username?: string } };
  HapticFeedback?: {
    impactOccurred: (s: Haptic) => void;
    notificationOccurred: (s: "error" | "success" | "warning") => void;
    selectionChanged: () => void;
  };
  MainButton: {
    setText: (t: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setParams: (p: Record<string, unknown>) => void;
  };
  BackButton: {
    show: () => void;
    hide: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp: TG };
  }
}

const SRC = "https://telegram.org/js/telegram-web-app.js";

export function loadTelegram(): Promise<TG | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.Telegram?.WebApp) return Promise.resolve(window.Telegram.WebApp);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SRC}"]`,
    );
    const done = () => resolve(window.Telegram?.WebApp ?? null);
    if (existing) {
      existing.addEventListener("load", done);
      existing.addEventListener("error", () => resolve(null));
      if (window.Telegram?.WebApp) done();
      return;
    }
    const s = document.createElement("script");
    s.src = SRC;
    s.async = true;
    s.onload = done;
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  });
}

export function haptic(tg: TG | null, style: Haptic = "light") {
  tg?.HapticFeedback?.impactOccurred(style);
}
