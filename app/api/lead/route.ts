import { NextResponse } from "next/server";

// Cloudflare Pages (@cloudflare/next-on-pages) выполняет серверные роуты на Edge.
export const runtime = "edge";

type LeadPayload = {
  phone?: string;
  car?: string;
  country?: string;
  year?: string;
  budget?: string;
  source?: string;
  consent?: string;
};

const countryLabels: Record<string, string> = {
  kr: "Корея 🇰🇷",
  cn: "Китай 🇨🇳",
  jp: "Япония 🇯🇵",
  eu: "ЕС 🇪🇺",
};

function buildMessage(lead: LeadPayload): string {
  const lines = [
    "🚗 *Новая заявка — ДиАвто69*",
    "",
    `📞 Телефон: ${lead.phone ?? "—"}`,
  ];
  if (lead.car) lines.push(`🔎 Авто/бюджет: ${lead.car}`);
  if (lead.country)
    lines.push(`🌍 Страна: ${countryLabels[lead.country] ?? lead.country}`);
  if (lead.year) lines.push(`📅 Год: ${lead.year}`);
  if (lead.budget) lines.push(`💰 Бюджет: ${lead.budget}`);
  lines.push("", `📍 Источник: ${lead.source ?? "сайт"}`);
  return lines.join("\n");
}

export async function POST(request: Request) {
  let lead: LeadPayload;
  try {
    lead = (await request.json()) as LeadPayload;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  // Телефон обязателен.
  if (!lead.phone || lead.phone.trim().length < 5) {
    return NextResponse.json(
      { ok: false, error: "phone_required" },
      { status: 422 },
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const text = buildMessage(lead);

  // Заглушка: пока заказчик не прислал токен/chat_id — логируем заявку.
  // TODO: убрать после настройки .env (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID).
  if (!token || !chatId) {
    console.log("[lead] Telegram не настроен, заявка получена:\n", text);
    return NextResponse.json({ ok: true, delivered: false });
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
        }),
      },
    );

    if (!res.ok) {
      const detail = await res.text();
      console.error("[lead] Telegram API error:", res.status, detail);
      return NextResponse.json(
        { ok: false, error: "telegram_failed" },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, delivered: true });
  } catch (err) {
    console.error("[lead] Telegram request failed:", err);
    return NextResponse.json(
      { ok: false, error: "telegram_unreachable" },
      { status: 502 },
    );
  }
}
