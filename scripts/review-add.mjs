#!/usr/bin/env node
/**
 * Добавить отзыв на сайт, не заходя ни в бота, ни в CRM.
 *
 * Обычный путь у отзыва один: владелец публикует пост в канале отзывов, бот
 * разбирает его и кладёт карточку в KV. Этого достаточно всегда — кроме
 * случая, когда карточку собирает разработчик: из его среды закрыты и домен
 * сайта, и домен воркера, и телеграм. А у Actions интернет открыт, и ключ от
 * Cloudflare там уже лежит — тем же, которым публикуется воркер.
 *
 * Поэтому запись кладётся прямо в KV, через открытый API Cloudflare.
 * Фотографии при этом берутся не из телеграма, а из папки сайта: они уезжают
 * на хостинг обычной выкладкой и живут по своим адресам.
 *
 * Запуск (обычно из .github/workflows/review-add.yml):
 *   CF_API_TOKEN=… CF_ACCOUNT_ID=… REVIEW_JSON='{"id":…}' node scripts/review-add.mjs
 *
 * Ничего не перезаписывает вслепую: если отзыв с таким id уже есть, запись
 * обновляется, а не задваивается, — ровно как это делает бот.
 */

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const KEY = "reviews";

/** Сколько отзывов держим — столько же, сколько бот. */
const LIMIT = 100;

/**
 * Идентификатор пространства KV берём из конфига воркера, а не из переменной.
 *
 * Иначе появляется второе место, где записан один и тот же номер, и при
 * переезде хранилища выгрузка молча продолжит писать в старое.
 */
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
  const r = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Cloudflare ${r.status}: ${text.slice(0, 400)}`);
  return text;
}

/**
 * Куда встанет новый отзыв.
 *
 * В начало списка — так же, как это делает бот: лента на витрине собирается
 * из этого порядка и метки времени. Повторная публикация того же отзыва
 * обновляет запись на месте: задвоенная карточка выглядит как ошибка сайта,
 * а удалять её придётся руками.
 */
export function mergeReview(list, review) {
  const out = Array.isArray(list) ? [...list] : [];
  const at = out.findIndex((r) => r && r.id === review.id);
  if (at >= 0) {
    out[at] = { ...out[at], ...review };
    return out.slice(0, LIMIT);
  }
  out.unshift(review);
  return out.slice(0, LIMIT);
}

/** Отзыв в том же виде, в каком его кладёт бот: те же поля и их порядок. */
export function buildReview(input) {
  const images = (input.images || []).filter(Boolean);
  if (!input.id) throw new Error("У отзыва нет id");
  if (!images.length && !input.text) throw new Error("Отзыв без текста и без фотографий");

  return {
    id: String(input.id),
    name: input.name || "Клиент ДиАвто69",
    text: input.text || "",
    rating: Number(input.rating) || 5,
    // media и video — первые из списков: поля остались ради старых карточек,
    // которые их читают напрямую.
    media: images[0] || "",
    video: (input.videos || [])[0] || "",
    poster: input.poster || "",
    images,
    videos: input.videos || [],
    chatId: "",
    ts: Number(input.ts) || Date.now(),
  };
}

async function main() {
  const raw = process.env.REVIEW_JSON;
  if (!raw) throw new Error("Не задан REVIEW_JSON");
  const review = buildReview(JSON.parse(raw));

  const current = JSON.parse((await cf(`/values/${KEY}`).catch(() => "[]")) || "[]");
  const before = Array.isArray(current) ? current.length : 0;
  const next = mergeReview(current, review);

  /*
   * Кладём файлом, а не строкой в теле: у значения KV есть предел на размер
   * обычного запроса, а список отзывов растёт и однажды его перешагнёт.
   */
  const form = new FormData();
  form.append("value", new Blob([JSON.stringify(next)], { type: "application/json" }));
  form.append("metadata", "{}");
  await cf(`/values/${KEY}`, { method: "PUT", body: form });

  console.log(`Отзыв ${review.id}: было ${before}, стало ${next.length}`);
  console.log(`Сверху: ${next[0].name} — ${(next[0].text || "").split("\n")[0]}`);
  console.log(`Фотографий: ${review.images.length}`);
}

// Запускаемся только когда файл вызвали напрямую: при импорте из теста
// ходить в Cloudflare не нужно и нечем.
const calledDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (calledDirectly) {
  main().catch((e) => {
    console.error("Не удалось:", e.message || e);
    process.exit(1);
  });
}
