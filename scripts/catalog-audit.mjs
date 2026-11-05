#!/usr/bin/env node
/**
 * Аудит каталога: собрать обложки всех авто в контактные листы для просмотра
 * глазами — и убрать из каталога отбракованные по id.
 *
 * Зачем. Фото в каталог прилетают из постов канала как есть, иногда с чужими
 * водяными знаками (ТИНТИН, 懂车帝, Encar…). Отличать их кодом ненадёжно, а из
 * среды разработчика живые фото недоступны — домены закрыты. Зато у GitHub
 * Actions интернет открыт: там качаем обложки, клеим в листы, а дальше человек
 * (или я) смотрит и присылает id на удаление.
 *
 * Два режима:
 *   node catalog-audit.mjs                   — собрать листы в audit/ + index.json
 *   REMOVE='id1,id2' node catalog-audit.mjs  — убрать эти авто из KV "catalog"
 *
 * Удаление идёт прямо в KV через открытый API Cloudflare (как в review-add).
 */

import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);

const WORKER = "https://diauto-bot.d-karatsapov.workers.dev";
const KEY = "catalog";
const OUT_DIR = "audit";
const PER_SHEET = 24; // 4×6 — лист читается без сильного уменьшения
const COLS = 4;
const THUMB = "440x274"; // крупнее — чтобы плашку на номере было видно

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
  if (!r.ok) throw new Error(`Cloudflare ${r.status}: ${text.slice(0, 300)}`);
  return text;
}

/** Убрать из каталога авто по id. Чистая функция — на неё есть тест. */
export function removeFromCatalog(list, ids) {
  const drop = new Set(ids.map((s) => String(s).trim()).filter(Boolean));
  return (Array.isArray(list) ? list : []).filter((c) => !drop.has(String(c?.id)));
}

/** Абсолютный адрес картинки (воркер отдаёт то относительные, то полные). */
function absImg(u) {
  if (!u || typeof u !== "string") return "";
  if (/^https?:\/\//i.test(u)) return u;
  return WORKER + (u.startsWith("/") ? u : "/" + u);
}

/** Подпись плитки: позиция (по ней ищем id в index.json), модель, цена. */
function tileLabel(pos, car) {
  const price = car.priceMoscowRub || car.priceRub || 0;
  const p = price ? `${Math.round(price / 1000)}k` : "—";
  const model = String(car.model || "?").replace(/\s+/g, " ").slice(0, 22);
  return `${pos}  ${model}  ${p}`;
}

async function buildSheets(cars) {
  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const index = cars.map((car, pos) => ({
    pos,
    id: car.id,
    model: car.model,
    price: car.priceMoscowRub || car.priceRub || 0,
    country: car.country,
  }));

  // Качаем обложки параллельно пачками: 270 штук по одной — это минуты.
  const CHUNK = 12;
  const got = new Array(cars.length).fill(false);
  for (let i = 0; i < cars.length; i += CHUNK) {
    await Promise.all(
      cars.slice(i, i + CHUNK).map(async (car, j) => {
        const pos = i + j;
        try {
          const src = absImg((car.images || [])[0]);
          if (!src) return;
          const r = await fetch(src);
          if (!r.ok) return;
          await writeFile(`${OUT_DIR}/.img-${pos}.bin`, Buffer.from(await r.arrayBuffer()));
          got[pos] = true;
        } catch {
          /* падение одной картинки не должно валить весь лист */
        }
      }),
    );
  }

  // Плитки строго по порядку; для несскачанных — заглушка, чтобы номера не съехали.
  const tiles = [];
  for (let pos = 0; pos < cars.length; pos++) {
    const label = tileLabel(pos, cars[pos]);
    if (got[pos]) {
      tiles.push({ file: `${OUT_DIR}/.img-${pos}.bin`, label });
    } else {
      const ph = `${OUT_DIR}/.ph-${pos}.png`;
      await run("convert", ["-size", THUMB, "xc:#330000", ph]);
      tiles.push({ file: ph, label: label + " (нет фото)" });
    }
  }

  const sheets = [];
  for (let i = 0; i < tiles.length; i += PER_SHEET) {
    const part = tiles.slice(i, i + PER_SHEET);
    const n = sheets.length + 1;
    const out = `${OUT_DIR}/sheet-${String(n).padStart(2, "0")}.png`;
    // montage: перед каждой картинкой свой -label, подпись рисуется под плиткой
    const args = [];
    for (const t of part) {
      args.push("-label", t.label, t.file);
    }
    args.push(
      "-tile", `${COLS}x`,
      "-geometry", `${THUMB}+6+6`,
      "-background", "#222",
      "-fill", "#fff",
      "-pointsize", "16",
      out,
    );
    await run("montage", args);
    sheets.push(out);
  }

  await writeFile(`${OUT_DIR}/index.json`, JSON.stringify(index, null, 1));
  await run("bash", ["-lc", `rm -f ${OUT_DIR}/.img-* ${OUT_DIR}/.ph-*`]).catch(() => {});
  return { cars: cars.length, sheets: sheets.length };
}

async function removeCars(ids) {
  const cur = JSON.parse((await cf(`/values/${KEY}`).catch(() => "[]")) || "[]");
  const before = Array.isArray(cur) ? cur.length : 0;
  const next = removeFromCatalog(cur, ids);
  const gone = before - next.length;
  if (!gone) throw new Error(`Ни одного id из списка не нашлось: ${ids.join(", ")}`);
  const form = new FormData();
  form.append("value", new Blob([JSON.stringify(next)], { type: "application/json" }));
  form.append("metadata", "{}");
  await cf(`/values/${KEY}`, { method: "PUT", body: form });
  console.log(`Удалено ${gone}: было ${before}, стало ${next.length}`);
}

async function main() {
  const removeIds = (process.env.REMOVE || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (removeIds.length) {
    await removeCars(removeIds);
    return;
  }
  const r = await fetch(`${WORKER}/api/catalog`);
  if (!r.ok) throw new Error(`Каталог не получен: HTTP ${r.status}`);
  const data = await r.json();
  const cars = Array.isArray(data.catalog) ? data.catalog : [];
  if (!cars.length) throw new Error("Каталог пуст или не получен");
  const res = await buildSheets(cars);
  console.log(`Собрано: ${res.cars} авто, ${res.sheets} листов в ${OUT_DIR}/`);
}

const calledDirectly = process.argv[1] && process.argv[1].endsWith("catalog-audit.mjs");
if (calledDirectly) {
  main().catch((e) => {
    console.error("Не удалось:", e.message || e);
    process.exit(1);
  });
}
