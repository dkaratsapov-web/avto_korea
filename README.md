# ДиАвто69 — лендинг

Лендинг импорта авто из 🇰🇷 Кореи, 🇨🇳 Китая, 🇯🇵 Японии и 🇪🇺 ЕС «под ключ».
Главное действие — **заявка на расчёт стоимости**. Бренд: бордо + хром + графит.

Чистый **React (SPA) + TypeScript**, сборка на **Vite**, стили — **Tailwind CSS**.
Визуал перенесён 1:1 из макета `docs/diauto69_site.html`, структура — по `docs/ТЗ_DI_AUTO_69_сайт.md`.

## Стек

- **React 19** + **TypeScript**, бандлер **Vite 5**
- **Tailwind CSS 3** с кастомными токенами (`tailwind.config.ts`)
- Шрифты — Google Fonts (`index.html`): **Saira Condensed** (заголовки), **Saira** (цены/числа), **Manrope** (текст)
- Иконки — **lucide-react**

## Запуск

```bash
npm install      # установить зависимости
npm run dev      # дев-сервер (Vite) на http://localhost:5173
npm run build    # типизация (tsc) + продакшен-сборка в dist/
npm run preview  # локальный предпросмотр собранного dist/
```

## Переменные окружения

Скопируйте `.env.example` → `.env.local`. Префикс `VITE_` обязателен (иначе
переменная не попадёт в клиентский бандл). Файлы `.env*` не коммитим.

| Переменная           | Назначение                                                              |
| -------------------- | ---------------------------------------------------------------------- |
| `VITE_SITE_URL`      | Публичный адрес сайта (метаданные). Дефолт — прод-домен.                |
| `VITE_LEAD_ENDPOINT` | Эндпоинт приёма заявок. Не задан — формы в демо-режиме (успех без отправки). |
| `VITE_BASE`          | base-путь для деплоя под подпапкой (напр. `/avto_korea/` на GitHub Pages). |

> Форма заявки шлёт `POST` на `VITE_LEAD_ENDPOINT`. Пока он не задан —
> показывается успех-тост без реальной отправки. Когда определимся, как
> принимать лиды (Telegram-бот / e-mail / CRM) — подключим эндпоинт.

## Структура

```
index.html              # точка входа: <head> (мета, OG, шрифты, JSON-LD), #root
vite.config.ts          # React-плагин, alias @ -> src, base из VITE_BASE
src/
  main.tsx              # монтирование React в #root
  App.tsx              # сборка всех секций + Toaster + плавающая кнопка
  index.css            # токены + фирменные классы (btn, slash, chrome-line)
  components/
    sections/          # Header, Hero, Advantages, HowItWorks, Catalog,
                       # Calculator, Geography, Reviews, Faq, FinalCta, Footer
    ui/                # Button, SectionHeading, Accordion, Logo, Toaster
    icons/             # CarSilhouette (SVG из макета), SpecIcons
    CarCard.tsx        # переиспользуемая карточка авто
    LeadForm.tsx       # переиспользуемая форма заявки (compact / full)
    FloatingTelegram.tsx
  data/cars.ts         # модель Car + демо-витрина + formatPrice
  lib/
    site.ts            # контакты, навигация, страны (контакты — плейсхолдеры с TODO)
    toast.ts           # шина тостов
public/                # hero-bg.jpg, robots.txt, sitemap.xml (копируются в dist как есть)
docs/                  # исходное ТЗ и эталонный макет
```

## Дизайн-токены

Заданы в `tailwind.config.ts` (`theme.extend`):

- **Цвета:** `graphite` / `bordeaux` / `steel` / `chrome` / `paper` / `ink` / `success`
- **Шрифты:** `font-display` / `font-num` / `font-body`
- **Радиусы:** `rounded-card` (16px), `rounded-btn` (12px)

Фирменные элементы (`src/index.css`): красный «росчерк» `.slash`, хром-хейрлайн
`.chrome-line`, кнопки `.btn-primary` / `.btn-ghost`.

## Каталог авто

Данные — в `src/data/cars.ts` (тип `Car`). Сейчас демо-витрина из макета.
Если у авто нет `image`, рисуется SVG-силуэт. Фильтр по странам и «показать ещё» —
в `src/components/sections/Catalog.tsx`.

> **TODO заказчику:** реальные фото и актуальное наличие; телефон/адрес/реквизиты
> для футера; отзывы и кейсы; способ приёма заявок (`VITE_LEAD_ENDPOINT`).

## Картинки для постов в Telegram

`scripts/post-card.mjs` собирает карточку авто 1280×960 в стиле сайта: логотип,
модель, цена, лента характеристик и строка преимуществ. Утверждённый макет —
менять его стоит осознанно, посты в канале должны выглядеть одинаково.

```bash
npm i -D playwright && npx playwright install chromium   # один раз
node scripts/post-card.mjs scripts/post-card.example.json out.jpg
```

Данные берутся из JSON (пример — `scripts/post-card.example.json`): марка, модель,
чипы, две цены, до девяти характеристик и путь к фото относительно корня проекта.
Иконки характеристик — имена файлов lucide (`gauge`, `fuel`, `cog`, …), те же, что
в интерфейсе сайта. Фото и логотип подставляются как data-URI, поэтому дев-сервер
для генерации не нужен.

Playwright намеренно не в зависимостях: он нужен только здесь, а в деплой тянуть
лишние сотни мегабайт незачем.

## Смена домена

Домен прописан в шести местах, поэтому меняется скриптом, а не руками:

```bash
node scripts/set-domain.mjs новый-домен.рф --redirect авто-из-кореи-под-ключ.рф
```

Скрипт правит `src/lib/site.ts`, `.env.example`, `public/feed/yandex.php`,
`public/sitemap.xml`, `public/robots.txt` и JSON-LD в `index.html`, а с флагом
`--redirect` добавляет в `public/.htaccess` 301 со старого домена. Кириллица
переводится в punycode там, где адрес читают роботы, и остаётся кириллицей там,
где его видит человек.

Что остаётся сделать руками, скрипт напомнит в конце: переменная
`VITE_SITE_URL` в GitHub Actions, SSL на хостинге, переезд в Яндекс.Вебмастере,
адрес фида в Директе и `MINI_APP_URL` бота.

## Деплой

Сборка — статика в `dist/`, разворачивается на любом статик-хостинге
(GitHub Pages, Vercel, Cloudflare Pages, Netlify, S3 и т.д.).

- **GitHub Pages** (превью): workflow `.github/workflows/deploy-pages.yml` собирает
  с `VITE_BASE=/avto_korea/` и публикует `dist/`. Для SPA добавляется `404.html`
  (копия `index.html`), чтобы прямые ссылки не давали 404.
- **Корневой домен:** соберите `npm run build` (без `VITE_BASE`) и отдайте `dist/`.

## Доступность и SEO

- Один `H1`, осмысленные `H2`, семантические секции, `alt`/`aria` у графики
- Кликабельные зоны ≥ 48px, видимый focus, уважается `prefers-reduced-motion`
- `title`/`description`/OG/Twitter и JSON-LD (`AutoDealer`) в `index.html`,
  `robots.txt` и `sitemap.xml` в `public/`

> Примечание: это клиентский SPA — контент рендерится в браузере. Базовые мета-теги
> в `index.html` присутствуют; для максимального SEO лендинга при необходимости можно
> добавить пререндер (vite-plugin-ssg / prerender) — обсуждаемо.
