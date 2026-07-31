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
  mapButtonText: "📍 Мы на Яндекс Картах",
  mapUrl: "https://yandex.com/maps/-/CTAf5Lo-",
  map2gisButtonText: "🗺 Мы в 2ГИС",
  map2gisUrl: "https://2gis.ru/tver/firm/70000001110299440",
  // Авто-публикация постов канала прямо в каталог (без черновиков).
  // По умолчанию включена — это основной сценарий (полностью авто-обновление).
  autoPublish: true,
  // Chat id канала отзывов: посты оттуда идут в блок «Отзывы», а не в каталог.
  // Узнать id: опубликуйте пост в канале и посмотрите lastUpdate.chatId в /api/diag.
  reviewsChatId: "",
  // Chat id канала новостей: посты оттуда идут в раздел «Новости».
  newsChatId: "",
  // Chat id чата, куда падают заявки с сайта и из бота. Если пусто —
  // используется TELEGRAM_CHAT_ID из переменных Cloudflare.
  leadChatId: "",
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
  if (d.username) lines.push(`✈️ Telegram: ${d.username}`);
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

// Тумблеры прав. Владелец (env ADMIN_IDS) имеет все права.
// "admins" — право добавлять/удалять админов и менять их права.
const CAPS = ["catalog", "leads", "reviews", "subs", "stats", "bot", "broadcast", "admins"];

// Какое право нужно для действия. null = любому админу; "owner" = только владелец.
const NEED_CAP = {
  "me": null,
  "catalog.get": "catalog",
  "catalog.save": "catalog",
  "drafts.list": "catalog",
  "drafts.remove": "catalog",
  "drafts.update": "catalog",
  "settings.get": "bot",
  "settings.save": "bot",
  "faq.get": "bot",
  "faq.save": "bot",
  "leads.list": "leads",
  "subs.list": "subs",
  "reviews.list": "reviews",
  "reviews.save": "reviews",
  "reviews.remove": "reviews",
  "reviews.clear": "reviews",
  "stats.get": "stats",
  "broadcast.send": "broadcast",
  "admins.list": "admins",
  "admins.set": "admins",
  "admins.remove": "admins",
};

// Любой ли это админ (owner из env или запись в KV) — для гейта пересылки постов.
async function roleOf(env, userId) {
  const perm = await permsOf(env, userId);
  return perm ? (perm.owner ? "owner" : "admin") : null;
}

// Является ли пользователь администратором/создателем данного чата (Telegram).
// Нужно, чтобы в каталог публиковали только те, кто управляет каналом/группой,
// а не любой участник.
async function isChatAdmin(env, chatId, userId) {
  if (!chatId || !userId) return false;
  try {
    const r = await api(env, "getChatMember", { chat_id: chatId, user_id: userId });
    const j = await r.json();
    const s = j?.result?.status;
    return s === "creator" || s === "administrator";
  } catch {
    return false;
  }
}

// Права пользователя: { owner:bool, caps:Set<string> } или null.
async function permsOf(env, userId) {
  const owners = String(env.ADMIN_IDS || "")
    .split(/[,\s]+/)
    .filter(Boolean);
  if (owners.includes(String(userId)))
    return { owner: true, caps: new Set(CAPS) };
  const admins = (await kvGet(env, "admins", {})) || {};
  const rec = admins[String(userId)];
  if (!rec) return null;
  let caps = rec.caps;
  if (!Array.isArray(caps)) {
    // миграция со старых ролей на тумблеры
    if (rec.role === "admin") caps = CAPS.slice();
    else if (rec.role === "manager")
      caps = ["catalog", "leads", "reviews", "subs", "stats", "bot"];
    else caps = ["leads", "reviews"]; // бывший viewer
  }
  return { owner: false, caps: new Set(caps.filter((c) => CAPS.includes(c))) };
}

