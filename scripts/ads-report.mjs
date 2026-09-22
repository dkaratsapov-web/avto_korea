#!/usr/bin/env node
/**
 * Выгрузка рекламной статистики: Яндекс.Метрика и (если есть доступ) Директ.
 *
 * Зачем это здесь, а не на сайте. Разбор кампаний делает разработчик, а у него
 * нет доступа ни к рекламному кабинету, ни к боевому серверу — сеть закрыта.
 * Зато есть этот репозиторий. Поэтому отчёты забирает GitHub Actions: у него
 * открыт интернет, токены лежат в секретах репозитория и никуда не уезжают, а
 * результат попадает в reports/ — туда, где его видно и можно разбирать.
 *
 * Запуск: METRIKA_TOKEN=... [DIRECT_TOKEN=...] node scripts/ads-report.mjs
 * Параметры: DAYS (по умолчанию 90), COUNTER_ID (по умолчанию наш счётчик).
 *
 * Ошибки не глотаем и не падаем на первой: каждый отчёт сохраняется отдельно,
 * а неудачный — вместе с ответом сервера. Молчаливо пустой отчёт хуже явной
 * ошибки: по нему делают выводы, не зная, что данных просто не пришло.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const METRIKA_TOKEN = process.env.METRIKA_TOKEN || "";
const DIRECT_TOKEN = process.env.DIRECT_TOKEN || "";
const COUNTER_ID = process.env.COUNTER_ID || "111166439";
const DAYS = Number(process.env.DAYS || 90);

const today = new Date();
const since = new Date(today.getTime() - DAYS * 86400000);
const iso = (d) => d.toISOString().slice(0, 10);
const DATE1 = iso(since);
const DATE2 = iso(today);

const OUT = path.join("reports", iso(today));
const saved = [];

async function save(name, data) {
  const file = path.join(OUT, name);
  const body = typeof data === "string" ? data : JSON.stringify(data, null, 1);
  await writeFile(file, body);
  saved.push({ name, bytes: body.length });
  console.log(`  ✔ ${name} (${body.length} Б)`);
}

/* ------------------------------------------------------------- Метрика */

const METRIKA = "https://api-metrika.yandex.net";

async function metrika(pathname, params = {}) {
  const url = new URL(pathname, METRIKA);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  const r = await fetch(url, {
    headers: { Authorization: `OAuth ${METRIKA_TOKEN}` },
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text.slice(0, 2000) };
  }
  if (!r.ok) {
    const err = new Error(`Метрика ${r.status}: ${text.slice(0, 500)}`);
    err.payload = data;
    throw err;
  }
  return data;
}

/** Плоская таблица из ответа Метрики — её удобно читать и глазами, и кодом. */
function toRows(report) {
  const dims = (report.query?.dimensions || []).map((d) => d.replace(/^ym:[a-z]+:/, ""));
  const mets = (report.query?.metrics || []).map((m) => m.replace(/^ym:[a-z]+:/, ""));
  return (report.data || []).map((row) => {
    const out = {};
    row.dimensions.forEach((d, i) => {
      out[dims[i] || `dim${i}`] = d.name ?? d.id ?? "";
    });
    row.metrics.forEach((v, i) => {
      out[mets[i] || `metric${i}`] = v;
    });
    return out;
  });
}

/**
 * Цели счётчика. Их идентификаторы нужны, чтобы спросить конверсии поимённо:
 * «сколько заявок дала кампания», а не «сколько было достижений любых целей».
 */
async function goals() {
  const d = await metrika(`/management/v1/counter/${COUNTER_ID}/goals`);
  return (d.goals || []).map((g) => ({ id: g.id, name: g.name, type: g.type }));
}

async function metrikaReports() {
  const list = await goals();
  await save("goals.json", list);

  // Заявки считаем по цели отправки формы; если её нет — по любой цели.
  const leadGoal =
    list.find((g) => /lead_submit|заявк/i.test(`${g.name} ${g.id}`)) || list[0] || null;
  const goalMetrics = leadGoal
    ? [`ym:s:goal${leadGoal.id}reaches`, `ym:s:goal${leadGoal.id}conversionRate`]
    : ["ym:s:sumGoalReachesAny"];

  const common = {
    ids: COUNTER_ID,
    date1: DATE1,
    date2: DATE2,
    accuracy: "full",
    limit: 500,
  };

  /*
   * Срезы выбраны под один вопрос: куда уходят деньги и что приносит заявки.
   * Кампания отвечает «что отключить», фраза — «что минусовать», площадка —
   * «где сливается РСЯ», устройство и регион — «кому мы вообще показываемся».
   */
  const reports = [
    {
      name: "campaigns.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName",
        metrics: [
          "ym:s:visits",
          "ym:s:users",
          "ym:s:bounceRate",
          "ym:s:pageDepth",
          "ym:s:avgVisitDurationSeconds",
          ...goalMetrics,
        ].join(","),
        sort: "-ym:s:visits",
      },
    },
    {
      name: "search-phrases.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName,ym:s:lastDirectSearchPhrase",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...goalMetrics].join(","),
        sort: "-ym:s:visits",
        limit: 300,
      },
    },
    {
      name: "platforms.json",
      params: {
        dimensions: "ym:s:lastDirectPlatform",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...goalMetrics].join(","),
        sort: "-ym:s:visits",
        limit: 200,
      },
    },
    {
      name: "devices.json",
      params: {
        dimensions: "ym:s:deviceCategory",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...goalMetrics].join(","),
      },
    },
    {
      name: "regions.json",
      params: {
        dimensions: "ym:s:regionCity",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...goalMetrics].join(","),
        sort: "-ym:s:visits",
        limit: 100,
      },
    },
    {
      name: "landing-pages.json",
      params: {
        dimensions: "ym:s:startURL",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...goalMetrics].join(","),
        sort: "-ym:s:visits",
        limit: 100,
      },
    },
    {
      // Расходы Директа лежат в своём пространстве имён (ym:ad:) — там клики
      // и деньги, которых в обычных отчётах нет.
      name: "direct-costs.json",
      params: {
        dimensions: "ym:ad:lastDirectClickOrderName",
        metrics: "ym:ad:clicks,ym:ad:RUBAdCost,ym:ad:visits,ym:ad:goal",
        sort: "-ym:ad:RUBAdCost",
        direct_client_logins: process.env.DIRECT_LOGIN || undefined,
      },
    },
  ];

  for (const r of reports) {
    try {
      const params = { ...common, ...r.params };
      for (const k of Object.keys(params)) if (params[k] === undefined) delete params[k];
      const data = await metrika("/stat/v1/data", params);
      await save(r.name, { query: data.query, totals: data.totals, rows: toRows(data) });
    } catch (e) {
      await save(r.name.replace(".json", ".error.json"), {
        отчёт: r.name,
        ошибка: String(e.message || e),
        ответ: e.payload || null,
      });
      console.log(`  ✖ ${r.name}: ${String(e.message || e).slice(0, 200)}`);
    }
  }
}

