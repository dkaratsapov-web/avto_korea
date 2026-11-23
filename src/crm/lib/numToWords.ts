/** Сумма прописью по-русски — нужна в счетах на оплату. */

const ONES_MALE = [
  '',
  'один',
  'два',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
];

const ONES_FEMALE = [
  '',
  'одна',
  'две',
  'три',
  'четыре',
  'пять',
  'шесть',
  'семь',
  'восемь',
  'девять',
];

const TEENS = [
  'десять',
  'одиннадцать',
  'двенадцать',
  'тринадцать',
  'четырнадцать',
  'пятнадцать',
  'шестнадцать',
  'семнадцать',
  'восемнадцать',
  'девятнадцать',
];

const TENS = [
  '',
  '',
  'двадцать',
  'тридцать',
  'сорок',
  'пятьдесят',
  'шестьдесят',
  'семьдесят',
  'восемьдесят',
  'девяносто',
];

const HUNDREDS = [
  '',
  'сто',
  'двести',
  'триста',
  'четыреста',
  'пятьсот',
  'шестьсот',
  'семьсот',
  'восемьсот',
  'девятьсот',
];

/** Выбор формы слова: 1 рубль, 2 рубля, 5 рублей. */
export function plural(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;

  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** Группа из трёх разрядов словами. */
function tripletToWords(value: number, female: boolean): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const tens = Math.floor(rest / 10);
  const ones = rest % 10;

  if (hundreds > 0) parts.push(HUNDREDS[hundreds]);

  if (tens === 1) {
    parts.push(TEENS[ones]);
  } else {
    if (tens > 1) parts.push(TENS[tens]);
    if (ones > 0) parts.push(female ? ONES_FEMALE[ones] : ONES_MALE[ones]);
  }

  return parts.join(' ');
}

const SCALES: { forms: [string, string, string]; female: boolean }[] = [
  { forms: ['', '', ''], female: false }, // единицы — название разряда берём из валюты
  { forms: ['тысяча', 'тысячи', 'тысяч'], female: true },
  { forms: ['миллион', 'миллиона', 'миллионов'], female: false },
  { forms: ['миллиард', 'миллиарда', 'миллиардов'], female: false },
];

/** Целое число словами. Для 0 возвращает «ноль». */
export function integerToWords(value: number, female = false): string {
  const rounded = Math.floor(Math.abs(value));
  if (rounded === 0) return 'ноль';

  const triplets: number[] = [];
  let rest = rounded;
  while (rest > 0) {
    triplets.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let index = triplets.length - 1; index >= 0; index -= 1) {
    const triplet = triplets[index];
    if (triplet === 0) continue;

    const scale = SCALES[index] ?? SCALES[SCALES.length - 1];
    const isFemale = index === 0 ? female : scale.female;
    parts.push(tripletToWords(triplet, isFemale));

    if (index > 0) parts.push(plural(triplet, scale.forms));
  }

  return parts.join(' ');
}

/**
 * Сумма прописью: «2 826 946,50 ₽» → «Два миллиона восемьсот двадцать шесть тысяч
 * девятьсот сорок шесть рублей 50 копеек».
 */
export function moneyToWords(amount: number): string {
  const negative = amount < 0;
  const absolute = Math.abs(amount);
  const rubles = Math.floor(absolute);
  // Округление до копеек делаем через строку, чтобы 0.1 + 0.2 не давало 0.30000000000000004
  const kopecks = Math.round((absolute - rubles) * 100);

  // Округление копеек может дать ровно 100 — тогда переносим рубль.
  const finalRubles = kopecks === 100 ? rubles + 1 : rubles;
  const finalKopecks = kopecks === 100 ? 0 : kopecks;

  const words = integerToWords(finalRubles);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);

  const rubleWord = plural(finalRubles, ['рубль', 'рубля', 'рублей']);
  const kopeckWord = plural(finalKopecks, ['копейка', 'копейки', 'копеек']);

  const result = `${capitalized} ${rubleWord} ${String(finalKopecks).padStart(2, '0')} ${kopeckWord}`;
  return negative ? `Минус ${result.charAt(0).toLowerCase()}${result.slice(1)}` : result;
}
