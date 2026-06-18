// Cloudflare Worker — бот + заявки + общий каталог + админка.
// Токен только в секретах воркера; вход в админку — по подписи Telegram initData.
//
// Переменные/секреты (Settings → Variables and Secrets):
//   TELEGRAM_BOT_TOKEN — токен бота (@BotFather)                 [Secret]
//   TELEGRAM_CHAT_ID   — куда падают заявки (@userinfobot)        [Secret]
//   MINI_APP_URL       — https://avto-korea.pages.dev/tma         [Text]
//   ADMIN_IDS          — Telegram id владельцев через запятую     [Text]
//                        (это роль owner: всё + выдача прав)
// Привязка (Settings → Bindings → KV Namespace):
//   STORE — KV namespace (общий каталог, настройки, админы, заявки)
//
// Маршруты:
//   POST /tg            — webhook Telegram
//   POST /lead          — заявки с сайта/мини-аппа
//   GET  /api/catalog   — публичный: общий каталог (Car[] | null)
//   POST /api/admin     — админ-API: { initData, action, payload }
//   GET  /              — статус

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, s = 200) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const DEFAULT_SETTINGS = {
  welcomeText:
    "🚗 *ДиАвто69* — авто из Кореи, Китая, Японии и ЕС под ключ.\nЧестный расчёт с растаможкой, без накруток.\n\nЖмите «Запустить бот» — каталог, калькулятор и заявка 👇",
  catalogButtonText: "🚀 Запустить бот",
  calcButtonText: "🧮 Калькулятор",
  quizButtonText: "🧩 Подбор по бюджету (5 вопросов)",
  managerButtonText: "💬 Написать менеджеру",
  managerUrl: "https://t.me/Dmitriicarexport",
  mapButtonText: "📍 Как к нам проехать?",
  mapUrl: "https://yandex.com/maps/-/CTAf5Lo-",
};

