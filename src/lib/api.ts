// Клиент к воркеру: общий каталог (публично) и админ-API (по подписи Telegram).
import type { Car } from "@/data/cars";

// VITE_LEAD_ENDPOINT = https://diauto-bot.<acc>.workers.dev/lead
// База API = тот же воркер без /lead.
const LEAD = (import.meta.env.VITE_LEAD_ENDPOINT as string | undefined) || "";
export const API_BASE = LEAD.replace(/\/lead\/?$/, "");
export const hasBackend = !!API_BASE;

export type BotSettings = {
  welcomeText: string;
  catalogButtonText: string;
  calcButtonText: string;
  managerButtonText: string;
  managerUrl: string;
  mapButtonText: string;
  mapUrl: string;
  miniAppUrl?: string;
};

export type Draft = {
  id: string;
  caption: string;
  fileIds: string[];
  parsed: { model: string; price: number; year: number; highlights: string[] };
  ts: number;
};

export type AdminRole = "owner" | "manager" | "viewer";

export type Lead = {
  name: string;
  phone: string;
  car: string;
  source: string;
  ts: number;
};

export type AdminsMap = Record<string, { role: "manager" | "viewer"; name?: string; addedAt?: number }>;

export type Review = {
  id: string;
  name: string;
  text: string;
  car?: string;
  rating: number;
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
};

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