/* ---------- Маршруты ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });

    // --- Разовая привязка вебхука: открыть в браузере ---
    if (url.pathname === "/setup") {
      if (!env.TELEGRAM_BOT_TOKEN)
        return json({ error: "no TELEGRAM_BOT_TOKEN" }, 400);
      const hook = `${url.origin}/tg`;
      const r = await api(env, "setWebhook", {
        url: hook,
        allowed_updates: [
          "message",
          "edited_message",
          "channel_post",
          "edited_channel_post",
          "callback_query",
        ],
      });
      const out = await r.json().catch(() => ({}));
      return json({ setWebhook: hook, telegram: out });
    }

    // --- Telegram webhook ---
    if (url.pathname === "/tg" && request.method === "POST") {
      let upd;
      try {
        upd = await request.json();
      } catch {
        return new Response("ok");
      }
      // Диагностика: запоминаем краткую сводку последнего апдейта, чтобы через
      // /api/diag увидеть, что реально присылает Telegram (тип чата, фото и т.д.).
      try {
        const u =
          upd.channel_post ||
          upd.edited_channel_post ||
          upd.message ||
          upd.edited_message;
        if (u && env.STORE) {
          await env.STORE.put(
            "diag:last",
            JSON.stringify({
              ts: Date.now(),
              kind: upd.channel_post
                ? "channel_post"
                : upd.edited_channel_post
                  ? "edited_channel_post"
                  : upd.message
                    ? "message"
                    : "edited_message",
              chatType: u.chat?.type || null,
              chatId: u.chat?.id || null,
              chatTitle: u.chat?.title || null,
              hasPhoto: Array.isArray(u.photo) && u.photo.length > 0,
              hasCaptionOrText: !!(u.caption || u.text),
              forwarded: !!(u.forward_from_chat || u.forward_origin),
              mediaGroup: u.media_group_id || null,
            }),
          );
        }
      } catch {
        /* диагностика не должна ломать обработку */
      }
      // пост из канала → отзывы (если это канал отзывов) или каталог
      const post = upd.channel_post || upd.edited_channel_post;
      if (post) {
        const st = await getSettings(env);
        const cid = String(post.chat?.id);
        if (st.newsChatId && cid === String(st.newsChatId)) {
          await publishNewsFromPost(env, post, url.origin);
        } else if (st.reviewsChatId && cid === String(st.reviewsChatId)) {
          await publishReviewFromPost(env, post, url.origin);
        } else {
          await handleChannelPost(env, post, {
            auto: !!st.autoPublish,
            origin: url.origin,
          });
        }
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

      // Пост с фото в группе/супергруппе. Публикуем, если это ОРИГИНАЛ (набрали
      // прямо в группе) ИЛИ авто-пересылка поста из привязанного канала
      // (is_automatic_forward) — это тоже «свой» контент, а не чужой репост.
      // Ручные пересылки чужих постов пропускаем (их разбираем ниже как черновик).
      const chatType = msg?.chat?.type;
      const isAutoForward = !!msg?.is_automatic_forward;
      const isManualForward =
        (msg?.forward_from_chat || msg?.forward_origin) && !isAutoForward;
      if (
        msg &&
        (chatType === "group" || chatType === "supergroup") &&
        (bestFileId(msg) || videoFileId(msg)) &&
        !isManualForward
      ) {
        const st = await getSettings(env);
        if (st.autoPublish) {
          // Публикуем ТОЛЬКО доверенный контент, иначе любой участник группы
          // может залить что угодно в каталог:
          //  • авто-пересылка из привязанного канала (контролирует канал), либо
          //  • отправитель — админ бота (owner/admin из наших списков), либо
          //  • отправитель — админ/создатель самой группы.
          const trusted =
            isAutoForward ||
            (await roleOf(env, msg.from?.id)) ||
            (await isChatAdmin(env, msg.chat?.id, msg.from?.id));
          if (trusted) {
            const cid = String(msg.chat?.id);
            if (st.newsChatId && cid === String(st.newsChatId)) {
              await publishNewsFromPost(env, msg, url.origin);
            } else if (st.reviewsChatId && cid === String(st.reviewsChatId)) {
              await publishReviewFromPost(env, msg, url.origin);
            } else {
              await handleChannelPost(env, msg, { auto: true, origin: url.origin });
            }
          }
        }
        return new Response("ok");
      }

      // Импорт поста пересылкой/отправкой боту — ОТКЛЮЧЁН по требованию:
      // раньше пересланный боту пост создавал черновик/карточку. Больше не
      // обрабатываем — в каталог попадают только доверенные посты канала/группы.

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

      // Отзыв в личку боту от ВЛАДЕЛЬЦА: пересланный/отправленный пост с
      // фото/видео (или пересланный текст) автоматически публикуется в
      // «Отзывы» (сайт + бот). Только владелец (ADMIN_IDS) — чужие игнор.
      if (msg && msg.chat?.type === "private") {
        const perm = await permsOf(env, msg.from?.id);
        const hasMedia = bestFileId(msg) || videoFileId(msg);
        const isForward = !!(msg.forward_from_chat || msg.forward_origin);
        if (perm?.owner && (hasMedia || isForward)) {
          await publishReviewFromPost(env, msg, url.origin);
          if (!msg.media_group_id) {
            await api(env, "sendMessage", {
              chat_id: msg.chat.id,
              text: "✅ Отзыв опубликован на сайте и в боте.",
            });
          }
          return new Response("ok");
        }
      }

      // /id — узнать идентификатор текущего чата. Работает и в группах:
      // именно этот номер вписывается в админке как чат для заявок.
      // В группах с включённым режимом приватности Telegram отдаёт боту
      // только команды с упоминанием, поэтому принимаем и «/id@BotName».
      if (msg && typeof msg.text === "string" && /^\/id(@\w+)?\b/.test(msg.text.trim())) {
        await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text:
            `Идентификатор чата: \`${msg.chat.id}\`\n` +
            `Тип: ${msg.chat.type}` +
            (msg.chat.title ? `\nНазвание: ${msg.chat.title}` : ""),
          parse_mode: "Markdown",
        });
        return new Response("ok");
      }

      // Приветствие с каталогом — ТОЛЬКО в личке с ботом. В группах/каналах
      // бот на сообщения не отвечает (иначе спамит чат участникам).
      if (
        msg &&
        typeof msg.text === "string" &&
        msg.chat?.type === "private"
      ) {
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
        if (settings.map2gisUrl)
          rows.push([{ text: settings.map2gisButtonText, url: settings.map2gisUrl }]);
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
      const target = await leadChat(env);
      let ok;
      if (d.photo) {
        const r = await sendPhotoDataUrl(env, target, d.photo, caption);
        ok = r.ok;
        if (!ok) {
          const r2 = await api(env, "sendMessage", {
            chat_id: target,
            text: caption,
            parse_mode: "Markdown",
          });
          ok = r2.ok;
        }
      } else {
        const r = await api(env, "sendMessage", {
          chat_id: target,
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

    // --- Диагностика авто-публикации (без секретов) ---
    // Открыть в браузере: /api/diag — покажет, включена ли авто-публикация,
    // сколько авто в каталоге и слушает ли вебхук посты канала.
    if (url.pathname === "/api/diag" && request.method === "GET") {
      const st = await getSettings(env);
      const catalog = (await kvGet(env, "catalog", [])) || [];
      const drafts = (await kvGet(env, "drafts", [])) || [];
      let webhook = null;
      try {
        const r = await api(env, "getWebhookInfo", {});
        const d = await r.json();
        const w = d.result || {};
        webhook = {
          url: w.url || null,
          has_channel_post: Array.isArray(w.allowed_updates)
            ? w.allowed_updates.includes("channel_post")
            : "default(all)",
          allowed_updates: w.allowed_updates || "default(all)",
          pending_update_count: w.pending_update_count,
          last_error_message: w.last_error_message || null,
          last_error_date: w.last_error_date || null,
        };
      } catch (e) {
        webhook = { error: String(e) };
      }
      // Список поддерживаемых действий — по нему видно, какая версия воркера
      // реально задеплоена (например, есть ли уже reviews.clear).
      const actions = Object.keys(NEED_CAP);
      const lastUpdate = await kvGet(env, "diag:last", null);
      const tgCars = Array.isArray(catalog)
        ? catalog.filter((c) => String(c.id).startsWith("tg-"))
        : [];
      const sampleTgCar = tgCars[0]
        ? { id: tgCars[0].id, model: tgCars[0].model, images: tgCars[0].images }
        : null;
      return json({
        ok: true,
        autoPublish: !!st.autoPublish,
        hasBotToken: !!env.TELEGRAM_BOT_TOKEN,
        hasStore: !!env.STORE,
        catalogCount: Array.isArray(catalog) ? catalog.length : 0,
        autoCarsFromChannel: tgCars.length,
        draftsCount: Array.isArray(drafts) ? drafts.length : 0,
        sampleTgCar,
        webhook,
        actions,
        lastUpdate,
      });
    }

    // --- Сброс/очистка каталога (только владелец: ключ = токен бота) ---
    // /admin/catalog-reset?key=<TELEGRAM_BOT_TOKEN>        — очистить каталог
    // /admin/catalog-reset?key=<TELEGRAM_BOT_TOKEN>&keepTg=1 — оставить только
    //   авто, пришедшие из канала (id tg-*), удалить демо-карточки.
    if (url.pathname === "/admin/catalog-reset" && request.method === "GET") {
      if (!env.TELEGRAM_BOT_TOKEN || url.searchParams.get("key") !== env.TELEGRAM_BOT_TOKEN)
        return json({ ok: false, error: "forbidden" }, 403);
      const keepTg = url.searchParams.get("keepTg") === "1";
      if (keepTg) {
        const cur = (await kvGet(env, "catalog", [])) || [];
        const kept = Array.isArray(cur)
          ? cur.filter((c) => String(c.id).startsWith("tg-"))
          : [];
        await kvPut(env, "catalog", kept);
        return json({ ok: true, cleared: "demo", kept: kept.length });
      }
      await env.STORE.delete("catalog");
      return json({ ok: true, cleared: "all" });
    }

    // --- Оптимизация существующих карточек (owner: key = токен бота) ---
    // /admin/catalog-optimize?key=<TELEGRAM_BOT_TOKEN>
    // Пересобирает по имеющимся данным: описание, флаг новый/с пробегом,
    // дефолты пустых полей. Исходные посты не хранятся, поэтому марку/цвет,
    // которых не было при создании, восстановить нельзя — только нормализуем.
    if (url.pathname === "/admin/catalog-optimize" && request.method === "GET") {
      if (!env.TELEGRAM_BOT_TOKEN || url.searchParams.get("key") !== env.TELEGRAM_BOT_TOKEN)
        return json({ ok: false, error: "forbidden" }, 403);
      let catalog = (await kvGet(env, "catalog", [])) || [];
      if (!Array.isArray(catalog)) catalog = [];
      let changed = 0;
      for (const c of catalog) {
        const before = JSON.stringify(c);
        c.isNew = !(c.mileageKm > 0);
        if (!c.gearbox) c.gearbox = "АКПП";
        if (!c.fuelType) c.fuelType = "Бензин";
        if (!c.mileage)
          c.mileage = c.mileageKm > 0 ? `${c.mileageKm.toLocaleString("ru-RU")} км` : "Новый, 0 км";
        c.description = genDescriptionSrv(c);
        if (JSON.stringify(c) !== before) changed++;
      }
      await kvPut(env, "catalog", catalog);
      return json({ ok: true, total: catalog.length, changed });
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
        if (!j?.ok) {
          // Показываем причину прямо в теле — для диагностики «чёрных» фото.
          return new Response(
            `getFile failed: ${j?.error_code || "?"} ${j?.description || ""}`,
            { status: 404, headers: cors },
          );
        }
        const path = j?.result?.file_path;
        if (!path) return new Response("no file_path", { status: 404, headers: cors });
        const f = await fetch(
          `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${path}`,
        );
        if (!f.ok) {
          return new Response(`download failed: ${f.status}`, {
            status: 502,
            headers: cors,
          });
        }
        // Тип определяем по расширению file_path (Telegram часто отдаёт
        // octet-stream, из-за чего браузер скачивает файл, а не показывает).
        const ext = (path.split(".").pop() || "").toLowerCase();
        const byExt = {
          jpg: "image/jpeg",
          jpeg: "image/jpeg",
          png: "image/png",
          webp: "image/webp",
          gif: "image/gif",
        };
        return new Response(f.body, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": byExt[ext] || "image/jpeg",
            "Cache-Control": "public, max-age=604800",
          },
        });
      } catch (e) {
        return new Response(`error: ${String(e)}`, { status: 500, headers: cors });
      }
    }

    // --- Прокси видео из Telegram (лимит Bot API — файлы до 20 МБ) ---
    if (url.pathname === "/api/tgvideo" && request.method === "GET") {
      const id = url.searchParams.get("id");
      if (!id) return new Response("no id", { status: 400, headers: cors });
      try {
        const gf = await api(env, "getFile", { file_id: id });
        const j = await gf.json();
        if (!j?.ok) {
          // «file is too big» — видео больше 20 МБ, Bot API его не отдаёт.
          return new Response(
            `getFile failed: ${j?.error_code || "?"} ${j?.description || ""}`,
            { status: 404, headers: cors },
          );
        }
        const path = j?.result?.file_path;
        if (!path) return new Response("no file_path", { status: 404, headers: cors });
        const f = await fetch(
          `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${path}`,
        );
        if (!f.ok)
          return new Response(`download failed: ${f.status}`, { status: 502, headers: cors });
        const ext = (path.split(".").pop() || "").toLowerCase();
        const byExt = {
          mp4: "video/mp4",
          mov: "video/quicktime",
          webm: "video/webm",
          m4v: "video/mp4",
        };
        return new Response(f.body, {
          status: 200,
          headers: {
            ...cors,
            "Content-Type": byExt[ext] || "video/mp4",
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=604800",
          },
        });
      } catch (e) {
        return new Response(`error: ${String(e)}`, { status: 500, headers: cors });
      }
    }

    // --- Публичные отзывы / новости / FAQ ---
    if (url.pathname === "/api/reviews" && request.method === "GET") {
      return json({ ok: true, reviews: (await kvGet(env, "reviews", [])) || [] });
    }
    if (url.pathname === "/api/news" && request.method === "GET") {
      return json({ ok: true, news: (await kvGet(env, "news", [])) || [] });
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
      const perm = await permsOf(env, auth.user.id);
      if (!perm) return json({ ok: false, error: "forbidden" }, 403);

      if (!(action in NEED_CAP))
        return json({ ok: false, error: "unknown_action" }, 400);
      const req = NEED_CAP[action];
      if (req === "owner" && !perm.owner)
        return json({ ok: false, error: "no_permission" }, 403);
      if (req && req !== "owner" && !perm.owner && !perm.caps.has(req))
        return json({ ok: false, error: "no_permission" }, 403);

      return handleAdmin(env, action, payload, perm, auth.user);
    }

    return new Response("DiAvto69 worker is running", { headers: cors });
  },
};

