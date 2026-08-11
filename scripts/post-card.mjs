/**
 * Генератор карточки авто для постов в Telegram.
 *
 * Собирает картинку 1280×960 в фирменном стиле сайта: логотип, название модели,
 * цена, лента характеристик и строка преимуществ. Вёрстка рисуется в Chromium
 * и снимается скриншотом, поэтому шрифты и раскладка — ровно как в браузере.
 *
 * Запуск:
 *   node scripts/post-card.mjs scripts/post-card.example.json out.jpg
 *
 * Данные — JSON вида как в scripts/post-card.example.json. Путь к фото в нём
 * указывается относительно корня проекта (или абсолютный). Файлы подставляются
 * в разметку как data-URI, поэтому дев-сервер поднимать не нужно.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , dataArg, outArg] = process.argv;

const dataPath = resolve(ROOT, dataArg || "scripts/post-card.example.json");
const outPath = resolve(ROOT, outArg || "post-card.jpg");
const car = JSON.parse(readFileSync(dataPath, "utf8"));

const W = 1280;
const H = 960;
const SKEW = "-22deg"; // угол фирменного росчерка — им же режем кадр

/** Файл как data-URI: скрипт не зависит от запущенного сайта. */
function dataUri(relPath) {
  const p = resolve(ROOT, relPath);
  if (!existsSync(p)) throw new Error(`файл не найден: ${p}`);
  const mime =
    { ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" }[
      extname(p).toLowerCase()
    ] || "application/octet-stream";
  return `data:${mime};base64,${readFileSync(p).toString("base64")}`;
}

/**
 * Иконка lucide по имени файла в пакете (kebab-case).
 * Берём узлы прямо из установленного lucide-react — те же иконки, что в
 * интерфейсе сайта, так что пост и карточка выглядят из одного комплекта.
 */
