/*
 * Проверка того, что человек видит в первую секунду.
 *
 * Мини-апп грузит около 470 КБ кода и стилей до первой отрисовки. На домашнем
 * интернете это доли секунды, на мобильном в 400 кбит/с — почти десять, и всё
 * это время экран был БЕЛЫМ. Со стороны неотличимо от «не работает».
 *
 * Лечится двумя вещами, и обе легко потерять при следующей правке:
 *   1. Заставка прямо в разметке — она приезжает вместе со страницей.
 *   2. Сжатие на сервере — те же файлы весят втрое меньше.
 *
 * Полная проверка (браузер, медленная сеть, мёртвые данные) живёт в
 * scripts/check-boot.mjs — она требует playwright и гоняется руками. Здесь
 * дешёвые проверки без браузера, которые можно держать в общем прогоне.
 *
 * Запуск: node scripts/check-shell.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const problems = [];

const check = (what, ok, detail = "") => {
  if (!ok) problems.push(what + (detail ? `: ${detail}` : ""));
};

const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const htaccess = fs.readFileSync(path.join(root, "public/.htaccess"), "utf8");
const boot = fs.readFileSync(
  path.join(root, "src/components/ui/BootScreen.tsx"),
  "utf8",
);

/* --- 1. Заставка есть в самой разметке --- */

const rootDiv = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script/);
check("в разметке нет узла приложения", !!rootDiv);
check(
  "узел приложения пуст — до загрузки кода человек увидит белый экран",
  !!rootDiv && rootDiv[1].includes('class="boot"'),
);
check(
  "у заставки нет подписи — пустой экран с картинкой читается как поломка",
  html.includes("Загружаем каталог"),
);

/* --- 2. Стили заставки внутри разметки, а не в отдельном файле --- */

/*
 * Это главное условие. Заставка на внешних стилях бесполезна: файл со стилями
 * весит 100 КБ и приезжает как раз тогда, когда заставка уже не нужна.
 */
const headStyles = html.slice(0, html.indexOf("</head>"));
for (const sel of [".boot", ".boot-mark", ".boot-bar", ".boot-note"]) {
  check(`стиль ${sel} должен быть внутри разметки`, headStyles.includes(sel));
}
/*
 * Заставка тёмная — и в мини-аппе, и на сайте.
 *
 * Раньше вариантов было два: светлый на сайте и тёмный в мини-аппе. Светлый
 * читался как отдельный, второй прелоадер — белый экран с полосой, а следом
 * тёмный экран с глобусом. Один тон на обоих экранах превращает их в одну
 * заставку; заодно в мини-аппе по-прежнему ничего не мигает белым.
 */
check(
  "заставка должна быть тёмной — иначе перед глобусом мигнёт белым",
  /\.boot\s*\{[^}]*background:\s*#11151a/i.test(headStyles),
);

/* --- 3. Запасной вид React повторяет заставку --- */

/*
 * Пока едет код страницы, React показывает запасной вид из Suspense. Раньше
 * там стоял кружок на классах Tailwind — и он оказывался невидимым ровно
 * тогда, когда нужен: стили ещё не приехали. Поэтому запасной вид обязан
 * пользоваться теми же внутренними стилями, что и заставка.
 */
for (const cls of ["boot", "boot-mark", "boot-bar", "boot-note"]) {
  check(`в BootScreen потерян класс ${cls}`, boot.includes(`"${cls}"`));
}
check(
  "BootScreen тянет классы Tailwind — они не работают до загрузки стилей",
  !/className="(?!boot)/.test(boot.replace(/className="boot[^"]*"/g, "")),
);
check(
  "подписи заставки разошлись между разметкой и BootScreen",
  boot.includes("Загружаем каталог"),
);

/* --- 4. Сжатие на сервере --- */

check(
  "в .htaccess нет сжатия — код и стили поедут в три раза дольше",
  htaccess.includes("mod_deflate.c") && htaccess.includes("AddOutputFilterByType"),
);
for (const type of ["text/css", "text/html", "application/javascript"]) {
  check(`сжатие не включено для ${type}`, htaccess.includes(type));
}
check(
  "нет Vary: Accept-Encoding — сжатый ответ может достаться тому, кто не умеет разжимать",
  /Header append Vary Accept-Encoding/.test(htaccess),
);
/*
 * Картинки и видео уже сжаты своим форматом. Повторное сжатие ничего не
 * экономит, зато занимает процессор и задерживает ответ.
 */
for (const type of ["image/jpeg", "image/webp", "video/mp4", "font/woff2"]) {
  check(`${type} сжимать не нужно, а он в списке`, !htaccess.includes(type));
}

/* --- Итог --- */

if (problems.length) {
  process.stderr.write("Первый экран: найдены проблемы\n");
  for (const p of problems) process.stderr.write(`  • ${p}\n`);
  process.exit(1);
}

process.stdout.write("Первый экран: заставка на месте, сжатие включено\n");
