# Устройство проекта ДиАвто69

Справочник для разработчика и для Claude: что из чего состоит, где лежит и как связано. Состояние на 20.11.2026.

## Части системы

| Часть | Где работает | Код | Адрес |
|---|---|---|---|
| Сайт (витрина, каталог, статьи, квиз) | reg.ru, Apache | `src/`, `index.html`, `public/` | https://автоимпорт-69.рф |
| Мини-апп каталога | тот же сайт, внутри Telegram и MAX | `src/components/tma/`, `src/lib/telegram.ts`, `src/lib/maxapp.ts` | /tma |
| CRM | тот же хостинг, PHP + SQLite | `src/crm/` (интерфейс), `public/crm-api/` (API) | /crm |
| Бот Telegram @DI_AVTO_69_BOT и бот MAX | Cloudflare Worker `diauto-bot` + KV | `worker/lead-worker.js`, `worker/max-bot.js` | diauto-bot.d-karatsapov.workers.dev |
| PHP-прокси сайта к воркеру | reg.ru | `public/api/*.php` | /api/... |
| Фиды каталога | reg.ru | `public/feed/*.php` | /feed/yandex.xml, /feed/2gis.xml, /feed/marquiz.csv |

Домен `*.workers.dev` в России блокируется, поэтому браузер ходит к сайту, а сайт сам — к воркеру (`public/api/proxy.php`, `media.php`, `lead.php`).

Старый домен авто-из-кореи-под-ключ.рф переадресует на основной (`.htaccess`).

## Сайт и мини-апп
- React 19, TypeScript, Vite, Tailwind. Сборка: `npm run build` → `dist/`.
- Маршруты — `src/App.tsx`: `/`, `/catalog`, `/reviews`, `/about`, `/contacts`, `/articles`, `/articles/:slug`, `/news`, `/quiz`, `/go` (посадочная под рекламу), `/thanks`, `/privacy`, `/consent`, `/bot`, `/tg`, `/tma` (мини-апп), `/admin`, `/crm/*`.
- Админка бота `src/components/pages/TmaAdmin.tsx` — одна и та же в мини-аппе и в CRM («Каталог и бот»). В CRM запросы идут через `setAdminTransport` → `/crm/api/bot/call`.
- Поиск похожих карточек каталога — `src/lib/duplicates.ts` (+ тесты).

## `public/.htaccess` (Apache)
- Принудительный HTTPS, путь ACME `/.well-known/acme-challenge/` не трогается.
- 301 со старого домена и с www.
- `/api/(catalog|reviews|news|faq|rates|diag|admin|ping|view|fav|subscribe|click)` → `api/proxy.php` (GET кэшируется, POST — только из списка `POST_ALLOWED`).
- `/api/tgphoto`, `/api/tgvideo` → `api/media.php` (кэш фото и видео в `/media-cache/` и `private-media/`).
- `/crm/api/...` → `crm-api/index.php`; остальные `/crm/...` → `index.html`.
- SPA-фолбэк: всё, чего нет на диске, → `index.html`.
- Заголовки: HSTS (180 дней), Referrer-Policy, Permissions-Policy, **CSP `script-src`** (только свой домен, Метрика, Telegram, MAX, tgtrack), для `/crm` — запрет фрейма. Служебные файлы (`.sqlite`, `.log`, `.jsonl`, точечные) не отдаются.
- Метка noindex для служебных страниц (`/go`, `/quiz`, `/crm`, `/tma` и др.).

## Внешние сервисы на сайте
- Яндекс Метрика 111166439 (вебвизор выключен в мини-аппе).
- tgtrack — подсчёт переходов в Telegram-канал (кроме /tma).
- Telegram WebApp SDK и MAX WebApp SDK — только в мини-аппе.
- Яндекс.Карта на «Контактах» (во фрейме).
- Google Fonts.