/** Куда отправлять заявки: настройка из админки, иначе переменная окружения. */
async function leadChat(env) {
  const st = await getSettings(env);
  return String(st.leadChatId || "").trim() || env.TELEGRAM_CHAT_ID;
}

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
      username: d.username || "",
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
// Строки постов часто украшены эмодзи/символами (🔥, ▪️, «!!!!!!» и т.п.).
// Чистим их с краёв, чтобы не тянуть мусор в модель и характеристики.
function cleanLine(s) {
  return String(s || "")
    .replace(/^[\s\p{Extended_Pictographic}\p{So}\p{Sk}\p{P}]+/u, "")
    .replace(/[\s\p{Extended_Pictographic}\p{So}\p{Sk}]+$/u, "")
    .trim();
}
function hasLetters(s) {
  return /[a-zа-я]/i.test(s);
}
// Метки-ярлыки строк характеристик — такие строки не могут быть моделью.
const LABEL_RE =
  /^(цена|стоимость|price|год|year|двигатель|мотор|объ[её]м|мощность|пробег|mileage|коробк|кпп|акпп|мкпп|трансмисс|привод|drive|цвет|color|кузов|топлив|компле|таможн|растаможк|под\s*ключ|итог|наличи|заказ|в\s*пути)/i;
// Строки-заголовки объявления — тоже не модель («НОВЫЙ АВТОМОБИЛЬ!!!!» и т.п.).
const HEADER_RE =
  /^(нов(ый|ое|ая|инка)|прода|в\s*прода|распрода|поступил|в\s*наличии|в\s*продаже|в\s*пути|под\s*заказ|доступен|доступна|доступно|ожида|готов\s|прибыл|приедет|выкуплен|забронир|бронир|резерв|свободен|принима|заявк|срочно|торг|обмен|скидк|акци|выгодн|кредит|рассрочк|лизинг|успей|спешит|осталось|последний|эксклюзив|лучшая\s*цена|цена\s*дня|хит\b|автомобиль\b|авто\b|new\b|sale\b|продан)/i;

