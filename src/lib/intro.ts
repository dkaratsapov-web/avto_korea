/**
 * Будет ли показана заставка с глобусом.
 *
 * Заставок на глаз должна быть ровно одна. Пока едет код страницы, её место
 * занимает разметка из index.html; когда глобус впереди — она остаётся пустым
 * тёмным фоном, и человек видит один экран, который «наполняется» глобусом.
 * Где глобуса не будет (телефон, мини-апп, отключённая анимация) — заставка
 * из разметки показывается целиком и остаётся единственной.
 *
 * ВАЖНО: это же условие продублировано в index.html — там оно должно
 * сработать ещё до загрузки кода. Разойдутся — человек увидит либо две
 * заставки подряд, либо пустой тёмный экран вместо одной.
 */

/** Разделы, у которых своя вёрстка: заставки с глобусом там нет. */
const APART = ["/tma", "/crm", "/go", "/tg", "/bot", "/quiz", "/admin"];

export function willShowIntro(): boolean {
  if (typeof window === "undefined") return false;
  const path = window.location.pathname;
  if (APART.some((prefix) => path.startsWith(prefix))) return false;
  if (window.innerWidth < 768) return false;
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
