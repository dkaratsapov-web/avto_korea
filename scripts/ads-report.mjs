#!/usr/bin/env node
/**
 * Выгрузка статистики сайта и рекламы: Яндекс.Метрика и (если есть доступ) Директ.
 *
 * Зачем это здесь, а не на сайте. Разбор кампаний делает разработчик, а у него
 * нет доступа ни к рекламному кабинету, ни к боевому серверу — сеть закрыта.
 * Зато есть этот репозиторий. Поэтому отчёты забирает GitHub Actions: у него
 * открыт интернет, токены лежат в секретах репозитория и никуда не уезжают, а
 * результат попадает в reports/ — туда, где его видно и можно разбирать.
 *
 * Запуск: YANDEX_TOKEN=... node scripts/ads-report.mjs
 * (или раздельно: METRIKA_TOKEN=... DIRECT_TOKEN=...)
 * Параметры: DAYS (по умолчанию 90), COUNTER_ID (по умолчанию наш счётчик).
 *
 * Ошибки не глотаем и не падаем на первой: каждый отчёт сохраняется отдельно,
 * а неудачный — вместе с ответом сервера. Молчаливо пустой отчёт хуже явной
 * ошибки: по нему делают выводы, не зная, что данных просто не пришло.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/*
 * Токен может быть один на оба сервиса.
 *
 * В приложении Яндекса доступы складываются: одно приложение с правами
 * metrika:read и direct:api выдаёт один токен, который открывает и Метрику, и
 * Директ. Раздельные METRIKA_TOKEN и DIRECT_TOKEN остаются на случай, когда
 * кабинеты принадлежат разным людям.
 */
const YANDEX_TOKEN = process.env.YANDEX_TOKEN || "";
const METRIKA_TOKEN = process.env.METRIKA_TOKEN || YANDEX_TOKEN;
const DIRECT_TOKEN = process.env.DIRECT_TOKEN || YANDEX_TOKEN;
const DIRECT_LOGIN = (process.env.DIRECT_LOGIN || "").trim();
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
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }

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

const shortName = (s) => s.replace(/^ym:[a-z]+:/, "");

