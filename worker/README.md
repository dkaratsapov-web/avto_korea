# Приём заявок в Telegram (Cloudflare Worker)

Бесплатный серверless-прокси: сайт и мини-апп шлют заявку сюда, воркер
пересылает её менеджеру в Telegram. **Токен бота хранится только в секретах
воркера** и нигде не светится в коде сайта.

## 1. Что нужно
- Аккаунт Cloudflare (бесплатный).
- **Новый** токен бота из @BotFather (старый, что светился в чате, — отозвать
  через `/revoke`).
- `chat_id` менеджера/чата: напишите боту, затем узнайте id через **@userinfobot**
  (или из `getUpdates`). Для группы — id группы (отрицательный).

## 2. Деплой воркера
Через дашборд Cloudflare → **Workers & Pages → Create → Worker**, вставьте код
из `lead-worker.js`, задеплойте. Затем в **Settings → Variables → Secrets**
добавьте:
```
TELEGRAM_BOT_TOKEN = <новый токен>
TELEGRAM_CHAT_ID   = <id чата>
```
Или через CLI:
```bash
npm i -g wrangler
wrangler deploy worker/lead-worker.js --name diauto-lead
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put TELEGRAM_CHAT_ID
```
Получите URL вида `https://diauto-lead.<account>.workers.dev`.

## 3. Подключить к сайту
В workflow сборки (`.github/workflows/deploy-pages.yml`, шаг *Build*) добавьте
переменную окружения:
```yaml
VITE_LEAD_ENDPOINT: https://diauto-lead.<account>.workers.dev
```
После пересборки **все формы сайта и форма мини-аппа** будут отправлять заявки
в этот воркер → вам в Telegram. Без неё формы работают в демо-режиме.

## Проверка
```bash
curl -X POST https://diauto-lead.<account>.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"name":"Тест","phone":"+79990001122","car":"Kia K3","source":"test"}'
# → {"ok":true}  и сообщение в Telegram
```
