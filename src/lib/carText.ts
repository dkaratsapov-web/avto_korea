import type { CountryCode } from "@/lib/site";

/**
 * Разобрать подпись комплектации, вычленив из неё название страны.
 *
 * Зачем. Бот при разборе поста иногда склеивал в поле «комплектация» хвост
 * «Страна: ОАЭ» — и в карточке выходило «HIGH LINE СТРАНА ОАЭ». Страна на
 * карточке и так показана флажком, поэтому из подписи её убираем. А заодно
 * возвращаем код страны: у части уже заведённых авто флаг проставлен неверно
 * (ОАЭ как страну бот не знал и ставил Японию по марке), и этот код позволяет
 * поправить флажок прямо на витрине, не дожидаясь переразбора поста.
 */

// Диапазоны кириллицы явно: \w в JS ловит только латиницу, и «КИТАЙ» после
// «кита\w*» не совпадал бы — хвост «й» выпадал из класса.
const WORD_TO_CODE: Array<[RegExp, CountryCode]> = [
  [/^(оаэ|эмират[а-яё]*|uae|dubai|дуба[а-яё]*)$/i, "ae"],
  [/^(коре[а-яё]*|korea)$/i, "kr"],
  [/^(кита[а-яё]*|china)$/i, "cn"],
  [/^(япон[а-яё]*|japan)$/i, "jp"],
  [/^(ес|европ[а-яё]*|eu|герман[а-яё]*)$/i, "eu"],
];

function codeOf(word: string): CountryCode | null {
  const w = word.trim();
  for (const [re, code] of WORD_TO_CODE) if (re.test(w)) return code;
  return null;
}

/** Убрать из комплектации хвост «страна …» и вернуть вычисленный код страны. */
export function splitTrimCountry(trim?: string): {
  trim: string;
  country: CountryCode | null;
} {
  const raw = (trim ?? "").trim();
  if (!raw) return { trim: "", country: null };

  // «… страна ОАЭ», «… страна: корея», «… country china» — отрезаем хвост.
  const m = raw.match(/\s*(?:страна|country)\s*[:：—-]?\s*([^\s,;]+)\s*$/i);
  if (!m) return { trim: raw, country: null };

  return { trim: raw.slice(0, m.index).trim(), country: codeOf(m[1]) };
}