## Воркер (бот)
Переменные и секреты Cloudflare (значения — только в панели Cloudflare):
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` (чат заявок), `ADMIN_IDS` (владельцы), `MAX_BOT_TOKEN`, `MINI_APP_URL` (в `wrangler.toml`), KV `STORE`.

Адреса:

| Адрес | Что | Защита |
|---|---|---|
| POST /tg | вебхук Telegram | заголовок `X-Telegram-Bot-Api-Secret-Token` (HMAC от токена) |
| POST /max | вебхук MAX | заголовок `X-Max-Bot-Api-Secret` |
| /setup, /max/setup, /max/diag, /admin/catalog-* | служебные | `?key=` токен бота |
| POST /api/admin | админка (мини-апп) | подпись Telegram initData + права |
| POST /api/crm | CRM → бот | `X-Crm-Key`: узкий `crmKey` (отзывы) или полный `crmAdminKey` |
| POST /lead | заявка | открыт; поля режутся, ≤40 уведомлений за 10 мин |
| GET /api/catalog, reviews, news, faq, rates | данные витрины | открыты |
| GET /api/diag | диагностика без секретов | открыт |
| GET /api/tgphoto, /api/tgvideo | медиа из Telegram | открыты |
| POST /api/view, fav, ping, subscribe, click | счётчики | initData там, где нужен пользователь |

Действия админки (`NEED_CAP`): `catalog.*`, `drafts.*`, `settings.*`, `faq.*`, `leads.list/remove`, `subs.list`, `reviews.*`, `stats.get`, `broadcast.send/audience`, `webhook.setup`, `admins.*`. Права: `catalog, leads, reviews, subs, stats, bot, broadcast, admins`; владелец из `ADMIN_IDS` — все.

Ключи KV: `catalog`, `drafts`, `settings`, `faq`, `leads`, `reviews`, `news`, `users`, `subs`, `stats`, `admins`, `crmKey`, `crmAdminKey`, `lastBroadcast`, `lastPostShape`, `catalogChatSeen`, `catalogChatRejected`, `diag:last`, `max:lastChat`, `max:replyTo`, `lead:burst:*`, `webhook:rebind:*`.

Что умеет бот (основное):
- посты канала с машиной → карточка каталога и копия в канал MAX (`mirrorToMax`, `maxPostHtml` — без ссылок на Telegram);
- заявки → чат заявок и KV;
- рекламные метки `/start a-<метка>` и `?start=<метка>` (статистика в админке: метки, UTM, клики по кнопке менеджера);
- рассылка с сегментами (все, новые 7 дней, активные 30 дней, спящие, с заявкой, без заявки, подписчики, по метке), заблокировавшие бота исключаются;
- `/crm_admin` (только владелец) — выдаёт полный ключ для раздела CRM «Каталог и бот».

Тесты: `worker/lead-worker.test.mjs` (`npm test`). Обёртка в тестах подписывает запросы к /tg и /max, как мессенджер.

## CRM
Подробно — `docs/crm.md`. Кратко:
- Роли: `OWNER`, `MANAGER`. Кука `crm_session` (путь /crm, HttpOnly, SameSite=Lax), вход с ограничением 5 попыток за 15 минут.
- Таблицы SQLite: `crm_users`, `crm_sessions`, `crm_deals`, `crm_events`, `crm_tasks`, `crm_files`, `crm_settings` (ключ → JSON), `crm_push`, `crm_schema`.
- Данные — вне папки сайта (`private-crm/`), резервные копии — `lib/backup.php`.
- Разделы интерфейса: Сделки, Задачи, Аналитика, **Контент** (контент-план Instagram: календарь по месяцам, по направлениям, список, бриф), Отзывы, Сотрудники, Реквизиты, Копии, **Каталог и бот** (доступен всем сотрудникам; подключение ключа и «Админы» — только владелец).
- Контент-план: `crm_settings` id `content_plan` (поле `seed` — версия стартового плана из `src/crm/data/content-plan.json`), бриф — id `content_brief`.

## GitHub Actions

| Workflow | Когда | Что делает |
|---|---|---|
| Deploy site to reg.ru | push в основную ветку | сборка и выгрузка `dist/` по FTP |
| Deploy Telegram bot (Cloudflare Worker) | push с изменениями в `worker/` | `wrangler deploy` |
| Deploy site to Yandex | push | падает всегда (давняя проблема, не используется) |
| Site shots | вручную или правка `site-shots.txt` | браузер на живом сайте → ветка `site-shots` |
| Site check | каждый день 06:17 UTC и вручную | SSL (падает, если < 14 дней), ответы сайта, вебхук Telegram |
| Выгрузка рекламы | понедельник 09:00 МСК | отчёт по рекламе |
| Каталог для Marquiz | понедельник 09:30 МСК | выгрузка каталога для квиза |
| Настройки бота | вручную | точечная правка настроек бота |
| Аудит каталога | вручную | проверка обложек, удаление брака по списку |
| Отзыв на сайт | вручную | добавить или убрать отзыв |
| Статистика TG-каналов | вручную | сбор статистики каналов для подбора рекламы |

Секреты Actions (значения не в репозитории): `REGRU_FTP_SERVER`, `REGRU_FTP_USERNAME`, `REGRU_FTP_PASSWORD` (выкладка сайта), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (воркер, правка KV из Actions), `METRIKA_TOKEN`, `DIRECT_TOKEN`, `DIRECT_LOGIN` (отчёты по рекламе), `YANDEX_TOKEN`, `YC_ACCESS_KEY_ID`, `YC_SECRET_ACCESS_KEY` (выкладка в Яндекс — не работает).

## Скрипты
- `scripts/site-shot.mjs` — браузер для живого сайта (используется в Site shots, работает и локально).
- `scripts/md-to-pdf.py` — PDF из markdown со шрифтом Manrope (`scripts/.fonts/`).
- `scripts/content-plan-json.mjs` — `context/content-calendar.md` → стартовый план CRM.
- `scripts/content-brief-md.mjs` — `src/crm/data/content-brief.json` → `context/content-brief.md`.

## Claude и скиллы
- Скиллы в репозитории: `.claude/skills/` (контент, видео, моушн, веб-дизайн).
- Плагины (`.claude/settings.json` и скрипт настройки облачного окружения Default): example-skills, marketing-skills, product-skills, a11y-audit, ui-ux-pro-max, superpowers.
