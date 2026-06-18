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
  miniAppUrl?: string;
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
