/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_URL?: string;
  /** Эндпоинт приёма заявок (бэкенд/serverless/Telegram-прокси). Не задан — демо-режим. */
  readonly VITE_LEAD_ENDPOINT?: string;
  /** База API воркера (каталог, отзывы, новости). */
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
