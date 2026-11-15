#!/usr/bin/env node
/**
 * Браузер для живого сайта: открывает страницы, снимает скриншоты (компьютер
 * и телефон) и пишет отчёт — что загрузилось, какие ошибки в консоли, какие
 * запросы упали, что с HTTPS.
 *
 * Работает где угодно, где есть Playwright с Chromium:
 *   - на серверах GitHub — workflow «Site shots», результат кладётся в ветку
 *     site-shots (её видно на GitHub и можно забрать git fetch);
 *   - локально или против локальной сборки:
 *       node scripts/site-shot.mjs --base http://localhost:4173 --pages /,/catalog
 *
 * Параметры:
 *   --base   адрес сайта (по умолчанию боевой https://автоимпорт-69.рф)
 *   --pages  страницы через запятую (по умолчанию — основные)
 *   --out    папка результата (по умолчанию site-shots)
 *   --wait   сколько мс ждать после загрузки (по умолчанию 2500)
 *   --click  CSS-селектор: кликнуть перед снимком (для проверки сценария)
 */
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

// require, а не import: так находится и Playwright, установленный глобально
// (NODE_PATH), — ESM-импорт ищет пакет только в node_modules проекта.
const { chromium, devices } = createRequire(import.meta.url)("playwright");

const arg = (name, def) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const BASE = arg("base", "https://xn---69-5cdk0b2aocjmsg.xn--p1ai").replace(/\/$/, "");
const PAGES = arg("pages", "/,/catalog,/reviews,/about,/contacts,/articles,/quiz,/go,/crm/login")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const OUT = arg("out", "site-shots");
const WAIT = Number(arg("wait", "2500"));
const CLICK = arg("click", "");

const slug = (p) => (p === "/" ? "home" : p.replace(/^\//, "").replace(/[^a-z0-9а-я_-]+/gi, "_")) || "page";

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

// HTTPS проверяем отдельно: со строгой проверкой сертификата — так, как
// откроет сайт обычный браузер. Скриншоты снимаем в любом случае.
let tls = "ок";
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/", { timeout: 30000 });
  } catch (e) {
    tls = String(e.message || e).split("\n")[0];
  }
  await ctx.close();
}

const profiles = [
  ["desktop", { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }],
  ["mobile", { ...devices["iPhone 13"] }],
];
const rows = [];
for (const [kind, opts] of profiles) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, locale: "ru-RU" });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    const failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("requestfailed", (r) => failed.push(`${r.failure()?.errorText || "fail"} ${r.url()}`));
    page.on("response", (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
    const started = Date.now();
    let status = "";
    try {
      const res = await page.goto(BASE + p, { waitUntil: "domcontentloaded", timeout: 45000 });
      status = String(res?.status() ?? "");
      await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(WAIT);
      if (CLICK) await page.click(CLICK, { timeout: 5000 }).catch((e) => errors.push(`click: ${e.message.split("\n")[0]}`));
    } catch (e) {
      status = `ошибка: ${String(e.message || e).split("\n")[0]}`;
    }
    const ms = Date.now() - started;
    const file = `${kind}-${slug(p)}.png`;
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: kind === "desktop" }).catch(() => {});
    const title = await page.title().catch(() => "");
    const overflow = await page
      .evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      .catch(() => 0);
    rows.push({ kind, p, status, ms, title, file, errors, failed, overflow });
    await page.close();
  }
  await ctx.close();
}
await browser.close();

const when = new Date().toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
const md = [
  `# Снимки сайта — ${when} (МСК)`,
  "",
  `Адрес: ${BASE}`,
  `HTTPS (как в обычном браузере): **${tls}**`,
  "",
  "| Вид | Страница | Ответ | Время | Ошибки | Сбойные запросы | Сдвиг вбок | Снимок |",
  "|---|---|---|---|---|---|---|---|",
  ...rows.map(
    (r) =>
      `| ${r.kind} | ${r.p} | ${r.status} | ${(r.ms / 1000).toFixed(1)} с | ${r.errors.length} | ${r.failed.length} | ${r.overflow > 0 ? `${r.overflow}px` : "—"} | [${r.file}](${r.file}) |`,
  ),
  "",
  ...rows
    .filter((r) => r.errors.length || r.failed.length)
    .flatMap((r) => [
      `## ${r.kind} ${r.p}`,
      ...r.errors.slice(0, 10).map((e) => `- ошибка: ${e.slice(0, 300)}`),
      ...[...new Set(r.failed)].slice(0, 15).map((f) => `- запрос: ${f.slice(0, 300)}`),
      "",
    ]),
].join("\n");
await writeFile(`${OUT}/README.md`, md);
console.log(md);