/* ---------- Telegram API ---------- */
function api(env, method, body) {
  return fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function leadText(d) {
  const lines = [
    "🚗 *Новая заявка — ДиАвто69*",
    "",
    `👤 Имя: ${d.name || "—"}`,
    `📞 Телефон: ${d.phone || "—"}`,
  ];
  if (d.car) lines.push(`🔎 Авто/бюджет: ${d.car}`);
  if (d.country) lines.push(`🌍 Страна: ${d.country}`);
  if (d.year) lines.push(`📅 Год: ${d.year}`);
  if (d.budget) lines.push(`💰 Бюджет: ${d.budget}`);
  if (d.link) lines.push(`🔗 Ссылка: ${d.link}`);
  if (d.comment) lines.push(`📝 Комментарий: ${d.comment}`);
  lines.push("", `📍 Источник: ${d.source || "сайт"}`);
  return lines.join("\n");
}

const DEFAULT_FAQ = [
  {
    q: "Сколько занимает доставка?",
    a: "В среднем 15–40 дней — зависит от страны и логистики. По конкретному авто срок подтвердит менеджер.",
  },
  {
    q: "Цена окончательная?",
    a: "Да, цена указана под ключ в РФ: авто, доставка, растаможка, утильсбор и ЭПТС. Без скрытых наценок.",
  },
  {
    q: "Есть ли проверка авто?",
    a: "Каждое авто проверяем перед выкупом. Историю и состояние присылаем до оплаты.",
  },
  {
    q: "Как происходит оплата?",
    a: "Поэтапно по договору. Детали под ваш случай расскажет менеджер.",
  },
];

/* ---------- Пользователи / статистика / фото ---------- */
// Возвращает true, если пользователь новый (записан впервые).
async function recordUser(env, from) {
  if (!env.STORE || !from?.id) return false;
  try {
    const users = (await kvGet(env, "users", {})) || {};
    if (!users[from.id]) {
      users[from.id] = {
        name: [from.first_name, from.last_name].filter(Boolean).join(" "),
        username: from.username || "",
        ts: Date.now(),
      };
      await kvPut(env, "users", users);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// Оповещение менеджеру о новом пользователе (нажал «Старт»).
async function notifyNewUser(env, from) {
  if (!env.TELEGRAM_CHAT_ID || !from?.id) return;
  const name =
    [from.first_name, from.last_name].filter(Boolean).join(" ") || "—";
  const uname = from.username ? `@${from.username}` : "без username";
  const lines = [
    "👋 *Новый пользователь запустил бота*",
    `👤 Имя: ${name}`,
    `🔗 Username: ${uname}`,
    `🆔 ID: ${from.id}`,
    `[Открыть профиль](tg://user?id=${from.id})`,
  ];
  await api(env, "sendMessage", {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: lines.join("\n"),
    parse_mode: "Markdown",
  });
}

async function bumpView(env, id) {
  if (!env.STORE) return;
  try {
    const stats = (await kvGet(env, "stats", {})) || {};
    stats.views = stats.views || {};
    stats.views[id] = (stats.views[id] || 0) + 1;
    stats.totalViews = (stats.totalViews || 0) + 1;
    await kvPut(env, "stats", stats);
  } catch {
    /* ignore */
  }
}

async function sendPhotoDataUrl(env, chatId, dataUrl, caption) {
  const m = /^data:(.+?);base64,(.*)$/s.exec(dataUrl || "");
  if (!m) return { ok: false };
  const bytes = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  const fd = new FormData();
  fd.append("chat_id", String(chatId));
  fd.append("caption", caption.slice(0, 1024));
  fd.append("parse_mode", "Markdown");
  fd.append("photo", new Blob([bytes], { type: m[1] || "image/jpeg" }), "photo.jpg");
  const r = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendPhoto`,
    { method: "POST", body: fd },
  );
  return { ok: r.ok };
}

/* ---------- KV helpers ---------- */
async function kvGet(env, key, fallback = null) {
  if (!env.STORE) return fallback;
  try {
    const v = await env.STORE.get(key, "json");
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
async function kvPut(env, key, value) {
  if (!env.STORE) throw new Error("kv_unavailable");
  await env.STORE.put(key, JSON.stringify(value));
}
async function getSettings(env) {
  const saved = (await kvGet(env, "settings", {})) || {};
  return { ...DEFAULT_SETTINGS, ...saved };
}
function miniAppUrl(env, settings) {
  return String(settings.miniAppUrl || env.MINI_APP_URL || "");
}

/* ---------- Auth: проверка Telegram initData ---------- */
const enc = new TextEncoder();
async function hmac(keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, msgBytes));
}
function toHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Возвращает { ok, user } если подпись валидна и свежая (< 24ч).
async function verifyInitData(initData, botToken) {
  if (!initData || !botToken) return { ok: false };
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };
  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData"), enc.encode(botToken));
  const computed = toHex(await hmac(secret, enc.encode(dataCheckString)));
  if (computed !== hash) return { ok: false };
  const authDate = Number(params.get("auth_date") || 0);
  if (authDate && Date.now() / 1000 - authDate > 86400) return { ok: false };
  let user = null;
  try {
    user = JSON.parse(params.get("user") || "null");
  } catch {
    /* ignore */
  }
  if (!user?.id) return { ok: false };
  return { ok: true, user };
}

// Роль пользователя: owner (env) > запись в KV admins > null.
async function roleOf(env, userId) {
  const owners = String(env.ADMIN_IDS || "")
    .split(/[,\s]+/)
    .filter(Boolean);
  if (owners.includes(String(userId))) return "owner";
  const admins = (await kvGet(env, "admins", {})) || {};
  return admins[String(userId)]?.role || null;
}

const RANK = { viewer: 1, manager: 2, owner: 3 };
const need = {
  "me": "viewer",
  "catalog.get": "viewer",
  "leads.list": "manager",
  "settings.get": "viewer",
  "catalog.save": "manager",
  "settings.save": "manager",
  "subs.list": "manager",
  "reviews.list": "viewer",
  "reviews.save": "manager",
  "reviews.remove": "manager",
  "faq.get": "viewer",
  "faq.save": "manager",
  "stats.get": "manager",
  "broadcast.send": "owner",
  "drafts.list": "manager",
  "drafts.remove": "manager",
  "admins.list": "owner",
  "admins.set": "owner",
  "admins.remove": "owner",
};

/* ---------- Маршруты ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });

    // --- Telegram webhook ---
    if (url.pathname === "/tg" && request.method === "POST") {
      let upd;
      try {
        upd = await request.json();
      } catch {
        return new Response("ok");
      }
      // пост из канала → черновик авто (для подтверждения в админке)
      const post = upd.channel_post || upd.edited_channel_post;
      if (post) {
        await handleChannelPost(env, post);
        return new Response("ok");
      }

      // нажатие inline-кнопки (например, «Калькулятор» — пока заглушка)
      const cq = upd.callback_query;
      if (cq) {
        await api(env, "answerCallbackQuery", { callback_query_id: cq.id });
        if (cq.data === "calc" && cq.message?.chat?.id) {
          await api(env, "sendMessage", {
            chat_id: cq.message.chat.id,
            text: "🧮 Калькулятор в разработке.\nПока оставьте заявку — рассчитаем стоимость под ключ вручную в течение 15 минут.",
          });
        }
        return new Response("ok");
      }

      const msg = upd.message || upd.edited_message;

      // заявка из мини-аппа (reply-кнопка)
      if (msg?.web_app_data?.data) {
        let d = {};
        try {
          d = JSON.parse(msg.web_app_data.data);
        } catch {
          /* ignore */
        }
        await storeLead(env, d);
        await api(env, "sendMessage", {
          chat_id: env.TELEGRAM_CHAT_ID,
          text: leadText(d),
          parse_mode: "Markdown",
        });
        await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text: "Спасибо! Заявка принята — перезвоним в течение 15 минут.",
        });
        return new Response("ok");
      }

      if (msg && typeof msg.text === "string") {
        const isNew = await recordUser(env, msg.from);
        if (isNew) await notifyNewUser(env, msg.from);
        const settings = await getSettings(env);
        const appUrl = miniAppUrl(env, settings);
        const openBtn = /^https:\/\//.test(appUrl)
          ? { text: settings.catalogButtonText, web_app: { url: appUrl } }
          : {
              text: settings.catalogButtonText,
              url: "https://avto-korea.pages.dev/catalog",
            };
        const rows = [[openBtn]];
        if (/^https:\/\//.test(appUrl)) {
          const quizUrl = appUrl + (appUrl.includes("?") ? "&" : "?") + "screen=quiz";
          rows.push([{ text: settings.quizButtonText, web_app: { url: quizUrl } }]);
        }
        rows.push([{ text: settings.managerButtonText, url: settings.managerUrl }]);
        if (settings.mapUrl)
          rows.push([{ text: settings.mapButtonText, url: settings.mapUrl }]);
        const r = await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text: settings.welcomeText,
          parse_mode: "Markdown",
          reply_markup: { inline_keyboard: rows },
        });
        if (!r.ok) {
          await api(env, "sendMessage", {
            chat_id: msg.chat.id,
            text: "🚗 ДиАвто69 — авто из Кореи, Китая, Японии и ЕС под ключ.\nКаталог: https://avto-korea.pages.dev/catalog",
          });
        }
      }
      return new Response("ok");
    }

    // --- Приём заявок с сайта/мини-аппа ---
    if (url.pathname === "/lead" && request.method === "POST") {
      let d;
      try {
        d = await request.json();
      } catch {
        return json({ ok: false, error: "bad_json" }, 400);
      }
      if (String(d.phone || "").replace(/\D/g, "").length < 10)
        return json({ ok: false, error: "phone_required" }, 422);
      await storeLead(env, d);
      const caption = leadText(d);
      let ok;
      if (d.photo) {
        const r = await sendPhotoDataUrl(env, env.TELEGRAM_CHAT_ID, d.photo, caption);
        ok = r.ok;
        if (!ok) {
          const r2 = await api(env, "sendMessage", {
            chat_id: env.TELEGRAM_CHAT_ID,
            text: caption,
            parse_mode: "Markdown",
          });
          ok = r2.ok;
        }
      } else {
        const r = await api(env, "sendMessage", {
          chat_id: env.TELEGRAM_CHAT_ID,
          text: caption,
          parse_mode: "Markdown",
        });
        ok = r.ok;
      }
      return json({ ok }, ok ? 200 : 502);
    }

    // --- Публичный общий каталог ---
    if (url.pathname === "/api/catalog" && request.method === "GET") {
      const catalog = await kvGet(env, "catalog", null);
      return json({ ok: true, catalog });
    }

    // --- Курс валют ЦБ РФ (для калькулятора) ---
    if (url.pathname === "/api/rates" && request.method === "GET") {
      try {
        const r = await fetch("https://www.cbr-xml-daily.ru/daily_json.js", {
          cf: { cacheTtl: 3600, cacheEverything: true },
        });
        const d = await r.json();
        const v = d.Valute || {};
        const norm = (c) => (c ? c.Value / (c.Nominal || 1) : null);
        return json({
          ok: true,
          date: d.Date || null,
          rates: {
            eur: norm(v.EUR),
            usd: norm(v.USD),
            krw: norm(v.KRW),
            cny: norm(v.CNY),
            jpy: norm(v.JPY),
          },
        });
      } catch {
        return json({ ok: false }, 502);
      }
    }

    // --- Прокси фото из Telegram (токен остаётся на сервере) ---
    if (url.pathname === "/api/tgphoto" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("no id", { status: 400, headers: cors });
      try {
        const gf = await api(env, "getFile", { file_id: id });
        const j = await gf.json();
        const path = j?.result?.file_path;
        if (!path) return new Response("not found", { status: 404, headers: cors });
        const f = await fetch(
          `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${path}`,
        );
        return new Response(f.body, {
          status: f.status,
          headers: {
            ...cors,
            "Content-Type": f.headers.get("content-type") || "image/jpeg",
            "Cache-Control": "public, max-age=604800",
          },
        });
      } catch {
        return new Response("error", { status: 500, headers: cors });
      }
    }

    // --- Публичные отзывы / FAQ ---
    if (url.pathname === "/api/reviews" && request.method === "GET") {
      return json({ ok: true, reviews: (await kvGet(env, "reviews", [])) || [] });
    }
    if (url.pathname === "/api/faq" && request.method === "GET") {
      return json({ ok: true, faq: (await kvGet(env, "faq", DEFAULT_FAQ)) || DEFAULT_FAQ });
    }

    // --- Счётчик просмотров авто ---
    if (url.pathname === "/api/view" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ ok: false }, 400);
      }
      if (b?.id) await bumpView(env, String(b.id));
      return json({ ok: true });
    }

    // --- Учёт добавления в избранное (популярность) ---
    if (url.pathname === "/api/fav" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ ok: false }, 400);
      }
      if (b?.id && b?.on && env.STORE) {
        try {
          const stats = (await kvGet(env, "stats", {})) || {};
          stats.favs = stats.favs || {};
          stats.favs[String(b.id)] = (stats.favs[String(b.id)] || 0) + 1;
          await kvPut(env, "stats", stats);
        } catch {
          /* ignore */
        }
      }
      return json({ ok: true });
    }

    // --- Регистрация пользователя мини-аппа (для рассылок/статистики) ---
    if (url.pathname === "/api/ping" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ ok: false }, 400);
      }
      const auth = await verifyInitData(b?.initData, env.TELEGRAM_BOT_TOKEN);
      if (auth.ok) await recordUser(env, auth.user);
      return json({ ok: true });
    }

    // --- Подписка на подбор (любой Telegram-пользователь) ---
    if (url.pathname === "/api/subscribe" && request.method === "POST") {
      let b;
      try {
        b = await request.json();
      } catch {
        return json({ ok: false, error: "bad_json" }, 400);
      }
      const auth = await verifyInitData(b?.initData, env.TELEGRAM_BOT_TOKEN);
      if (!auth.ok) return json({ ok: false, error: "unauthorized" }, 401);
      await recordUser(env, auth.user);
      const subs = (await kvGet(env, "subs", [])) || [];
      const p = b.params || {};
      subs.unshift({
        userId: auth.user.id,
        name: auth.user.first_name || "",
        params: p,
        ts: Date.now(),
      });
      await kvPut(env, "subs", subs.slice(0, 200));
      await api(env, "sendMessage", {
        chat_id: env.TELEGRAM_CHAT_ID,
        parse_mode: "Markdown",
        text: `🔔 *Новая подписка на подбор*\n👤 ${auth.user.first_name || "—"} (id ${auth.user.id})\n🌍 Страна: ${p.country || "любая"}\n🚙 Кузов: ${p.body || "любой"}\n💰 Бюджет до: ${p.budget ? p.budget + " ₽" : "—"}`,
      });
      await api(env, "sendMessage", {
        chat_id: auth.user.id,
        text: "🔔 Подписка оформлена! Сообщим, как только появится подходящее авто.",
      });
      return json({ ok: true });
    }

    // --- Админ-API ---
    if (url.pathname === "/api/admin" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "bad_json" }, 400);
      }
      const { initData, action, payload } = body || {};
      const auth = await verifyInitData(initData, env.TELEGRAM_BOT_TOKEN);
      if (!auth.ok) return json({ ok: false, error: "unauthorized" }, 401);
      const role = await roleOf(env, auth.user.id);
      if (!role) return json({ ok: false, error: "forbidden" }, 403);

      const required = need[action];
      if (!required) return json({ ok: false, error: "unknown_action" }, 400);
      if (RANK[role] < RANK[required])
        return json({ ok: false, error: "no_permission" }, 403);

      return handleAdmin(env, action, payload, role, auth.user);
    }

    return new Response("DiAvto69 worker is running", { headers: cors });
  },
};

/* ---------- Заявки в KV (последние 50) ---------- */
async function storeLead(env, d) {
  if (!env.STORE) return;
  try {
    const [leads, stats] = await Promise.all([
      kvGet(env, "leads", []),
      kvGet(env, "stats", {}),
    ]);
    leads.unshift({
      name: d.name || "",
      phone: d.phone || "",
      car: d.car || "",
      source: d.source || "сайт",
      ts: Date.now(),
    });
    // дневной счётчик заявок (для графика)
    stats.daily = stats.daily || {};
    const day = new Date().toISOString().slice(0, 10);
    stats.daily[day] = (stats.daily[day] || 0) + 1;
    await Promise.all([
      kvPut(env, "leads", leads.slice(0, 50)),
      kvPut(env, "stats", stats),
    ]);
  } catch {
    /* ignore */
  }
}

/* ---------- Черновики из канала ---------- */
function parseCaption(text) {
  const lines = String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const model = lines[0] || "";
  const nums = (String(text).match(/\d[\d\s.]*\d|\d/g) || [])
    .map((s) => Number(s.replace(/[^\d]/g, "")))
    .filter(Boolean);
  const price = nums.find((n) => n >= 100000) || 0;
  const yearM = String(text).match(/\b(19|20)\d{2}\b/);
  const year = yearM ? Number(yearM[0]) : new Date().getFullYear();
  return { model, price, year, highlights: lines };
}

async function handleChannelPost(env, post) {
  if (!env.STORE) return;
  const caption = (post.caption || post.text || "").trim();
  const fileId =
    Array.isArray(post.photo) && post.photo.length
      ? post.photo[post.photo.length - 1].file_id
      : null;
  const groupId = post.media_group_id || null;
  const drafts = (await kvGet(env, "drafts", [])) || [];

  // альбом: добавляем фото к уже созданному черновику той же группы
  if (groupId) {
    const ex = drafts.find((d) => d.groupId === groupId);
    if (ex) {
      if (fileId && !ex.fileIds.includes(fileId)) ex.fileIds.push(fileId);
      if (caption && !ex.caption) {
        ex.caption = caption;
        ex.parsed = parseCaption(caption);
      }
      await kvPut(env, "drafts", drafts);
      return;
    }
  }

  if (!fileId && !caption) return;
  drafts.unshift({
    id: "d" + Date.now() + Math.random().toString(36).slice(2, 6),
    groupId,
    caption,
    fileIds: fileId ? [fileId] : [],
    parsed: parseCaption(caption),
    ts: Date.now(),
  });
  await kvPut(env, "drafts", drafts.slice(0, 50));
  await api(env, "sendMessage", {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: "🆕 Новый черновик авто из канала — проверьте в админке → «Черновики».",
  });
}

/* ---------- Обработчики админ-действий ---------- */
async function handleAdmin(env, action, payload, role, user) {
  switch (action) {
    case "me":
      return json({ ok: true, role, user: { id: user.id, name: user.first_name } });

    case "catalog.get":
      return json({ ok: true, catalog: await kvGet(env, "catalog", null) });

    case "catalog.save": {
      if (!Array.isArray(payload))
        return json({ ok: false, error: "bad_payload" }, 400);
      await kvPut(env, "catalog", payload);
      return json({ ok: true, count: payload.length });
    }

    case "settings.get":
      return json({ ok: true, settings: await getSettings(env) });

    case "settings.save": {
      const cur = await getSettings(env);
      const allowed = [
        "welcomeText",
        "catalogButtonText",
        "calcButtonText",
        "quizButtonText",
        "managerButtonText",
        "managerUrl",
        "mapButtonText",
        "mapUrl",
        "miniAppUrl",
      ];
      const next = { ...cur };
      for (const k of allowed)
        if (typeof payload?.[k] === "string") next[k] = payload[k];
      await kvPut(env, "settings", next);
      return json({ ok: true, settings: next });
    }

    case "leads.list":
      return json({ ok: true, leads: (await kvGet(env, "leads", [])) || [] });

    case "subs.list":
      return json({ ok: true, subs: (await kvGet(env, "subs", [])) || [] });

    case "reviews.list":
      return json({ ok: true, reviews: (await kvGet(env, "reviews", [])) || [] });

    case "reviews.save": {
      const list = (await kvGet(env, "reviews", [])) || [];
      const rev = {
        id: payload?.id || "r" + Date.now(),
        name: String(payload?.name || "").slice(0, 80),
        text: String(payload?.text || "").slice(0, 1000),
        car: String(payload?.car || "").slice(0, 120),
        rating: Math.max(1, Math.min(5, Number(payload?.rating) || 5)),
        ts: payload?.ts || Date.now(),
      };
      const idx = list.findIndex((x) => x.id === rev.id);
      if (idx >= 0) list[idx] = rev;
      else list.unshift(rev);
      await kvPut(env, "reviews", list);
      return json({ ok: true, reviews: list });
    }

    case "reviews.remove": {
      const list = ((await kvGet(env, "reviews", [])) || []).filter(
        (x) => x.id !== payload?.id,
      );
      await kvPut(env, "reviews", list);
      return json({ ok: true, reviews: list });
    }

    case "faq.get":
      return json({ ok: true, faq: (await kvGet(env, "faq", DEFAULT_FAQ)) || DEFAULT_FAQ });

    case "faq.save": {
      if (!Array.isArray(payload))
        return json({ ok: false, error: "bad_payload" }, 400);
      const faq = payload
        .map((x) => ({
          q: String(x.q || "").slice(0, 200),
          a: String(x.a || "").slice(0, 1000),
        }))
        .filter((x) => x.q);
      await kvPut(env, "faq", faq);
      return json({ ok: true, faq });
    }

    case "stats.get": {
      // параллельное чтение KV — один round-trip вместо шести
      const [leads, users, subs, reviews, drafts, stats] = await Promise.all([
        kvGet(env, "leads", []),
        kvGet(env, "users", {}),
        kvGet(env, "subs", []),
        kvGet(env, "reviews", []),
        kvGet(env, "drafts", []),
        kvGet(env, "stats", {}),
      ]);
      const now = Date.now();
      const DAY = 86400000;
      const bySource = {};
      for (const l of leads) {
        const s = l.source || "сайт";
        bySource[s] = (bySource[s] || 0) + 1;
      }
      const daily = [];
      for (let i = 13; i >= 0; i--) {
        const key = new Date(now - i * DAY).toISOString().slice(0, 10);
        daily.push({ date: key, count: (stats.daily || {})[key] || 0 });
      }
      return json({
        ok: true,
        stats: {
          leads: leads.length,
          users: Object.keys(users).length,
          subs: subs.length,
          reviews: reviews.length,
          drafts: drafts.length,
          totalViews: stats.totalViews || 0,
          views: stats.views || {},
          favs: stats.favs || {},
          daily,
          leadsToday: leads.filter((l) => now - (l.ts || 0) < DAY).length,
          leads7d: leads.filter((l) => now - (l.ts || 0) < 7 * DAY).length,
          usersNew7d: Object.values(users).filter(
            (u) => now - (u.ts || 0) < 7 * DAY,
          ).length,
          bySource,
          lastLeadTs: leads[0]?.ts || null,
        },
      });
    }

    case "drafts.list":
      return json({ ok: true, drafts: (await kvGet(env, "drafts", [])) || [] });

    case "drafts.remove": {
      const list = ((await kvGet(env, "drafts", [])) || []).filter(
        (d) => d.id !== payload?.id,
      );
      await kvPut(env, "drafts", list);
      return json({ ok: true, drafts: list });
    }

    case "broadcast.send": {
      const text = String(payload?.text || "").trim();
      if (!text) return json({ ok: false, error: "empty" }, 400);
      const users = (await kvGet(env, "users", {})) || {};
      const ids = Object.keys(users);
      let sent = 0;
      for (const id of ids) {
        try {
          const r = await api(env, "sendMessage", { chat_id: id, text });
          if (r.ok) sent++;
        } catch {
          /* ignore */
        }
      }
      return json({ ok: true, sent, total: ids.length });
    }

    case "admins.list": {
      const admins = (await kvGet(env, "admins", {})) || {};
      const owners = String(env.ADMIN_IDS || "")
        .split(/[,\s]+/)
        .filter(Boolean);
      return json({ ok: true, admins, owners });
    }

    case "admins.set": {
      const id = String(payload?.id || "").trim();
      const r = payload?.role;
      if (!/^\d+$/.test(id) || (r !== "manager" && r !== "viewer"))
        return json({ ok: false, error: "bad_payload" }, 400);
      const admins = (await kvGet(env, "admins", {})) || {};
      admins[id] = { role: r, name: payload?.name || "", addedAt: Date.now() };
      await kvPut(env, "admins", admins);
      return json({ ok: true, admins });
    }

    case "admins.remove": {
      const id = String(payload?.id || "").trim();
      const admins = (await kvGet(env, "admins", {})) || {};
      delete admins[id];
      await kvPut(env, "admins", admins);
      return json({ ok: true, admins });
    }

    default:
      return json({ ok: false, error: "unknown_action" }, 400);
  }
}
