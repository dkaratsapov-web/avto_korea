/**
 * Ставки таможенных платежей для расчёта в CRM.
 *
 * ⚠️ ВАЖНО: ставки меняются, а расчёт нужен только для предварительной оценки
 * стоимости для клиента. Все числа собраны в этом файле, чтобы их можно было
 * поправить в одном месте, не трогая логику. Перед использованием в работе
 * сверьте значения с действующими актами и при необходимости обновите их здесь.
 *
 * Актуально на: январь 2025, ввоз физическим лицом для личного пользования.
 */

export const RATES_UPDATED_AT = 'январь 2025';

export type AgeGroup = 'UNDER_3' | 'FROM_3_TO_5' | 'OVER_5';
export type EngineType = 'PETROL' | 'DIESEL' | 'HYBRID' | 'ELECTRIC';

export const AGE_GROUP_LABELS: Record<AgeGroup, string> = {
  UNDER_3: 'До 3 лет',
  FROM_3_TO_5: 'От 3 до 5 лет',
  OVER_5: 'Старше 5 лет',
};

export const ENGINE_TYPE_LABELS: Record<EngineType, string> = {
  PETROL: 'Бензин',
  DIESEL: 'Дизель',
  HYBRID: 'Гибрид',
  ELECTRIC: 'Электро',
};

/**
 * Авто до 3 лет: комбинированная ставка — процент от стоимости,
 * но не менее фиксированной суммы за кубический сантиметр.
 * Границы `maxPriceEur` — таможенная стоимость в евро.
 */
export const DUTY_UNDER_3 = [
  { maxPriceEur: 8500, percent: 0.54, minEurPerCc: 2.5 },
  { maxPriceEur: 16700, percent: 0.48, minEurPerCc: 3.5 },
  { maxPriceEur: 42300, percent: 0.48, minEurPerCc: 5.5 },
  { maxPriceEur: 84500, percent: 0.48, minEurPerCc: 7.5 },
  { maxPriceEur: 169000, percent: 0.48, minEurPerCc: 15 },
  { maxPriceEur: Infinity, percent: 0.48, minEurPerCc: 20 },
];

/** Авто от 3 до 5 лет: ставка за кубический сантиметр по объёму двигателя. */
export const DUTY_FROM_3_TO_5 = [
  { maxCc: 1000, eurPerCc: 1.5 },
  { maxCc: 1500, eurPerCc: 1.7 },
  { maxCc: 1800, eurPerCc: 2.5 },
  { maxCc: 2300, eurPerCc: 2.7 },
  { maxCc: 3000, eurPerCc: 3.0 },
  { maxCc: Infinity, eurPerCc: 3.6 },
];

/** Авто старше 5 лет. */
export const DUTY_OVER_5 = [
  { maxCc: 1000, eurPerCc: 3.0 },
  { maxCc: 1500, eurPerCc: 3.2 },
  { maxCc: 1800, eurPerCc: 3.5 },
  { maxCc: 2300, eurPerCc: 4.8 },
  { maxCc: 3000, eurPerCc: 5.0 },
  { maxCc: Infinity, eurPerCc: 5.7 },
];

/** Электромобили: единая ставка от таможенной стоимости. */
export const DUTY_ELECTRIC_PERCENT = 0.15;

/**
 * Утилизационный сбор. Базовая ставка умножается на коэффициент.
 * Коэффициенты для личного пользования кратно ниже коммерческих.
 */
export const UTIL_FEE_BASE_RUB = 20000;

export const UTIL_FEE_PERSONAL = {
  UNDER_3: 0.17,
  FROM_3_TO_5: 0.26,
  OVER_5: 0.26,
} satisfies Record<AgeGroup, number>;

/** Коэффициенты для ввоза юридическим лицом или на продажу (объём до 3000 см³). */
export const UTIL_FEE_COMMERCIAL = {
  UNDER_3: 44.3,
  FROM_3_TO_5: 74.75,
  OVER_5: 74.75,
} satisfies Record<AgeGroup, number>;

/** Сбор за таможенные операции — зависит от таможенной стоимости в рублях. */
export const CLEARANCE_FEE = [
  { maxValueRub: 200000, feeRub: 1067 },
  { maxValueRub: 450000, feeRub: 2134 },
  { maxValueRub: 1200000, feeRub: 4269 },
  { maxValueRub: 2700000, feeRub: 11746 },
  { maxValueRub: 4200000, feeRub: 16524 },
  { maxValueRub: 5500000, feeRub: 21344 },
  { maxValueRub: 7000000, feeRub: 27540 },
  { maxValueRub: Infinity, feeRub: 30000 },
];