/* -------------------------------------------------------------- Директ */

/**
 * Отчёт Директа. Доступ к API выдаётся по заявке, поэтому токена может не
 * быть — это не ошибка, просто часть данных придётся брать из Метрики.
 */
async function directReport(name, fieldNames, reportType) {
  const body = {
    params: {
      SelectionCriteria: { DateFrom: DATE1, DateTo: DATE2 },
      FieldNames: fieldNames,
      ReportName: `${name} ${DATE1}–${DATE2} ${Date.now()}`,
      ReportType: reportType,
      DateRangeType: "CUSTOM_DATE",
      Format: "TSV",
      IncludeVAT: "YES",
    },
  };

  for (let attempt = 0; attempt < 10; attempt++) {
    const r = await fetch("https://api.direct.yandex.com/json/v5/reports", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${DIRECT_TOKEN}`,
        "Accept-Language": "ru",
        "Content-Type": "application/json; charset=utf-8",
        processingMode: "auto",
        returnMoneyInMicros: "false",
        ...(process.env.DIRECT_LOGIN ? { "Client-Login": process.env.DIRECT_LOGIN } : {}),
      },
      body: JSON.stringify(body),
    });

    // 201/202 — отчёт ставится в очередь: ждём и спрашиваем снова.
    if (r.status === 201 || r.status === 202) {
      await new Promise((ok) => setTimeout(ok, 5000 * (attempt + 1)));
      continue;
    }
    const text = await r.text();
    if (!r.ok) throw new Error(`Директ ${r.status}: ${text.slice(0, 500)}`);
    return text;
  }
  throw new Error("Директ: отчёт не собрался за отведённое время");
}

async function directReports() {
  const jobs = [
    {
      name: "direct-campaigns.tsv",
      type: "CAMPAIGN_PERFORMANCE_REPORT",
      fields: ["CampaignName", "Impressions", "Clicks", "Ctr", "Cost", "AvgCpc", "Conversions", "CostPerConversion"],
    },
    {
      name: "direct-search-queries.tsv",
      type: "SEARCH_QUERY_PERFORMANCE_REPORT",
      fields: ["CampaignName", "Query", "Impressions", "Clicks", "Ctr", "Cost", "Conversions"],
    },
    {
      name: "direct-criteria.tsv",
      type: "CRITERIA_PERFORMANCE_REPORT",
      fields: ["CampaignName", "Criteria", "Impressions", "Clicks", "Ctr", "Cost", "Conversions", "CostPerConversion"],
    },
  ];

  for (const job of jobs) {
    try {
      await save(job.name, await directReport(job.name, job.fields, job.type));
    } catch (e) {
      await save(job.name.replace(".tsv", ".error.json"), {
        отчёт: job.name,
        ошибка: String(e.message || e),
      });
      console.log(`  ✖ ${job.name}: ${String(e.message || e).slice(0, 200)}`);
    }
  }
}

/* ---------------------------------------------------------------- пуск */

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`Период: ${DATE1} — ${DATE2}, счётчик ${COUNTER_ID}`);

  if (METRIKA_TOKEN) {
    console.log("Метрика:");
    await metrikaReports();
  } else {
    console.log("Метрика: токена нет — пропускаю");
  }

  if (DIRECT_TOKEN) {
    console.log("Директ:");
    await directReports();
  } else {
    console.log("Директ: токена нет — пропускаю (доступ к API выдаётся по заявке)");
  }

  await save(
    "README.md",
    [
      `# Выгрузка рекламы за ${DATE1} — ${DATE2}`,
      "",
      `Счётчик Метрики: ${COUNTER_ID}. Собрано: ${new Date().toISOString()}.`,
      "",
      "| файл | размер |",
      "| --- | --- |",
      ...saved.map((s) => `| ${s.name} | ${s.bytes} Б |`),
      "",
      "Файлы с `.error.json` в имени — отчёты, которые не собрались; внутри",
      "ответ сервера. Пустой отчёт без ошибки означает, что данных за период",
      "действительно нет.",
    ].join("\n"),
  );

  console.log(`Готово: ${OUT}`);
}

main().catch((e) => {
  console.error("Сорвалось целиком:", e);
  process.exit(1);
});
