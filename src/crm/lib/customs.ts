import {
  CLEARANCE_FEE,
  DUTY_ELECTRIC_PERCENT,
  DUTY_FROM_3_TO_5,
  DUTY_OVER_5,
  DUTY_UNDER_3,
  UTIL_FEE_BASE_RUB,
  UTIL_FEE_COMMERCIAL,
  UTIL_FEE_PERSONAL,
  type AgeGroup,
  type EngineType,
} from './customs-rates';

export type CustomsInput = {
  ageGroup: AgeGroup;
  engineType: EngineType;
  /** Объём двигателя в кубических сантиметрах. Для электромобиля не используется. */
  engineCc: number;
  /** Таможенная стоимость авто в евро. */
  priceEur: number;
  /** Курс евро к рублю. */
  eurRate: number;
  /** Ввоз для перепродажи/юрлицом — утильсбор считается по коммерческим коэффициентам. */
  commercial?: boolean;
};

export type CustomsResult = {
  /** Пошлина в евро. */
  dutyEur: number;
  dutyRub: number;
  utilFeeRub: number;
  clearanceFeeRub: number;
  /** Пошлина + утильсбор + сбор за оформление. */
  totalRub: number;
  /** Как именно посчитана пошлина — показываем менеджеру, чтобы расчёт был прозрачным. */
  explanation: string;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Пошлина в евро. */
export function calcDutyEur(input: Pick<CustomsInput, 'ageGroup' | 'engineType' | 'engineCc' | 'priceEur'>): {
  dutyEur: number;
  explanation: string;
} {
  const { ageGroup, engineType, engineCc, priceEur } = input;

  if (engineType === 'ELECTRIC') {
    return {
      dutyEur: round2(priceEur * DUTY_ELECTRIC_PERCENT),
      explanation: `Электромобиль: ${DUTY_ELECTRIC_PERCENT * 100}% от таможенной стоимости`,
    };
  }

  if (ageGroup === 'UNDER_3') {
    const band = DUTY_UNDER_3.find((row) => priceEur <= row.maxPriceEur) ?? DUTY_UNDER_3[DUTY_UNDER_3.length - 1];
    const byPercent = priceEur * band.percent;
    const byVolume = engineCc * band.minEurPerCc;
    const dutyEur = Math.max(byPercent, byVolume);

    return {
      dutyEur: round2(dutyEur),
      explanation:
        `До 3 лет: ${Math.round(band.percent * 100)}% от стоимости = ${round2(byPercent)} €, ` +
        `но не менее ${band.minEurPerCc} €/см³ = ${round2(byVolume)} €. ` +
        `Берём ${byPercent >= byVolume ? 'процент от стоимости' : 'минимум по объёму'}.`,
    };
  }

  const table = ageGroup === 'FROM_3_TO_5' ? DUTY_FROM_3_TO_5 : DUTY_OVER_5;
  const band = table.find((row) => engineCc <= row.maxCc) ?? table[table.length - 1];
  const label = ageGroup === 'FROM_3_TO_5' ? 'От 3 до 5 лет' : 'Старше 5 лет';

  return {
    dutyEur: round2(engineCc * band.eurPerCc),
    explanation: `${label}: ${band.eurPerCc} €/см³ × ${engineCc} см³`,
  };
}

export function calcUtilFeeRub(ageGroup: AgeGroup, commercial = false): number {
  const coefficients = commercial ? UTIL_FEE_COMMERCIAL : UTIL_FEE_PERSONAL;
  return round2(UTIL_FEE_BASE_RUB * coefficients[ageGroup]);
}

export function calcClearanceFeeRub(customsValueRub: number): number {
  const band =
    CLEARANCE_FEE.find((row) => customsValueRub <= row.maxValueRub) ?? CLEARANCE_FEE[CLEARANCE_FEE.length - 1];
  return band.feeRub;
}

/** Полный предварительный расчёт таможенных платежей. */
export function calcCustoms(input: CustomsInput): CustomsResult {
  const { dutyEur, explanation } = calcDutyEur(input);
  const dutyRub = round2(dutyEur * input.eurRate);
  const utilFeeRub = calcUtilFeeRub(input.ageGroup, input.commercial);
  const clearanceFeeRub = calcClearanceFeeRub(round2(input.priceEur * input.eurRate));

  return {
    dutyEur,
    dutyRub,
    utilFeeRub,
    clearanceFeeRub,
    totalRub: round2(dutyRub + utilFeeRub + clearanceFeeRub),
    explanation,
  };
}

/** Возрастная группа по году выпуска — граница считается от текущей даты. */
export function ageGroupFromYear(year: number, now = new Date()): AgeGroup {
  const age = now.getFullYear() - year;
  if (age < 3) return 'UNDER_3';
  if (age <= 5) return 'FROM_3_TO_5';
  return 'OVER_5';
}
