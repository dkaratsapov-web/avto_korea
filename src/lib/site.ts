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
  phone: "+7 (482) 236-87-77",
  phoneHref: "tel:+74822368777",

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
  address: "ул. Коминтерна, 71",
  addressFull: "Тверь, ул. Коминтерна, 71",
  mapHref: "https://yandex.ru/maps/?text=Тверь%2C%20улица%20Коминтерна%2C%2071",
  map2gisHref: "https://2gis.ru/tver/firm/70000001110299440",

  // Реквизиты ИП (для футера, оферты, страницы «О нас»).
  requisites: {
    name: "ИП Петренко Дмитрий Анатольевич",
    nameFull:
      "Индивидуальный предприниматель Петренко Дмитрий Анатольевич",
    legalAddress:
      "170518, Тверская обл., Калининский р-н, д. Кривцово, ул. Садовая, д. 2, кв. 6",
    inn: "695008216276",
    ogrnip: "325690000034058",
    account: "40802810700008426125",
    bank: "АО «ТБанк»",
    bankInn: "7710140679",
    bik: "044525974",
    corrAccount: "30101810145250000974",
    bankAddress: "127287, г. Москва, ул. Хуторская 2-я, д. 38А, стр. 26",
  },
} as const;

// Навигация по реальным страницам (без якорей-секций).
export const nav = [
  { href: "/about", label: "О нас" },
  { href: "/catalog", label: "Каталог" },
  { href: "/articles", label: "Статьи" },
  { href: "/reviews", label: "Отзывы" },
  { href: "/contacts", label: "Контакты" },
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
