/**
 * Расчёт сумм по сделке.
 *
 * Та же формула, что на сервере (public/crm/api/lib/model.php). Дублируется
 * намеренно: суммы нужно показывать во время ввода, до сохранения, — иначе
 * менеджер вводит цифры вслепую. Обе реализации покрыты тестами на одних
 * и тех же примерах.
 */

export type DealCosts = {
  carPrice: number;
  exchangeRate: number;
  deliveryCost: number;
  customsDuty: number;
  utilFee: number;
  brokerCost: number;
  otherCost: number;
  commission: number;
  paidAmount: number;
};

export type DealTotals = {
  /** Цена авто, пересчитанная в рубли по указанному курсу. */
  carPriceRub: number;
  /** Себестоимость: авто + доставка + пошлина + утильсбор + брокер + прочее. */
  costRub: number;
  /** Итого к оплате клиентом: себестоимость + комиссия. */
  totalRub: number;
  /** Остаток к доплате. */
  dueRub: number;
  /** Прибыль по сделке. */
  profitRub: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function num(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Курс 0 означает «курс ещё не задан»: цену авто в рубли не пересчитываем,
 * чтобы сумма сделки не обнулялась в момент, когда цена уже введена,
 * а курс — ещё нет.
 */
export function calcTotals(deal: Partial<DealCosts>): DealTotals {
  const rate = num(deal.exchangeRate);
  const carPriceRub = rate > 0 ? num(deal.carPrice) * rate : 0;

  const costRub =
    carPriceRub +
    num(deal.deliveryCost) +
    num(deal.customsDuty) +
    num(deal.utilFee) +
    num(deal.brokerCost) +
    num(deal.otherCost);

  const commission = num(deal.commission);
  const totalRub = costRub + commission;

  return {
    carPriceRub: round2(carPriceRub),
    costRub: round2(costRub),
    totalRub: round2(totalRub),
    dueRub: round2(totalRub - num(deal.paidAmount)),
    profitRub: round2(commission),
  };
}

/** «3 552 700 ₽». Дробную часть показываем, только если она есть. */
export function money(value: number | null | undefined, currency = "₽"): string {
  const n = num(value);
  const formatted = n.toLocaleString("ru-RU", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return currency ? `${formatted} ${currency}` : formatted;
}

/** Компактно для карточек: «3,55 млн ₽». */
export function moneyShort(value: number | null | undefined): string {
  const n = num(value);
  if (Math.abs(n) >= 1_000_000) {
    return `${(n / 1_000_000).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} млн ₽`;
  }
  if (Math.abs(n) >= 10_000) {
    return `${Math.round(n / 1000).toLocaleString("ru-RU")} тыс ₽`;
  }
  return money(n);
}

/**
 * Разбор суммы из поля ввода. Менеджер печатает «1 200 000,50» — приводим
 * к числу, не заставляя его следить за формой записи.
 */
export function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[\s ]/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
