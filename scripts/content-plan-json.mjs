#!/usr/bin/env node
/**
 * Контент-план (context/content-calendar.md) → стартовые данные раздела
 * «Контент» в CRM (src/crm/data/content-plan.json).
 *
 * CRM хранит план у себя в базе и правится там. Этот файл — только
 * начальная версия: её показываем, пока в базе ничего не сохранено.
 * Запуск: node scripts/content-plan-json.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const md = await readFile(new URL("../context/content-calendar.md", import.meta.url), "utf8");
const year = Number((md.match(/Период:.*?(\d{4})/) || [])[1] || new Date().getFullYear());

const posts = [];
for (const block of md.split(/\nPOST /).slice(1)) {
  const body = block.split(/\n## /)[0];
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  const n = Number(lines[0]);
  const d = /Дата: (\d\d)\.(\d\d)/.exec(lines[1]);
  const r = /Рубрика: (.+?) \| Формат: (.+?) \| Цель: (.+)/.exec(lines[2]);
  const field = (name) => {
    const l = lines.find((x) => x.startsWith(name + ":"));
    const v = l ? l.slice(name.length + 1).trim() : "";
    return v === "—" ? "" : v;
  };
  posts.push({
    id: `p${n}`,
    n,
    date: `${year}-${d[2]}-${d[1]}`,
    rubric: r[1].trim(),
    format: r[2].trim(),
    goal: r[3].trim(),
    topic: field("Тема"),
    hook: field("Зацепка"),
    visual: field("Визуал"),
    note: field("Примечание"),
    length: /^длинн/i.test(field("Объём")) ? "long" : /^коротк/i.test(field("Объём")) ? "short" : "",
    size: field("Объём").replace(/^(длинный|короткий)\s*—\s*/i, ""),
    local: /тверь/i.test(field("ЦА")),
    status: "idea",
  });
}
if (posts.length === 0) throw new Error("в плане нет блоков POST");
// version растёт, когда стартовый план меняется по существу: CRM предложит
// заменить им уже сохранённый план (сама не заменяет — там могут быть правки).
const version = 3;
await writeFile(
  new URL("../src/crm/data/content-plan.json", import.meta.url),
  JSON.stringify({ version, posts }, null, 2) + "\n",
);
console.log(`ok: ${posts.length} публикаций, ${posts[0].date} … ${posts.at(-1).date}`);
