/**
 * Этапы воронки.
 *
 * Порядок здесь — это порядок колонок на доске и порядок шагов в полосе
 * прогресса у клиента. Коды совпадают с тем, что хранит база (crm_deals.stage).
 */

export type Stage =
  | "NEW"
  | "SELECTION"
  | "APPROVAL"
  | "PURCHASED"
  | "SHIPPING"
  | "CUSTOMS"
  | "DELIVERY"
  | "DONE"
  | "LOST";

export const STAGES: Stage[] = [
  "NEW",
  "SELECTION",
  "APPROVAL",
  "PURCHASED",
  "SHIPPING",
  "CUSTOMS",
  "DELIVERY",
  "DONE",
  "LOST",
];

/** Колонки канбан-доски: завершённые сделки на ней не висят. */
export const BOARD_STAGES: Stage[] = [
  "NEW",
  "SELECTION",
  "APPROVAL",
  "PURCHASED",
  "SHIPPING",
  "CUSTOMS",
  "DELIVERY",
];

export const CLOSED_STAGES: Stage[] = ["DONE", "LOST"];

export const STAGE_LABELS: Record<Stage, string> = {
  NEW: "Новая заявка",
  SELECTION: "Подбор авто",
  APPROVAL: "Согласование и предоплата",
  PURCHASED: "Куплено на аукционе",
  SHIPPING: "В пути",
  CUSTOMS: "Таможня",
  DELIVERY: "Выдача клиенту",
  DONE: "Сделка завершена",
  LOST: "Отказ",
};

/** Короткие подписи для колонок — полные не влезают в заголовок. */
export const STAGE_SHORT: Record<Stage, string> = {
  NEW: "Заявка",
  SELECTION: "Подбор",
  APPROVAL: "Согласование",
  PURCHASED: "Куплено",
  SHIPPING: "В пути",
  CUSTOMS: "Таможня",
  DELIVERY: "Выдача",
  DONE: "Завершена",
  LOST: "Отказ",
};

export const STAGE_COLORS: Record<Stage, string> = {
  NEW: "#64748b",
  SELECTION: "#0ea5e9",
  APPROVAL: "#8b5cf6",
  PURCHASED: "#f59e0b",
  SHIPPING: "#06b6d4",
  CUSTOMS: "#f97316",
  DELIVERY: "#22c55e",
  DONE: "#16a34a",
  LOST: "#ef4444",
};

export function isStage(value: unknown): value is Stage {
  return typeof value === "string" && (STAGES as string[]).includes(value);
}
