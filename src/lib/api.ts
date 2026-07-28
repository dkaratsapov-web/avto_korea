// Клиент к воркеру: общий каталог (публично) и админ-API (по подписи Telegram).
import type { Car } from "@/data/cars";

// VITE_LEAD_ENDPOINT = https://diauto-bot.<acc>.workers.dev/lead
// База API = тот же воркер без /lead.
// Прод-фолбэк: если переменная не задана при сборке (например статический
// экспорт сайта на Яндекс), всё равно ходим в публичный воркер — иначе сайт
// не подхватит общий каталог, обновляемый из бота. URL воркера не секрет.
const DEFAULT_WORKER = "https://diauto-bot.d-karatsapov.workers.dev";
const LEAD =
  (import.meta.env.VITE_LEAD_ENDPOINT as string | undefined) ||
  `${DEFAULT_WORKER}/lead`;
export const API_BASE = LEAD.replace(/\/lead\/?$/, "");
export const hasBackend = !!API_BASE;

export type BotSettings = {
  welcomeText: string;
  catalogButtonText: string;
  calcButtonText: string;
  quizButtonText: string;
  managerButtonText: string;
  managerUrl: string;
  mapButtonText: string;
  mapUrl: string;
  miniAppUrl?: string;
  autoPublish?: boolean;
  reviewsChatId?: string;
  newsChatId?: string;
};

export type NewsItem = {
  id: string;
  title: string;
  text: string;
  media?: string;
  video?: string;
  ts: number;
};

export type Draft = {
  id: string;
  caption: string;
  fileIds: string[];
  parsed: {
    model: string;
    price: number;
    priceTver?: number;
    priceMoscow?: number;
    year: number;
    engineCc?: number;
    powerHp?: number;
    mileageKm?: number;
    gearbox?: string;
    drive?: string;
    bodyType?: string;
    fuelType?: string;
    steering?: string;
    color?: string;
    trim?: string;
    country?: string | null;
    highlights: string[];
  };
  ts: number;
};

export type AdminRole = "owner" | "admin" | "manager" | "viewer";
export type AdminCap =
  | "catalog"
  | "leads"
  | "reviews"
  | "subs"
  | "stats"
  | "bot"
  | "broadcast"
  | "admins";
export const ALL_CAPS: { key: AdminCap; label: string }[] = [
  { key: "catalog", label: "Каталог и черновики" },
  { key: "leads", label: "Заявки" },
  { key: "reviews", label: "Отзывы" },
  { key: "subs", label: "Подписки" },
  { key: "stats", label: "Статистика" },
  { key: "bot", label: "Настройки бота" },
  { key: "broadcast", label: "Рассылка" },
  { key: "admins", label: "Управление админами" },
];
export type AdminMe = { owner: boolean; caps: AdminCap[] };

export type Lead = {
  name: string;
  phone: string;
  car: string;
  source: string;
  ts: number;
};

export type AdminsMap = Record<
  string,
  { caps?: string[]; role?: string; name?: string; addedAt?: number }
>;

export type Review = {
  id: string;
  name: string;
  text: string;
  car?: string;
  rating: number;
  /** Фото из поста-отзыва (через прокси). */
  media?: string;
  /** Видео из поста-отзыва (через прокси). */
  video?: string;
  ts: number;
};
export type Faq = { q: string; a: string };
export type SubParams = { country?: string; body?: string; budget?: number };
export type Subscription = { userId: number; name: string; params: SubParams; ts: number };
export type Stats = {
  leads: number;
  users: number;
  subs: number;
  reviews: number;
  totalViews: number;
  views: Record<string, number>;
  leadsToday?: number;
  leads7d?: number;
  usersNew7d?: number;
  drafts?: number;
  bySource?: Record<string, number>;
  lastLeadTs?: number | null;
  daily?: { date: string; count: number }[];
  favs?: Record<string, number>;
};

export type Rates = {
  eur: number | null;
  usd: number | null;
  krw: number | null;
  cny: number | null;
  jpy: number | null;
};

/** Курс валют ЦБ РФ (для калькулятора). */
export async function fetchRates(): Promise<{ rates: Rates; date: string | null } | null> {
  if (!API_BASE) return null;
  try {
    const r = await fetch(`${API_BASE}/api/rates`);
    const d = (await r.json()) as { ok: boolean; rates: Rates; date: string | null };
    return d.ok ? { rates: d.rates, date: d.date } : null;
  } catch {
    return null;
  }
}

/** Публичные отзывы (для сайта и мини-аппа). */
export async function fetchReviews(): Promise<Review[]> {
  if (!API_BASE) return [];
  try {
    const r = await fetch(`${API_BASE}/api/reviews`, { cache: "no-store" });
    const d = (await r.json()) as { ok: boolean; reviews: Review[] };
    return Array.isArray(d.reviews) ? d.reviews : [];
  } catch {
    return [];
  }
}

/** Публичные новости (из Telegram-канала). */
export async function fetchNews(): Promise<NewsItem[]> {
  if (!API_BASE) return [];
  try {
    const r = await fetch(`${API_BASE}/api/news`, { cache: "no-store" });
    const d = (await r.json()) as { ok: boolean; news: NewsItem[] };
    return Array.isArray(d.news) ? d.news : [];
  } catch {
    return [];
  }
}

/** Публичный FAQ. */
export async function fetchFaq(): Promise<Faq[]> {
  if (!API_BASE) return [];
  try {
    const r = await fetch(`${API_BASE}/api/faq`, { cache: "no-store" });
    const d = (await r.json()) as { ok: boolean; faq: Faq[] };
    return Array.isArray(d.faq) ? d.faq : [];
  } catch {
    return [];
  }
}

/** Зарегистрировать пользователя мини-аппа (рассылки/статистика). */
export function pingUser(initData: string) {
  if (!API_BASE || !initData) return;
  fetch(`${API_BASE}/api/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  }).catch(() => {});
}

/** Засчитать просмотр карточки. */
export function logView(id: string) {
  if (!API_BASE) return;
  fetch(`${API_BASE}/api/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch(() => {});
}

/** Засчитать добавление в избранное (популярность). */
export function logFav(id: string) {
  if (!API_BASE) return;
  fetch(`${API_BASE}/api/fav`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, on: true }),
  }).catch(() => {});
}

/** Подписка на подбор авто. */
export async function subscribe(
  initData: string,
  params: SubParams,
): Promise<{ ok: boolean; error?: string }> {
  if (!API_BASE) return { ok: false, error: "no_backend" };
  try {
    const r = await fetch(`${API_BASE}/api/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, params }),
    });
    return (await r.json()) as { ok: boolean; error?: string };
  } catch {
    return { ok: false, error: "network" };
  }
}

/** Публичный общий каталог (или null, если ещё не задан/нет бэкенда). */
export async function fetchSharedCatalog(): Promise<Car[] | null> {
  if (!API_BASE) return null;
  try {
    const r = await fetch(`${API_BASE}/api/catalog`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as { ok: boolean; catalog: Car[] | null };
    return Array.isArray(data.catalog) ? data.catalog : null;
  } catch {
    return null;
  }
}

/** Вызов админ-API с подписью initData мини-аппа. */
export async function adminCall<T = unknown>(
  initData: string,
  action: string,
  payload?: unknown,
): Promise<{ ok: boolean; error?: string } & T> {
  if (!API_BASE) return { ok: false, error: "no_backend" } as never;
  try {
    const r = await fetch(`${API_BASE}/api/admin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData, action, payload }),
    });
    return (await r.json()) as { ok: boolean; error?: string } & T;
  } catch {
    return { ok: false, error: "network" } as never;
  }
}
