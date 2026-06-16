# ДиАвто69 — лендинг

Лендинг импорта авто из 🇰🇷 Кореи, 🇨🇳 Китая, 🇯🇵 Японии и 🇪🇺 ЕС «под ключ».
Главное действие — **заявка на расчёт стоимости**. Бренд: бордо + хром + графит.

Построен на **Next.js (App Router) + TypeScript + Tailwind CSS**.
Визуал перенесён 1:1 из макета `diauto69_site.html`, структура — по `ТЗ_DI_AUTO_69_сайт.md`.

## Стек

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS 3** с кастомными токенами (`tailwind.config.ts`)
- Шрифты через `next/font` (Google): **Saira Condensed** (заголовки), **Saira** (цены/числа), **Manrope** (текст)
- Иконки — **lucide-react**

## Запуск

```bash
npm install      # установить зависимости
npm run dev      # дев-сервер на http://localhost:3000
npm run build    # продакшен-сборка
npm run start    # запуск собранного приложения
npm run lint     # проверка ESLint
```

## Переменные окружения

Скопируйте `.env.example` → `.env.local` и заполните значениями.

| Переменная             | Назначение                                                        |
| ---------------------- | ----------------------------------------------------------------- |
| `TELEGRAM_BOT_TOKEN`   | Токен бота из @BotFather — отправка заявок менеджеру               |
| `TELEGRAM_CHAT_ID`     | ID чата/канала, куда падают заявки                                 |
| `NEXT_PUBLIC_SITE_URL` | Публичный адрес сайта (для `sitemap`/`robots`/OG). Дефолт — прод.  |

> Пока `TELEGRAM_*` не заданы, форма работает в режиме заглушки: заявка
> логируется в консоль сервера, а пользователю показывается успех-тост.
> **Токены не коммитим** (`.env*` в `.gitignore`). Запросите значения у заказчика.

## Структура

```
app/
  layout.tsx          # шрифты, SEO-метаданные, OG
  page.tsx            # сборка всех секций + JSON-LD
  globals.css         # токены + фирменные классы (btn, slash, chrome-line)
  api/lead/route.ts   # приём заявки → Telegram (с заглушкой)
  sitemap.ts          # /sitemap.xml
  robots.ts           # /robots.txt
components/
  sections/           # Header, Hero, Advantages, HowItWorks, Catalog,
                      # Calculator, Geography, Reviews, Faq, FinalCta, Footer
  ui/                 # Button, SectionHeading, Accordion, Logo, Toaster
  icons/              # CarSilhouette (SVG из макета), SpecIcons
  CarCard.tsx         # переиспользуемая карточка авто
  LeadForm.tsx        # переиспользуемая форма заявки (compact / full)
  FloatingTelegram.tsx
data/
  cars.ts             # модель Car + демо-витрина + formatPrice
lib/
  site.ts             # контакты, навигация, страны (контакты — плейсхолдеры с TODO)
  toast.ts            # шина тостов
```

## Дизайн-токены

Заданы в `tailwind.config.ts` (`theme.extend`):

- **Цвета:** `graphite` / `bordeaux` / `steel` / `chrome` / `paper` / `ink` / `success`
- **Шрифты:** `font-display` / `font-num` / `font-body`
- **Радиусы:** `rounded-card` (16px), `rounded-btn` (12px)

Фирменные элементы (`globals.css`): красный «росчерк» `.slash`, хром-хейрлайн
`.chrome-line`, кнопки `.btn-primary` / `.btn-ghost`.

## Каталог авто

Данные — в `data/cars.ts` (тип `Car`). Сейчас демо-витрина из макета.
Если у авто нет `image`, рисуется SVG-силуэт. Фильтр по странам и «показать ещё» —
в `components/sections/Catalog.tsx`.

> **TODO заказчику:** прислать реальные фото и актуальное наличие; реальный
> телефон/адрес/реквизиты для футера; отзывы и кейсы; токены Telegram.

## Деплой на Vercel

Проект готов к zero-config деплою на Vercel (`vercel.json` указывает фреймворк
и регион). Добавьте переменные окружения в настройках проекта Vercel и
подключите репозиторий — сборка `next build` запустится автоматически.

## Доступность и SEO

- Один `H1`, осмысленные `H2`, семантические секции, `alt`/`aria` у графики
- Кликабельные зоны ≥ 48px, видимый focus, уважается `prefers-reduced-motion`
- `metadata` (title/description/OG/Twitter), `sitemap.ts`, `robots.ts`, JSON-LD (`AutoDealer`)
