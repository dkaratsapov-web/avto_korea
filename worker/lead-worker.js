// Cloudflare Worker — «мозги» бота + приём заявок (один воркер на всё).
// Токен только в секретах воркера, в коде сайта его нет.
//
// Секреты/переменные (wrangler secret put ... или дашборд → Variables):
//   TELEGRAM_BOT_TOKEN — токен бота (@BotFather)
//   TELEGRAM_CHAT_ID   — id чата менеджера, куда падают заявки (@userinfobot)
//   MINI_APP_URL       — адрес мини-аппа, напр. https://авто-из-кореи-под-ключ.рф/tma
//
// Маршруты:
//   POST /tg    — webhook Telegram (ответы бота, приём web_app_data)
//   POST /lead  — приём заявок с сайта/мини-аппа → сообщение менеджеру
//
// Подключение (один раз), подставь свой токен и адрес воркера:
//   setWebhook:
//     https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<worker>.workers.dev/tg
//   (опц.) постоянная кнопка-меню «Каталог»:
//     https://api.telegram.org/bot<TOKEN>/setChatMenuButton
//       ?menu_button={"type":"web_app","text":"Каталог","web_app":{"url":"<MINI_APP_URL>"}}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, s) =>
  new Response(JSON.stringify(o), {
    status: s,
    headers: { ...cors, "Content-Type": "application/json" },
  });

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
  lines.push("", `📍 Источник: ${d.source || "сайт"}`);
  return lines.join("\n");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // --- Telegram webhook ---
    if (url.pathname === "/tg" && request.method === "POST") {
      let upd;
      try {
        upd = await request.json();
      } catch {
        return new Response("ok");
      }
      const msg = upd.message || upd.edited_message;

      // заявка из мини-аппа (если открыт из reply-кнопки)
      if (msg?.web_app_data?.data) {
        let d = {};
        try {
          d = JSON.parse(msg.web_app_data.data);
        } catch {
          /* ignore */
        }
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

      // любое сообщение/команда → приветствие с кнопкой открыть каталог
      if (msg && typeof msg.text === "string") {
        // web_app-кнопку показываем только при валидном https-URL мини-аппа,
        // иначе Telegram отклонит всё сообщение и бот «промолчит».
        const appUrl = String(env.MINI_APP_URL || "");
        const openBtn = /^https:\/\//.test(appUrl)
          ? { text: "🚘 Открыть каталог", web_app: { url: appUrl } }
          : { text: "🚘 Открыть каталог", url: "https://авто-из-кореи-под-ключ.рф/catalog" };
        const r = await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text: "🚗 *ДиАвто69* — авто из Кореи, Китая, Японии и ЕС под ключ.\nЧестный расчёт с растаможкой, без накруток.\n\nОткройте каталог и оставьте заявку 👇",
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [openBtn],
              [{ text: "💬 Написать менеджеру", url: "https://t.me/Dmitriicarexport" }],
            ],
          },
        });
        // если Telegram отклонил сообщение (напр. невалидный URL кнопки) —
        // шлём простой текст без разметки, чтобы бот ответил в любом случае.
        if (!r.ok) {
          await api(env, "sendMessage", {
            chat_id: msg.chat.id,
            text: "🚗 ДиАвто69 — авто из Кореи, Китая, Японии и ЕС под ключ.\nКаталог: https://авто-из-кореи-под-ключ.рф/catalog\nМенеджер: https://t.me/Dmitriicarexport",
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
      const r = await api(env, "sendMessage", {
        chat_id: env.TELEGRAM_CHAT_ID,
        text: leadText(d),
        parse_mode: "Markdown",
      });
      return json({ ok: r.ok }, r.ok ? 200 : 502);
    }

    return new Response("DiAvto69 worker is running", { headers: cors });
  },
};
