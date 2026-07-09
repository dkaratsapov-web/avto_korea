/**
 * Единая точка для контактов и метаданных сайта.
 * TODO: подтвердить у заказчика реальные телефон / адрес / реквизиты.
 */
export const site = {
  name: "ДиАвто69",
  tagline: "Авто из Кореи, Китая и Японии под ключ",
  description:
    "Импорт и автоподбор авто из Кореи, Китая, Японии и ЕС под ключ. Реальные цены и честный расчёт с доставкой и растаможкой — без накруток. 69 регион, Тверь.",
  url: import.meta.env.VITE_SITE_URL ?? "https://diauto69.ru",

  // TODO: уточнить реальный номер у заказчика (сейчас плейсхолдер).
  phone: "+7 (482) 200-69-69",
  phoneHref: "tel:+74822006969",

  telegram: "@Dmitriicarexport",
  telegramHref: "https://t.me/Dmitriicarexport",

  // Мессенджер MAX. TODO: подставить реальную ссылку профиля/канала MAX.
  maxHref: "https://max.ru/",

  // TODO: подтвердить наличие WhatsApp и e-mail.
  whatsappHref: "https://wa.me/74822006969",
  email: "info@diauto69.ru",
  emailHref: "mailto:info@diauto69.ru",

  // TODO: уточнить юридический адрес / реквизиты для футера.
  region: "Тверь · 69 регион",
} as const;

export const nav = [
  { href: "#how", label: "Как работаем" },
  { href: "#calc", label: "Расчёт" },
  { href: "#reviews", label: "Отзывы" },
  { href: "#contacts", label: "Контакты" },
] as const;

export type CountryCode = "kr" | "cn" | "jp" | "eu";

export const countries: Record<
  CountryCode,
  { label: string; flag: string }
> = {
  kr: { label: "Корея", flag: "🇰🇷" },
  cn: { label: "Китай", flag: "🇨🇳" },
  jp: { label: "Япония", flag: "🇯🇵" },
  eu: { label: "ЕС", flag: "🇪🇺" },
};
