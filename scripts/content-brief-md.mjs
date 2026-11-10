#!/usr/bin/env node
/**
 * Бриф перед запуском Instagram: src/crm/data/content-brief.json →
 * context/content-brief.md (для скиллов и PDF).
 *
 * Вопросы живут в JSON — его же показывает CRM (Контент → Бриф), там же
 * сохраняются ответы. Запуск: node scripts/content-brief-md.mjs
 */
import { readFile, writeFile } from "node:fs/promises";

const brief = JSON.parse(await readFile(new URL("../src/crm/data/content-brief.json", import.meta.url), "utf8"));
const total = brief.sections.reduce((s, x) => s + x.questions.length, 0);
let n = 0;
const out = [
  `# ${brief.title} — ДиАвто69`,
  "",
  `${total} вопросов · ${brief.sections.length} блоков. Отвечать удобнее в CRM: раздел «Контент» → «Бриф» — ответы сохраняются и видны всем сотрудникам.`,
  "",
  brief.intro,
  "",
];
for (const s of brief.sections) {
  out.push(`## ${s.title}`, "");
  for (const q of s.questions) {
    n += 1;
    out.push(`**${n}. ${q.q}**`, "");
    if (q.hint) out.push(`Подсказка: ${q.hint}`, "");
    out.push("Ответ: ", "");
  }
}
await writeFile(new URL("../context/content-brief.md", import.meta.url), out.join("\n"));
console.log(`ok: ${total} вопросов`);
