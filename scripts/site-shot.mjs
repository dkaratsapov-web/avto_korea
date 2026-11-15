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
// Первый полный адрес к каждому чужому домену и начало кода чужих скриптов —
// чтобы по отчёту было видно не только «кто», но и «что именно» грузится.
const samples = new Map();
const scriptHeads = new Map();
const KNOWN = /(^|\.)(yandex\.(ru|com|net)|yastatic\.net|googleapis\.com|gstatic\.com|tgtrack\.ru|telegram\.org|workers\.dev)$/;
for (const [kind, opts] of profiles) {
  const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: true, locale: "ru-RU" });
  for (const p of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    const failed = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("requestfailed", (r) => failed.push(`${r.failure()?.errorText || "fail"} ${r.url()}`));
    page.on("response", (r) => {
      if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
      try {
        const h = new URL(r.url()).host;
        if (r.request().resourceType() === "script" && !KNOWN.test(h) && h !== new URL(BASE).host && !scriptHeads.has(h)) {
          scriptHeads.set(h, "…");
          r.text()
            .then((t) => scriptHeads.set(h, `${r.url()}\n${t.slice(0, 400)}`))
            .catch(() => {});
        }
      } catch {
        /* пропускаем */
      }
    });
    // Внешние запросы и кто их сделал: адрес скрипта-инициатора из DevTools.
    // Так видно, откуда на сайте берутся чужие пиксели и счётчики.
    const external = new Map();
    const ownHost = new URL(BASE).host;
    try {
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Network.enable");
      cdp.on("Network.requestWillBeSent", (e) => {
        let host = "";
        try {
          host = new URL(e.request.url).host;
        } catch {
          return;
        }
        if (!host || host === ownHost || e.request.url.startsWith("data:")) return;
        const ini = e.initiator || {};
        const frame = ini.stack?.callFrames?.find((f) => f.url) || ini.stack?.parent?.callFrames?.find((f) => f.url);
        const by = frame?.url || ini.url || ini.type || "?";
        const key = `${host} ← ${by.split("?")[0]}`;
        external.set(key, (external.get(key) || 0) + 1);
        if (!samples.has(host)) samples.set(host, { url: e.request.url, by, type: e.type || "" });
      });
    } catch {
      /* не Chromium — без инициаторов */
    }
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
    rows.push({ kind, p, status, ms, title, file, errors, failed, overflow, external });
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
  "## Чужие скрипты (не Яндекс, не Google, не наши)",
  "",
  ...(scriptHeads.size ? [...scriptHeads.values()].map((t) => "```\n" + t + "\n```") : ["нет"]),
  "",
  "## Примеры адресов по доменам",
  "",
  ...[...samples.entries()]
    .filter(([h]) => !KNOWN.test(h))
    .map(([h, v]) => `- ${h}: ${v.type} ${v.url.slice(0, 250)} ← ${v.by.slice(0, 200)}`),
  "",
  "## Внешние запросы: домен ← кто его вызвал",
  "",
  ...(() => {
    const all = new Map();
    for (const r of rows) for (const [k, n] of r.external) all.set(k, (all.get(k) || 0) + n);
    return [...all.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `- ${k} (${n})`);
  })(),
].join("\n");
await writeFile(`${OUT}/README.md`, md);
console.log(md);
