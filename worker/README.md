# Бот + приём заявок (один Cloudflare Worker)

Один бесплатный serverless-воркер делает две вещи:

1. **`POST /tg`** — webhook Telegram. Бот отвечает на любое сообщение/`/start`
   приветствием с кнопкой «🚘 Открыть каталог» (мини-апп) и принимает заявки из
   мини-аппа (`web_app_data`).
2. **`POST /lead`** — заявки с сайта и из мини-аппа → сообщение менеджеру в Telegram.

**Токен бота хранится только в секретах воркера** и нигде не светится в коде сайта.

## 0. Автодеплой (воркер обновляется сам при пуше в git)
В репозитории есть `worker/wrangler.toml` — описывает воркер, переменные и
привязку KV. Подключив **Workers Builds**, Cloudflare сам пересобирает воркер при
каждом пуше (как Pages для сайта). Ручная вставка кода больше не нужна.

1. Заполните в `worker/wrangler.toml` два значения (это **не** секреты):
   - `ADMIN_IDS` — ваш Telegram id (узнать: @userinfobot);
   - `id` в `[[kv_namespaces]]` — id KV-namespace (Storage & Databases → KV →
     создать `diauto` → скопировать **Namespace ID**).
2. Воркер `diauto-bot` → **Settings → Build → Connect** → выберите репозиторий
   `dkaratsapov-web/avto_korea`, branch `claude/beautiful-goodall-irzq2f`,
   **Root directory = `worker`**. Build command пустой (деплой по `wrangler.toml`).
3. Один раз задайте секреты (они в git не хранятся и при деплоях не стираются):
   `diauto-bot → Settings → Variables and Secrets`:
   ```
   TELEGRAM_BOT_TOKEN = <токен>     (Secret)
   TELEGRAM_CHAT_ID   = <id чата>   (Secret)
   ```
Готово: дальше любой `git push` сам обновляет и сайт (Pages), и бота (Worker).
Разделы 2–4 ниже — ручной способ (если не подключать автодеплой).

## 1. Что нужно
- Аккаунт Cloudflare (бесплатный).
- **Новый** токен бота из @BotFather (старый, что светился, — отозвать `/revoke`).
- `chat_id` менеджера: напишите боту → узнайте id через **@userinfobot**
  (для группы — отрицательный id группы).
- Адрес мини-аппа: `https://автоимпорт-69.рф/tma`.

## 2. Деплой воркера
Дашборд Cloudflare → **Workers & Pages → Create → Worker**, вставьте код из
`lead-worker.js`, задеплойте. Затем **Settings → Variables and Secrets**:
```
TELEGRAM_BOT_TOKEN = <новый токен>          (Secret)
TELEGRAM_CHAT_ID   = <id чата менеджера>     (Secret/Variable)
MINI_APP_URL       = https://автоимпорт-69.рф/tma   (Variable)
```
Или через CLI:
```bash
npm i -g wrangler
wrangler deploy worker/lead-worker.js --name diauto-bot
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
# MINI_APP_URL можно как обычную переменную в дашборде
```
Получите URL вида `https://diauto-bot.<account>.workers.dev`.

## 3. Включить бота (setWebhook)
Один раз откройте в браузере (подставьте токен и адрес воркера):
```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://diauto-bot.<account>.workers.dev/tg
```
Ответ `{"ok":true,...}` → бот начнёт отвечать. Проверка статуса:
```
https://api.telegram.org/bot<TOKEN>/getWebhookInfo
```

(Опц.) постоянная кнопка-меню «Каталог» рядом с полем ввода:
```
https://api.telegram.org/bot<TOKEN>/setChatMenuButton?menu_button={"type":"web_app","text":"Каталог","web_app":{"url":"https://автоимпорт-69.рф/tma"}}
```

## 4. Админка в боте (общий каталог + роли)
Чтобы заработала админка внутри мини-аппа (общий каталог, тексты бота, заявки,
выдача прав), нужно добавить хранилище KV и указать владельцев.

**4.1. Создать KV namespace и привязать.** Cloudflare → Storage & Databases →
**KV → Create** (имя любое, напр. `diauto`). Затем воркер `diauto-bot` →
**Settings → Bindings → Add → KV Namespace**:
```
Variable name: STORE        ← важно именно так
KV namespace:  diauto
```

**4.2. Указать владельцев.** Узнайте свой Telegram ID через **@userinfobot**.
Воркер → **Settings → Variables and Secrets → Variable**:
```
ADMIN_IDS = 123456789           (несколько — через запятую: 111,222)
```
Владелец (owner) может всё + выдавать права. Остальных админов добавляете уже
из самой админки: **manager** (правит каталог и тексты бота) и **viewer**
(видит заявки) — по их Telegram ID.

**4.3. Вход.** В боте `/start` → «Открыть каталог» → в шапке мини-аппа у
владельцев появится значок «щит» — это вход в админку. Вход только по вашему
Telegram-аккаунту, пароль не нужен (воркер проверяет подпись Telegram).

> Без KV бот и заявки продолжают работать, но админка и общий каталог выключены.

## 5. Подключить заявки и общий каталог к сайту
Сайт хостится на **Cloudflare Pages** — в проекте Pages → **Settings →
Environment variables (Production)** должна быть:
```
VITE_LEAD_ENDPOINT = https://diauto-bot.<account>.workers.dev/lead
```
Этот же адрес фронтенд использует и для общего каталога (`/api/catalog`) и
админ-API (`/api/admin`) — отдельных переменных не нужно. После пересборки все
формы шлют заявки в воркер, а каталог берётся из KV (общий для всех). Без
переменной формы работают в демо-режиме, каталог — стандартный из сборки.

## Проверка
```bash
# заявка
curl -X POST https://diauto-bot.<account>.workers.dev/lead \
  -H 'Content-Type: application/json' \
  -d '{"name":"Тест","phone":"+79990001122","car":"Kia K3","source":"test"}'
# → {"ok":true}  и сообщение в Telegram

# бот: напишите ему /start в Telegram → должно прийти приветствие с кнопкой
```
