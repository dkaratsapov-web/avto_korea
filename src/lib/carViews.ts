/**
 * Глубина просмотра каталога: сколько РАЗНЫХ авто человек открыл за визит.
 *
 * Зачем отдельный счётчик, а не встроенная цель Метрики «количество
 * просмотров»: карточка авто — модалка, а не страница, хита Метрика не видит.
 * И считать надо уникальные авто: пять раз открыть одну и ту же машину — это
 * не выбор из пяти вариантов, а сомнение над одной.
 *
 * Цель уходит один раз за визит, на шестой карточке — «более пяти».
 */
import { GOALS, reachGoal } from "./metrika";

/** Больше скольких авто — «глубокий просмотр». Цель уходит на следующем. */
export const DEEP_VIEW_CARS = 5;

const KEY = "diauto:car-views";

/** Метрика закрывает визит после 30 минут без действий — считаем так же. */
const VISIT_GAP_MS = 30 * 60 * 1000;

/** Больше сотни авто за визит не бывает — храним столько, чтобы не пухло. */
const MAX_IDS = 100;

type Store = {
  /** Идентификаторы открытых авто, без повторов. */
  ids: string[];
  /** Время последнего просмотра — по нему определяем конец визита. */
  ts: number;
  /** Цель уже отправлена: повторно не шлём. */
  sent: boolean;
};

const fresh = (): Store => ({ ids: [], ts: Date.now(), sent: false });

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const s = JSON.parse(raw) as Store;
    if (!Array.isArray(s.ids) || typeof s.ts !== "number") return fresh();
    // Визит истёк — начинаем счёт заново.
    return Date.now() - s.ts > VISIT_GAP_MS ? fresh() : s;
  } catch {
    return fresh();
  }
}

function write(s: Store) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* приватный режим или переполненное хранилище — не повод падать */
  }
}

/**
 * Отметить просмотр карточки. Вызывается из openCar — единственной точки,
 * через которую карточка открывается со всех экранов.
 */
export function trackCarView(id: string) {
  const s = read();
  s.ts = Date.now();

  if (!s.ids.includes(id) && s.ids.length < MAX_IDS) {
    s.ids.push(id);
  }

  if (!s.sent && s.ids.length > DEEP_VIEW_CARS) {
    s.sent = true;
    reachGoal(GOALS.deepView, { cars: s.ids.length });
  }

  write(s);
}
