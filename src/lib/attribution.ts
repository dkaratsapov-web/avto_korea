/**
 * Откуда пришёл человек: метки рекламы запоминаются до самой заявки.
 *
 * Зачем. В заявке до сих пор был только «источник» в смысле страницы —
 * «Каталог», «Страница «Контакты»». Для менеджера этого хватает, для рекламы
 * не хватает совсем: по такой заявке нельзя сказать, какая кампания её
 * привела, а значит нельзя ни отключить пустую кампанию, ни усилить рабочую.
 * Метрика считает цели сама, но она знает только про клики по кнопкам; какая
 * заявка стала сделкой, знает CRM — и вот там метки и нужны.
 *
 * Как. Метки снимаем при первом же заходе и храним в браузере: человек редко
 * оставляет заявку на той же странице, куда пришёл по объявлению, а до формы
 * доходит через каталог и карточки. Первый заход и последний храним отдельно:
 * первый отвечает на вопрос «кто привёл», последний — «что дожало».
 */

const KEY_FIRST = "di-ad-first";
const KEY_LAST = "di-ad-last";

/** Метки, которые имеют значение для разбора рекламы. */
const FIELDS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type Attribution = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** Идентификатор клика Яндекса — по нему сходится выгрузка из Директа. */
  yclid?: string;
  gclid?: string;
  /** Страница входа и первый реферер: пригодятся, когда меток нет вовсе. */
  landing?: string;
  referrer?: string;
  ts?: number;
};

function read(key: string): Attribution | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Attribution) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: Attribution) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* приватный режим — метка не сохранится, это не повод падать */
  }
}

/** Снять метки с текущего адреса. Пусто — если рекламных меток нет. */
function fromUrl(): Attribution | null {
  const params = new URLSearchParams(window.location.search);
  const out: Attribution = {};

  for (const field of FIELDS) {
    const value = params.get(field);
    if (value) out[field.replace("utm_", "") as keyof Attribution] = value.slice(0, 120) as never;
  }
  const yclid = params.get("yclid");
  const gclid = params.get("gclid");
  if (yclid) out.yclid = yclid.slice(0, 64);
  if (gclid) out.gclid = gclid.slice(0, 64);

  // Ни одной метки — запоминать нечего: переход из закладок или по прямой
  // ссылке не должен затирать рекламную метку прошлого захода.
  if (!Object.keys(out).length) return null;

  out.landing = window.location.pathname.slice(0, 120);
  out.referrer = (document.referrer || "").slice(0, 160);
  out.ts = Date.now();
  return out;
}

/**
 * Запомнить метки текущего захода. Вызывается один раз при запуске.
 */
export function captureAttribution() {
  if (typeof window === "undefined") return;
  const now = fromUrl();
  if (!now) return;
  if (!read(KEY_FIRST)) write(KEY_FIRST, now);
  write(KEY_LAST, now);
}

/**
 * Что приложить к заявке.
 *
 * Отдаём оба захода: первый — кто привёл, последний — что дожало. Если меток
 * не было вовсе, возвращаем пусто, и заявка выглядит как раньше.
 */
export function attributionForLead(): { first?: Attribution; last?: Attribution } | undefined {
  const first = read(KEY_FIRST);
  const last = read(KEY_LAST);
  if (!first && !last) return undefined;
  return {
    ...(first ? { first } : {}),
    ...(last && JSON.stringify(last) !== JSON.stringify(first) ? { last } : {}),
  };
}

/** Короткая подпись для чата менеджеров: «yandex / cpc / korea-msk». */
export function attributionLabel(ad?: Attribution | null): string {
  if (!ad) return "";
  const parts = [ad.source, ad.medium, ad.campaign].filter(Boolean);
  if (!parts.length && ad.yclid) return "Яндекс.Директ (клик без меток)";
  return parts.join(" / ");
}
