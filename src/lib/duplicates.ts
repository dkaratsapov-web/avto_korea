import type { Car } from "@/data/cars";

/**
 * Поиск повторов в каталоге.
 *
 * Откуда они берутся. Каталог наполняется из канала: каждый пост становится
 * карточкой, и связь между ними — идентификатор поста. Пока канал один, всё
 * сходится. Но если те же машины опубликовать во ВТОРОМ канале — например при
 * переезде, — это для бота новые посты, и он честно заводит вторые карточки.
 * Ни он, ни мы не можем знать, что это та же машина, а не ещё одна такая же на
 * складе: у нового автомобиля и пробег нулевой, и цена та же.
 *
 * Поэтому здесь не «удалялка», а поиск кандидатов. Решение остаётся за
 * человеком: только он знает, две ли это машины или одна, опубликованная
 * дважды.
 */

/**
 * Отпечаток машины: по нему и группируем.
 *
 * Берём то, что описывает конкретный экземпляр и не зависит от того, как
 * оформлен пост: модель, год, комплектация, пробег и цена. Фотографии,
 * описание и дата добавления не в счёт — они у повторов как раз разные.
 *
 * Модель приводим к общему виду: в постах она пишется то через дефис, то
 * через пробел, то в разном регистре.
 */
export function carFingerprint(car: Car): string {
  const model = String(car.model || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "")
    .trim();
  const price = car.priceTverRub ?? car.priceRub ?? 0;
  return [model, car.year ?? 0, String(car.trim || "").toLowerCase().trim(), car.mileageKm ?? 0, price].join("|");
}

export type DuplicateGroup = {
  /** Отпечаток — общий для всей группы. */
  key: string;
  /** Карточки, от самой свежей к самой старой. */
  cars: Car[];
  /**
   * Насколько уверенно это повтор.
   *
   * «Точно» — у машины есть пробег, и он совпал до километра. Два разных
   * автомобиля с одинаковым одометром, ценой и годом практически не
   * встречаются: пробег работает как отпечаток пальца.
   *
   * «Возможно» — машина новая, пробег нулевой у всех. Тогда совпадение может
   * означать и вторую такую же машину в наличии. Такие группы показываем, но
   * ничего не предлагаем удалять по умолчанию.
   *
   * «Похожие» — точного совпадения нет, но модель и год те же, а цена и
   * пробег почти равны (цену поправили на пару тысяч, комплектацию записали
   * иначе). Чаще всего это тот же автомобиль, опубликованный повторно, —
   * показываем как подсказку, удалять не предлагаем.
   */
  certainty: "sure" | "maybe" | "similar";
};

/** Дата добавления; у старых карточек её может не быть. */
function addedAt(car: Car): number {
  return typeof car.addedAt === "number" ? car.addedAt : 0;
}

/**
 * Сгруппировать повторы. Группы идут от самых уверенных к спорным, внутри
 * группы — от свежей карточки к старой.
 */
export function findDuplicates(cars: Car[]): DuplicateGroup[] {
  const byKey = new Map<string, Car[]>();
  for (const car of cars) {
    const key = carFingerprint(car);
    const list = byKey.get(key);
    if (list) list.push(car);
    else byKey.set(key, [car]);
  }
  const groups: DuplicateGroup[] = [];
  const inExact = new Set<string>();
  for (const [key, list] of byKey) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => addedAt(b) - addedAt(a));
    const hasMileage = (sorted[0].mileageKm ?? 0) > 0;
    groups.push({ key, cars: sorted, certainty: hasMileage ? "sure" : "maybe" });
    for (const c of list) inExact.add(c.id);
  }
  /*
   * Похожие ищем по ВСЕМУ каталогу: карточка, похожая на точный повтор,
   * иначе выпадала из поиска — её пары уже «заняты» точной группой. Группу,
   * которая целиком повторяет точную, второй раз не показываем.
   */
  const exactKey = new Map(cars.map((c) => [c.id, carFingerprint(c)]));
  for (const g of findSimilar(cars)) {
    const keys = new Set(g.cars.map((c) => exactKey.get(c.id)));
    if (keys.size === 1 && g.cars.every((c) => inExact.has(c.id))) continue;
    groups.push(g);
  }
  const rank = { sure: 0, maybe: 1, similar: 2 } as const;
  return groups.sort((a, b) => {
    if (a.certainty !== b.certainty) return rank[a.certainty] - rank[b.certainty];
    return b.cars.length - a.cars.length;
  });
}

