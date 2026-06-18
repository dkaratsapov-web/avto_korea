// Cloudflare Worker — приём заявок с сайта/мини-аппа и отправка в Telegram.
// Токен НЕ в коде: задаётся секретами воркера (wrangler secret / дашборд):
//   TELEGRAM_BOT_TOKEN — токен бота (@BotFather)
//   TELEGRAM_CHAT_ID   — id чата/менеджера (через @userinfobot)
// Деплой: см. worker/README.md. URL воркера → переменная VITE_LEAD_ENDPOINT сайта.

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });
    if (request.method !== "POST")
      return json({ ok: false, error: "method_not_allowed" }, 405);

    let data;
    try {
      data = await request.json();
    } catch {
      return json({ ok: false, error: "bad_json" }, 400);
    }

    const phone = String(data.phone || "");
    if (phone.replace(/\D/g, "").length < 10)
      return json({ ok: false, error: "phone_required" }, 422);

    const lines = [
      "🚗 *Новая заявка — ДиАвто69*",
      "",
      `👤 Имя: ${data.name || "—"}`,
      `📞 Телефон: ${phone}`,
    ];
    if (data.car) lines.push(`🔎 Авто/бюджет: ${data.car}`);
    if (data.country) lines.push(`🌍 Страна: ${data.country}`);
    if (data.year) lines.push(`📅 Год: ${data.year}`);
    if (data.budget) lines.push(`💰 Бюджет: ${data.budget}`);
    lines.push("", `📍 Источник: ${data.source || "сайт"}`);

    const res = await fetch(
      `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: lines.join("\n"),
          parse_mode: "Markdown",
        }),
      },
    );

    if (!res.ok) return json({ ok: false, error: "telegram_failed" }, 502);
    return json({ ok: true }, 200);
  },
};