// Похоже ли на название модели: латиница (Kia Sportage, JETTA VS8) либо
// короткая строка без глаголов. Рекламные фразы вроде «ДОСТУПЕН К ЗАКАЗУ»
// длиннее и состоят из обычных слов, поэтому отсекаются.
function looksLikeModel(line) {
  const t = line.trim();
  if (t.length < 2 || t.length > 60) return false;
  if (/[.!?]$/.test(t)) return false; // законченное предложение — не модель
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  if (/[a-z]/i.test(t)) return true; // латиница — почти всегда марка/модель
  // Кириллическое название допускаем, если это одно-два слова без глагола.
  return words.length <= 2 && !/(ся|ть|ет|ют|ем|ли)$/i.test(words[0]);
}

// Начало подписи-футера поста: ссылки, адрес, «Забронировать», «Мы в …» —
// всё, что ниже такой строки, в описание авто не тянем.
const FOOTER_RE =
  /^(мы\s+в\s|ссылк|http|t\.me|www\.|@[a-zа-я]|забронир|бронир|наш\s+адрес|^адрес\s*[:—-]|тел[:.\s]|телефон|whats|instagram|insta\b|vk\.com|подпис|звони|наш\s+канал|наш\s+сайт|наш\s+telegram|записа|график\s+работ|режим\s+работ|г\.?\s*твер|ул\.?\s)/i;

function pickNumber(str) {
  const m = String(str).match(/\d[\d\s. ]*\d|\d/);
  return m ? Number(m[0].replace(/[^\d]/g, "")) : 0;
}

