// Клиент к воркеру: общий каталог (публично) и админ-API (по подписи Telegram).
import type { Car } from "@/data/cars";
import { orderReviews } from "./reviews-order";

// VITE_LEAD_ENDPOINT = https://diauto-bot.<acc>.workers.dev/lead
// База API = тот же воркер без /lead.
// Прод-фолбэк: если переменная не задана при сборке (например статический
// экспорт сайта на Яндекс), всё равно ходим в публичный воркер — иначе сайт
// не подхватит общий каталог, обновляемый из бота. URL воркера не секрет.
const DEFAULT_WORKER = "https://diauto-bot.d-karatsapov.workers.dev";
const LEAD =
  (import.meta.env.VITE_LEAD_ENDPOINT as string | undefined) ||
  `${DEFAULT_WORKER}/lead`;

// Домен воркера (*.workers.dev) в России блокируется провайдерами, поэтому на
// боевом сайте база API задаётся как "/" — тогда запросы идут на сам сайт, а
// сервер (см. public/api/proxy.php) уже сам ходит к воркеру. Для сборок без
// такого прокси остаётся прямой адрес воркера.
const RAW_BASE = import.meta.env.VITE_API_BASE as string | undefined;
export const API_BASE =
  RAW_BASE !== undefined
    ? RAW_BASE.replace(/\/+$/, "") // "/" → "" (запросы вида /api/catalog)
    : /^https?:\/\//.test(LEAD)
      ? LEAD.replace(/\/lead\/?$/, "")
      : DEFAULT_WORKER;
export const hasBackend = true;

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
  leadChatId?: string;
  /** Канал-источник каталога. Пусто — каталогом считается любой канал. */
  catalogChatId?: string;
  reviewsChatId?: string;
  newsChatId?: string;
  /* Гейт подписки на канал — стена перед ботом для рекламного трафика. */
  gateEnabled?: boolean;
  gateChannelId?: string;
  gateInviteUrl?: string;
  gateText?: string;
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
  /** Первое фото — оставлено для совместимости со старыми записями. */
  media?: string;
  /** Первое видео — оставлено для совместимости со старыми записями. */
  video?: string;
  /** Все фото поста/альбома. */
  images?: string[];
  /** Все видео поста/альбома. */
  videos?: string[];
  /**
   * Кадр-обложка видео: его присылает Telegram вместе с самим файлом.
   *
   * Без обложки карточка до конца закачки — чёрный прямоугольник, а видео
   * отзыва весит десятки мегабайт и идёт через наш сервер. Обложка весит
   * килобайты и появляется сразу.
   *
   * Хранится отдельно от images: иначе кадр из видео встал бы в ленту
   * миниатюр как ещё одна «фотография» отзыва.
   */
  poster?: string;
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
  /** Метки рекламы бота (/start a-<метка>): люди, подписки, заявки, клики. */
  ads?: {
    tag: string;
    users: number;
    users7d: number;
    subscribed: number;
    leads: number;
    leads7d: number;
    manager: number;
  }[];
  /** UTM-метки сайта: заявки по кампаниям. */
  utm?: { label: string; leads: number; leads7d: number; lastTs: number }[];
  /** Клики «Написать менеджеру». */
  managerClicks?: {
    total: number;
    today: number;
    d7: number;
    daily: { date: string; count: number }[];
    screens: Record<string, number>;
    noTag: number;
  };
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
  if (!hasBackend) return null;
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
  if (!hasBackend) return [];
  try {
    const r = await fetch(`${API_BASE}/api/reviews`, { cache: "no-store" });
    const d = (await r.json()) as { ok: boolean; reviews: Review[] };
    const list = Array.isArray(d.reviews) ? d.reviews : [];
    // Правило порядка вынесено отдельно и покрыто тестами: на витрине его
    // ошибку не видно, пока свежая выдача не окажется в самом низу страницы.
    return orderReviews(list);
  } catch {
    return [];
  }
}

/** Публичные новости (из Telegram-канала). */
export async function fetchNews(): Promise<NewsItem[]> {
  if (!hasBackend) return [];
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
  if (!hasBackend) return [];
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
  if (!hasBackend || !initData) return;
  fetch(`${API_BASE}/api/ping`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  }).catch(() => {});
}

/** Засчитать просмотр карточки. */
export function logView(id: string) {
  if (!hasBackend) return;
  fetch(`${API_BASE}/api/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id }),
  }).catch(() => {});
}

/**
 * Засчитать клик по кнопке мини-аппа (например, «Написать менеджеру»).
 * keepalive — запрос должен уйти, даже если сразу после клика Telegram
 * откроет чат и мини-апп уйдёт в фон.
 */
export function logClick(kind: "manager", screen: string, initData?: string) {
  if (!hasBackend) return;
  fetch(`${API_BASE}/api/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, screen, initData: initData || undefined }),
    keepalive: true,
  }).catch(() => {});
}

/** Засчитать добавление в избранное (популярность). */
export function logFav(id: string) {
  if (!hasBackend) return;
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
  if (!hasBackend) return { ok: false, error: "no_backend" };
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
  if (!hasBackend) return null;
  try {
    const r = await fetch(`${API_BASE}/api/catalog`, { cache: "no-store" });
    if (!r.ok) return null;
    const data = (await r.json()) as { ok: boolean; catalog: Car[] | null };
    return Array.isArray(data.catalog) ? data.catalog : null;
  } catch {
    return null;
  }
}

/**
 * Куда уходят вызовы админки бота.
 *
 * Обычно — прямо боту, с подписью мини-аппа. Та же админка открывается и в
 * CRM (раздел «Бот»): там подписи Telegram нет, и вызовы идут через сервер
 * CRM полным ключом. Интерфейс один и тот же, данные одни и те же — поэтому
 * обе админки всегда синхронны.
 */
type AdminTransport = (action: string, payload?: unknown) => Promise<unknown>;
let adminTransport: AdminTransport | null = null;
export function setAdminTransport(t: AdminTransport | null) {
  adminTransport = t;
}

/** Вызов админ-API с подписью initData мини-аппа. */
export async function adminCall<T = unknown>(
  initData: string,
  action: string,
  payload?: unknown,
): Promise<{ ok: boolean; error?: string } & T> {
  if (adminTransport) {
    try {
      return (await adminTransport(action, payload)) as { ok: boolean; error?: string } & T;
    } catch (e) {
      return { ok: false, error: (e as Error)?.message || "network" } as never;
    }
  }
  if (!hasBackend) return { ok: false, error: "no_backend" } as never;
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
