# ДКП-бот — оформление договора купли-продажи ТС

Отдельный Telegram-бот с мини-приложением: пользователь загружает фото
паспорта и СТС, проверяет распознанные данные и получает готовый договор
(**DOCX + PDF**) прямо в чат.

```
dkp-bot/
├── worker.js          # Cloudflare Worker: вебхук бота + API (распознавание, отправка)
├── wrangler.toml      # конфиг воркера (Root directory = dkp-bot в Workers Builds)
├── web/               # мини-апп (статическая страница для Cloudflare Pages)
│   ├── index.html
│   └── dkp-template.docx
└── template/          # исходник шаблона + пример + генератор
```

Файлы DOCX/PDF формируются **в браузере** (docxtemplater + pdfmake), поэтому
воркеру не нужна сборка/зависимости. Воркер только: отвечает на `/start`,
распознаёт фото через Claude Vision и пересылает готовые файлы в чат.

## Развёртывание

### 1. Мини-апп (Cloudflare Pages)
- Создайте Pages-проект, **Build output / root = `dkp-bot/web`** (без сборки, статика).
- Получите адрес, напр. `https://dkp-mini.pages.dev`.

### 2. Воркер (Cloudflare Workers)
- Workers Builds → новый воркер из этого репозитория, **Root directory = `dkp-bot`**.
- В `wrangler.toml` пропишите `MINI_APP_URL` = адрес мини-аппа из шага 1.
- Секреты (Worker → Variables and Secrets → **Secret**):
  - `TELEGRAM_BOT_TOKEN` — токен бота (@BotFather)
  - `ANTHROPIC_API_KEY` — ключ Claude Vision (для авто-распознавания; без него
    мини-апп работает в режиме ручного ввода)
- Получите адрес воркера, напр. `https://dkp-bot.<субдомен>.workers.dev`.

### 3. Связать мини-апп с воркером
- В `web/index.html` укажите `const WORKER = "https://dkp-bot.<субдомен>.workers.dev";`
  и передеплойте Pages.

### 4. Подключить вебхук Telegram
```
curl "https://api.telegram.org/bot<ТОКЕН>/setWebhook?url=https://dkp-bot.<субдомен>.workers.dev/webhook"
```

### 5. (Опционально) кнопка-меню в боте
В @BotFather → `/setmenubutton` → URL мини-аппа — чтобы открывать прямо из меню чата.

## Проверка
1. В боте `/start` → кнопка «Оформить ДКП».
2. Загрузите фото паспорта/СТС (или заполните вручную), проверьте поля.
3. Город + цена → «Сформировать договор» → DOCX и PDF придут в чат.

## Поля шаблона
См. `template/README.md`. Шаблон поддерживает обе стороны как физлицо,
так и юрлицо/ИП (условные блоки docxtemplater).
