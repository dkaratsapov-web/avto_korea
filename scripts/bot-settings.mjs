#!/usr/bin/env node
/**
 * Поправить живые настройки бота, не заходя в админку.
 *
 * Настройки бота лежат в KV воркера под ключом "settings". Обычно их меняют
 * в мини-аппе (/tma → Настройки), но из среды разработчика ни админка, ни
 * воркер, ни телеграм не доступны. Зато у GitHub Actions открыт интернет и
 * лежит ключ Cloudflare — тот же, которым публикуется воркер. Поэтому правка
 * идёт прямо в KV через открытый API Cloudflare.
 *
 * Патч точечный: читаем ВЕСЬ объект настроек, меняем только переданные поля,
 * пишем обратно. Остальное не трогаем — объект настроек один на весь бот, и
 * перезаписать его целиком вслепую значит снести конфигурацию.
 *
 * Запуск (обычно из .github/workflows/bot-settings.yml):
 *   CF_API_TOKEN=… CF_ACCOUNT_ID=… SETTINGS_PATCH='{"gateInviteUrl":"…"}' \
 *     node scripts/bot-settings.mjs
 *
 * Без SETTINGS_PATCH просто печатает текущие настройки — чтобы посмотреть,
 * что там сейчас, перед правкой.
 */

import { readFile } from "node:fs/promises";

const KEY = "settings";

/** Что вообще разрешено трогать этим путём — тот же список, что у settings.save в воркере. */
const ALLOWED = new Set([
  "welcomeText", "catalogButtonText", "calcButtonText", "quizButtonText",
  "managerButtonText", "managerUrl", "mapButtonText", "mapUrl",
  "map2gisButtonText", "map2gisUrl", "miniAppUrl",
  "gateEnabled", "gateChannelId", "gateInviteUrl", "gateText",
  "gateSubscribeButton", "gateCheckButton",
  "catalogChatId", "reviewsChatId", "newsChatId", "leadChatId",
  "maxChannelId", "autoPublish",
]);

/** Id пространства KV — из конфига воркера, чтобы не дублировать номер. */
async function namespaceId() {
  const toml = await readFile(new URL("../worker/wrangler.toml", import.meta.url), "utf8");
  const m = toml.match(/binding\s*=\s*"STORE"[\s\S]*?id\s*=\s*"([0-9a-f]+)"/);
  if (!m) throw new Error("В worker/wrangler.toml не нашёлся id хранилища STORE");
  return m[1];
}

async function cf(path, init = {}) {
  const token = process.env.CF_API_TOKEN;
  const account = process.env.CF_ACCOUNT_ID;
  if (!token || !account) throw new Error("Нет CF_API_TOKEN или CF_ACCOUNT_ID");
  const ns = await namespaceId();
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${ns}${path}`;
  const r = await fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(`Cloudflare ${r.status}: ${text.slice(0, 400)}`);
  return text;
}

/** Применить патч к настройкам: только разрешённые ключи, с проверкой типа. */
export function applyPatch(current, patch) {
  const next = { ...(current && typeof current === "object" ? current : {}) };
  const changed = [];
  for (const [k, v] of Object.entries(patch || {})) {
    if (!ALLOWED.has(k)) {
      changed.push({ key: k, skipped: "не в списке разрешённых" });
      continue;
    }
    const okType = k === "gateEnabled" || k === "autoPublish" ? typeof v === "boolean" : typeof v === "string";
    if (!okType) {
      changed.push({ key: k, skipped: "неверный тип значения" });
      continue;
    }
    changed.push({ key: k, from: next[k], to: v });
    next[k] = v;
  }
  return { next, changed };
}

async function main() {
  const current = JSON.parse((await cf(`/values/${KEY}`).catch(() => "{}")) || "{}");

  const raw = process.env.SETTINGS_PATCH;
  if (!raw) {
    console.log("Текущие настройки бота:");
    console.log(JSON.stringify(current, null, 1));
    return;
  }

  const { next, changed } = applyPatch(current, JSON.parse(raw));
  const real = changed.filter((c) => !c.skipped);
  if (!real.length) {
    console.log("Нечего менять:", JSON.stringify(changed));
    return;
  }

  // Кладём файлом: у значения KV есть предел на размер обычного запроса.
  const form = new FormData();
  form.append("value", new Blob([JSON.stringify(next)], { type: "application/json" }));
  form.append("metadata", "{}");
  await cf(`/values/${KEY}`, { method: "PUT", body: form });

  for (const c of changed) {
    if (c.skipped) console.log(`  ✖ ${c.key}: пропущено (${c.skipped})`);
    else console.log(`  ✔ ${c.key}: ${JSON.stringify(c.from)} → ${JSON.stringify(c.to)}`);
  }
}

// Запускаемся только при прямом вызове — не при импорте из теста.
if (process.argv[1] && process.argv[1].endsWith("bot-settings.mjs")) {
  main().catch((e) => {
    console.error("Не удалось:", e.message || e);
    process.exit(1);
  });
}