function parseCaption(text) {
  const raw = String(text || "");
  const lines = raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const clean = lines.map(cleanLine).filter(Boolean);

  // Отсекаем подпись-футер поста — всё, что ниже, в авто не тянем.
  const cutIdx = clean.findIndex((l) => FOOTER_RE.test(l));
  const body = cutIdx >= 0 ? clean.slice(0, cutIdx) : clean;
  const bodyRaw = body.join("\n");

  // Модель — первая осмысленная строка body: есть буквы, не характеристика,
  // не заголовок. «Kia Sportage 2021» оставляем, хвостовой год обрезаем.
  const candidates = body.filter(
    (l) => hasLetters(l) && !LABEL_RE.test(l) && !HEADER_RE.test(l) && l.length >= 2,
  );
  const stripYear = (l) =>
    l
      .replace(/\s*[—\-–,]?\s*(19|20)\d{2}\s*(г(од)?\.?|year)?\s*$/i, "")
      .replace(/[.,;:!]+$/, "")
      .trim();
  // Сначала ищем строку, похожую на название модели, и только потом берём
  // первую попавшуюся — иначе в модель попадали фразы вроде «Доступен к заказу».
  let model = "";
  for (const l of candidates) {
    if (!looksLikeModel(l)) continue;
    model = stripYear(l);
    if (model) break;
  }
  if (!model && candidates.length) model = stripYear(candidates[0]);
  if (!model) model = body.find((l) => hasLetters(l)) || "";

  // Год выпуска — сперва по метке «Год выпуска: 2026», иначе первое 19xx/20xx.
  const yearLabeled = bodyRaw.match(/год(?:\s*выпуска)?[:\s—-]*((?:19|20)\d{2})/i);
  const yearAny = bodyRaw.match(/\b(19|20)\d{2}\b/);
  const year = yearLabeled
    ? Number(yearLabeled[1])
    : yearAny
      ? Number(yearAny[0])
      : new Date().getFullYear();

  // Цена — различаем город (до Твери / до Москвы), иначе одна цена на всё.
  // Диапазон 100 000…99 999 999 отсекает телефоны (11 цифр) и мусор.
  const isPrice = (n) => n >= 100000 && n <= 99999999;
  // Цену в юанях игнорируем — берём только рублёвые «до Твери / до Москвы».
  const isYuan = (l) => /[¥￥元]|юан|yuan|cny|rmb/i.test(l);
  let price = 0;
  let priceTver = 0;
  let priceMoscow = 0;
  for (const l of body) {
    if (isYuan(l)) continue;
    const n = pickNumber(l);
    if (!isPrice(n)) continue;
    if (/твер/i.test(l)) priceTver = priceTver || n;
    else if (/москв/i.test(l)) priceMoscow = priceMoscow || n;
    else if (/цена|стоимост|price|₽|руб|под\s*ключ/i.test(l)) price = price || n;
  }
  // База цены — город (Тверь в приоритете), затем общая; юань сюда не попадёт.
  price = priceTver || priceMoscow || price;
  if (!price) {
    for (const l of body) {
      if (isYuan(l)) continue;
      const n = pickNumber(l);
      if (isPrice(n)) {
        price = n;
        break;
      }
    }
  }
  priceTver = priceTver || price;
  priceMoscow = priceMoscow || price;

  // Двигатель: объём (л) и мощность (л.с.)
  let engineCc = 0;
  let powerHp = 0;
  const volM = bodyRaw.match(/(\d(?:[.,]\d)?)\s*[лl](?![а-яa-z.])/i);
  if (volM) engineCc = Math.round(Number(volM[1].replace(",", ".")) * 1000);
  const ccM = bodyRaw.match(/(\d{3,4})\s*(?:куб|см³|cc)/i);
  if (!engineCc && ccM) engineCc = Number(ccM[1]);
  const hpM = bodyRaw.match(/(\d{2,4})\s*(?:л\.?\s*с\.?|hp|л\.с)/i);
  if (hpM) powerHp = Number(hpM[1]);

  // Пробег
  let mileageKm = 0;
  // Учитываем разделители тысяч (точка/пробел/запятая): «39.700 км» = 39700.
  const mileM = bodyRaw.match(/пробег[^\d]*([\d\s.,]+?)\s*(?:км|km|тыс)/i)
    || bodyRaw.match(/([\d][\d\s.,]{2,})\s*(?:км|km)\b/i);
  if (mileM) {
    mileageKm = Number(mileM[1].replace(/[^\d]/g, ""));
    if (/тыс/i.test(mileM[0])) mileageKm *= 1000;
  }

  // Коробка / привод / кузов / топливо
  const gearbox = /вариатор|cvt/i.test(bodyRaw) ? "Вариатор"
    : /робот|dsg|dct/i.test(bodyRaw) ? "Робот"
    : /механик|мкпп|manual/i.test(bodyRaw) ? "МКПП"
    : /автомат|акпп|a\/t|at\b/i.test(bodyRaw) ? "АКПП" : "";
  const driveRaw = `${raw}\n${bodyRaw}`;
  const drive = /полн(ый)?\s*привод|\bawd\b|\b4wd\b|4x4|4matic|quattro|xdrive|4motion|allrad|\bатт?esa\b/i.test(driveRaw)
    ? "Полный"
    : /задн(ий)?\s*привод|\brwd\b/i.test(driveRaw) ? "Задний"
    : /перед(ний)?\s*привод|\bfwd\b/i.test(driveRaw) ? "Передний" : "";
  const bodyTypeM = (bodyRaw.match(/седан|кроссовер|внедорожник|хэтчбек|хетчбек|универсал|купе|минивэн|пикап|лифтбек|кабриолет/i) || [""])[0];
  const fuelType = /гибрид|hybrid/i.test(bodyRaw) ? "Гибрид"
    : /электро|electric|ev\b/i.test(bodyRaw) ? "Электро"
    : /дизел/i.test(bodyRaw) ? "Дизель"
    : /бензин/i.test(bodyRaw) ? "Бензин" : "";

  // Руль: левый / правый (частая характеристика для авто из Японии).
  const steering = /руль[:\s—-]*прав|правый\s*руль|правостор|\brhd\b/i.test(bodyRaw) ? "Правый"
    : /руль[:\s—-]*лев|левый\s*руль|левостор|\blhd\b/i.test(bodyRaw) ? "Левый" : "";

  // Комплектация (trim) — по метке «Комплектация: …»
  const trimM = bodyRaw.match(/комплектац[а-яё]*\s*[:：—-]?\s*([^\n]+)/i);
  const trim = trimM ? cleanLine(trimM[1]).slice(0, 60) : "";

  // Цвет — по словарю (надёжнее меток): ищем цвет-слово в теле поста.
  const COLORS = [
    [/серебр|silver/i, "Серебристый"],
    [/бел(ый|ая|ое|о)|white|перлам/i, "Белый"],
    [/ч[ёе]рн|black/i, "Чёрный"],
    [/сер(ый|ая|ое|о[-\s]|\b)|gr[ae]y/i, "Серый"],
    [/син(ий|яя|ее|е)|blue/i, "Синий"],
    [/голуб/i, "Голубой"],
    [/красн|red/i, "Красный"],
    [/бордов|вишн|бургунд/i, "Бордовый"],
    [/зел[ёе]н|green/i, "Зелёный"],
    [/коричнев|шоколад|brown/i, "Коричневый"],
    [/беж|beige/i, "Бежевый"],
    [/золот|gold/i, "Золотистый"],
    [/ж[ёе]лт|yellow/i, "Жёлтый"],
    [/оранж|orange/i, "Оранжевый"],
    [/фиолет|пурпур|purple/i, "Фиолетовый"],
    [/розов|pink/i, "Розовый"],
  ];
  // Цвет берём ТОЛЬКО из строки с меткой «Цвет: …». Поиск по всему тексту
  // ошибался: «белый салон», «белые диски» или белый цвет в соседней фразе
  // приводили к неверному цвету кузова.
  let color = "";
  const colorLine = body.find((l) => /^\s*цвет|^\s*color\b/i.test(l));
  if (colorLine) {
    const rest = colorLine.replace(/^[^:：—-]*[:：—-]\s*/, "").trim();
    const src = rest || colorLine;
    for (const [re, label] of COLORS) {
      if (re.test(src)) { color = label; break; }
    }
    if (!color && rest && /^[а-яёa-z][а-яёa-z\s-]{2,29}$/i.test(rest)) {
      color = cleanLine(rest).slice(0, 40);
    }
  }

  // Страна — по всему тексту (в т.ч. подпись «из Китая»), иначе по марке.
  const byText = /коре|korea/i.test(raw) ? "kr"
    : /кита|china/i.test(raw) ? "cn"
    : /япон|japan/i.test(raw) ? "jp"
    : /европ|герман|\bес\b|\beu\b/i.test(raw) ? "eu" : null;
  const brand = (model.trim().split(/\s+/)[0] || "").toLowerCase();
  const BRAND_COUNTRY = {
    haval: "cn", geely: "cn", chery: "cn", changan: "cn", exeed: "cn", omoda: "cn",
    jaecoo: "cn", tank: "cn", gac: "cn", byd: "cn", zeekr: "cn", li: "cn", nio: "cn",
    jetour: "cn", voyah: "cn", hongqi: "cn", jac: "cn", faw: "cn", dongfeng: "cn",
    foton: "cn", baic: "cn", wey: "cn", xpeng: "cn", avatr: "cn", ora: "cn",
    roewe: "cn", mg: "cn", lynk: "cn", jetta: "cn", tharu: "cn", teramont: "cn",
    vw: "cn", volkswagen: "cn",
    hyundai: "kr", kia: "kr", genesis: "kr", ssangyong: "kr", daewoo: "kr",
    toyota: "jp", honda: "jp", nissan: "jp", mazda: "jp", mitsubishi: "jp",
    subaru: "jp", suzuki: "jp", lexus: "jp", infiniti: "jp", acura: "jp",
    bmw: "eu", mercedes: "eu", audi: "eu", porsche: "eu", volvo: "eu", skoda: "eu",
    peugeot: "eu", opel: "eu", mini: "eu", jaguar: "eu", bentley: "eu",
  };
  const country = byText || BRAND_COUNTRY[brand] || null;

  return {
    model,
    price,
    priceTver,
    priceMoscow,
    year,
    engineCc,
    powerHp,
    mileageKm,
    gearbox,
    drive,
    bodyType: bodyTypeM ? bodyTypeM[0].toUpperCase() + bodyTypeM.slice(1) : "",
    fuelType,
    steering,
    color,
    trim,
    country,
    // Буллеты-описание: строки тела без заголовка и без цены.
    highlights: body.filter(
      (l) => hasLetters(l) && !HEADER_RE.test(l) && !/цена|стоимость|price/i.test(l),
    ),
  };
}

