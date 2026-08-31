/*
 * Мини-апп в плохих условиях.
 *
 * Замер «всё отвечает мгновенно» ничего не говорит: у людей телефон, мобильный
 * интернет, телеграм внутри приложения и провайдер, который душит зарубежные
 * домены. Здесь по очереди воспроизводятся именно такие случаи, и для каждого
 * записывается, ЧТО ЧЕЛОВЕК ВИДИТ на первой, третьей и восьмой секунде.
 *
 * Пустой экран считается провалом независимо от того, что там в консоли.
 */
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const DIST = "/home/user/avto_korea/dist";

const CARS = Array.from({ length: 18 }, (_, i) => ({
  id: `tg-${1000 + i}`,
  model: ["Kia K5", "Hyundai Palisade", "BMW X5", "Zeekr 001"][i % 4],
  year: 2023,
  country: "kr",
  engine: "2.0 л · 156 л.с.",
  trim: "Comfort",
  mileage: "23 000 км",
  mileageKm: 23000,
  gearbox: "АКПП",
  drive: "Полный",
  bodyType: "Кроссовер",
  fuelType: "Бензин",
  engineCc: 1998,
  powerHp: 156,
  color: "Белый",
  priceRub: 3790000 + i * 10000,
  priceTverRub: 3790000 + i * 10000,
  priceMoscowRub: 3780000,
  status: "in_stock",
  isNew: false,
  images: [`/api/tgphoto?r=2&id=PHOTO${i}AAAAAAAAAA`],
  highlights: [],
  description: "Описание автомобиля.",
  addedAt: Date.now() - i * 3600000,
}));

const PIXEL = Buffer.from(
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  "base64",
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Сценарий задаёт, как ведёт себя сервер данных. */
let mode = "ok";

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  if (p === "/api/catalog") {
    if (mode === "slow") await sleep(8000); // потолок ожидания воркера в proxy.php
    if (mode === "dead") {
      await sleep(300);
      res.writeHead(502, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ ok: false, error: "upstream unavailable" }));
    }
    if (mode === "hang") return; // соединение не закрывается вовсе
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, catalog: CARS }));
  }
  if (p.startsWith("/api/tgphoto") || p.startsWith("/media-cache/")) {
    await sleep(mode === "slow" ? 3000 : 60);
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    return res.end(PIXEL);
  }
  if (p.startsWith("/api/")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, reviews: [], news: [], faq: [], rates: {} }));
  }

  const file = path.join(DIST, p === "/" ? "index.html" : p);
  if (fs.existsSync(file) && fs.statSync(file).isFile()) {
    const ext = path.extname(file);
    const type =
      { ".js": "text/javascript", ".css": "text/css", ".html": "text/html", ".svg": "image/svg+xml" }[
        ext
      ] || "application/octet-stream";
    let body = fs.readFileSync(file);
    const head = { "Content-Type": type };
    // Как на боевом сервере после включения mod_deflate: текст жмётся.
    if ([".js", ".css", ".html", ".svg"].includes(ext) && /gzip/.test(req.headers["accept-encoding"] || "")) {
      body = zlib.gzipSync(body, { level: 6 });
      head["Content-Encoding"] = "gzip";
    }
    res.writeHead(200, head);
    return res.end(body);
  }
  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(fs.readFileSync(path.join(DIST, "index.html")));
});

await new Promise((r) => server.listen(8124, r));

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"],
});

/** Что видно на экране: сколько текста и есть ли карточки. */
async function snapshot(page) {
  return page.evaluate(() => {
    const root = document.getElementById("root") || document.body;
    const text = (root.innerText || "").replace(/\s+/g, " ").trim();
    return {
      chars: text.length,
      head: text.slice(0, 70),
      cards: document.querySelectorAll("article").length,
    };
  });
}

async function scenario(name, opts) {
  mode = opts.api ?? "ok";
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  // Внешние домены: в песочнице они всё равно недоступны, а нам нужно
  // отличать «заблокирован» (обрыв) от «душат» (долгий ответ).
  const blockTg = opts.telegramBlocked !== false;
  await ctx.route("**://*.googleapis.com/**", (r) => r.abort());
  await ctx.route("**://*.gstatic.com/**", (r) => r.abort());
  await ctx.route("**://mc.yandex.ru/**", (r) => r.abort());
  await ctx.route("**://telegram.org/**", (r) =>
    blockTg ? r.abort() : setTimeout(() => r.abort(), 20000),
  );

  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 90)));

  if (opts.throttleKbps) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: opts.latencyMs ?? 150,
      downloadThroughput: (opts.throttleKbps * 1024) / 8,
      uploadThroughput: (opts.throttleKbps * 1024) / 8,
    });
  }

  const t0 = Date.now();
  page.goto("http://127.0.0.1:8124/tma?screen=catalog").catch(() => {});

  const marks = [];
  for (const at of [1000, 3000, 8000]) {
    await sleep(Math.max(0, at - (Date.now() - t0)));
    marks.push({ at, ...(await snapshot(page).catch(() => ({ chars: -1, head: "—", cards: 0 }))) });
  }

  console.log(`\n■ ${name}`);
  for (const m of marks) {
    const verdict = m.chars <= 0 ? "ПУСТО" : m.cards > 0 ? "каталог" : "что-то есть";
    console.log(
      `   ${String(m.at / 1000).padStart(2)} c  ${verdict.padEnd(12)} символов ${String(m.chars).padStart(5)}  карточек ${String(m.cards).padStart(2)}  «${m.head}»`,
    );
  }
  if (errors.length) console.log(`   ошибки JS: ${[...new Set(errors)].join(" | ")}`);

  await ctx.close();
}

await scenario("Обычные условия", {});
await scenario("Данные отвечают 8 секунд (воркер тупит)", { api: "slow" });
await scenario("Данные не отвечают вовсе (соединение висит)", { api: "hang" });
await scenario("Данные отдают 502", { api: "dead" });
await scenario("telegram.org душат: ответ не приходит 20 секунд", { telegramBlocked: false });
await scenario("Медленный мобильный интернет (400 кбит/с)", { throttleKbps: 400, latencyMs: 400 });
await scenario("Всё сразу: медленно + данные висят + телеграм душат", {
  api: "hang",
  throttleKbps: 400,
  latencyMs: 400,
  telegramBlocked: false,
});

await browser.close();
server.close();