function icon(name, size = 22, stroke = 2) {
  const file = resolve(ROOT, "node_modules/lucide-react/dist/esm/icons", `${name}.js`);
  if (!existsSync(file)) throw new Error(`нет иконки lucide: ${name}`);
  const src = readFileSync(file, "utf8");
  const from = src.indexOf("[", src.indexOf("createLucideIcon("));
  const nodes = eval(src.slice(from, src.indexOf("]);", from) + 1));
  const inner = nodes
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${a}/>`;
    })
    .join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:${W}px; height:${H}px; overflow:hidden; position:relative; color:#fff;
  font-family:"Manrope","Saira","DejaVu Sans",sans-serif; background:#0d1014; }

/* Фон: градиент, диагональные полосы и точечный растр. */
.bg { position:absolute; inset:0;
  background:
    repeating-linear-gradient(112deg, rgba(255,255,255,.030) 0 2px, rgba(255,255,255,0) 2px 26px),
    radial-gradient(38% 46% at 8% 92%, rgba(177,31,22,.34) 0%, rgba(177,31,22,0) 70%),
    radial-gradient(46% 40% at 2% 4%, rgba(92,109,118,.30) 0%, rgba(92,109,118,0) 72%),
    linear-gradient(155deg, #1b222b 0%, #12171d 48%, #0b0e12 100%); }
.dots { position:absolute; inset:0; opacity:.5;
  background-image:radial-gradient(rgba(255,255,255,.10) 1px, transparent 1px);
  background-size:22px 22px;
  -webkit-mask-image:linear-gradient(115deg, #000 0%, transparent 62%); }

/* Фотопанель со скосом: блок наклонён, фото внутри отклонено обратно —
   картинка не деформируется, а красная кромка совпадает с краем панели. */
.shot { position:absolute; right:-70px; top:0; width:60%; height:${H - 246}px;
  transform:skewX(-8deg); overflow:hidden;
  border-left:5px solid #D4372B; box-shadow:-18px 0 60px -20px rgba(212,55,43,.55); }
.shot img { width:118%; height:100%; margin-left:-9%; object-fit:cover;
  object-position:${car.photoPosition || "72% 50%"}; transform:skewX(8deg); }
.shot::after { content:""; position:absolute; inset:0; transform:skewX(8deg) scale(1.3);
  background:
    linear-gradient(102deg, rgba(13,16,20,1) 0%, rgba(13,16,20,.86) 16%, rgba(13,16,20,.05) 46%, rgba(13,16,20,0) 70%),
    linear-gradient(0deg, rgba(13,16,20,.95) 0%, rgba(13,16,20,0) 26%); }

/* Контурная модель — заполняет пустоту под ценой. */
.ghost { position:absolute; left:30px; bottom:300px; font-size:140px; font-weight:900; line-height:.8;
  letter-spacing:-.04em; color:transparent; -webkit-text-stroke:2px rgba(255,255,255,.045);
  transform:skewX(${SKEW}); }

.wrap { position:absolute; left:56px; top:44px; right:0; }
.top { display:flex; align-items:center; gap:14px; }
.top img { height:46px; }
.slash { width:44px; height:7px; border-radius:2px; transform:skewX(${SKEW});
  background:linear-gradient(90deg,#7A1410,#D4372B); }
.top span { font-size:13px; font-weight:800; letter-spacing:.18em; text-transform:uppercase; color:#8C97A1; }

.eyebrow { margin-top:52px; display:flex; align-items:center; gap:12px;
  font-size:13px; font-weight:900; letter-spacing:.2em; text-transform:uppercase; color:#D4372B; }
h1 { margin-top:12px; font-size:74px; line-height:.86; font-weight:900; letter-spacing:-.03em; text-transform:uppercase; }
h1 .brand { display:block; font-size:38px; letter-spacing:.02em;
  background:linear-gradient(180deg,#E6EAED,#AEBAC2 42%,#5C6D76);
  -webkit-background-clip:text; background-clip:text; color:transparent; }
.chips { margin-top:18px; display:flex; gap:10px; }
.chips b { font-size:13px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:#C7CFD6;
  padding:8px 14px; border:1px solid rgba(255,255,255,.16); border-radius:999px; background:rgba(255,255,255,.04); }
.chips b.acc { color:#fff; border-color:rgba(212,55,43,.6); background:rgba(177,31,22,.22); }

.price { margin-top:34px; display:flex; flex-direction:column; align-items:flex-start; gap:14px; }
.price .rule { width:96px; height:2px; background:linear-gradient(90deg,#D4372B,rgba(212,55,43,0)); }
.price .lab { margin-top:14px; font-size:12.5px; font-weight:800; letter-spacing:.16em;
  text-transform:uppercase; color:#8C97A1; }
.price .val { margin-top:6px; font-size:64px; font-weight:900; letter-spacing:-.03em; line-height:1; }
.price .val i { font-style:normal; color:#D4372B; font-size:40px; margin-left:6px; }
.price .alt { display:flex; align-items:baseline; gap:12px; }
.price .alt .val { font-size:28px; color:#C7CFD6; margin-top:0; }
.price .alt .val i { font-size:22px; }
.price .alt .lab { margin-top:0; font-size:11.5px; }

/* Характеристики — лентой внизу, по ячейке на цифру. */
.specs { position:absolute; left:0; right:0; bottom:110px; height:136px; padding:0 34px;
  display:grid; grid-template-columns:repeat(${car.specs.length},1fr); align-items:center;
  background:linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
  border-top:1px solid rgba(255,255,255,.12); }
.sp { position:relative; display:flex; flex-direction:column; align-items:center; gap:7px;
  text-align:center; padding:0 6px; }
.sp + .sp::before { content:""; position:absolute; left:0; top:2px; bottom:2px; width:1px;
  background:rgba(255,255,255,.10); }
.sp .ic { display:flex; align-items:center; justify-content:center; width:38px; height:38px;
  border-radius:12px; color:#fff; background:linear-gradient(160deg,#B11F16,#7A1410);
  box-shadow:0 8px 18px -10px rgba(177,31,22,.9); }
.sp .k { display:block; font-size:9.5px; font-weight:800; letter-spacing:.1em;
  text-transform:uppercase; color:#8C97A1; }
.sp .v { display:block; font-size:17px; font-weight:900; margin-top:2px; white-space:nowrap; }

/* Нижняя строка — как бегущая строка на сайте, с ромбами-разделителями. */
.strip { position:absolute; left:0; right:0; bottom:0; height:110px; display:flex; align-items:center;
  justify-content:center; gap:26px; padding:0 40px;
  background:linear-gradient(180deg, rgba(255,255,255,.045), rgba(255,255,255,.015));
  border-top:1px solid rgba(255,255,255,.12); }
.strip::before { content:""; position:absolute; left:0; right:0; top:-1px; height:2px;
  background:linear-gradient(90deg, transparent, #5C6D76, #AEBAC2, #5C6D76, transparent); }
.strip u { text-decoration:none; font-size:14.5px; font-weight:800; letter-spacing:.06em;
  text-transform:uppercase; color:#C7CFD6; white-space:nowrap; }
.rh { width:9px; height:9px; transform:rotate(45deg); background:#D4372B; flex:none; }
</style></head><body>
<div class="bg"></div><div class="dots"></div>

<div class="shot"><img src="${dataUri(car.photo)}" alt=""></div>
<div class="ghost">${car.model}</div>

<div class="wrap">
  <div class="top">
    <img src="${dataUri("public/logo-wordmark.png")}" alt="ДиАвто69">
    <span class="slash"></span>
    <span>${car.tagline || "Импорт под ключ · 69 регион"}</span>
  </div>

  <div class="eyebrow"><span class="slash"></span> ${car.eyebrow || "Новое поступление"}</div>
  <h1><span class="brand">${car.brand}</span>${car.model}</h1>

  <div class="chips">
    ${(car.chips || []).map((c, i) => `<b class="${i ? "" : "acc"}">${c}</b>`).join("")}
  </div>

  <div class="price">
    <div>
      <div class="rule"></div>
      <div class="lab">${car.priceLabel}</div>
      <div class="val">${car.price}<i>₽</i></div>
    </div>
    ${
      car.price2
        ? `<div class="alt">
             <div class="lab">${car.price2Label}</div>
             <div class="val">${car.price2}<i>₽</i></div>
           </div>`
        : ""
    }
  </div>
</div>

<div class="specs">
  ${car.specs
    .map(
      ([ic, k, v]) => `<div class="sp"><span class="ic">${icon(ic, 22)}</span>
        <span><span class="k">${k}</span><span class="v">${v}</span></span></div>`,
    )
    .join("")}
</div>

<div class="strip">
  ${(car.benefits || []).map((b, i) => `${i ? '<span class="rh"></span>' : ""}<u>${b}</u>`).join("")}
</div>
</body></html>`;

// Playwright намеренно не в зависимостях проекта: он нужен только для этого
// скрипта, а в сборку и деплой тянуть лишние сотни мегабайт незачем.
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error(
    "Нужен playwright. Установите один раз:\n" +
      "  npm i -D playwright && npx playwright install chromium",
  );
  process.exit(1);
}

const browser = await chromium.launch({
  args: ["--no-sandbox"],
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: outPath, type: "jpeg", quality: 93 });
await browser.close();

console.log(`готово: ${outPath} (${W}×${H})`);