/** Плоская таблица из ответа Метрики — её удобно читать и глазами, и кодом. */
function toRows(report) {
  const dims = (report.query?.dimensions || []).map(shortName);
  const mets = (report.query?.metrics || []).map(shortName);
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
 * Динамика по дням и неделям приходит с другой ручки.
 *
 * У /stat/v1/data метрики — числа за весь период, и параметр group там просто
 * игнорируется: отчёт «по неделям» молча получался копией обычного. Ряды по
 * времени отдаёт /stat/v1/data/bytime, и там в каждой строке метрика — массив
 * значений по интервалам, которые перечислены в time_intervals.
 */
function toSeries(report) {
  const dims = (report.query?.dimensions || []).map(shortName);
  const mets = (report.query?.metrics || []).map(shortName);
  const intervals = (report.time_intervals || []).map((pair) => pair[0]);
  return {
    интервалы: intervals,
    ряды: (report.data || []).map((row) => {
      const out = {};
      row.dimensions.forEach((d, i) => {
        out[dims[i] || `dim${i}`] = d.name ?? d.id ?? "";
      });
      row.metrics.forEach((values, i) => {
        out[mets[i] || `metric${i}`] = values;
      });
      return out;
    }),
  };
}

/**
 * Цели счётчика. Их идентификаторы нужны, чтобы спросить конверсии поимённо:
 * «сколько заявок дала кампания», а не «сколько было достижений любых целей».
 */
async function goals() {
  const d = await metrika(`/management/v1/counter/${COUNTER_ID}/goals`);
  return (d.goals || []).map((g) => ({ id: g.id, name: g.name, type: g.type }));
}

/**
 * Спросить отчёт, перебирая варианты названий полей.
 *
 * Справочник Метрики недоступен из среды разработки, а имена измерений в
 * разных пространствах имён не совпадают: то, что в отчётах по визитам зовётся
 * lastDirectClickOrderName, в отчётах по расходам называется иначе. Перебор
 * дешевле угадывания: первый вариант, который сервер принял, и есть верный, а
 * если не принял ни один — в файле останутся все ответы сразу.
 */
async function tryReport(name, variants, common) {
  const errors = [];
  for (const variant of variants) {
    try {
      const data = await metrika("/stat/v1/data", { ...common, ...variant });
      await save(name, {
        запрос: { dimensions: variant.dimensions, metrics: variant.metrics },
        totals: data.totals,
        rows: toRows(data),
      });
      return true;
    } catch (e) {
      errors.push({ вариант: variant.dimensions, ошибка: String(e.message || e).slice(0, 300) });
    }
  }
  await save(name.replace(".json", ".error.json"), { отчёт: name, попытки: errors });
  console.log(`  ✖ ${name}: не принят ни один вариант полей`);
  return false;
}

/* --------------------------------------------------------------- цели */

/**
 * Какие цели считаем.
 *
 * Считать по одной цели «заявка с сайта» нельзя по двум причинам. Первая:
 * половина рекламы ведёт не на форму, а в бота и канал — для таких кампаний
 * заявок на сайте не будет никогда. Вторая: сама цель «Заявка с сайта» —
 * типа url, то есть срабатывает на переход по адресу; на сайте-одностраничнике
 * адрес после отправки формы не меняется, и ноль в этой цели может означать
 * не «нет заявок», а «цель не настроена». Поэтому рядом всегда берём
 * автоцели Метрики (отправка формы, контактные данные) и цели CRM: если
 * заявки есть, они проявятся хотя бы в одной из них.
 */
const GOAL_WANTED = [
  { key: "заявка", re: /^заявка с сайта/i },
  { key: "форма", re: /автоцель.*отправка формы/i },
  { key: "контакты", re: /автоцель.*отправил контактные/i },
  { key: "мессенджер", re: /автоцель.*переход в мессенджер/i },
  { key: "телефон", re: /^js - клик по номеру/i },
  { key: "лс-тг", re: /переход в лс - тг/i },
  { key: "канал-тг", re: /переход в канал - тг/i },
  { key: "бот-клик", re: /переход в бота тг/i },
  { key: "бот-старт", re: /подписка\/старт/i },
  { key: "карточка", re: /открыта карточка/i },
  { key: "crm-заказ", re: /crm: заказ создан/i },
  { key: "crm-оплата", re: /crm: заказ оплачен/i },
];

/** Короткий набор — для срезов в два измерения, где важнее строки, чем цели. */
const GOAL_CORE = ["заявка", "форма", "мессенджер", "канал-тг", "бот-клик", "карточка"];

function pickGoals(list) {
  const picked = [];
  for (const w of GOAL_WANTED) {
    const g = list.find((x) => w.re.test(x.name) && !picked.some((p) => p.id === x.id));
    if (g) picked.push({ ...g, key: w.key });
  }
  return picked;
}

/* ------------------------------------------------------------- отчёты */

async function metrikaReports() {
  const list = await goals();
  await save("goals.json", list);

  const picked = pickGoals(list);
  await save("goals-used.json", picked);

  const metricOf = (key) => {
    const g = picked.find((p) => p.key === key);
    return g ? `ym:s:goal${g.id}reaches` : null;
  };
  const all = picked.map((g) => `ym:s:goal${g.id}reaches`);
  const core = GOAL_CORE.map(metricOf).filter(Boolean);
  // Ключ к чтению файлов: какая метрика какой цели соответствует.
  await save(
    "goals-legend.json",
    picked.map((g) => ({ метрика: `goal${g.id}reaches`, цель: g.name, ключ: g.key, тип: g.type })),
  );

  const BASE = ["ym:s:visits", "ym:s:users", "ym:s:bounceRate", "ym:s:pageDepth", "ym:s:avgVisitDurationSeconds"];
  const common = { ids: COUNTER_ID, date1: DATE1, date2: DATE2, accuracy: "full", limit: 500 };

  /*
   * Срезы выбраны под четыре вопроса, а не под один.
   *
   * Куда уходят деньги (кампания, площадка, фраза), кто приходит (устройство,
   * регион, новый или вернувшийся), куда он попадает (посадочная, связка
   * «кампания × посадочная») и что делает дальше (страницы, выходы, цели).
   * Без связки «кампания × посадочная» разбор упирается в потолок: видно, что
   * кампания плоха, но не видно, кампания плоха или страница под ней.
   */
  const reports = [
    /* --- весь трафик, не только реклама --------------------------------- */
    {
      name: "traffic-sources.json",
      params: {
        dimensions: "ym:s:lastTrafficSource,ym:s:lastSourceEngineName",
        metrics: [...BASE, ...all].join(","),
        sort: "-ym:s:visits",
        limit: 200,
      },
    },
    {
      name: "all-landings.json",
      params: {
        dimensions: "ym:s:startURL",
        metrics: [...BASE, ...all].join(","),
        sort: "-ym:s:visits",
        limit: 200,
      },
    },
    {
      name: "exit-pages.json",
      params: {
        dimensions: "ym:s:endURL",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...core].join(","),
        sort: "-ym:s:visits",
        limit: 100,
      },
    },
    {
      name: "pages.json",
      params: {
        dimensions: "ym:pv:URL",
        metrics: "ym:pv:pageviews,ym:pv:users",
        sort: "-ym:pv:pageviews",
        limit: 150,
      },
    },
    {
      name: "new-vs-returning.json",
      params: {
        dimensions: "ym:s:isNewUser",
        metrics: [...BASE, ...all].join(","),
      },
    },
    {
      name: "devices.json",
      params: {
        dimensions: "ym:s:deviceCategory,ym:s:mobilePhone",
        metrics: [...BASE, ...core].join(","),
        sort: "-ym:s:visits",
        limit: 60,
      },
    },
    {
      name: "regions.json",
      params: {
        dimensions: "ym:s:regionCity",
        metrics: [...BASE, ...core].join(","),
        sort: "-ym:s:visits",
        limit: 120,
      },
    },
    {
      name: "utm.json",
      params: {
        dimensions: "ym:s:UTMSource,ym:s:UTMCampaign",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...core].join(","),
        sort: "-ym:s:visits",
        limit: 150,
      },
    },

    /* --- реклама ---------------------------------------------------------- */
    {
      name: "campaigns.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName",
        metrics: [...BASE, ...all].join(","),
        sort: "-ym:s:visits",
      },
    },
    {
      // Главная связка разбора: кампания × страница, куда она ведёт.
      name: "campaign-landing.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName,ym:s:startURL",
        metrics: [...BASE, ...core].join(","),
        sort: "-ym:s:visits",
        limit: 300,
      },
    },
    {
      name: "campaign-device.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName,ym:s:deviceCategory",
        metrics: [...BASE, ...core].join(","),
        sort: "-ym:s:visits",
        limit: 100,
      },
    },
    {
      name: "campaign-region.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName,ym:s:regionCity",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...core].join(","),
        sort: "-ym:s:visits",
        limit: 300,
      },
    },
    {
      name: "platforms.json",
      params: {
        dimensions: "ym:s:lastDirectPlatform,ym:s:lastDirectClickOrderName",
        metrics: [...BASE, ...core].join(","),
        sort: "-ym:s:visits",
        limit: 400,
      },
    },
    {
      name: "search-phrases.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName,ym:s:lastDirectSearchPhrase",
        metrics: ["ym:s:visits", "ym:s:bounceRate", ...core].join(","),
        sort: "-ym:s:visits",
        limit: 400,
      },
    },
  ];

  for (const r of reports) {
    try {
      const data = await metrika("/stat/v1/data", { ...common, ...r.params });
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

  /* --- динамика --------------------------------------------------------- */

  const series = [
    {
      name: "daily-total.json",
      params: {
        metrics: [...BASE, ...all].join(","),
        group: "day",
      },
    },
    {
      name: "weekly-campaigns.json",
      params: {
        dimensions: "ym:s:lastDirectClickOrderName",
        metrics: ["ym:s:visits", ...core].join(","),
        group: "week",
        sort: "-ym:s:visits",
        limit: 20,
      },
    },
  ];

  for (const s of series) {
    try {
      const data = await metrika("/stat/v1/data/bytime", { ...common, ...s.params });
      await save(s.name, { query: data.query, totals: data.totals, ...toSeries(data) });
    } catch (e) {
      await save(s.name.replace(".json", ".error.json"), {
        отчёт: s.name,
        ошибка: String(e.message || e),
        ответ: e.payload || null,
      });
      console.log(`  ✖ ${s.name}: ${String(e.message || e).slice(0, 200)}`);
    }
  }

  /* --- поля с неизвестным написанием ------------------------------------ */

  // Объявления и ключи: без них нельзя сказать, что именно минусовать.
  await tryReport(
    "direct-banners.json",
    [
      { dimensions: "ym:s:lastDirectBannerGroup,ym:s:lastDirectPhraseOrCond" },
      { dimensions: "ym:s:lastDirectBanner,ym:s:lastDirectPhraseOrCond" },
      { dimensions: "ym:s:lastDirectPhraseOrCond" },
      { dimensions: "ym:s:lastDirectConditionType" },
    ].map((v) => ({
      ...v,
      metrics: ["ym:s:visits", "ym:s:bounceRate", ...core].join(","),
      sort: "-ym:s:visits",
      limit: 300,
    })),
    common,
  );

  // Тип площадки (сайт или мобильное приложение) — разные рычаги отключения.
  await tryReport(
    "platform-type.json",
    [
      { dimensions: "ym:s:lastDirectPlatformType,ym:s:lastDirectClickOrderName" },
      { dimensions: "ym:s:lastDirectPlatformType" },
    ].map((v) => ({
      ...v,
      metrics: ["ym:s:visits", "ym:s:bounceRate", ...core].join(","),
      sort: "-ym:s:visits",
      limit: 100,
    })),
    common,
  );

  // Как долго люди смотрят: средняя длительность прячет распределение.
  await tryReport(
    "engagement.json",
    [
      { dimensions: "ym:s:visitDurationInterval" },
      { dimensions: "ym:s:pageViewsInterval" },
    ].map((v) => ({
      ...v,
      metrics: ["ym:s:visits", "ym:s:bounceRate", ...core].join(","),
      limit: 50,
    })),
    common,
  );

  /*
   * Деньги. Клики и расход лежат в отдельном пространстве имён (ym:ad:), и
   * доступ к нему Метрика открывает только вместе с логином рекламодателя:
   * без параметра direct_client_logins ответ — 403 direct_client_logins.
   */
  await tryReport(
    "direct-costs.json",
    [
      { dimensions: "ym:ad:lastDirectOrder", metrics: "ym:ad:clicks,ym:ad:RUBAdCost,ym:ad:visits" },
      { dimensions: "ym:ad:directOrder", metrics: "ym:ad:clicks,ym:ad:RUBAdCost,ym:ad:visits" },
      { dimensions: "ym:ad:lastsignDirectOrder", metrics: "ym:ad:clicks,ym:ad:RUBAdCost,ym:ad:visits" },
    ].map((v) => ({ ...v, sort: "-ym:ad:RUBAdCost", direct_client_logins: DIRECT_LOGIN })),
    { ids: COUNTER_ID, date1: DATE1, date2: DATE2, accuracy: "full", limit: 200 },
  );
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
        ...(DIRECT_LOGIN ? { "Client-Login": DIRECT_LOGIN } : {}),
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

  /*
   * Что из настроек доехало. Значения секретов не печатаем и не сохраняем —
   * только факт наличия и длину: этого хватает, чтобы отличить «переменную не
   * добавили» от «добавили, но доступа всё равно нет», и ровно этот вопрос
   * встаёт каждый раз, когда приходит 403.
   */
  await save("env-check.json", {
    YANDEX_TOKEN: YANDEX_TOKEN ? `есть, ${YANDEX_TOKEN.length} симв.` : "нет",
    METRIKA_TOKEN: METRIKA_TOKEN ? `есть, ${METRIKA_TOKEN.length} симв.` : "нет",
    DIRECT_TOKEN: DIRECT_TOKEN ? `есть, ${DIRECT_TOKEN.length} симв.` : "нет",
    DIRECT_LOGIN: DIRECT_LOGIN ? `есть, ${DIRECT_LOGIN.length} симв.` : "нет",
    COUNTER_ID,
    DAYS,
  });

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
      "Соответствие метрик `goalNNNreaches` целям — в `goals-legend.json`.",
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
