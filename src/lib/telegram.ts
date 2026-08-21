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
  initData?: string;
  initDataUnsafe?: {
    user?: { id?: number; first_name?: string; username?: string };
  };
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

/**
 * Ссылка на канал в схеме приложения — та, что открывает Telegram напрямую.
 *
 * Обычная ссылка t.me сначала грузит веб-страницу Telegram и только оттуда
 * предлагает открыть приложение: лишний экран и лишняя секунда, на которой
 * часть людей отваливается. Схема tg:// ведёт в приложение сразу.
 *
 * Приглашение в закрытый канал и публичный канал открываются РАЗНЫМИ методами:
 * у приглашения на руках только хэш, имени у канала нет вовсе. Перепутать их
 * нельзя — Telegram молча ничего не откроет.
 *
 * Возвращает null, если ссылка не телеграмовская: тогда работаем как раньше,
 * через обычный переход.
 */
export function telegramAppLink(href: string): string | null {
  const invite = href.match(/(?:t\.me\/\+|t\.me\/joinchat\/)([A-Za-z0-9_-]+)/);
  if (invite) {
    return `tg://join?invite=${invite[1]}`;
  }

  // Имя публичного канала: буква в начале, дальше буквы, цифры и подчёркивания.
  // Служебные разделы t.me именами каналов не являются.
  const domain = href.match(/t\.me\/([A-Za-z][A-Za-z0-9_]{3,})/);
  if (domain && !["joinchat", "share", "addstickers", "proxy"].includes(domain[1])) {
    return `tg://resolve?domain=${domain[1]}`;
  }

  return null;
}