/** Модель в общем виде: без регистра, пробелов и знаков. */
function modelKey(car: Car): string {
  return String(car.model || "").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "");
}

/** Почти равны: разница не больше доли от большего. Оба нуля — равны. */
function near(a: number, b: number, share: number): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Math.abs(a - b) <= Math.max(a, b) * share;
}

/**
 * Комплектации не противоречат друг другу: совпадают с точностью до
 * написания, одна продолжает другую («M-SPORT» и «M Sport пакет») или одна
 * не указана. «BASE» и «M-SPORT» — уже разные машины.
 */
function trimsCompatible(a: Car, b: Car): boolean {
  const k = (c: Car) => String(c.trim || "").toLowerCase().replace(/[^a-zа-яё0-9]+/gi, "");
  const x = k(a);
  const y = k(b);
  return !x || !y || x.includes(y) || y.includes(x);
}

/**
 * Похожие карточки: та же модель и год, цена в пределах 3%, пробег в
 * пределах 2%. Группа собирается цепочкой: если A похожа на B, а B на C —
 * все трое в одной группе.
 */
function findSimilar(cars: Car[]): DuplicateGroup[] {
  const byModel = new Map<string, Car[]>();
  for (const c of cars) {
    const k = `${modelKey(c)}|${c.year ?? 0}`;
    const list = byModel.get(k);
    if (list) list.push(c);
    else byModel.set(k, [c]);
  }
  const groups: DuplicateGroup[] = [];
  for (const [k, list] of byModel) {
    if (list.length < 2) continue;
    const used = new Set<string>();
    for (const seed of list) {
      if (used.has(seed.id)) continue;
      const group = [seed];
      used.add(seed.id);
      for (let i = 0; i < group.length; i++) {
        for (const other of list) {
          if (used.has(other.id)) continue;
          const x = group[i];
          const px = x.priceTverRub ?? x.priceRub ?? 0;
          const po = other.priceTverRub ?? other.priceRub ?? 0;
          if (
            trimsCompatible(x, other) &&
            near(px, po, 0.03) &&
            near(x.mileageKm ?? 0, other.mileageKm ?? 0, 0.02)
          ) {
            group.push(other);
            used.add(other.id);
          }
        }
      }
      if (group.length > 1) {
        const sorted = group.sort((a, b) => addedAt(b) - addedAt(a));
        groups.push({ key: `~${k}|${sorted[0].id}`, cars: sorted, certainty: "similar" });
      }
    }
  }
  return groups;
}

/**
 * Что предлагаем удалить, если человек согласится со всем сразу.
 *
 * Из каждой уверенной группы оставляем САМУЮ СВЕЖУЮ карточку, остальные
 * предлагаем убрать. Свежую — потому что она пришла из действующего канала, и
 * дальше правки поста будут обновлять именно её; старая осталась от канала,
 * из которого мы больше не читаем, и обновляться уже не будет никогда.
 *
 * Спорные группы (новые машины с нулевым пробегом) не трогаем: там повтор
 * неотличим от второй такой же машины в наличии.
 */
export function suggestedRemovals(groups: DuplicateGroup[]): Car[] {
  return groups
    .filter((g) => g.certainty === "sure")
    .flatMap((g) => g.cars.slice(1));
}

/** Поле карточки для сравнения в группе: подпись и значение у машины. */
export type CompareField = { key: string; label: string; value: (c: Car) => string };

