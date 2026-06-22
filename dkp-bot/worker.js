/**
 * ДКП-бот — отдельный Telegram-бот для оформления договора купли-продажи ТС.
 * Открывает Mini App, где пользователь загружает паспорт/СТС, проверяет
 * распознанные поля и получает готовый ДОГОВОР (DOCX + PDF) в чат.
 *
 * Секреты (Cloudflare → Worker → Variables and Secrets → Secret):
 *   TELEGRAM_BOT_TOKEN — токен бота (@BotFather)
 *   ANTHROPIC_API_KEY  — ключ Claude Vision (для авто-распознавания; опц.)
 * Публичные переменные ([vars] в wrangler.toml):
 *   MINI_APP_URL — адрес мини-аппа (страница на Cloudflare Pages)
 */

const enc = new TextEncoder();

/* ---------- Telegram API ---------- */
function tg(env, method, body) {
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Отправка файла из base64 как документа в чат.
async function sendDocument(env, chatId, filename, base64, caption) {
  const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const fd = new FormData();
  fd.append("chat_id", String(chatId));
  if (caption) fd.append("caption", caption);
  fd.append("document", new Blob([bin]), filename);
  return fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendDocument`, {
    method: "POST",
    body: fd,
  });
}

/* ---------- Auth: проверка Telegram initData ---------- */
async function hmac(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey(
    "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, msgBytes));
}
const toHex = (b) => [...b].map((x) => x.toString(16).padStart(2, "0")).join("");

async function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  params.delete("hash");
  const dcs = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await hmac(enc.encode("WebAppData"), enc.encode(botToken));
  if (toHex(await hmac(secret, enc.encode(dcs))) !== hash) return { ok: false };
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return { ok: false };
  let user = null;
  try { user = JSON.parse(params.get("user") || "null"); } catch { /* ignore */ }
  if (!user?.id) return { ok: false };
  return { ok: true, user };
}

/* ---------- CORS ---------- */
const cors = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status, headers: { "content-type": "application/json", ...cors },
  });

/* ---------- Claude Vision: распознавание паспорта / СТС ---------- */
const PROMPTS = {
  passport:
    "На изображении — разворот паспорта гражданина РФ. Извлеки данные и верни СТРОГО JSON " +
    "без пояснений с ключами: fio (ФИО полностью), birth (дата рождения ДД.ММ.ГГГГ), " +
    "birthplace (место рождения), pasp_series (серия, 4 цифры), pasp_number (номер, 6 цифр), " +
    "pasp_issued_by (кем выдан), pasp_issued_date (дата выдачи ДД.ММ.ГГГГ), pasp_code " +
    "(код подразделения), address (адрес регистрации, если виден, иначе пустая строка). " +
    "Если поле не читается — пустая строка.",
  org_card:
    "На изображении — карточка организации (реквизиты юрлица или ИП). Извлеки данные и верни " +
    "СТРОГО JSON без пояснений с ключами: org_name (полное или краткое наименование, напр. " +
    "ООО «...» или ИП Фамилия И.О.), ogrn (ОГРН или ОГРНИП), inn (ИНН), kpp (КПП; для ИП — " +
    "пустая строка), signer_role (должность подписанта в родительном падеже, напр. «директора»; " +
    "для ИП — пустая строка), signer_fio (ФИО руководителя или ИП), basis (на основании чего " +
    "действует: «Устава» для ООО или «свидетельства о государственной регистрации» для ИП), " +
    "address (юридический/почтовый адрес). Если поле не читается — пустая строка.",
  sts:
    "На изображении — свидетельство о регистрации ТС (СТС) РФ. Извлеки данные и верни СТРОГО " +
    "JSON без пояснений с ключами: car_brand (марка, модель), car_vin (VIN), car_type (тип ТС), " +
    "car_category (категория), car_year (год выпуска), car_engine (модель и № двигателя), " +
    "car_chassis (шасси/рама №), car_body (кузов №), car_color (цвет), car_power (мощность л.с.), " +
    "car_volume (рабочий объём, куб.см), car_plate (госномер), pts_series (серия ПТС), " +
    "pts_number (номер ПТС), sts_series (серия СТС), sts_number (номер СТС). " +
    "Если поле не читается — пустая строка.",
};

async function recognize(env, imageDataUrl, kind) {
  const m = /^data:(image\/\w+);base64,(.+)$/s.exec(imageDataUrl || "");
  if (!m) return { error: "bad_image" };
  const [, mediaType, data] = m;
  if (env.YANDEX_API_KEY) return recognizeYandex(env, mediaType, data, kind);
  if (env.ANTHROPIC_API_KEY) return recognizeAnthropic(env, mediaType, data, kind);
  return { error: "no_api_key" };
}

/* ---------- Yandex Vision OCR (модели под паспорт РФ и СТС) ---------- */
const YA_MODEL = {
  passport: "passport", sts: "vehicle-registration-front",
  sts_back: "vehicle-registration-back", pts: "page", org_card: "page", reg: "page",
};

// Один вызов OCR Яндекса с заданной моделью → { entities, fullText } или { error }.
async function yandexOcr(env, mediaType, data, model) {
  const headers = {
    "content-type": "application/json",
    Authorization: "Api-Key " + env.YANDEX_API_KEY,
  };
  if (env.YANDEX_FOLDER_ID) headers["x-folder-id"] = env.YANDEX_FOLDER_ID;
  const r = await fetch("https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText", {
    method: "POST",
    headers,
    body: JSON.stringify({ mimeType: mediaType, languageCodes: ["ru", "en"], model, content: data }),
  });
  if (!r.ok) return { error: "vision_failed", status: r.status, detail: (await r.text().catch(() => "")).slice(0, 300) };
  const raw = await r.text();
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch { try { parsed = JSON.parse(raw.split("\n").filter(Boolean)[0]); } catch { return { error: "parse_failed" }; } }
  const ann = parsed.result?.textAnnotation || {};
  return { entities: ann.entities || [], fullText: ann.fullText || "" };
}

async function recognizeYandex(env, mediaType, data, kind) {
  const res = await yandexOcr(env, mediaType, data, YA_MODEL[kind] || "page");
  if (res.error) return res;
  let { entities, fullText } = res;
  // Модели passport/sts не отдают сплошной текст — добираем page-OCR
  // для «кем выдан» (паспорт) и недостающих полей СТС (тип/категория/двигатель/кузов).
  if (kind === "passport" || kind === "sts" || kind === "sts_back") {
    const page = await yandexOcr(env, mediaType, data, "page");
    if (!page.error && page.fullText) fullText = page.fullText;
  }
  const fields = kind === "passport" ? mapPassport(entities, fullText)
    : (kind === "sts" || kind === "sts_back") ? mapSts(entities, fullText)
    : kind === "pts" ? mapPts(fullText)
    : kind === "reg" ? mapReg(fullText)
    : mapOrg(fullText);
  let _gender;
  if (kind === "passport") {
    const g = (entities.find((e) => (e.name || "").toLowerCase() === "gender")?.text || "").trim().toLowerCase();
    if (/^[мm]/.test(g)) _gender = "m"; else if (/^[жf]/.test(g)) _gender = "f";
  }
  return { fields, _gender };
}

// Карта сущностей по точному имени (lowercase) — Яндекс отдаёт name/surname/...
function entMap(entities) {
  const m = {};
  for (const e of entities) {
    const k = (e.name || "").toLowerCase();
    if (k && !(k in m)) m[k] = (e.text || "").trim();
  }
  return m;
}
const pick = (m, ...names) => { for (const n of names) if (m[n]) return m[n]; return ""; };
// «МОКИЕНКО иван» → «Мокиенко Иван»
const titleCase = (s) => s.toLowerCase().replace(/(^|[\s\-])([^\s\-])/g, (_, p, c) => p + c.toUpperCase());

function mapPassport(entities, fullText) {
  const m = entMap(entities);
  const last = pick(m, "surname", "last_name");
  const first = pick(m, "name", "first_name", "given_name");
  const middle = pick(m, "patronymic", "middle_name");
  const fio = titleCase([last, first, middle].filter(Boolean).join(" "));
  let series = "", number = "";
  const sn = (pick(m, "series_and_number", "number") || ((m.series || "") + (m.number || ""))).replace(/\D/g, "");
  if (sn.length >= 10) { series = sn.slice(0, 4); number = sn.slice(4, 10); }
  const f = {
    fio,
    birth: pick(m, "birth_date", "birthdate", "date_of_birth"),
    birthplace: titleCase(pick(m, "birth_place", "place_of_birth")),
    pasp_series: series,
    pasp_number: number,
    pasp_issued_by: pick(m, "issued_by", "issuing_authority", "authority"),
    pasp_issued_date: pick(m, "issue_date", "date_of_issue"),
    pasp_code: pick(m, "subdivision", "subdivision_code", "department_code", "division_code", "code"),
  };
  // Запасные разборы из общего текста.
  if (!f.pasp_series) {
    const mm = fullText.replace(/\s/g, "").match(/(\d{4})(\d{6})/);
    if (mm) { f.pasp_series = mm[1]; f.pasp_number = mm[2]; }
  }
  if (!f.pasp_code) {
    const c = fullText.match(/\b(\d{3})\s*-\s*(\d{3})\b/);
    if (c) f.pasp_code = c[1] + "-" + c[2];
  }
  // «Кем выдан»: модель паспорта это поле не возвращает — достаём из текста
  // (page-OCR). Сначала «выдан … <дата>», иначе по ключевым словам органа.
  if (!f.pasp_issued_by && fullText) {
    const t = fullText.replace(/\s+/g, " ");
    let by = "";
    const m1 = t.match(/выдан[аоы]?\.?\s+(.{6,90}?)\s*\d{2}[.\-]\d{2}[.\-]\d{4}/i);
    if (m1) by = m1[1];
    if (!by) {
      const m2 = t.match(/(?:ГУ\s?|У|О|ОУ|ТП\s?)?(?:МВД|УФМС|ФМС|ОВД|МИЛИЦИИ|ПОЛИЦИИ)[^|]{0,80}?(?:ОБЛ\w*|КРА\w*|РАЙОН\w*|ГОРОД\w*|Г\.?\s?[А-ЯЁ][а-яё]+|РЕСПУБЛИК\w*|АО\b)/i);
      if (m2) by = m2[0];
    }
    if (by) f.pasp_issued_by = by.replace(/^[\s.,№-]+|[\s.,]+$/g, "");
  }
  return f;
}
// Граница значения — перед следующей подписью (общая для СТС/ПТС).
const STOP_LABEL = "(?=\\s*(?:категори|кузов|шасси|рама|двигател|мощност|об[ъь][её]м|цвет|масса|эколог|год|vin|идентификац|регистрац|разрешен|изготов|марк|модел|сери|номер|особ|паспорт|наимен|тип|разреш)|$)";

// Дозаполняет недостающие поля ТС из сплошного текста СТС/ПТС (page-OCR).
function fillFromText(f, t) {
  const T = (t || "").replace(/\s+/g, " ");
  if (!T) return f;
  const grab = (re) => { const m = T.match(re); return m ? (m[1] || "").trim() : ""; };
  if (!f.car_vin) { const v = T.match(/\b[A-HJ-NPR-Z0-9]{17}\b/); if (v) f.car_vin = v[0]; }
  if (!f.car_brand) { const br = grab(new RegExp("марк[аи][,\\s]*(?:модел[ьи])?[\\s,]*(?:тс)?[\\s:№()]*([A-ZА-Я0-9][A-ZА-Я0-9 .\\-]{2,40}?)" + STOP_LABEL, "i")); if (br) f.car_brand = titleCase(br); }
  if (!f.car_year) { const y = T.match(/год[а-я ]*выпуска\D{0,8}((?:19|20)\d{2})/i) || T.match(/\b(19\d{2}|20\d{2})\b/); if (y) f.car_year = y[1] || y[0]; }
  if (!f.car_type) f.car_type = grab(new RegExp("тип\\s*тс[\\s:№]*([А-Яа-яЁё][А-Яа-яЁё \\-]{2,40}?)" + STOP_LABEL, "i"));
  if (!f.car_category) f.car_category = grab(/категори[ия]\s*(?:тс\s*)?[:№(]*\s*([ABCDEMАВСЕДМ]{1,2}\d?)\b/i);
  if (!f.car_color) f.car_color = grab(new RegExp("цвет[\\s:а-яё]*([А-Яа-яЁё][А-Яа-яЁё \\-]{2,30}?)" + STOP_LABEL, "i"));
  // Мощность: формат «кВт/л.с. 128/174» → берём л.с. (второе число).
  if (!f.car_power) { const mp = T.match(/мощност[ья][^0-9]{0,28}(\d{2,4})(?:\s*\/\s*(\d{2,4}))?/i); if (mp) f.car_power = mp[2] || mp[1]; }
  if (!f.car_volume) f.car_volume = grab(/(?:рабочий\s*)?об[ъь][её]м[^0-9]{0,16}(\d{3,5})/i);
  if (!f.car_engine) { const e = grab(/(?:модел[ьи][^.]{0,4})?двигател[ья][\s№:no.,]{0,10}([A-ZА-Я0-9][A-ZА-Я0-9 \-/]{3,24})/i); if (/\d{2,}/.test(e)) f.car_engine = e.trim(); }
  if (!f.car_body) { const b = grab(/кузов.{0,40}?(ОТСУТСТВУЕТ|[A-ZА-Я0-9]{6,22})/i); if (/\d{4,}/.test(b) || /ОТСУТ/i.test(b)) f.car_body = b.toUpperCase(); }
  if (!f.car_chassis) { const ch = grab(/(?:шасси|рама).{0,30}?(ОТСУТСТВУЕТ|[A-ZА-Я0-9]{6,22})/i); if (ch) f.car_chassis = ch.toUpperCase(); }
  if (!f.pts_issued) {
    // п.23 «Наименование организации, выдавшей паспорт» + п.25 «Дата выдачи паспорта».
    const iss = grab(/выдавш[а-яё]+\s+паспорт[\s:№.]*([А-ЯЁA-Z][^0-9]{4,80}?)(?=\s*(?:\d|адрес)|$)/i);
    const pd = (T.match(/дата\s+выдачи\s+паспорта[\s:№.]*(\d{2}\.\d{2}\.\d{4})/i) || [])[1] || "";
    const v = [iss.replace(/[,\s]+$/, ""), pd].filter(Boolean).join(", ");
    if (v) f.pts_issued = v;
  }
  if (!f.pts_series || !f.pts_number) {
    const p = T.match(/паспорт\s*тс\s*сери[яи]\s*(\d{2}\s?[А-ЯЁA-Z]{2})\s*№?\s*(\d{6})/i) || T.match(/\b(\d{2}\s?[А-ЯЁA-Z]{2})\s?№?\s?(\d{6})\b/);
    if (p) { f.pts_series = p[1].replace(/\s+/g, " ").trim(); f.pts_number = p[2]; }
  }
  return f;
}

// ПТС (паспорт ТС) — спец-модели у Яндекса нет, разбираем из общего текста.
function mapPts(t) {
  return fillFromText({}, t);
}
// Прописка (отдельное фото страницы регистрации) → адрес. OCR общий, чистим текст.
function mapReg(t) {
  let s = (t || "").replace(/\s+/g, " ").trim();
  s = s.replace(/место\s+жительства|зарегистрирован[аоы]?\s*(по\s+месту\s+жительства)?|отметк\w*\s+о\s+регистрации|снят[аоы]?\s+с\s+регистрационного\s+учёта|код подразделения|УФМС|ГУ\s?МВД|ОУФМС|России?|\b\d{2}[.\-]\d{2}[.\-]\d{4}\b/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  const i = s.search(/[А-ЯЁ]?\s*обл|г\.|город|край|респ|ул\.|улиц|пер\.|просп|д\.|кв\./i);
  if (i > 0) s = s.slice(i);
  return { address: s.slice(0, 200) };
}
// Универсальный разбор СТС (лицевая stsfront_* и оборот stsback_*) по подстрокам.
function mapSts(entities, fullText) {
  const m = entMap(entities);
  const keys = Object.keys(m);
  const find = (...subs) => { for (const k of keys) if (subs.some((s) => k.includes(s)) && m[k]) return m[k]; return ""; };
  const brand = find("car_brand", "_brand", "make");
  const model = find("car_model", "_model");
  const f = {
    car_brand: titleCase([brand, model].filter(Boolean).join(" ")),
    car_vin: find("vin").toUpperCase(),
    car_type: find("car_type", "vehicle_type"),
    car_category: find("category"),
    car_year: find("year"),
    car_engine: find("engine"),
    car_chassis: find("chassis").toUpperCase(),
    car_body: find("body").toUpperCase(),
    car_color: find("color", "colour"),
    car_plate: find("car_number", "license_plate", "registration_number", "gos_number").toUpperCase(),
    sts_series: "", sts_number: "", pts_series: "", pts_number: "",
  };
  const sn = find("sts_number").replace(/\D/g, "");
  if (sn.length >= 10) { f.sts_series = sn.slice(0, 4); f.sts_number = sn.slice(4); }
  else if (sn) f.sts_number = sn;
  const pn = find("pts_number").replace(/\D/g, "");
  if (pn.length >= 4) { f.pts_series = pn.slice(0, 4); f.pts_number = pn.slice(4); }
  // Недостающие поля — из сплошного текста СТС (page-OCR).
  return fillFromText(f, fullText);
}
function mapOrg(t) {
  const f = {};
  const ogrn = t.match(/\b\d{15}\b|\b\d{13}\b/);
  const inn = t.match(/\b\d{12}\b|\b\d{10}\b/);
  const kpp = (t.match(/КПП[^\d]{0,6}(\d{9})/i) || [])[1];
  if (ogrn) f.ogrn = ogrn[0];
  if (inn) f.inn = inn[0];
  if (kpp) f.kpp = kpp;
  const nm = t.split(/\n/).map((l) => l.trim()).find((l) => /(ООО|АО|ПАО|ОАО|ЗАО|ИП)\b/i.test(l));
  if (nm) f.org_name = nm;
  return f;
}

/* ---------- Anthropic Claude Vision (запасной вариант) ---------- */
async function recognizeAnthropic(env, mediaType, data, kind) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data } },
          { type: "text", text: PROMPTS[kind] || PROMPTS.passport },
        ],
      }],
    }),
  });
  if (!r.ok) return { error: "vision_failed", status: r.status };
  const out = await r.json();
  const text = (out.content || []).map((c) => c.text || "").join("");
  try {
    const jsonText = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
    return { fields: JSON.parse(jsonText) };
  } catch {
    return { error: "parse_failed", raw: text };
  }
}

/* ---------- Webhook (сообщения боту) ---------- */
async function handleUpdate(env, update) {
  const msg = update.message;
  if (!msg) return;
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();

  if (text === "/start" || text === "/dkp") {
    const url = env.MINI_APP_URL;
    await tg(env, "sendMessage", {
      chat_id: chatId,
      text:
        "🚗 *Оформление договора купли-продажи ТС*\n\n" +
        "Нажмите кнопку ниже, загрузите фото паспорта и СТС, проверьте данные — " +
        "и бот пришлёт готовый договор (DOCX + PDF).",
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [[{ text: "📝 Оформить ДКП", web_app: { url } }]],
      },
    });
    return;
  }

  await tg(env, "sendMessage", {
    chat_id: chatId,
    text: "Напишите /start, чтобы оформить договор.",
  });
}

/* ---------- Router ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // Разовая привязка вебхука: открыть в браузере после установки токена.
    if (url.pathname === "/setup") {
      if (!env.TELEGRAM_BOT_TOKEN)
        return new Response("Сначала задайте секрет TELEGRAM_BOT_TOKEN в воркере.", { status: 400 });
      const hook = `${url.origin}/webhook`;
      const r = await tg(env, "setWebhook", { url: hook });
      const out = await r.json().catch(() => ({}));
      return json({ setWebhook: hook, telegram: out });
    }

    // Telegram webhook
    if (url.pathname === "/webhook" && request.method === "POST") {
      const update = await request.json().catch(() => null);
      if (update) await handleUpdate(env, update);
      return new Response("ok");
    }

    // Распознавание паспорта/СТС
    if (url.pathname === "/api/recognize" && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const auth = await verifyInitData(b.initData, env.TELEGRAM_BOT_TOKEN);
      if (!auth.ok) return json({ error: "unauthorized" }, 401);
      const res = await recognize(env, b.image, b.kind);
      return json(res, res.error ? 422 : 200);
    }

    // Отправка готового договора в чат пользователю
    if (url.pathname === "/api/send" && request.method === "POST") {
      const b = await request.json().catch(() => ({}));
      const auth = await verifyInitData(b.initData, env.TELEGRAM_BOT_TOKEN);
      if (!auth.ok) return json({ error: "unauthorized" }, 401);
      const base = b.filename || "ДКП";
      if (b.docx_base64)
        await sendDocument(env, auth.user.id, `${base}.docx`, b.docx_base64, "📄 Договор (Word)");
      if (b.pdf_base64)
        await sendDocument(env, auth.user.id, `${base}.pdf`, b.pdf_base64, "📄 Договор (PDF)");
      return json({ ok: true });
    }

    // health
    if (url.pathname === "/") return new Response("dkp-bot ok");
    return new Response("not found", { status: 404 });
  },
};
