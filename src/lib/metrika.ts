/**
 * Яндекс.Метрика: номер счётчика и отправка целей.
 *
 * Цели заводятся в интерфейсе Метрики как «JavaScript-событие», идентификатор
 * должен совпадать со значением из GOALS. Отправка заявки дополнительно
 * фиксируется посещением страницы /thanks — на случай, если JS-цель не успеет
 * уйти до перехода.
 */
export const METRIKA_ID = 111166439;

export const GOALS = {
  /** Форма заявки успешно отправлена. */
  lead: "lead_submit",
  /** Переход в канал/чат Telegram. */
  telegram: "click_telegram",
  /** Переход в канал/чат MAX. */
  max: "click_max",
  /** Клик по номеру телефона. */
  phone: "click_phone",
} as const;

type Ym = (id: number, action: string, ...rest: unknown[]) => void;

/** Отправить цель. Метрики может не быть (блокировщик, локальный запуск). */
export function reachGoal(goal: string, params?: Record<string, unknown>) {
  try {
    const ym = (window as unknown as { ym?: Ym }).ym;
    ym?.(METRIKA_ID, "reachGoal", goal, params);
  } catch {
    /* аналитика не должна ломать интерфейс */
  }
}