const rub = (n: number) => `${new Intl.NumberFormat("ru-RU").format(n)} ₽`;
const km = (n: number) => (n ? `${new Intl.NumberFormat("ru-RU").format(n)} км` : "без пробега");

/**
 * Поля, которые показываем у каждой карточки группы — по ним человек и
 * решает, одна это машина или две. Пустые значения выводятся как «—».
 */
export const COMPARE_FIELDS: CompareField[] = [
  { key: "price", label: "Цена", value: (c) => rub(c.priceTverRub ?? c.priceRub ?? 0) },
  { key: "trim", label: "Комплектация", value: (c) => String(c.trim || "").trim() },
  { key: "year", label: "Год", value: (c) => (c.year ? String(c.year) : "") },
  { key: "mileage", label: "Пробег", value: (c) => km(c.mileageKm ?? 0) },
  { key: "engine", label: "Двигатель", value: (c) => String(c.engine || "").trim() },
  { key: "power", label: "Мощность", value: (c) => (c.powerHp ? `${c.powerHp} л.с.` : "") },
  { key: "color", label: "Цвет", value: (c) => String(c.color || "").trim() },
  { key: "drive", label: "Привод", value: (c) => String(c.drive || "").trim() },
  { key: "country", label: "Страна", value: (c) => String(c.country || "") },
];

/** Насколько различаются два числа, в процентах от большего. */
function spread(values: number[]): number {
  const xs = values.filter((v) => v > 0);
  if (xs.length < 2) return 0;
  const max = Math.max(...xs);
  return ((max - Math.min(...xs)) / max) * 100;
}

/**
 * Почему карточки группы похожи — и чем отличаются.
 *
 * Без этого в группе видны только одинаковые названия, и чтобы решить, что
 * удалять, приходилось открывать каждую карточку. Здесь — что совпало
 * (модель, год, комплектация, главное фото, описание) и насколько разошлись
 * цена и пробег.
 */
export function whySimilar(group: DuplicateGroup): { same: string[]; diff: string[] } {
  const cars = group.cars;
  const same: string[] = ["модель"];
  const diff: string[] = [];
  const all = (f: (c: Car) => string) => {
    const vals = cars.map(f).map((v) => v.toLowerCase().replace(/\s+/g, " ").trim());
    return { vals, one: vals.every((v) => v === vals[0]), empty: vals.every((v) => !v) };
  };

  const year = all((c) => String(c.year || ""));
  if (year.one && !year.empty) same.push(`год ${cars[0].year}`);
  else if (!year.empty) diff.push("год");

  const prices = cars.map((c) => c.priceTverRub ?? c.priceRub ?? 0);
  const ps = spread(prices);
  if (ps === 0 && prices[0]) same.push(`цена ${rub(prices[0])}`);
  else if (prices.some(Boolean)) {
    const lo = Math.min(...prices.filter(Boolean));
    const hi = Math.max(...prices);
    diff.push(`цена ${rub(lo)} – ${rub(hi)} (разница ${ps.toFixed(1)}%)`);
  }

  const kms = cars.map((c) => c.mileageKm ?? 0);
  const ks = spread(kms);
  if (kms.every((k) => k === kms[0])) same.push(kms[0] ? `пробег ${km(kms[0])}` : "без пробега");
  else diff.push(`пробег ${km(Math.min(...kms))} – ${km(Math.max(...kms))} (разница ${ks.toFixed(1)}%)`);

  for (const f of COMPARE_FIELDS.filter((x) => ["trim", "engine", "power", "color", "drive"].includes(x.key))) {
    const r = all(f.value);
    if (r.empty) continue;
    if (r.one) same.push(`${f.label.toLowerCase()}${f.key === "trim" ? ` «${f.value(cars[0])}»` : ""}`);
    else diff.push(f.label.toLowerCase());
  }

  const photo = all((c) => String(c.images?.[0] || ""));
  if (photo.one && !photo.empty) same.push("главное фото");
  const about = all((c) => String(c.description || ""));
  if (about.one && !about.empty) same.push("описание");

  return { same, diff };
}
