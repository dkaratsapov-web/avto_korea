/**
 * Смена домена сайта одной командой.
 *
 * Домен прописан в шести местах: метаданные, карта сайта, robots.txt, JSON-LD,
 * генератор товарного фида и пример .env. Менять руками — верный способ забыть
 * одно из них (так и получилось при переезде с diauto69.ru).
 *
 * Запуск:
 *   node scripts/set-domain.mjs новый-домен.рф
 *   node scripts/set-domain.mjs новый-домен.рф --redirect старый-домен.рф
 *
 * Кириллические домены переводятся в punycode там, где адрес читают роботы
 * (карта сайта, robots.txt, JSON-LD), и остаются кириллицей там, где его видит
 * человек (site.ts выводится в политике конфиденциальности).
 *
 * С флагом --redirect в public/.htaccess добавляется 301 со старого домена:
 * без него поисковый вес и старые ссылки теряются.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const domainArg = args.find((a) => !a.startsWith("--"));
const redirectIdx = args.indexOf("--redirect");
const oldDomainArg = redirectIdx >= 0 ? args[redirectIdx + 1] : null;

if (!domainArg) {
  console.error(
    "Укажите новый домен:\n  node scripts/set-domain.mjs новый-домен.рф [--redirect старый-домен.рф]",
  );
  process.exit(1);
}

/** Нормализуем: убираем схему, слэши, приводим к нижнему регистру. */
const clean = (d) =>
  d
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();

const human = clean(domainArg);
// URL сам переводит кириллицу в punycode — отдельная библиотека не нужна.
const ascii = new URL(`https://${human}`).hostname;
const oldHuman = oldDomainArg ? clean(oldDomainArg) : null;
const oldAscii = oldHuman ? new URL(`https://${oldHuman}`).hostname : null;

const HUMAN_URL = `https://${human}`;
const ASCII_URL = `https://${ascii}`;

/** Заменить в файле по списку правил, пожаловаться, если правило не сработало. */
function patch(relPath, rules) {
  const file = resolve(ROOT, relPath);
  let text = readFileSync(file, "utf8");
  for (const [re, replacement] of rules) {
    if (!re.test(text)) {
      console.error(`  ! в ${relPath} не найдено: ${re}`);
      continue;
    }
    text = text.replace(re, replacement);
  }
  writeFileSync(file, text);
  console.log(`  ✓ ${relPath}`);
}

console.log(`Новый домен: ${human}${human !== ascii ? ` (punycode: ${ascii})` : ""}`);

// Человекочитаемый адрес — его видит посетитель в политике конфиденциальности.
patch("src/lib/site.ts", [[/(\?\?\s*")https?:\/\/[^"]+(")/, `$1${HUMAN_URL}$2`]]);
patch(".env.example", [[/^VITE_SITE_URL=.*$/m, `VITE_SITE_URL=${HUMAN_URL}`]]);
patch("public/feed/yandex.php", [
  [/const SITE_URL = '[^']+';/, `const SITE_URL = '${HUMAN_URL}';`],
]);

// Роботы читают адреса только в ASCII — здесь punycode.
patch("public/sitemap.xml", [
  [/<loc>https?:\/\/[^<]+<\/loc>/, `<loc>${ASCII_URL}/</loc>`],
  [/Домен кириллический: \S+\./, `Домен кириллический: ${human}.`],
]);
patch("public/robots.txt", [
  [/^Sitemap: .*$/m, `Sitemap: ${ASCII_URL}/sitemap.xml`],
  [/^# .* в punycode/m, `# ${human} в punycode`],
]);
patch("index.html", [[/("url":\s*")https?:\/\/[^"]+(")/, `$1${ASCII_URL}$2`]]);

// 301 со старого домена: без него теряется поисковый вес и старые ссылки.
if (oldAscii) {
  const file = resolve(ROOT, "public/.htaccess");
  let text = readFileSync(file, "utf8");
  const marker = "# --- Переезд: 301 со старого домена ---";
  const block = `${marker}
  # Старый домен должен оставаться оплаченным и указывать на этот же хостинг,
  # иначе редирект умрёт вместе с ним и ссылки станут битыми.
  RewriteCond %{HTTP_HOST} ^(www\\.)?(${oldAscii.replace(/\./g, "\\.")})$ [NC]
  RewriteRule ^(.*)$ ${ASCII_URL}/$1 [R=301,L]
`;
  if (text.includes(marker)) {
    text = text.replace(new RegExp(`${marker}[\\s\\S]*?\\[R=301,L\\]\\n`), block);
  } else {
    text = text.replace(
      "  # --- Данные и медиа бота отдаём со своего домена ---",
      `${block}\n  # --- Данные и медиа бота отдаём со своего домена ---`,
    );
  }
  writeFileSync(file, text);
  console.log(`  ✓ public/.htaccess — 301 с ${oldHuman} (${oldAscii})`);
}

console.log(`
Дальше вручную:
  1. GitHub → Settings → Secrets and variables → Actions → переменная
     VITE_SITE_URL = ${HUMAN_URL}
  2. Выпустить SSL для нового домена в панели хостинга.
  3. Яндекс.Вебмастер: добавить домен, подтвердить права, «Переезд сайта».
  4. Директ: адрес фида ${ASCII_URL}/feed/yandex.xml и ссылки в объявлениях.
  5. Бот: MINI_APP_URL в Cloudflare и адрес мини-аппа в BotFather.`);
