/**
 * Форматирование дат и подписей.
 *
 * Сервер хранит время в UTC (ISO с Z), а даты сделки — простой строкой
 * YYYY-MM-DD. Второе намеренно не превращается в Date без часового пояса:
 * иначе «прибытие 15 октября» у менеджера в Твери могло бы показаться
 * четырнадцатым.
 */

const MONTHS = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** «2026-10-15» → «15 октября 2026». */
export function formatDay(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** «2026-10-15» → «15.10.2026» — для плотных мест вроде карточек. */
export function formatDayShort(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";
  return `${day}.${month}.${year}`;
}

/** Метка времени события: «15.10.2026, 14:32» в часовом поясе браузера. */
export function formatMoment(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Сегодняшняя дата в том виде, в котором её ждёт поле ввода. */
export function today(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** Выбор формы слова: 1 сделка, 2 сделки, 5 сделок. */
export function plural(count: number, forms: [string, string, string]): string {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

/** «2,4 МБ» — размер вложения. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
  return `${(bytes / (1024 * 1024)).toLocaleString("ru-RU", { maximumFractionDigits: 1 })} МБ`;
}

/**
 * Пора ли звонить: время перезвона наступило или прошло.
 *
 * Время хранится без часового пояса — как его назначил менеджер. Сравниваем
 * тоже с местным: перезвон в 14:00 должен загораться в 14:00 по Твери, а не
 * по Гринвичу.
 */
export function isCallbackDue(value: string | null | undefined): boolean {
  if (!value) return false;
  const at = new Date(value);
  return !Number.isNaN(at.getTime()) && at.getTime() <= Date.now();
}

/** Инициалы для аватарки сотрудника. */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