// Лучший file_id из сообщения: крупнейшее фото ИЛИ изображение-документ
// (фото, отправленное «файлом» — без сжатия, в полном качестве).
function bestFileId(m) {
  if (Array.isArray(m?.photo) && m.photo.length)
    return m.photo[m.photo.length - 1].file_id;
  if (m?.document && /^image\//i.test(m.document.mime_type || ""))
    return m.document.file_id;
  return null;
}

// file_id видео из сообщения (обычное видео или документ с видео-mime).
function videoFileId(m) {
  if (m?.video?.file_id) return m.video.file_id;
  if (m?.document && /^video\//i.test(m.document.mime_type || ""))
    return m.document.file_id;
  return null;
}

function videoUrl(origin, fileId) {
  return `${origin}/api/tgvideo?id=${encodeURIComponent(fileId)}`;
}

function photoUrl(origin, fileId) {
  return `${origin}/api/tgphoto?id=${encodeURIComponent(fileId)}`;
}

// Связное описание из характеристик (серверная копия клиентского генератора).
// Описание НЕ повторяет характеристики: год, пробег, двигатель, коробка,
// привод, комплектация, цвет, топливо и преимущества уже выводятся отдельными
// блоками карточки. Здесь — только условия сделки.
const COUNTRY_FROM = { kr: "Кореи", cn: "Китая", jp: "Японии", eu: "Европы" };

function genDescriptionSrv(c) {
  const from = COUNTRY_FROM[c.country] ? ` из ${COUNTRY_FROM[c.country]}` : "";
  const seg = [
    `Привезём${from} под ключ: выкуп у проверенного поставщика, доставка, растаможка и оформление включены`,
    "Итоговая цена фиксируется в договоре — без скрытых наценок и доплат по факту",
  ];
  if (c.isNew || !c.mileageKm) {
    seg.push("Автомобиль новый, на учёте в РФ не стоял");
  } else {
    seg.push("Перед выкупом проверяем историю и состояние, присылаем фото- и видеоотчёт");
  }
  return seg.join(". ") + ".";
}

// Полная карточка авто из поста канала (с стабильным id для правок).
function carFromPost(p, id, images) {
  const price = p.price || 0;
  const mileageKm = p.mileageKm || 0;
  const eng =
    [
      p.engineCc ? `${(p.engineCc / 1000).toFixed(1).replace(".", ",")} л` : "",
      p.powerHp ? `${p.powerHp} л.с.` : "",
    ].filter(Boolean).join(" · ") || "—";
  const car = {
    id,
    model: p.model || "Авто из канала",
    year: p.year || new Date().getFullYear(),
    country: p.country || "kr",
    engine: eng,
    trim: p.trim || "",
    mileage: mileageKm > 0 ? `${mileageKm.toLocaleString("ru-RU")} км` : "Новый, 0 км",
    gearbox: p.gearbox || "АКПП",
    drive: p.drive || "",
    bodyType: p.bodyType || "",
    fuelType: p.fuelType || "Бензин",
    steering: p.steering || "",
    engineCc: p.engineCc || 0,
    powerHp: p.powerHp || 0,
    mileageKm,
    color: p.color || "",
    priceRub: price,
    priceTverRub: p.priceTver || price,
    priceMoscowRub: p.priceMoscow || price,
    status: "in_stock",
    isNew: !(mileageKm > 0),
    images,
    highlights: [],
  };
  car.description = genDescriptionSrv(car);
  return car;
}

// Является ли пост ОБЪЯВЛЕНИЕМ об авто, а не благодарностью/новостью/отчётом.
// В каталог публикуем только листинги: есть цена и/или набор характеристик.
function isCarListing(p, caption) {
  const hasPrice =
    (p.price || 0) > 0 || (p.priceTver || 0) > 0 || (p.priceMoscow || 0) > 0;
  const structured = [
    p.engineCc > 0,
    p.powerHp > 0,
    p.mileageKm > 0,
    !!p.trim,
    !!p.gearbox,
    !!p.drive,
    !!p.bodyType,
  ].filter(Boolean).length;
  // Явные НЕ-листинги (без цены): благодарности, отчёты «выкупили/проделанная».
  const nonListing =
    /спасибо|благодар|поздрав|проделанн|выполненн|выкупил|отзыв|довери|наш\s*клиент|с\s*праздник|поступлени|видеоотч|отчёт|отчет/i.test(
      String(caption || ""),
    );
  if (nonListing && !hasPrice) return false;
  return hasPrice || structured >= 2;
}

// Авто-публикация: пост канала → карточка в каталоге (upsert по стабильному id).
async function publishFromPost(env, post, caption, fileId, groupId, origin, videoId) {
  const srcId = "tg-" + (groupId || post.message_id);
  const url = fileId ? photoUrl(origin, fileId) : null;
  const vurl = videoId ? videoUrl(origin, videoId) : null;
  let catalog = (await kvGet(env, "catalog", [])) || [];
  if (!Array.isArray(catalog)) catalog = [];
  let car = catalog.find((c) => c.id === srcId);
  const isNewCar = !car;

  if (!car) {
    // Умное распознавание: создаём карточку только из реального объявления
    // об авто. Благодарности/новости/видеоотчёты в каталог не попадают.
    const parsed = parseCaption(caption);
    if (!isCarListing(parsed, caption)) return;
    car = carFromPost(parsed, srcId, url ? [url] : []);
    car.addedAt = Date.now(); // дата добавления в каталог
    catalog.unshift(car); // новые авто — в начало списка
  } else {
    if (url && !car.images.includes(url)) car.images.push(url);
    if (caption) {
      const imgs = car.images;
      const vid = car.video;
      Object.assign(car, carFromPost(parseCaption(caption), srcId, imgs));
      car.images = imgs;
      if (vid) car.video = vid;
    }
  }
  // Видео из поста (первое найденное) — прикрепляем к карточке.
  if (vurl && !car.video) car.video = vurl;
  await kvPut(env, "catalog", catalog);
  if (isNewCar && env.TELEGRAM_CHAT_ID) {
    await api(env, "sendMessage", {
      chat_id: env.TELEGRAM_CHAT_ID,
      text: `✅ Авто из канала опубликовано в каталог: ${car.model}${car.priceRub ? ` · ${car.priceRub.toLocaleString("ru-RU")} ₽` : ""}`,
    });
  }
}

// Пост из канала отзывов → карточка отзыва (текст + фото/видео) в KV reviews.
async function publishReviewFromPost(env, post, origin) {
  const text = (post.caption || post.text || "").trim();
  const fileId = bestFileId(post);
  const videoId = videoFileId(post);
  if (!text && !fileId && !videoId) return;
  const groupId = post.media_group_id || null;
  const srcId = "tg-" + (groupId || post.message_id);
  const media = fileId ? photoUrl(origin, fileId) : "";
  const video = videoId ? videoUrl(origin, videoId) : "";

  let reviews = (await kvGet(env, "reviews", [])) || [];
  if (!Array.isArray(reviews)) reviews = [];
  const ex = reviews.find((r) => r.id === srcId);
  if (ex) {
    // Альбом/правка: копим все фото и видео поста, а не только первые.
    if (text && !ex.text) ex.text = text;
    if (!Array.isArray(ex.images)) ex.images = ex.media ? [ex.media] : [];
    if (!Array.isArray(ex.videos)) ex.videos = ex.video ? [ex.video] : [];
    if (media && !ex.images.includes(media)) ex.images.push(media);
    if (video && !ex.videos.includes(video)) ex.videos.push(video);
    // media/video оставляем для совместимости со старыми клиентами.
    ex.media = ex.media || media;
    ex.video = ex.video || video;
  } else {
    reviews.unshift({
      id: srcId,
      name: post.author_signature || "Клиент ДиАвто69",
      text,
      rating: 5,
      media,
      video,
      images: media ? [media] : [],
      videos: video ? [video] : [],
      ts: Date.now(),
    });
  }
  await kvPut(env, "reviews", reviews.slice(0, 100));
}

// Пост из канала новостей → карточка новости (заголовок + текст + фото/видео).
async function publishNewsFromPost(env, post, origin) {
  const raw = (post.caption || post.text || "").trim();
  const fileId = bestFileId(post);
  const videoId = videoFileId(post);
  if (!raw && !fileId && !videoId) return;
  const groupId = post.media_group_id || null;
  const srcId = "tg-" + (groupId || post.message_id);
  const media = fileId ? photoUrl(origin, fileId) : "";
  const video = videoId ? videoUrl(origin, videoId) : "";
  // Заголовок — первая содержательная строка, текст — остальное.
  const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
  const title = (lines[0] || "Новость").slice(0, 120);
  const text = lines.slice(1).join("\n");

  let news = (await kvGet(env, "news", [])) || [];
  if (!Array.isArray(news)) news = [];
  const ex = news.find((n) => n.id === srcId);
  if (ex) {
    if (raw && !ex.text && !ex.title) {
      ex.title = title;
      ex.text = text;
    }
    if (media && !ex.media) ex.media = media;
    if (video && !ex.video) ex.video = video;
  } else {
    news.unshift({ id: srcId, title, text, media, video, ts: Date.now() });
  }
  await kvPut(env, "news", news.slice(0, 60));
}

async function handleChannelPost(env, post, opts = {}) {
  if (!env.STORE) return;
  const caption = (post.caption || post.text || "").trim();
  const fileId = bestFileId(post);
  const videoId = videoFileId(post);
  const groupId = post.media_group_id || null;
  if (!fileId && !videoId && !caption) return;

  // Полностью автоматический режим — сразу в каталог.
  if (opts.auto) {
    await publishFromPost(env, post, caption, fileId, groupId, opts.origin, videoId);
    return;
  }

  // Иначе — черновик для ручной проверки (прежнее поведение).
  const drafts = (await kvGet(env, "drafts", [])) || [];
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
async function handleAdmin(env, action, payload, perm, user) {
  switch (action) {
    case "me":
      return json({
        ok: true,
        owner: perm.owner,
        caps: CAPS.filter((c) => perm.caps.has(c)),
        user: { id: user.id, name: user.first_name },
      });

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
        "map2gisButtonText",
        "map2gisUrl",
        "miniAppUrl",
        "reviewsChatId",
        "newsChatId",
        "leadChatId",
      ];
      const next = { ...cur };
      for (const k of allowed)
        if (typeof payload?.[k] === "string") next[k] = payload[k];
      if (typeof payload?.autoPublish === "boolean")
        next.autoPublish = payload.autoPublish;
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

    case "reviews.clear": {
      await kvPut(env, "reviews", []);
      return json({ ok: true, reviews: [] });
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

    case "drafts.update": {
      // Редактирование фото черновика: порядок и удаление (payload.fileIds).
      if (!Array.isArray(payload?.fileIds))
        return json({ ok: false, error: "bad_payload" }, 400);
      const fileIds = payload.fileIds
        .filter((x) => typeof x === "string")
        .slice(0, 30);
      const list = (await kvGet(env, "drafts", [])) || [];
      const d = list.find((x) => x.id === payload?.id);
      if (!d) return json({ ok: false, error: "not_found" }, 404);
      d.fileIds = fileIds;
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
      const caps = Array.isArray(payload?.caps)
        ? payload.caps.filter((c) => CAPS.includes(c))
        : [];
      if (!/^\d+$/.test(id))
        return json({ ok: false, error: "bad_payload" }, 400);
      const admins = (await kvGet(env, "admins", {})) || {};
      const existed = !!admins[id];
      const name = payload?.name || admins[id]?.name || "";
      admins[id] = { caps, name, addedAt: admins[id]?.addedAt || Date.now() };
      await kvPut(env, "admins", admins);

      // Уведомление админу (только если он уже запускал бота).
      let notified = false;
      const CAP_LABEL = {
        catalog: "каталог",
        leads: "заявки",
        reviews: "отзывы",
        subs: "подписки",
        stats: "статистика",
        bot: "настройки бота",
        broadcast: "рассылка",
        admins: "управление админами",
      };
      try {
        const list = caps.map((c) => CAP_LABEL[c]).filter(Boolean).join(", ") || "—";
        const text = existed
          ? `🔧 Ваши права в админке *ДиАвто69* обновлены.\nДоступ: ${list}.`
          : `✅ Вам выдан доступ в админку *ДиАвто69*.\nДоступ: ${list}.\n\nОткройте мини-приложение бота и нажмите значок щита 🛡 в правом верхнем углу.`;
        const resp = await api(env, "sendMessage", {
          chat_id: id,
          text,
          parse_mode: "Markdown",
        });
        const jr = await resp.json().catch(() => ({}));
        notified = !!jr.ok;
      } catch {
        /* не доставлено — админ ещё не запускал бота */
      }
      return json({ ok: true, admins, notified });
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
