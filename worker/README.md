# Бот + приём заявок (один Cloudflare Worker)

Один бесплатный serverless-воркер делает две вещи:

1. **`POST /tg`** — webhook Telegram. Бот отвечает на любое сообщение/`/start`
   приветствием с кнопкой «🚘 Открыть каталог» (мини-апп) и принимает заявки из
   мини-аппа (`web_app_data`).
2. **`POST /lead`** — заявки с сайта и из мини-аппа → сообщение менеджеру в Telegram.

**Токен бота хранится только в секретах воркера** и нигде не светится в коде сайта.

## 1. Что нужно
- Аккаунт Cloudflare (бесплатный).
- **Новый** токен бота из @BotFather (старый, что светился, — отозвать `/revoke`).
- `chat_id` менеджера: напишите боту → узнайте id через **@userinfobot**
  (для группы — отрицательный id группы).
- Адрес мини-аппа: `https://авто-из-кореи-под-ключ.рф/tma`.

## 2. Деплой воркера
Дашборд Cloudflare → **Workers & Pages → Create → Worker**, вставьте код из
`lead-worker.js`, задеплойте. Затем **Settings → Variables and Secrets**:
```
TELEGRAM_BOT_TOKEN = <новый токен>          (Secret)
TELEGRAM_CHAT_ID   = <id чата менеджера>     (Secret/Variable)
MINI_APP_URL       = https://авто-из-кореи-под-ключ.рф/tma   (Variable)
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
https://api.telegram.org/bot<TOKEN>/setChatMenuButton?menu_button={"type":"web_app","text":"Каталог","web_app":{"url":"https://авто-из-кореи-под-ключ.рф/tma"}}
```

## 4. Подключить заявки к сайту
В workflow сборки (`.github/workflows/deploy-pages.yml`, шаг *Build*) добавьте
переменную окружения:
```yaml
VITE_LEAD_ENDPOINT: https://diauto-bot.<account>.workers.dev/lead
```
После пересборки все формы сайта и мини-аппа будут слать заявки в воркер → вам
в Telegram. Без неё формы работают в демо-режиме.

## Проверка
```bash
# заявка
curl -X POST https://diauto-bot.<account>.workers.dev/lead \
  -H 'Content-Type: application/json' \
  -d '{"name":"Тест","phone":"+79990001122","car":"Kia K3","source":"test"}'
# → {"ok":true}  и сообщение в Telegram

# бот: напишите ему /start в Telegram → должно прийти приветствие с кнопкой
```
