#!/usr/bin/env node
/**
 * Статистика публичных Telegram-каналов — для подбора площадок под Telegram Ads.
 *
 * Берём прямо у Telegram: публичное превью канала t.me/s/<имя> показывает число
 * подписчиков и просмотры каждого поста. Каталоги (TGStat, Telemetr) и сам t.me
 * из среды разработчика закрыты, поэтому запускается из GitHub Actions.
 *
 * Что считаем по каждому каналу:
 *   — подписчики;
 *   — медиана просмотров последних постов (реальный охват, а не «мёртвые души»);
 *   — постов в день за последние 30 дней и дата последнего поста (жив ли канал);
 *   — признак «не канал»: у чатов и закрытых каналов превью ленты нет, а реклама
 *     Telegram Ads в них не показывается.
 *
 * Запуск: CHANNELS='a,b,c' node scripts/tg-channel-stats.mjs
 */

const UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

/** «1.2K» / «12,5K» / «3M» / «842» → число. */
export function parseCount(s) {
  const m = String(s || "").trim().replace(/\s/g, "").replace(",", ".").match(/^([\d.]+)([KM]?)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mul = m[2].toUpperCase() === "K" ? 1e3 : m[2].toUpperCase() === "M" ? 1e6 : 1;
  return Math.round(n * mul);
}

export function median(xs) {
  const a = xs.filter((x) => Number.isFinite(x)).sort((p, q) => p - q);
  if (!a.length) return null;
  const mid = Math.floor(a.length / 2);
  return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
}

/** Разобрать HTML превью t.me/s/<имя>. Чистая функция — на неё есть тест. */
export function parsePreview(html, now = Date.now()) {
  const title = (html.match(/<div class="tgme_channel_info_header_title"[^>]*>(?:<span[^>]*>)?([^<]+)/) || [])[1]?.trim() || "";
  const subsRaw = (html.match(/<span class="counter_value">([^<]+)<\/span>\s*<span class="counter_type">subscribers?<\/span>/) || [])[1];
  const views = [...html.matchAll(/<span class="tgme_widget_message_views">([^<]+)<\/span>/g)].map((m) => parseCount(m[1]));
  const dates = [...html.matchAll(/<time datetime="([^"]+)" class="time"/g)].map((m) => Date.parse(m[1])).filter(Number.isFinite);
  const isFeed = views.length > 0 || dates.length > 0;
  const last = dates.length ? Math.max(...dates) : null;
  const first = dates.length ? Math.min(...dates) : null;
  const month = dates.filter((d) => now - d <= 30 * 864e5).length;
  // Превью отдаёт ~20 последних постов; если все они моложе месяца — частоту
  // считаем по фактическому окну, иначе по числу постов за 30 дней.
  const spanDays = first && last ? Math.max(1, (last - first) / 864e5) : null;
  const perDay = dates.length >= 2 && spanDays && month === dates.length
    ? +(dates.length / spanDays).toFixed(2)
    : +(month / 30).toFixed(2);
  return {
    title,
    subscribers: subsRaw ? parseCount(subsRaw) : null,
    isFeed,
    medianViews: median(views.slice(-15)),
    postsPerDay: perDay,
    lastPostDaysAgo: last ? Math.round((now - last) / 864e5) : null,
  };
}

/** Служебные пути t.me, которые не являются именами каналов. */
const NOT_NAMES = new Set(["s", "joinchat", "share", "addstickers", "proxy", "socks", "iv", "c", "contact", "addlist", "boost", "login", "privacy"]);

/**
 * Имена каналов со страницы каталога: ссылки t.me/<имя> и карточки TGStat
 * (/channel/@<имя>). Чистая функция — на неё есть тест.
 */
export function extractChannelNames(html) {
  const out = new Set();
  for (const m of html.matchAll(/(?:t\.me|telegram\.me)\/(?:s\/)?([A-Za-z][A-Za-z0-9_]{4,31})/g)) {
    if (!NOT_NAMES.has(m[1].toLowerCase())) out.add(m[1]);
  }
  for (const m of html.matchAll(/\/(?:channel|chat)\/@([A-Za-z][A-Za-z0-9_]{4,31})/g)) out.add(m[1]);
  // Карточки Telemetr: telemetr.me/content/<имя>
  for (const m of html.matchAll(/telemetr\.me\/content\/([A-Za-z][A-Za-z0-9_]{4,31})/g)) out.add(m[1]);
  for (const m of html.matchAll(/href="\/content\/([A-Za-z][A-Za-z0-9_]{4,31})/g)) out.add(m[1]);
  return [...out];
}

async function main() {
  const list = (process.env.CHANNELS || "").split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);

  // Режим поиска: читаем страницы каталогов и добавляем найденные там каналы.
  const discover = (process.env.DISCOVER_URLS || "").split(/[\s,]+/).filter(Boolean);
  for (const url of discover) {
    try {
      const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "ru,en" } });
      const found = extractChannelNames(await r.text());
      console.log(`Каталог ${url}: HTTP ${r.status}, найдено ${found.length}`);
      for (const n of found) if (!list.some((x) => x.toLowerCase() === n.toLowerCase())) list.push(n);
    } catch (e) {
      console.log(`Каталог ${url}: не открылся — ${e.message || e}`);
    }
  }
  if (!list.length) throw new Error("CHANNELS пуст и в каталогах ничего не нашлось");
  const rows = [];
  for (const u of list) {
    try {
      const r = await fetch(`https://t.me/s/${u}`, { headers: { "User-Agent": UA, "Accept-Language": "en" }, redirect: "follow" });
      const html = await r.text();
      const s = parsePreview(html);
      // Нет ленты в превью — это чат, закрытый канал или такого имени нет.
      rows.push({ channel: "@" + u, http: r.status, ...s, kind: s.isFeed ? "канал" : "НЕ КАНАЛ/закрыт" });
    } catch (e) {
      rows.push({ channel: "@" + u, error: String(e.message || e) });
    }
    await new Promise((res) => setTimeout(res, 700)); // не долбим t.me
  }
  console.log("TG_STATS_JSON_BEGIN");
  console.log(JSON.stringify(rows));
  console.log("TG_STATS_JSON_END");
  for (const r of rows) {
    console.log(`${r.channel.padEnd(26)} ${String(r.kind || r.error).padEnd(16)} подп ${String(r.subscribers ?? "—").padStart(7)}  медиана просм ${String(r.medianViews ?? "—").padStart(6)}  постов/день ${String(r.postsPerDay ?? "—").padStart(5)}  посл. пост ${r.lastPostDaysAgo ?? "—"} дн  | ${r.title || ""}`);
  }
}

const direct = process.argv[1] && process.argv[1].endsWith("tg-channel-stats.mjs");
if (direct) main().catch((e) => { console.error("Не удалось:", e.message || e); process.exit(1); });
