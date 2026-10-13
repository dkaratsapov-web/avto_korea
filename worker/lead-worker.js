// Cloudflare Worker — бот + заявки + общий каталог + админка.
// Токен только в секретах воркера; вход в админку — по подписи Telegram initData.
//
// Переменные/секреты (Settings → Variables and Secrets):
//   TELEGRAM_BOT_TOKEN — токен бота (@BotFather)                 [Secret]
//   TELEGRAM_CHAT_ID   — куда падают заявки (@userinfobot)        [Secret]
//   MINI_APP_URL       — https://автоимпорт-69.рф/tma         [Text]
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
  /*
   * Chat id канала, из которого собирается КАТАЛОГ.
   *
   * Пока пусто, каталогом считается любой канал, где бот администратор и
   * который не назначен отзывами или новостями. Так было с самого начала, и
   * пока бот сидел в одном канале, это работало. Но как только он становится
   * администратором второго — например публичного, на который просят
   * подписаться, — весь этот второй канал начинает сыпаться в каталог
   * черновиками автомобилей. Достаточно одного анонса или поздравления.
   *
   * Поэтому: заполните это поле — и каталог будет собираться только из
   * указанного канала, остальные бот просто не станет разбирать.
   */
  catalogChatId: "",
  // Chat id канала отзывов: посты оттуда идут в блок «Отзывы», а не в каталог.
  // Узнать id: опубликуйте пост в канале и посмотрите lastUpdate.chatId в /api/diag.
  reviewsChatId: "",
  // Chat id канала новостей: посты оттуда идут в раздел «Новости».
  newsChatId: "",
  // Chat id чата, куда падают заявки с сайта и из бота. Если пусто —
  // используется TELEGRAM_CHAT_ID из переменных Cloudflare.
  leadChatId: "",

  /* --- Гейт подписки на канал (А/Б-тест трафика из Директа) --- */
  /*
   * Общий рубильник: выключает стену для всех, не трогая рекламу.
   *
   * Выключен. Стена просит подписаться на канал и до подписки бота не
   * открывает — это лишний шаг между рекламой и заявкой, и включать его
   * стоит осознанно, отдельным решением, когда будет что сравнивать.
   * Сейчас задача обратная: пустить человека в бот как можно быстрее.
   *
   * Приёма заявок на вступление в канал это НЕ касается — заявки одобряются
   * независимо от рубильника.
   */
  gateEnabled: false,
  // Числовой id канала, вида -1001234567890. Узнать: /id в канале.
  // Бот обязан быть администратором канала, иначе проверка не работает.
  gateChannelId: "-1002743098562",
  // Постоянная инвайт-ссылка. Одноразовая сломает гейт на середине кампании.
  gateInviteUrl: "https://t.me/+YGu6mTHwM6k0Mzhi",
  gateText:
    "🔒 *Каталог открыт подписчикам канала*\n\nВ канале — новые поступления с ценами под ключ, фото и видео с площадки.\n\nПодпишитесь и нажмите «Я подписался» — открою каталог.",
  gateSubscribeButton: "📣 Подписаться на канал",
  gateCheckButton: "✅ Я подписался",
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

/**
 * События, на которые подписан вебхук.
 *
 * chat_member и chat_join_request нужны гейту подписки: по ним бот узнаёт о
 * вступлении в канал и сам возвращает человека в бот. Без них останется
 * только кнопка «Я подписался».
 */
const WEBHOOK_UPDATES = [
  "message",
  "edited_message",
  "channel_post",
  "edited_channel_post",
  "callback_query",
  "chat_member",
  "chat_join_request",
];

/**
 * Привязать вебхук. Вынесено из маршрута /setup, потому что вызывается ещё и
 * кнопкой из админки: домен воркера в России блокируется, и открыть /setup
 * браузером получается не у всех.
 */
async function bindWebhook(env, origin) {
  const r = await api(env, "setWebhook", {
    url: `${origin}/tg`,
    allowed_updates: WEBHOOK_UPDATES,
  });
  return r.json().catch(() => ({}));
}

/**
 * Синяя кнопка меню бота — та, что слева от поля ввода.
 *
 * Раньше её никогда не выставлял код: она была настроена руками в BotFather,
 * и адрес там лежал с кириллическим доменом. Из-за этого правки адреса в
 * нашем коде её не касались вовсе — кнопка продолжала открывать своё, и
 * человек упирался в «не удалось найти IP-адрес сервера», сколько бы мы ни
 * чинили кнопки в сообщениях.
 *
 * Теперь бот выставляет её сам, тем же проверенным адресом в машинной записи.
 * Настройка из BotFather при этом перекрывается — источник адреса остаётся
 * один, и его видно в коде.
 *
 * Вызывается при привязке вебхука: это то самое действие «переподключить
 * бота», которое и так делают после правки настроек.
 */
async function bindMenuButton(env, settings) {
  const appUrl = miniAppUrl(env, settings);
  const button = appUrl
    ? {
        type: "web_app",
        text: settings.catalogButtonText || "Каталог",
        web_app: { url: appUrl },
      }
    // Адреса нет или он непригоден — возвращаем обычное меню команд.
    // Пустая кнопка лучше кнопки в никуда.
    : { type: "commands" };
  const r = await api(env, "setChatMenuButton", { menu_button: button });
  return r.json().catch(() => ({}));
}

/**
 * Свести метки рекламы к одной строке и паре полей.
 *
 * В заявке храним не всё, что прислал браузер, а только то, по чему потом
 * считают: кампанию, площадку и идентификатор клика Яндекса — по нему
 * заявка сходится с выгрузкой из Директа. Мусор из адресной строки в
 * хранилище не тянем.
 */
function adSummary(ad) {
  const pick = ad?.first || ad?.last || null;
  if (!pick || typeof pick !== "object") return null;

  const str = (v, max = 120) => (typeof v === "string" ? v.slice(0, max) : "");
  const label = [str(pick.source), str(pick.medium), str(pick.campaign)]
    .filter(Boolean)
    .join(" / ");
  if (!label && !pick.yclid) return null;

  return {
    label: label || "Яндекс.Директ (клик без меток)",
    campaign: str(pick.campaign),
    source: str(pick.source),
    medium: str(pick.medium),
    content: str(pick.content),
    term: str(pick.term),
    yclid: str(pick.yclid, 64),
    landing: str(pick.landing),
  };
}

function leadText(d) {
  const lines = [
    "🚗 Новая заявка — ДиАвто69",
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
  // В сообщении показываем только откуда пришла заявка — сайт или бот.
  // Подробный источник (какая форма) остаётся в d.source и учитывается в
  // статистике, но менеджеру в чате он не нужен.
  const fromBot =
    !!d.tgUserId || /мини-?апп|mini\s*app|бот|bot/i.test(String(d.source || ""));
  lines.push("", `📍 Источник: ${fromBot ? "Бот" : "Сайт"}`);
  // Кампанию показываем, только когда она есть: у заявки из бота или с
  // прямого захода этой строки быть не должно — пустая графа сбивает с толку.
  const ad = adSummary(d.ad);
  if (ad) lines.push(`📣 Реклама: ${ad.label}`);
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

/**
 * Кому уходят служебные уведомления: владельцы из ADMIN_IDS, админы из KV и
 * общий чат из переменных Cloudflare (он может быть группой, а не человеком).
 *
 * Дубли убираем: владелец, добавленный ещё и в KV, не должен получать одно и
 * то же уведомление дважды.
 */
async function adminChatIds(env) {
  const owners = String(env.ADMIN_IDS || "")
    .split(/[,\s]+/)
    .filter(Boolean);
  const admins = Object.keys((await kvGet(env, "admins", {})) || {});
  return [
    ...new Set(
      [...owners, ...admins, env.TELEGRAM_CHAT_ID].filter(Boolean).map(String),
    ),
  ];
}

/**
 * Служебное сообщение всем администраторам, без разметки.
 *
 * Без разметки намеренно: сюда попадают идентификаторы каналов и обрывки
 * настроек, а в них встречаются подчёркивания и минусы. С разметкой Telegram
 * на таком тексте отвечает ошибкой и сообщение не уходит вовсе — то есть
 * предупреждение о поломке само тихо теряется.
 *
 * Недоступный адресат не отменяет доставку остальным: админ, который сам не
 * запускал бота, боту недоступен, и это нормально.
 */
async function notifyAdmins(env, text) {
  for (const chatId of await adminChatIds(env)) {
    try {
      await api(env, "sendMessage", { chat_id: chatId, text });
    } catch {
      /* один недоступный не мешает остальным */
    }
  }
}

/** Текст, безопасный для parse_mode HTML. */
function htmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Оповещение о новом пользователе (нажал «Старт») — в чат заявок.
 *
 * Раньше уходило личным сообщением каждому админу и в общий чат сразу.
 * У владельца это выглядело так, будто бот пишет сам себе: уведомления
 * о новых людях смешивались с рабочей перепиской и терялись. Теперь адресат
 * тот же, что у заявок с сайта, — один чат, где всё видно в одном месте
 * и куда можно добавить любого сотрудника, не выдавая ему прав админа.
 *
 * Порядок как у заявок: сначала чат из админки, при неудаче — чат из
 * переменных Cloudflare. Неверно указанный id не должен приводить к полной
 * потере уведомления.
 *
 * Разметка HTML, а не Markdown: имена приходят от людей, и «Ivan_Petrov»
 * ломал разбор Markdown — Telegram отвечал ошибкой, а уведомление молча
 * не доходило. В HTML достаточно экранировать три символа.
 */
async function notifyNewUser(env, from, settings) {
  if (!from?.id) return;

  // Настройки принимаем снаружи: на пути /start они уже прочитаны, и второй
  // поход в хранилище за тем же самым — лишняя задержка перед приветствием.
  const st = settings || (await getSettings(env));
  const custom = String(st.leadChatId || "").trim();
  const targets = [...new Set([custom, env.TELEGRAM_CHAT_ID].filter(Boolean))];
  if (!targets.length) return;

  const name =
    [from.first_name, from.last_name].filter(Boolean).join(" ") || "—";
  const uname = from.username ? `@${from.username}` : "без username";
  const text = [
    "👋 <b>Новый пользователь запустил бота</b>",
    `👤 Имя: ${htmlEscape(name)}`,
    `🔗 Username: ${htmlEscape(uname)}`,
    `🆔 ID: ${from.id}`,
    `<a href="tg://user?id=${from.id}">Открыть профиль</a>`,
  ].join("\n");

  // До первой удачной доставки: запасной адрес нужен на случай неверного id
  // в админке, а не для дублирования одного и того же сообщения.
  for (const chatId of targets) {
    try {
      const r = await api(env, "sendMessage", {
        chat_id: chatId,
        text,
        parse_mode: "HTML",
      });
      const j = await r.json().catch(() => null);
      if (j?.ok) return;
    } catch {
      /* пробуем следующий адрес */
    }
  }
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
/**
 * Адрес мини-аппа — проверенный и приведённый к машинному виду.
 *
 * ГЛАВНОЕ ЗДЕСЬ — punycode. Домен сайта кириллический, и в настройках он
 * хранился так же: https://автоимпорт-69.рф/tma. Встроенный браузер Telegram
 * с кириллицей в адресе ведёт себя по-разному на разных устройствах, и на
 * части из них адрес превращался в бессмыслицу: имя домена длиной 126
 * символов при пределе в 63 по правилам DNS. Человек вместо каталога видел
 * «не удалось найти IP-адрес сервера».
 *
 * new URL приводит имя домена к машинной записи: автоимпорт-69.рф →
 * xn---69-5cdk0b2aocjmsg.xn--p1ai. Наружу уходит чистая латиница, портить
 * которую нечему.
 *
 * Проверка — вторым слоем. Адрес правится в админке обычным текстовым полем,
 * и раньше единственным условием было «начинается на https://»: любая строка
 * с этим началом уезжала в кнопку как есть. Теперь непригодное значение
 * превращается в пустую строку, и кнопка ведёт на каталог сайта — рабочую
 * страницу вместо ошибки браузера.
 *
 * Проверка длины метки формально дублирует new URL (он такой адрес и сам не
 * разбирает), но оставлена намеренно: разные среды разбирают адреса
 * по-разному, а правило DNS одно и то же везде.
 */
function safeAppUrl(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  let u;
  try {
    u = new URL(s);
  } catch {
    return "";
  }
  if (u.protocol !== "https:") return "";
  const labels = u.hostname.split(".");
  if (labels.length < 2) return "";
  if (labels.some((l) => !l || l.length > 63)) return "";
  if (!/^[a-z0-9.-]+$/i.test(u.hostname)) return "";
  return u.href;
}

function miniAppUrl(env, settings) {
  return (
    safeAppUrl(settings.miniAppUrl) || safeAppUrl(env.MINI_APP_URL) || ""
  );
}

/* ---------- Гейт подписки и метки кампаний ---------- */

/**
 * Разбор метки из диплинка: /start a-yd-korea → { variant:"a", src:"yd-korea" }.
 *
 * Вариант "a" — со стеной подписки, "b" — без неё. Всё остальное (в том числе
 * обычный /start без метки) считаем "b": органику и переходы из канала гейтить
 * незачем, стена нужна только рекламному трафику из теста.
 *
 * Telegram разрешает в метке лишь A-Z a-z 0-9 _ - и не длиннее 64 символов,
 * поэтому источник тут уже приходит очищенным — на всякий случай режем ещё раз.
 */
function parseStartPayload(text) {
  const raw = String(text || "").trim().split(/\s+/)[1] || "";
  const m = /^([ab])-(.*)$/.exec(raw);
  if (!m) return { variant: "b", src: raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60) };
  return { variant: m[1], src: m[2].replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60) };
}

/**
 * Подписан ли человек на канал.
 *
 * Считаем подписанными всех, кто состоит: creator, administrator, member и
 * restricted (последний — участник с ограничениями, он канал видит).
 * left и kicked — не подписан. Ошибка запроса тоже даёт false, но она означает
 * скорее «бот не админ канала», чем «человек не подписан», — поэтому вызывающий
 * код сначала проверяет, что канал вообще настроен.
 */
async function isChannelMember(env, channelId, userId) {
  if (!channelId || !userId) return null;
  try {
    const r = await api(env, "getChatMember", { chat_id: channelId, user_id: userId });
    const j = await r.json();
    /*
     * Telegram не ответил по существу — значит проверить нечем.
     *
     * Так бывает ровно в одном случае: бот не администратор канала. Тогда
     * getChatMember отвечает ошибкой («chat not found», «bot is not a member»
     * и подобными), и раньше это считалось «человек не подписан». Стена
     * никогда не открывалась: человек подписывался, жал «Я подписался»,
     * снова упирался в стену — и уходил. Со стороны это ровно «бот не
     * работает», причём чинится не в боте, а в правах на канал.
     *
     * Поэтому неизвестность отделена от отказа: null означает «проверить не
     * смогли», и выше по коду такого человека пускают. Сломанный замок
     * должен открываться, а не запирать дверь навсегда.
     */
    if (!j || j.ok !== true) return null;
    const s = j?.result?.status;
    return s === "creator" || s === "administrator" || s === "member" || s === "restricted";
  } catch {
    return null;
  }
}

/** Дописать поля в карточку пользователя, не затирая уже записанное. */
async function patchUser(env, userId, patch) {
  if (!env.STORE || !userId) return;
  try {
    const users = (await kvGet(env, "users", {})) || {};
    const cur = users[userId] || {};
    // Вариант и источник фиксируем один раз — при первом заходе. Иначе
    // повторный /start без метки перезапишет принадлежность к группе теста,
    // и сравнивать А с Б станет нечем.
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined || v === "") continue;
      if ((k === "v" || k === "src") && cur[k]) continue;
      cur[k] = v;
    }
    users[userId] = cur;
    await kvPut(env, "users", users);
    // Возвращаем итоговую карточку: вызывающему коду она нужна сразу после
    // записи, а отдельное чтение того же самого — лишний поход в хранилище
    // на пути, где человек ждёт ответа бота.
    return cur;
  } catch {
    /* статистика не должна ломать сценарий */
  }
  return null;
}

/**
 * Каталог на сайте — запасной адрес, когда мини-апп открыть нельзя.
 * В машинной записи: кнопку открывает встроенный браузер Telegram, и
 * кириллица в адресе на части устройств доезжает искажённой.
 */
const SITE_CATALOG_URL = "https://xn---69-5cdk0b2aocjmsg.xn--p1ai/catalog";

/** Клавиатура основного меню бота (каталог, подбор, менеджер, карты). */
function menuKeyboard(env, settings) {
  // Адрес уже проверен: непригодный превращается в пустую строку, и кнопка
  // ведёт на каталог сайта — рабочую страницу вместо ошибки браузера.
  const appUrl = miniAppUrl(env, settings);
  const isApp = !!appUrl;
  const openBtn = isApp
    ? { text: settings.catalogButtonText, web_app: { url: appUrl } }
    : { text: settings.catalogButtonText, url: SITE_CATALOG_URL };
  const rows = [[openBtn]];
  if (isApp) {
    const quizUrl = appUrl + (appUrl.includes("?") ? "&" : "?") + "screen=quiz";
    rows.push([{ text: settings.quizButtonText, web_app: { url: quizUrl } }]);
  }
  rows.push([{ text: settings.managerButtonText, url: settings.managerUrl }]);
  if (settings.mapUrl) rows.push([{ text: settings.mapButtonText, url: settings.mapUrl }]);
  if (settings.map2gisUrl)
    rows.push([{ text: settings.map2gisButtonText, url: settings.map2gisUrl }]);
  return rows;
}

/** Приветствие с меню. Запасной текст — если Markdown не прошёл. */
async function sendWelcome(env, chatId, settings) {
  const r = await api(env, "sendMessage", {
    chat_id: chatId,
    text: settings.welcomeText,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: menuKeyboard(env, settings) },
  });
  if (!r.ok) {
    await api(env, "sendMessage", {
      chat_id: chatId,
      text: "🚗 ДиАвто69 — авто из Кореи, Китая, Японии и ЕС под ключ.\nКаталог: https://автоимпорт-69.рф/catalog",
    });
  }
}

/** Экран подписки: ссылка на канал и кнопка повторной проверки. */
async function sendGate(env, chatId, settings) {
  const rows = [];
  if (settings.gateInviteUrl)
    rows.push([{ text: settings.gateSubscribeButton, url: settings.gateInviteUrl }]);
  rows.push([{ text: settings.gateCheckButton, callback_data: "gate_check" }]);
  await api(env, "sendMessage", {
    chat_id: chatId,
    text: settings.gateText,
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: rows },
  });
}

/**
 * Нужна ли этому человеку стена подписки.
 *
 * Гейт работает только когда он включён, канал настроен и человек пришёл по
 * варианту «a». Если канал не настроен — пускаем без стены: недонастроенный
 * гейт не должен закрывать бота вообще для всех.
 */
function gateApplies(settings, variant) {
  return Boolean(settings.gateEnabled && settings.gateChannelId && variant === "a");
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
  "webhook.setup": "bot",
  "admins.list": "admins",
  "admins.set": "admins",
  "admins.remove": "admins",
};

/*
 * Что разрешено ключу CRM (см. POST /api/crm).
 *
 * Список нарочно короткий и лежит отдельно от NEED_CAP: право «reviews» в
 * админке бота однажды может обрасти новыми действиями, и они не должны
 * молча стать доступны стороннему серверу — их сюда придётся вписать руками.
 */
const CRM_ACTIONS = ["reviews.list", "reviews.save", "reviews.remove", "reviews.clear"];

/**
 * Сравнение секретов за постоянное время.
 *
 * Обычное === выходит из сравнения на первом несовпавшем символе, и по
 * времени ответа ключ подбирается посимвольно. Здесь проходим строку целиком.
 */
function timingSafeEqual(a, b) {
  a = String(a);
  b = String(b);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Любой ли это админ (owner из env или запись в KV) — для гейта пересылки постов.
async function roleOf(env, userId) {
  const perm = await permsOf(env, userId);
  return perm ? (perm.owner ? "owner" : "admin") : null;
}

/**
 * Чем назначен этот чат в настройках бота: источником каталога, каналом
 * отзывов, каналом новостей — или ничем.
 *
 * Пустая строка в настройках означает «не назначен», поэтому сравниваем
 * только заполненные поля: иначе любой чат совпал бы с пустым значением.
 */
function chatPurpose(st, cid) {
  cid = String(cid);
  if (st.newsChatId && cid === String(st.newsChatId)) return "news";
  if (st.reviewsChatId && cid === String(st.reviewsChatId)) return "reviews";
  if (st.catalogChatId && cid === String(st.catalogChatId)) return "catalog";
  return null;
}

/**
 * Можно ли брать каталог из этого канала, когда источник в настройках не задан.
 *
 * «Не задан — значит любой» держалось на том, что бот сидит в одном канале.
 * Но добавить его администратором в свой канал может кто угодно, зная имя, —
 * и посторонние посты поехали бы к нам карточками автомобилей.
 *
 * Совсем закрыть тоже нельзя: у кого поле не заполнено, каталог перестал бы
 * обновляться, причём молча — худший из возможных исходов. Поэтому запоминаем
 * ПЕРВЫЙ канал, из которого пришёл пост, и дальше принимаем только его.
 * Настоящий канал публикует каждый день, чужой появляется потом — так первым
 * оказывается свой. О любом решении админам приходит сообщение: и о том, что
 * канал запомнен, и о том, что чужой пост не принят.
 */
async function catalogSourceOk(env, post) {
  const cid = String(post.chat?.id);
  const seen = String((await kvGet(env, "catalogChatSeen", "")) || "");

  if (!seen) {
    await kvPut(env, "catalogChatSeen", cid);
    await tellAdmins(
      env,
      `📥 Каталог теперь собирается из канала «${post.chat?.title || cid}» (\`${cid}\`).\n\n` +
        "Поле «Источник каталога» в настройках пустое, поэтому бот запомнил первый канал, " +
        "из которого пришёл пост. Если это не тот канал — впишите нужный в настройках бота.",
    );
    return true;
  }

  if (seen === cid) return true;

  // Чужой канал. Молчать нельзя: владелец должен понимать, почему его посты
  // не появляются, — и должен узнать, если бота куда-то добавили без него.
  const told = (await kvGet(env, "catalogChatRejected", [])) || [];
  if (!told.includes(cid)) {
    await kvPut(env, "catalogChatRejected", [...told, cid].slice(-20));
    await tellAdmins(
      env,
      `🚫 Пост из канала «${post.chat?.title || cid}» (\`${cid}\`) в каталог не принят.\n\n` +
        `Каталог берётся из канала \`${seen}\`. Если публиковать нужно отсюда — впишите этот ` +
        "идентификатор в поле «Источник каталога» в настройках бота.",
    );
  }
  return false;
}

/** Сообщение всем админам бота. Недоступный админ не мешает остальным. */
async function tellAdmins(env, text) {
  for (const chatId of await adminChatIds(env)) {
    try {
      await api(env, "sendMessage", { chat_id: chatId, text, parse_mode: "Markdown" });
    } catch {
      /* один недоступный админ не должен ронять обработку */
    }
  }
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
/**
 * Доделать работу уже после ответа Telegram.
 *
 * Служебные дела — уведомить админов, записать отметку времени — человека
 * не касаются, но раньше он их ждал: пока мы не закончим, приветствие не
 * уходило. Cloudflare умеет продлевать жизнь обработчика после ответа, этим
 * и пользуемся. Если продлить нечем (вызов не из обработчика запроса),
 * просто дожидаемся, как раньше, — потерять дело хуже, чем задержать.
 */
function later(ctx, promise) {
  const p = Promise.resolve(promise).catch(() => {});
  if (ctx && typeof ctx.waitUntil === "function") {
    ctx.waitUntil(p);
    return Promise.resolve();
  }
  return p;
}

/*
 * Бот в MAX — второе окно в тот же каталог.
 *
 * Живёт отдельным файлом: у MAX другой Bot API, и мешать его разбор с
 * телеграмным значит однажды сломать оба разом. Сюда приходят только три
 * строчки — вебхук, настройка и показания приборов.
 */
import {
  handleMaxUpdate,
  maxBind,
  maxDiag,
  maxAppButtonReport,
  maxWrite,
  maxChatLink,
  maxPostToChat,
} from "./max-bot.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS")
      return new Response(null, { headers: cors });

    // --- Разовая привязка вебхука: открыть в браузере ---
    if (url.pathname === "/setup") {
      if (!env.TELEGRAM_BOT_TOKEN)
        return json({ error: "no TELEGRAM_BOT_TOKEN" }, 400);
      const out = await bindWebhook(env, url.origin);
      // Заодно перевыставляем синюю кнопку меню: её адрес должен приходить
      // из кода, а не из BotFather, иначе правки адреса её не касаются.
      const menu = await bindMenuButton(env, await getSettings(env));
      return json({ setWebhook: `${url.origin}/tg`, telegram: out, menuButton: menu });
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
          /*
           * Пишем уже после ответа Telegram.
           *
           * Это диагностика — она нужна нам, а не человеку в чате, и держать
           * ради неё ответ вебхука незачем. Запись в хранилище стоит около
           * десяти миллисекунд, и раньше они добавлялись к КАЖДОМУ событию:
           * к каждому посту канала, к каждому сообщению, к каждому нажатию.
           */
          later(
            ctx,
            env.STORE.put(
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
            ),
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

        // «/id» прямо в канале: отвечаем не в канал (чтобы не мусорить в
        // ленте подписчиков), а личным сообщением админам. Пост при этом в
        // каталог не уходит — иначе команда осела бы черновиком авто.
        if (/^\/id(@\w+)?\s*$/.test(String(post.text || post.caption || "").trim())) {
          const title = post.chat?.title ? `\nНазвание: ${post.chat.title}` : "";
          /*
           * К идентификатору сразу показываем, чем этот канал уже назначен.
           *
           * Каналов теперь несколько, и все они задаются вручную одинаковыми
           * на вид числами. Голый id тут — приглашение вписать его не в то
           * поле: каталог начнёт собираться из публичного канала, а стена
           * подписки будет проверять подписку на канал-источник. Поэтому бот
           * сам говорит, кем он этот канал считает.
           */
          const roles = [];
          if (st.catalogChatId && cid === String(st.catalogChatId))
            roles.push("источник каталога");
          if (st.reviewsChatId && cid === String(st.reviewsChatId))
            roles.push("канал отзывов");
          if (st.newsChatId && cid === String(st.newsChatId)) roles.push("канал новостей");
          if (st.gateChannelId && cid === String(st.gateChannelId))
            roles.push("канал подписки (гейт)");
          const now = roles.length
            ? `\n\nСейчас этот канал назначен как: ${roles.join(", ")}.`
            : "\n\nСейчас этот канал ни за чем не закреплён." +
              (st.catalogChatId
                ? ""
                : "\n⚠️ Поле «Источник каталога» пустое, поэтому посты отсюда" +
                  " попадут в каталог автомобилей.");
          const both =
            st.catalogChatId &&
            st.gateChannelId &&
            String(st.catalogChatId) === String(st.gateChannelId)
              ? "\n\nИсточник каталога и канал подписки у вас совпадают — это рабочая схема, так и задумано."
              : "";
          for (const chatId of await adminChatIds(env)) {
            try {
              await api(env, "sendMessage", {
                chat_id: chatId,
                text:
                  `Идентификатор канала: \`${cid}\`${title}${now}${both}\n\n` +
                  "Куда вписать в настройках бота:\n" +
                  "• «Источник каталога» — канал, откуда берутся автомобили\n" +
                  "• «Канал отзывов» / «Канал новостей» — если это они\n" +
                  "• «Канал для гейта» — канал, на который просим подписаться\n\n" +
                  "Каталог и гейт могут быть одним и тем же каналом — так тоже правильно.",
                parse_mode: "Markdown",
              });
            } catch {
              /* недоступный админ не мешает остальным */
            }
          }
          return new Response("ok");
        }

        /*
         * Запоминаем устройство последнего поста — по команде /пост.
         *
         * Это единственный способ узнать, в каком виде Telegram присылает
         * новый формат публикаций: доступа к каналу у разработчика нет, а
         * ошибка разбора выглядит снаружи просто как неполная карточка.
         */
        await kvPut(env, "lastPostShape", {
          at: Date.now(),
          chat: cid,
          title: post.chat?.title || "",
          photos: postPhotoIds(post).length,
          videos: postVideoIds(post).length,
          textLines: postText(post).split("\n").length,
          shape: shapeOf(post),
        });

        /*
         * Куда девать пост — решаем по каналу, из которого он пришёл.
         *
         * Порядок проверок важен: каналы назначаются вручную, и человек
         * вполне может вписать один и тот же id в два поля. Тогда выигрывает
         * первое совпадение, а не «оба сразу».
         */
        if (st.newsChatId && cid === String(st.newsChatId)) {
          await publishNewsFromPost(env, post, url.origin);
          return new Response("ok");
        }
        if (st.reviewsChatId && cid === String(st.reviewsChatId)) {
          await publishReviewFromPost(env, post, url.origin);
          return new Response("ok");
        }

        /*
         * Каталог берётся ровно из назначенного канала.
         *
         * Один и тот же канал спокойно может быть и источником каталога, и
         * каналом подписки — это нормальная схема: просим подписаться туда,
         * откуда и так публикуем машины. Никакого запрета на совпадение тут
         * нет и быть не должно.
         *
         * Опасно другое — молчаливое «каталогом считается любой канал». Пока
         * бот сидел в одном канале, это работало. Как только он становится
         * администратором второго, каждый посторонний пост оттуда уезжает в
         * каталог карточкой автомобиля, а при включённой авто-публикации —
         * сразу на сайт, минуя черновик. Поэтому заполненное поле «источник
         * каталога» главнее всего: назначен канал — остальные не разбираем.
         *
         * Пустое поле оставляет прежнее поведение: иначе у тех, кто ещё не
         * заполнил настройку, каталог перестал бы обновляться после этой
         * правки, причём молча.
         */
        if (st.catalogChatId) {
          if (cid !== String(st.catalogChatId)) return new Response("ok");
        } else if (!(await catalogSourceOk(env, post))) {
          return new Response("ok");
        }
        await handleChannelPost(env, post, {
          auto: !!st.autoPublish,
          origin: url.origin,
        });
        return new Response("ok");
      }

      // Человек вступил в канал — открываем доступ и пишем сами.
      // Это и есть «возврат»: Telegram из канала обратно не ведёт, а
      // уведомление от бота человек видит сразу. Писать первым можно —
      // он уже нажал /start, иначе бы сюда не попал.
      const cm = upd.chat_member;
      if (cm) {
        const st = await getSettings(env);
        const joined = ["member", "administrator", "creator", "restricted"].includes(
          cm.new_chat_member?.status,
        );
        const uid = cm.new_chat_member?.user?.id;
        if (joined && uid && String(cm.chat?.id) === String(st.gateChannelId)) {
          await sendWelcome(env, uid, st);
          // Обе отметки — одной записью и уже после ответа: они читают и
          // перезаписывают общий список пользователей целиком, поэтому
          // двумя вызовами подряд затирали бы поля друг друга.
          later(ctx, patchUser(env, uid, { subAt: Date.now(), openedAt: Date.now() }));
        }
        return new Response("ok");
      }

      /*
       * Заявка на вступление в канал — одобряем сразу.
       *
       * Человек в этот момент смотрит на надпись «заявка отправлена» и ждёт.
       * Каждая лишняя секунда здесь — это секунда сомнения, поэтому одобрение
       * идёт ПЕРВЫМ действием, а всё остальное после него: приветствие в
       * личку, отметки в статистике. Раньше приветствие стояло до ответа
       * вебхука и задерживало его, хотя человеку оно нужно уже после того,
       * как его впустили.
       *
       * Одобряем независимо от того, включена ли стена подписки: стена — это
       * про доступ к боту, а заявка в канал к ней отношения не имеет. Выключив
       * стену, приём заявок терять нельзя.
       */
      const cjr = upd.chat_join_request;
      if (cjr) {
        const st = await getSettings(env);
        const cid = String(cjr.chat?.id ?? "");
        // Свой канал — тот, что назначен каналом подписки или источником
        // каталога. Оба поля указывают на канал компании; какое из них
        // заполнено, зависит от настройки, и полагаться на одно нельзя.
        const ours =
          (st.gateChannelId && cid === String(st.gateChannelId)) ||
          (st.catalogChatId && cid === String(st.catalogChatId));

        if (ours) {
          await api(env, "approveChatJoinRequest", {
            chat_id: cjr.chat.id,
            user_id: cjr.from.id,
          });
          later(ctx, sendWelcome(env, cjr.from.id, st));
          later(
            ctx,
            patchUser(env, cjr.from.id, { subAt: Date.now(), openedAt: Date.now() }),
          );
        } else {
          /*
           * Заявка из канала, который в настройках не значится.
           *
           * Раньше такая заявка молча игнорировалась, и человек висел
           * неодобренным до тех пор, пока кто-нибудь не заглянет в канал
           * руками. Причина при этом всегда одна и та же — опечатка в id, —
           * но снаружи она никак не проявлялась. Теперь о промахе сообщаем
           * сразу и с обоими номерами, чтобы было что с чем сверить.
           */
          later(
            ctx,
            notifyAdmins(
              env,
              "⚠️ Заявка на вступление из НЕизвестного канала\n\n" +
                `Канал заявки: ${cid}\n` +
                `В настройках «канал подписки»: ${st.gateChannelId || "—"}\n` +
                `В настройках «источник каталога»: ${st.catalogChatId || "—"}\n\n` +
                "Заявка не одобрена. Сверьте id: отправьте /id в нужном канале.",
            ),
          );
        }
        return new Response("ok");
      }

      // нажатие inline-кнопки (например, «Калькулятор» — пока заглушка)
      const cq = upd.callback_query;
      if (cq) {
        // «Я подписался» — перепроверяем и отвечаем всплывающим окном,
        // поэтому отвечаем на колбэк отдельно, а не общим ответом ниже.
        if (cq.data === "gate_check") {
          const st = await getSettings(env);
          const uid = cq.from?.id;
          // null — проверить не смогли (бот не админ канала). Такого
          // человека пускаем: иначе он будет жать эту кнопку до бесконечности.
          const ok = (await isChannelMember(env, st.gateChannelId, uid)) !== false;
          await api(env, "answerCallbackQuery", {
            callback_query_id: cq.id,
            text: ok ? "Готово! Открываю каталог" : "Подписка пока не видна. Подпишитесь и нажмите ещё раз.",
            show_alert: !ok,
          });
          if (ok && cq.message?.chat?.id) {
            await sendWelcome(env, cq.message.chat.id, st);
            later(ctx, patchUser(env, uid, { subAt: Date.now(), openedAt: Date.now() }));
          }
          return new Response("ok");
        }

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
          const cid = String(msg.chat?.id);
          const purpose = chatPurpose(st, cid);
          const botAdmin = await roleOf(env, msg.from?.id);

          /*
           * Кому здесь верим — зависит от того, наш это чат или чужой.
           *
           * В НАЗНАЧЕННОЙ группе (вписана в настройках как источник каталога,
           * канал отзывов или новостей) доверяем её распорядителям: админам
           * группы и авто-пересылке из привязанного канала. Группа наша,
           * админы в ней наши.
           *
           * В любой ДРУГОЙ группе — только админу самого бота. Бота можно
           * добавить в чужую группу, зная его имя, и раньше этого хватало:
           * в своей группе человек по определению администратор, а значит
           * его фотография уезжала к нам в каталог, при авто-публикации —
           * сразу на сайт. Признак «пост пришёл автопересылкой из канала»
           * тем более ничего не доказывает: канал у него свой.
           */
          const trusted = purpose
            ? isAutoForward ||
              botAdmin ||
              (await isChatAdmin(env, msg.chat?.id, msg.from?.id))
            : !!botAdmin;

          if (trusted) {
            if (purpose === "news") {
              await publishNewsFromPost(env, msg, url.origin);
            } else if (purpose === "reviews") {
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
          const saved = await publishReviewFromPost(env, msg, url.origin);
          if (!msg.media_group_id) {
            /*
             * Отвечаем тем, что реально записалось. Раньше здесь стояло
             * безусловное «опубликован», и владелец видел галочку даже когда
             * бот не понял вложение и сохранил один текст.
             */
            const got = [];
            if (saved?.videos) got.push(`видео: ${saved.videos}`);
            if (saved?.images) got.push(`фото: ${saved.images}`);

            /*
             * Про тяжёлое видео говорим сразу и с цифрой.
             *
             * Ограничение Telegram обойти нечем, но молчать о нём нельзя:
             * иначе владелец отправляет десять роликов, видит десять
             * галочек — и пустую витрину.
             */
            const heavy = saved?.tooBigMb
              ? `⚠️ Видео на ${saved.tooBigMb} МБ бот забрать не может: Telegram отдаёт ботам файлы до 20 МБ.\n` +
                "Пришлите ролик покороче или сожмите его — иначе на сайте будет карточка с неработающим плеером."
              : "";

            await api(env, "sendMessage", {
              chat_id: msg.chat.id,
              text: got.length
                ? `✅ Отзыв опубликован (${got.join(", ")}).` + (heavy ? "\n\n" + heavy : "")
                : heavy ||
                  "⚠️ Отзыв сохранён БЕЗ файлов — вложение бот прочитать не смог.\nПришлите видео обычным видеосообщением или файлом.",
            });
          }
          return new Response("ok");
        }
      }

      /*
       * /fix — починить бота, не заходя в админку.
       *
       * Раньше кнопка «Переподключить бота» жила только внутри мини-аппа.
       * Если ломалась сама кнопка запуска мини-аппа, владелец оказывался
       * заперт снаружи: чтобы починить кнопку, надо было нажать кнопку,
       * которая не работает. Команда снимает эту петлю — она приходит
       * обычным сообщением и от мини-аппа не зависит.
       *
       * Перепривязывает вебхук и заново выставляет синюю кнопку меню
       * проверенным адресом. Только владелец: команда меняет настройки бота.
       */
      if (msg && typeof msg.text === "string" && /^\/fix(@\w+)?\b/.test(msg.text.trim())) {
        const perm = await permsOf(env, msg.from?.id);
        if (!perm?.owner) return new Response("ok");
        const st = await getSettings(env);
        const hook = await bindWebhook(env, url.origin);
        const menu = await bindMenuButton(env, st);
        const appUrl = miniAppUrl(env, st);
        await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text:
            (hook?.ok ? "✅ Вебхук привязан" : "⚠️ Вебхук: " + (hook?.description || "не вышло")) +
            "\n" +
            (menu?.ok ? "✅ Кнопка меню обновлена" : "⚠️ Кнопка меню: " + (menu?.description || "не вышло")) +
            "\n\nАдрес мини-аппа:\n" +
            (appUrl || "не задан — кнопка ведёт на каталог сайта") +
            "\n\nЗакройте и откройте чат: Telegram помнит кнопку меню какое-то время.",
        });
        return new Response("ok");
      }

      /*
       * /crm — ключ, которым CRM подключается к отзывам бота.
       *
       * Отзывы живут здесь, а удалять их владельцу удобнее с компьютера, из
       * CRM. Чтобы CRM могла об этом попросить, ей нужно чем-то представиться:
       * подписи мини-аппа у неё нет. Ключ выдаётся один раз, вставляется в
       * CRM и больше не нужен.
       *
       * Повторная команда показывает тот же ключ, а не выписывает новый:
       * иначе владелец, нажавший её из любопытства, тихо отключил бы CRM.
       * Для замены — «/crm новый».
       */
      if (msg && typeof msg.text === "string" && /^\/crm(@\w+)?\b/.test(msg.text.trim())) {
        const perm = await permsOf(env, msg.from?.id);
        if (!perm?.owner) return new Response("ok");
        // Без \b: граница слова в JS живёт только среди латиницы, и «/crm новый»
        // мимо неё проходил бы молча.
        const rotate = /(нов|new|сброс|reset)/i.test(msg.text);
        let key = String((await kvGet(env, "crmKey", "")) || "");
        if (!key || rotate) {
          key = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
          await kvPut(env, "crmKey", key);
        }
        await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text:
            "🔑 Ключ CRM для отзывов" +
            (rotate ? " (новый — старый больше не работает)" : "") +
            ":\n\n`" +
            key +
            "`\n\nОткройте CRM → «Отзывы» и вставьте его в поле подключения. " +
            "Ключ даёт право только смотреть и удалять отзывы.\n\n" +
            "Заменить ключ: /crm новый",
          parse_mode: "Markdown",
        });
        return new Response("ok");
      }

      /*
       * /канал — привязать канал MAX и проверить публикацию.
       *
       * Идентификатор канала в MAX нигде не показывают: его знает только сам
       * мессенджер. Бот запоминает чат, в который его добавили админом, и по
       * этой команде показывает id, вписывает его в настройки и сразу шлёт
       * туда пробную карточку — иначе «не работает» выяснится через неделю,
       * на живой публикации.
       */
      if (msg && typeof msg.text === "string" && /^\/(канал|maxchannel)(@\w+)?/i.test(msg.text.trim())) {
        const perm = await permsOf(env, msg.from?.id);
        if (!perm?.owner) return new Response("ok");

        const said = (msg.text.match(/(-?\d{3,})/) || [])[1] || "";
        const seen = (await kvGet(env, "max:lastChat", null)) || null;
        const channel = said || seen?.id || "";

        if (!channel) {
          await api(env, "sendMessage", {
            chat_id: msg.chat.id,
            text:
              "Канал MAX пока не привязан.\n\n" +
              "1. Добавьте бота ДиАвто69 администратором в канал MAX.\n" +
              "2. Пришлите сюда /канал — id подставится сам.\n\n" +
              "Если id известен, можно указать прямо: /канал -1234567890",
          });
          return new Response("ok");
        }

        const st = await getSettings(env);
        await kvPut(env, "settings", { ...st, maxChannelId: String(channel) });

        const probe = await maxPostToChat(
          env,
          channel,
          "Проверка связи: сюда будут приходить новые авто из каталога.",
        );
        await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text: probe.ok
            ? `✅ Канал MAX привязан: \`${channel}\`\nПробное сообщение отправлено — проверьте канал.`
            : `⚠️ Канал сохранён (\`${channel}\`), но опубликовать не вышло.\nОтвет MAX: ${String(probe.error || JSON.stringify(probe.data || {})).slice(0, 300)}\n\nЧаще всего это значит, что бот не администратор канала.`,
          parse_mode: "Markdown",
        });
        return new Response("ok");
      }

      /*
       * /пост — в каком виде пришёл последний пост канала.
       *
       * Нужна ровно тогда, когда карточка собралась неполной: сразу видно,
       * сколько фотографий и строк текста удалось достать и какими полями
       * Telegram прислал публикацию. Содержимого поста команда не показывает.
       */
      if (msg && typeof msg.text === "string" && /^\/(пост|post)(@\w+)?/i.test(msg.text.trim())) {
        const perm = await permsOf(env, msg.from?.id);
        if (!perm?.owner) return new Response("ok");
        const last = await kvGet(env, "lastPostShape", null);
        if (!last) {
          await api(env, "sendMessage", {
            chat_id: msg.chat.id,
            text: "Постов из каналов после включения этой проверки ещё не было.",
          });
          return new Response("ok");
        }
        const when = new Date(last.at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" });
        const body = JSON.stringify(last.shape, null, 1).slice(0, 3200);
        await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text:
            `Последний пост канала ${last.title || last.chat} — ${when}\n` +
            `Фото: ${last.photos} · видео: ${last.videos} · строк текста: ${last.textLines}\n\n` +
            "```\n" + body + "\n```",
          parse_mode: "Markdown",
        });
        return new Response("ok");
      }

      /*
       * Ответ менеджера человеку в MAX.
       *
       * Работает как переписка: менеджер отвечает (reply) на уведомление о
       * новом человеке или на его вопрос — и текст уходит адресату в MAX.
       * Ничего запоминать и никуда переходить не нужно, а главное — из
       * Telegram в чат MAX перейти нельзя в принципе, так что другого пути
       * ответить у менеджера просто нет.
       *
       * Отвечать может только свой: уведомления приходят в рабочий чат, но
       * писать от имени компании — не то право, которое раздают по факту
       * присутствия в чате.
       */
      if (msg?.reply_to_message?.message_id && typeof msg.text === "string" && msg.text.trim()) {
        const map = (await kvGet(env, "max:replyTo", {})) || {};
        const target = map[String(msg.reply_to_message.message_id)];
        if (target) {
          const perm = await permsOf(env, msg.from?.id);
          if (!perm) return new Response("ok");

          const sent = await maxWrite(env, target, msg.text.trim());
          await api(env, "sendMessage", {
            chat_id: msg.chat.id,
            reply_to_message_id: msg.message_id,
            text: sent?.ok
              ? "✅ Отправлено в MAX"
              : "⚠️ MAX не принял сообщение: " +
                JSON.stringify(sent?.data ?? sent?.raw ?? sent?.error ?? "неизвестно"),
          });
          return new Response("ok");
        }
      }

      /*
       * /max — подключить бота в MAX и проверить связь.
       *
       * Настройка второго мессенджера через служебный адрес воркера не
       * годится: его домен у российских провайдеров закрыт, и открыть
       * ссылку получается не у всех — а нужна она ровно тогда, когда
       * что-то не работает. Команда приходит обычным сообщением.
       *
       * Токен MAX в секретах воркера: код его не хранит и не показывает.
       */
      if (msg && typeof msg.text === "string" && /^\/max(@\w+)?\b/.test(msg.text.trim())) {
        const perm = await permsOf(env, msg.from?.id);
        if (!perm?.owner) return new Response("ok");

        if (!env.MAX_BOT_TOKEN) {
          await api(env, "sendMessage", {
            chat_id: msg.chat.id,
            text:
              "⚠️ Токен MAX не задан.\n\nCloudflare → Workers & Pages → diauto-bot → " +
              "Settings → Variables and Secrets → Add → тип Secret, имя `MAX_BOT_TOKEN`, " +
              "значение — токен из настроек бота в MAX. После сохранения пришлите /max ещё раз.",
            parse_mode: "Markdown",
          });
          return new Response("ok");
        }

        const bound = await maxBind(env, url.origin);
        const who = bound.me?.data?.name || bound.me?.data?.username || "—";
        const hookOk = bound.hook?.ok;
        await api(env, "sendMessage", {
          chat_id: msg.chat.id,
          text:
            (bound.me?.ok ? `✅ Токен принят. Бот в MAX: ${who}` : "⚠️ MAX не принял токен") +
            "\n" +
            (hookOk ? "✅ Вебхук подписан" : "⚠️ Вебхук: " + JSON.stringify(bound.hook?.data ?? bound.hook?.raw ?? bound.hook)) +
            "\n" +
            (bound.commands?.ok
              ? "✅ Команды в подсказках: /start, /catalog, /lead, /reviews"
              : "⚠️ Команды: " + JSON.stringify(bound.commands?.data ?? bound.commands?.raw ?? bound.commands)) +
            "\n" +
            (await maxAppButtonReport(env, kvGet)) +
            "\n\nНапишите боту в MAX «привет» — он должен ответить меню с каталогом.",
        });
        return new Response("ok");
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
        /*
         * Весь /start работает с ОДНОЙ копией списка пользователей.
         *
         * Раньше здесь было три чтения и три записи этого списка: запись
         * нового человека, фиксация метки кампании и отметки времени — каждая
         * ходила в хранилище отдельно. Список хранится одним куском и растёт с
         * каждым новым человеком, поэтому цена росла вместе с ним: на трёх
         * десятках пользователей это 12 КБ чтения и 13 КБ записи на один
         * /start, а на трёх тысячах — уже по 1,2 МБ в каждую сторону. Замерено.
         *
         * Хуже того, три записи подряд в один ключ — это ещё и гонка: у
         * Cloudflare запись в один ключ ограничена одним разом в секунду, и
         * при потоке с рекламы соседние /start затирали бы друг друга.
         *
         * Теперь читаем один раз, всё меняем в памяти, пишем один раз в конце.
         */
        const users = (await kvGet(env, "users", {})) || {};
        const uid = String(msg.from?.id ?? "");
        const wasKnown = !!users[uid];
        const me = users[uid] || {
          name: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" "),
          username: msg.from?.username || "",
          ts: Date.now(),
        };

        const settings = await getSettings(env);

        /*
         * Уведомление админам о новом человеке — уже после ответа.
         *
         * Раньше оно стояло здесь же, но с await: приветствие не уходило,
         * пока мы не достучимся до чата заявок. То есть новый человек —
         * ровно тот, у кого первое впечатление о боте, — ждал дольше всех,
         * причём ждал нашей внутренней переписки. Теперь уведомление
         * доставляется параллельно и на скорость ответа не влияет.
         */
        if (!wasKnown) later(ctx, notifyNewUser(env, msg.from, settings));

        // Метка из диплинка: вариант А/Б и источник кампании. Фиксируется
        // один раз, чтобы повторный /start не перекинул человека в другую
        // группу теста.
        const { variant, src } = parseStartPayload(msg.text);
        if (!me.v) me.v = variant;
        if (!me.src && src) me.src = src;
        // Вариант берём сохранённый: человек мог вернуться уже без метки.
        const myVariant = me.v || variant;

        if (gateApplies(settings, myVariant)) {
          const member = await isChannelMember(env, settings.gateChannelId, msg.from.id);
          // Стену показываем только при твёрдом «не подписан». Если проверка
          // не удалась (null), пускаем: см. isChannelMember.
          if (member === false) {
            await sendGate(env, msg.chat.id, settings);
            // Метку кампании сохраняем даже тому, кто упёрся в стену: иначе
            // при повторном заходе он попал бы в другую группу теста.
            users[uid] = me;
            later(ctx, kvPut(env, "users", users));
            return new Response("ok");
          }
          if (member === true) me.subAt = Date.now();
        }

        await sendWelcome(env, msg.chat.id, settings);

        // Единственная запись за весь /start — и та уже после приветствия.
        me.openedAt = Date.now();
        users[uid] = me;
        later(ctx, kvPut(env, "users", users));
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
      const sent = await sendLead(env, leadText(d), d.photo);
      // Заявка уже сохранена, поэтому при сбое доставки возвращаем причину —
      // по ней видно, что не так с чатом.
      return json(
        { ok: sent.ok, chatId: sent.chatId, errors: sent.errors },
        sent.ok ? 200 : 502,
      );
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
        /*
         * Виден ли воркеру токен MAX.
         *
         * Само значение наружу не отдаём — только «есть или нет». Этого
         * достаточно, чтобы отличить «секрет не доехал до воркера» от «MAX
         * не принял токен», а перепутать эти два случая проще всего:
         * в панели Cloudflare переменную можно добавить и забыть нажать
         * «Deploy», и снаружи это выглядит точно так же, как её отсутствие.
         */
        hasMaxToken: !!env.MAX_BOT_TOKEN,
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
      /*
       * Счётчик просмотров ведём уже после ответа.
       *
       * Ответ на этот запрос никто не читает — страница просто сообщает, что
       * карточку открыли. Держать её ради записи в хранилище незачем, а
       * карточки открывают часто: на каждую уходило чтение и запись общей
       * статистики, и всё это до ответа.
       */
      if (b?.id) later(ctx, bumpView(env, String(b.id)));
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
      // Как и с просмотрами: считаем после ответа, ответ никто не ждёт.
      if (b?.id && b?.on && env.STORE) {
        later(
          ctx,
          (async () => {
            try {
              const stats = (await kvGet(env, "stats", {})) || {};
              stats.favs = stats.favs || {};
              stats.favs[String(b.id)] = (stats.favs[String(b.id)] || 0) + 1;
              await kvPut(env, "stats", stats);
            } catch {
              /* статистика не должна ломать сценарий */
            }
          })(),
        );
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
      // Запись «человек открыл мини-апп» — после ответа. Мини-апп ждёт этот
      // ответ на старте, а запись трогает общий список пользователей.
      if (auth.ok) later(ctx, recordUser(env, auth.user));
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

    /*
     * --- MAX ---
     *
     * Вебхук второго мессенджера. Отвечаем ok всегда и как можно раньше:
     * MAX, как и Telegram, повторяет доставку при неудаче, а повторно
     * заведённая заявка хуже пропущенной ошибки.
     */
    if (url.pathname === "/max" && request.method === "POST") {
      if (!env.MAX_BOT_TOKEN) return new Response("max off", { status: 200 });
      let upd = null;
      try {
        upd = await request.json();
      } catch {
        return new Response("ok");
      }
      const work = handleMaxUpdate(env, upd, {
        kvGet,
        kvPut,
        // Заявка — только с телефоном: она идёт в общий список и в чат заявок.
        onLead: async (e, lead) => {
          await storeLead(e, lead);
          await api(e, "sendMessage", {
            chat_id: e.TELEGRAM_CHAT_ID,
            text: leadText(lead),
          });
        },
        /*
         * Вопрос — не заявка.
         *
         * Уходит тем же людям, что и заявки (это чат менеджеров, клиенты его
         * не видят), но в список заявок не попадает: по нему считают, сколько
         * обращений принесла реклама, и «привет» без телефона там только
         * портит счёт.
         */
        /*
         * Новый человек в MAX — уведомление туда же, куда телеграмное.
         *
         * Менеджеру всё равно, из какого мессенджера пришёл клиент; ему важно
         * не пропустить его. Поэтому один чат на оба бота, а мессенджер
         * назван в первой строке — по ней и понятно, где отвечать.
         */
        onNewUser: async (e, u) => {
          const st = await getSettings(e);
          const targets = [
            ...new Set([String(st.leadChatId || "").trim(), e.TELEGRAM_CHAT_ID].filter(Boolean)),
          ];
          /*
           * Ссылку на переписку спрашиваем у самого MAX.
           *
           * Уведомление без неё почти бесполезно: имя есть, а открыть чат
           * нечем — из Telegram в MAX не перейти. Если ссылки нет (у человека
           * нет ника и диалог её не отдаёт), остаётся ответ через бота, и об
           * этом сказано прямо, а не «свяжитесь как-нибудь».
           */
          const link = await maxChatLink(e, u.chatId, u.username);
          const text = [
            "👋 <b>Новый пользователь — бот в MAX</b>",
            `👤 Имя: ${htmlEscape(u.name || "—")}`,
            `🔗 Ник: ${htmlEscape(u.username ? "@" + u.username : "без ника")}`,
            `🆔 ID: ${u.id}`,
            "",
            link
              ? `<a href="${htmlEscape(link)}">💬 Открыть переписку в MAX</a>`
              : "💬 Ссылки на профиль у человека нет (не указан ник).",
            "↩️ Или ответьте на это сообщение — ответ уйдёт ему в MAX.",
          ].join("\n");
          for (const chatId of targets) {
            try {
              const r = await api(e, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML" });
              const j = await r.json().catch(() => null);
              if (j?.ok) {
                await linkReply(e, j.result?.message_id, u.id);
                return;
              }
            } catch {
              /* пробуем следующий адрес */
            }
          }
        },
        onQuestion: async (e, userId, text) => {
          const r = await api(e, "sendMessage", {
            chat_id: e.TELEGRAM_CHAT_ID,
            text: `❓ Вопрос из MAX\n\n${text}\n\n↩️ Ответьте на это сообщение — ответ уйдёт человеку в MAX.`,
          });
          const j = await r.json().catch(() => null);
          if (j?.ok) await linkReply(e, j.result?.message_id, userId);
        },
      }).catch(() => {});
      later(ctx, work);
      // Без ctx (вызов вне Cloudflare) дожидаемся сами: иначе работа
      // оборвётся вместе с ответом.
      if (!ctx) await work;
      return new Response("ok");
    }

    // Привязка вебхука MAX. Ключ — токен телеграмного бота: тот же приём,
    // что и у остальных служебных адресов воркера.
    if (url.pathname === "/max/setup") {
      if (!env.TELEGRAM_BOT_TOKEN || url.searchParams.get("key") !== env.TELEGRAM_BOT_TOKEN)
        return json({ ok: false, error: "forbidden" }, 403);
      return json({ ok: true, ...(await maxBind(env, url.origin)) });
    }

    if (url.pathname === "/max/diag") {
      if (!env.TELEGRAM_BOT_TOKEN || url.searchParams.get("key") !== env.TELEGRAM_BOT_TOKEN)
        return json({ ok: false, error: "forbidden" }, 403);
      return json(await maxDiag(env, kvGet));
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

      return handleAdmin(env, action, payload, perm, auth.user, url.origin);
    }

    /*
     * --- Отзывы для CRM ---
     *
     * CRM живёт на своём сервере, входит по своему паролю и про Telegram
     * ничего не знает — подписью мини-аппа она представиться не может. Поэтому
     * у неё отдельный ключ: владелец берёт его в боте командой /crm и вставляет
     * в CRM один раз.
     *
     * Ключ узкий по замыслу: им можно только смотреть и удалять отзывы.
     * Утечка ключа с сервера сайта не должна означать доступ к каталогу,
     * заявкам, рассылке и настройкам бота.
     */
    if (url.pathname === "/api/crm" && request.method === "POST") {
      const key = String(await kvGet(env, "crmKey", "") || "");
      const given = request.headers.get("X-Crm-Key") || "";
      // Ключа нет — соединять не с чем; так и говорим, чтобы CRM показала
      // владельцу инструкцию, а не «неверный ключ».
      if (!key) return json({ ok: false, error: "not_paired" }, 401);
      if (!timingSafeEqual(given, key))
        return json({ ok: false, error: "bad_key" }, 401);

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ ok: false, error: "bad_json" }, 400);
      }
      const { action, payload } = body || {};
      if (!CRM_ACTIONS.includes(action))
        return json({ ok: false, error: "unknown_action" }, 400);

      return handleAdmin(
        env,
        action,
        payload,
        { owner: false, caps: new Set(["reviews"]) },
        { id: 0, first_name: "CRM" },
        url.origin,
      );
    }

    return new Response("DiAvto69 worker is running", { headers: cors });
  },
};

/**
 * Отправка заявки менеджеру. Сначала в чат из админки, при неудаче — в чат
 * из переменных Cloudflare: неверно указанный id не должен приводить к
 * полной потере заявки.
 */
async function sendLead(env, caption, photo) {
  const st = await getSettings(env);
  const custom = String(st.leadChatId || "").trim();
  const targets = [...new Set([custom, env.TELEGRAM_CHAT_ID].filter(Boolean))];
  const errors = [];

  for (const chatId of targets) {
    if (photo) {
      const r = await sendPhotoDataUrl(env, chatId, photo, caption);
      if (r.ok) return { ok: true, chatId, errors };
    }
    const r = await api(env, "sendMessage", { chat_id: chatId, text: caption });
    let j = null;
    try {
      j = await r.json();
    } catch {
      /* ответ без json — считаем ошибкой ниже */
    }
    if (j?.ok) return { ok: true, chatId, errors };
    errors.push(`${chatId}: ${j?.error_code || r.status} ${j?.description || ""}`.trim());
  }
  return { ok: false, chatId: null, errors };
}

/* ---------- Заявки в KV (последние 50) ---------- */
/*
 * Связка «уведомление в Telegram → человек в MAX».
 *
 * Из Telegram в чат MAX не перейти: там другой мессенджер и другие
 * идентификаторы. Значит либо менеджер вообще не может ответить новому
 * человеку, либо отвечает через бота. Второе и делаем: запоминаем, какому
 * человеку соответствует уведомление, и ответ на него пересылаем в MAX.
 *
 * Храним последние двести связок: переписка старше этого всё равно ведётся
 * не ответом на давнее уведомление, а списком в CRM.
 */
async function linkReply(env, messageId, maxUserId) {
  if (!messageId || !maxUserId) return;
  try {
    const map = (await kvGet(env, "max:replyTo", {})) || {};
    map[String(messageId)] = String(maxUserId);
    const keys = Object.keys(map);
    if (keys.length > 200) {
      // Ключи растут по номеру сообщения, поэтому старые — в начале списка.
      for (const k of keys.sort((a, b) => Number(a) - Number(b)).slice(0, keys.length - 200)) {
        delete map[k];
      }
    }
    await kvPut(env, "max:replyTo", map);
  } catch {
    /* потеря связки не должна ронять уведомление */
  }
}

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
      /*
       * Метки рекламы — отдельно от «источника».
       *
       * Источник отвечает на вопрос «с какой страницы», метки — «по какому
       * объявлению». Без вторых нельзя ни отключить пустую кампанию, ни
       * усилить работающую: в списке заявок все выглядят одинаково.
       */
      ad: adSummary(d.ad),
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
  /^(цена|стоимость|price|год|year|модел|двигатель|мотор|объ[её]м|мощность|пробег|mileage|коробк|кпп|акпп|мкпп|трансмисс|привод|drive|цвет|color|кузов|топлив|компле|таможн|растаможк|под\s*ключ|итог|наличи|заказ|в\s*пути)/i;
/*
 * Строки, которые моделью быть не могут ни при каких условиях.
 *
 * Появилось после того, как в каталог уехали четыре карточки с названием
 * «До Москвы под ключ - всего»: строка с ценой начинается со слова «до», под
 * шаблон ярлыков не попадала и оказывалась первой осмысленной строкой поста.
 * Проверка ярлыков по началу строки тут бессильна — нужен запрет по смыслу.
 */
const NOT_MODEL_RE =
  /(под\s*ключ|до\s+(москв|твер|владивосток)|всего\s+за|цена|стоимост|₽|руб\b|\d[\d\s.,]{5,})/i;

// Строки-заголовки объявления — тоже не модель («НОВЫЙ АВТОМОБИЛЬ!!!!» и т.п.).
const HEADER_RE =
  /^(нов(ый|ое|ая|ые|ые\s|инка)|автомобил[ьия]|прода|в\s*прода|распрода|поступил|в\s*наличии|в\s*продаже|в\s*пути|под\s*заказ|доступен|доступна|доступно|ожида|готов\s|прибыл|приедет|выкуплен|забронир|бронир|резерв|свободен|принима|заявк|срочно|торг|обмен|скидк|акци|выгодн|кредит|рассрочк|лизинг|успей|спешит|осталось|последний|эксклюзив|лучшая\s*цена|цена\s*дня|хит\b|автомобиль\b|авто\b|new\b|sale\b|продан)/i;

// Похоже ли на название модели: латиница (Kia Sportage, JETTA VS8) либо
// короткая строка без глаголов. Рекламные фразы вроде «ДОСТУПЕН К ЗАКАЗУ»
// длиннее и состоят из обычных слов, поэтому отсекаются.
/**
 * Похоже ли на название комплектации, а не на фразу из описания.
 *
 * Комплектация — это «Sharp Edition», «Luxury Smart», «Максимальная»: пара
 * слов без глаголов. Всё длиннее и с законченным предложением — рекламный
 * текст, ему место в описании, а не в подписи карточки.
 */
function looksLikeTrim(s) {
  const t = String(s || "").trim();
  if (t.length < 2 || t.length > 32) return false;
  if (/[.!?]$/.test(t)) return false;
  if (t.split(/\s+/).filter(Boolean).length > 4) return false;
  return !/(оснащ|имеет|включа|установ|есть\b|доступн|привез)/i.test(t);
}

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
    (l) =>
      hasLetters(l) &&
      !LABEL_RE.test(l) &&
      !HEADER_RE.test(l) &&
      !NOT_MODEL_RE.test(l) &&
      l.length >= 2,
  );
  const stripYear = (l) =>
    l
      .replace(/\s*[—\-–,]?\s*(19|20)\d{2}\s*(г(од)?\.?|year)?\s*$/i, "")
      .replace(/[.,;:!]+$/, "")
      .trim();
  let model = "";

  /*
   * Статья из канала: марка стоит заголовком, модель — строкой таблицы.
   *
   * «HYUNDAI» сверху и «Модель: Elantra» в таблице — это одна машина, и в
   * каталог она должна попасть как «HYUNDAI Elantra». Если взять только
   * заголовок, каталог заполнится десятком одинаковых «HYUNDAI»; если только
   * строку таблицы — пропадёт марка, а по ней работают и фильтр, и определение
   * страны вывоза.
   */
  const modelRow = bodyRaw.match(/(?:^|\n)\s*модел[ьи]\s*[:：—–-]+\s*([^\n]+)/i);
  if (modelRow) {
    // «Модель: GOLF:» — двоеточие пришло из соседней ячейки таблицы.
    const value = stripYear(cleanLine(modelRow[1]).replace(/\s*[:：]\s*$/, ""));
    const head = candidates.find((l) => looksLikeModel(l)) || "";
    const brandHead = stripYear(head);
    const fitsBrand =
      brandHead &&
      brandHead.split(/\s+/).filter(Boolean).length <= 2 &&
      !value.toLowerCase().includes(brandHead.toLowerCase());
    model = fitsBrand ? `${brandHead} ${value}`.trim() : value;
  }

  // Сначала ищем строку, похожую на название модели, и только потом берём
  // первую попавшуюся — иначе в модель попадали фразы вроде «Доступен к заказу».
  if (!model) for (const l of candidates) {
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
  /*
   * «Двигатель: 1.4Т» — объём без буквы «л».
   *
   * В таблице пишут по-своему: «1.4Т», «2.0T», «1.5». Единицы там нет, зато
   * есть ярлык, и после него число меньше десяти может означать только литры.
   */
  if (!engineCc) {
    const volLabeled = bodyRaw.match(/(?:двигатель|мотор|объ[её]м)\s*[:：]\s*(\d(?:[.,]\d)?)(?!\d)/i);
    if (volLabeled) {
      const litres = Number(volLabeled[1].replace(",", "."));
      if (litres > 0 && litres < 10) engineCc = Math.round(litres * 1000);
    }
  }
  const ccM = bodyRaw.match(/(\d{3,4})\s*(?:куб|см³|cc)/i);
  if (!engineCc && ccM) engineCc = Number(ccM[1]);
  const hpM = bodyRaw.match(/(\d{2,4})\s*(?:л\.?\s*с\.?|hp|л\.с)/i);
  if (hpM) powerHp = Number(hpM[1]);

  // Пробег
  let mileageKm = 0;
  // Учитываем разделители тысяч (точка/пробел/запятая): «39.700 км» = 39700.
  //
  // После слова «Пробег» единицу измерения НЕ требуем: в канале пишут и
  // «41.000м», и «41000», и просто «41 тыс». Раньше такие посты не
  // распознавались, пробег оставался нулевым, а нулевой пробег означает
  // «новый» — машина с 41 000 км уезжала в каталог с пометкой «Новый, 0 км».
  //
  // Запасной шаблон (число где-то в тексте) единицу по-прежнему требует:
  // без метки «пробег» отличить его от цены или мощности нечем.
  const mileLabeled = bodyRaw.match(/пробег[^\d\n]*([\d][\d\s.,]*)\s*(тыс[а-я.]*|км|km|m|м)?/i);
  const mileBare = bodyRaw.match(/([\d][\d\s.,]{2,})\s*(км|km)\b/i);
  const mileM = mileLabeled || mileBare;
  if (mileM) {
    mileageKm = Number(String(mileM[1]).replace(/[^\d]/g, ""));
    if (/тыс/i.test(mileM[2] || "")) mileageKm *= 1000;
    // Защита от разбора мусора: столько не ездят, значит это не пробег.
    if (!Number.isFinite(mileageKm) || mileageKm > 2_000_000) mileageKm = 0;
  }

  // Коробка / привод / кузов / топливо
  const gearbox = /вариатор|cvt/i.test(bodyRaw) ? "Вариатор"
    : /робот|dsg|dct/i.test(bodyRaw) ? "Робот"
    : /механик|мкпп|manual/i.test(bodyRaw) ? "МКПП"
    : /автомат|акпп|a\/t|at\b/i.test(bodyRaw) ? "АКПП" : "";
  const driveRaw = `${raw}\n${bodyRaw}`;
  /*
   * Привод пишут двумя способами, и порядок слов в них обратный.
   *
   * В подписи к посту — «полный привод», в таблице статьи — «Привод: полный».
   * Шаблон, который требовал слова «привод» ПОСЛЕ типа, на таблице не
   * срабатывал, и машина уезжала в каталог без привода — то есть выпадала из
   * фильтра по нему.
   */
  const driveLabel = driveRaw.match(/привод\s*[:：—–-]+\s*([^\n]+)/i);
  const driveText = `${driveRaw}\n${driveLabel ? driveLabel[1] : ""}`;
  const drive = /полн(ый)?\s*привод|привод\s*[:：—–-]+\s*полн|\bawd\b|\b4wd\b|4x4|4matic|quattro|xdrive|4motion|allrad|\bатт?esa\b/i.test(driveText)
    ? "Полный"
    : /задн(ий)?\s*привод|привод\s*[:：—–-]+\s*задн|\brwd\b/i.test(driveText) ? "Задний"
    : /перед(ний)?\s*привод|привод\s*[:：—–-]+\s*перед|\bfwd\b/i.test(driveText) ? "Передний" : "";
  const bodyTypeM = (bodyRaw.match(/седан|кроссовер|внедорожник|хэтчбек|хетчбек|универсал|купе|минивэн|пикап|лифтбек|кабриолет/i) || [""])[0];
  const fuelType = /гибрид|hybrid/i.test(bodyRaw) ? "Гибрид"
    : /электро|electric|ev\b/i.test(bodyRaw) ? "Электро"
    : /дизел/i.test(bodyRaw) ? "Дизель"
    : /бензин/i.test(bodyRaw) ? "Бензин" : "";

  // Руль: левый / правый (частая характеристика для авто из Японии).
  const steering = /руль[:\s—-]*прав|правый\s*руль|правостор|\brhd\b/i.test(bodyRaw) ? "Правый"
    : /руль[:\s—-]*лев|левый\s*руль|левостор|\blhd\b/i.test(bodyRaw) ? "Левый" : "";

  // Комплектация (trim) — по метке «Комплектация: …».
  // Пишут её по-разному: то названием («Sharp Edition»), то целой фразой
  // («оснащена тремя блокировками дифференциалов»). В карточке это короткая
  // подпись рядом с годом, поэтому берём только название; фраза никуда не
  // пропадает — она остаётся в описании (highlights).
  const trimM = bodyRaw.match(/комплектац[а-яё]*\s*[:：—-]?\s*([^\n]+)/i);
  // Хвост «Страна: ОАЭ» склеивался с комплектацией, когда метки в посте шли
  // одной строкой. Страна на карточке есть флажком — из подписи её убираем.
  const trimRaw = trimM ? cleanLine(trimM[1]).replace(/\s*страна\s*[:：—-]?\s*\S+\s*$/i, "").trim() : "";
  const trim = looksLikeTrim(trimRaw) ? trimRaw : "";

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
  // ОАЭ проверяем первым: их машины — это японские и немецкие марки с арабских
  // рынков, и по марке они иначе улетели бы в Японию/Европу.
  const byText = /оаэ|эмират|\buae\b|dubai|дуба[йяе]/i.test(raw) ? "ae"
    : /коре|korea/i.test(raw) ? "kr"
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

/* ---------- Посты-статьи из канала ---------- */

/*
 * Авто выкладывают в канал статьёй, а не обычным постом.
 *
 * У обычного поста всё содержимое лежало в двух полях: подпись (caption или
 * text) и фотографии (photo). У статьи иначе: заголовок, карусель снимков и
 * таблица характеристик приезжают отдельным деревом блоков. Подпись при этом
 * может быть пустой или неполной — например, в ней не будет ни модели, ни
 * пробега, потому что они стоят строками таблицы.
 *
 * Разбирать это дерево «по схеме» нельзя: набор блоков Telegram расширяет, и
 * жёсткий разбор молча перестанет находить характеристики ровно в тот день,
 * когда в статью добавят новый элемент. Поэтому обход терпимый: он собирает
 * текст и файлы отовсюду, где они лежат, а незнакомые блоки просто проходит
 * насквозь. Худшее, что может случиться, — лишняя строка в описании; это
 * несравнимо дешевле, чем карточка без пробега и цены.
 */

/** Поля, в которых у блока может лежать собственный текст. */
const RICH_TEXT_KEYS = ["text", "caption", "title", "subtitle", "value", "label"];

/**
 * Построчный текст из дерева блоков.
 *
 * Строка таблицы обязана остаться парой: «Модель | Elantra» превращается в
 * «Модель: Elantra» — именно в таком виде характеристику находит разборщик.
 * Разорви эту пару на две строки — и «Elantra» станет отдельной строкой без
 * ярлыка, то есть кандидатом в название модели, а «Модель» — мусором.
 */
function richLines(node, out = [], depth = 0) {
  if (node == null || depth > 8) return out;
  if (typeof node === "string") {
    const s = node.trim();
    if (s) out.push(s);
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) richLines(item, out, depth + 1);
    return out;
  }
  if (typeof node !== "object") return out;

  if (Array.isArray(node.cells)) {
    const parts = node.cells
      .map((cell) => richLines(cell, [], depth + 1).join(" ").trim())
      .filter(Boolean);
    if (parts.length === 1) out.push(parts[0]);
    else if (parts.length > 1) {
      // Двоеточие в ячейке-ярлыке («Модель:») уже есть — второе сделало бы из
      // строки «Модель:: Elantra», и ярлык перестал бы распознаваться.
      const label = parts[0].replace(/\s*[:：]\s*$/, "");
      out.push(`${label}: ${parts.slice(1).join(" ")}`);
    }
    return out;
  }

  for (const key of RICH_TEXT_KEYS) {
    if (typeof node[key] === "string") {
      const s = node[key].trim();
      if (s) out.push(s);
    }
  }
  /*
   * Вглубь идём по ВСЕМ полям, а не по списку знакомых.
   *
   * Список подвёл ровно так, как и должен был: таблица характеристик в
   * реальной статье лежала под именем, которого в нём не оказалось, — и в
   * каталог поехали карточки без модели, года и пробега. Имя поля мы угадать
   * не можем, а вот текст внутри узнаём по тем же ключам, что и всегда.
   */
  for (const [key, kid] of Object.entries(node)) {
    if (MEDIA_SKIP_KEYS.has(key) || !kid || typeof kid !== "object") continue;
    richLines(kid, out, depth + 1);
  }
  return out;
}

/**
 * Весь текст поста: подпись плюс содержимое статьи.
 *
 * Повторы убираем: заголовок статьи нередко дублируется и в подписи, а
 * дважды повторённая строка сбивает разбор описания.
 */
function postText(post) {
  const plain = String(post?.caption || post?.text || "").trim();
  const rich = [];
  for (const root of richRoots(post)) richLines(root, rich);
  if (!rich.length) return plain;

  const seen = new Set();
  const out = [];
  for (const line of [...plain.split("\n"), ...rich]) {
    const s = String(line).trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return joinLabels(out.flatMap(splitSpecLine)).join("\n");
}

/**
 * Ярлыки характеристик, по которым режется слипшаяся строка таблицы.
 *
 * Telegram отдаёт таблицу статьи одной строкой: «Модель: GOLF: Год выпуска:
 * 2022/03 Пробег: 29.000KM …». Для разборщика это одна характеристика с
 * бесконечным значением — он ищет число в строке со словом «пробег» и находит
 * там же год, мощность и цену. Режем строку перед каждым ярлыком, и таблица
 * снова становится таблицей.
 */
const SPEC_SPLIT_RE =
  /(?=(?:модель|год\s*выпуска|пробег|двигатель|мощность|привод|коробка|кпп|трансмиссия|комплектация|кузов|цвет|топливо|руль|состояние|страна|объ[её]м)\s*[:：])/gi;

function splitSpecLine(line) {
  const parts = String(line)
    .split(SPEC_SPLIT_RE)
    .map((s) => s.trim())
    .filter(Boolean);
  // Одна часть — значит ярлыков в строке не было и резать нечего.
  return parts.length > 1 ? parts : [line];
}

/**
 * Склеить ярлык со значением, если они оказались на разных строках.
 *
 * Таблица характеристик может прийти как угодно: парой ячеек в строке или
 * двумя отдельными строками — «Пробег:» и следом «23.000 км». Во втором
 * случае разборщик не найдёт ни одной характеристики: он ищет число в той же
 * строке, что и слово «пробег». Именно так в каталог уехали карточки без
 * года, пробега и двигателя.
 */
function joinLabels(lines) {
  const isLabel = (l) => /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё\s().]{1,28}[:：]$/.test(l);
  // «Цена до Москвы с утильсбором и ЭПТС.» и следом «2.160.000₽!» — цена
  // города, разорванная надвое. Порознь это строка без числа и число без
  // города, вместе — «до Москвы 2 160 000».
  const isPriceIntro = (l) => /цена|стоимост|под\s*ключ|до\s+(москв|твер)/i.test(l) && !/\d/.test(l);
  const isAmount = (l) => /^[^\dA-Za-zА-Яа-яЁё]*[\d][\d\s.,]*\s*(₽|руб|р\.?)?[!.…]*$/i.test(l);

  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const next = lines[i + 1];
    if (next && ((isLabel(line) && !isLabel(next)) || (isPriceIntro(line) && isAmount(next)))) {
      out.push(`${line} ${next}`.replace(/\s+/g, " "));
      i += 1;
      continue;
    }
    out.push(line);
  }
  return out;
}

/*
 * Баннер-полоса из статьи — не фотография машины.
 *
 * В публикацию вставляют картинку с преимуществами: широкая полоса во всю
 * ширину поста. Для бота это такой же снимок, как и остальные, и он приезжал
 * в галерею карточки шестым фото — между салоном и двигателем.
 *
 * Отличаем по пропорциям: снимок автомобиля с площадки — это 4:3 или 16:9,
 * то есть не шире двух к одному. Всё, что заметно вытянуто в строку (или,
 * наоборот, в столб), — оформление, а не машина.
 */
function looksLikeBanner(size) {
  const w = Number(size?.width) || 0;
  const h = Number(size?.height) || 0;
  if (!w || !h) return false;
  const ratio = w / h;
  return ratio >= 2.2 || ratio <= 0.42;
}

/** Похож ли массив на набор размеров одной фотографии (PhotoSize[]). */
function isPhotoSizes(v) {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((x) => x && typeof x === "object" && x.file_id && Number(x.width) > 0)
  );
}

/*
 * Поля, в которые за файлами лезть не надо.
 *
 * thumbnail/thumb — уменьшенная копия: возьмёшь её как самостоятельный снимок,
 * и в карточке появится мыльный дубль. Остальное — служебные части сообщения,
 * где встречаются чужие вложения (пересланный пост, ответ, разметка кнопок).
 */
const MEDIA_SKIP_KEYS = new Set([
  "thumbnail",
  "thumb",
  "entities",
  "caption_entities",
  "reply_markup",
  "reply_to_message",
  "external_reply",
  "forward_origin",
  "link_preview_options",
  "chat",
  "sender_chat",
  "from",
]);

/**
 * Фото и видео из дерева блоков — карусель статьи лежит именно там.
 *
 * Обходим ВСЕ поля, а не список знакомых: как именно Telegram назовёт узел с
 * каруселью, заранее неизвестно, а цена ошибки — карточка с одним снимком
 * вместо десяти. Опознаём не по имени поля, а по содержимому: массив размеров
 * одной фотографии узнаётся по file_id и ширине у каждого элемента.
 */
function richFiles(node, out = { photos: [], videos: [] }, depth = 0) {
  if (node == null || depth > 10 || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    if (isPhotoSizes(node)) {
      const largest = node[node.length - 1];
      if (!looksLikeBanner(largest) && !out.photos.includes(largest.file_id)) {
        out.photos.push(largest.file_id);
      }
      return out;
    }
    for (const item of node) richFiles(item, out, depth + 1);
    return out;
  }

  const photo = bestFileId(node);
  if (photo && !out.photos.includes(photo)) out.photos.push(photo);
  const video = videoFileId(node);
  if (video && !out.videos.includes(video)) out.videos.push(video);

  for (const [key, kid] of Object.entries(node)) {
    if (MEDIA_SKIP_KEYS.has(key) || !kid || typeof kid !== "object") continue;
    richFiles(kid, out, depth + 1);
  }
  return out;
}

/**
 * Дерево статьи может приехать не только полем rich_message.
 *
 * Имя поля у Telegram менялось и ещё поменяется, а узнать об этом мы можем
 * только по тому, что каталог перестал наполняться. Поэтому смотрим в
 * несколько мест сразу: лишняя проверка ничего не стоит.
 */
function richRoots(post) {
  return [post?.rich_message, post?.article, post?.blocks, post?.content].filter(
    (v) => v && typeof v === "object",
  );
}

/**
 * Все фотографии поста.
 *
 * У обычного поста она одна: альбом Telegram присылает отдельными
 * сообщениями, и каждое добавляет свой снимок к той же карточке. У статьи
 * вся карусель приходит одним обновлением — значит и забрать надо всю, иначе
 * в каталоге у машины останется одно фото из десяти.
 */
function postPhotoIds(post) {
  const ids = [];
  const first = bestFileId(post);
  if (first) ids.push(first);
  for (const root of richRoots(post)) {
    for (const id of richFiles(root).photos) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

/**
 * Слепок устройства поста: какие поля пришли, без их содержимого.
 *
 * Формат постов в канале меняется — сегодня подпись к фото, завтра статья с
 * таблицей. Понять, что именно приехало, по сайту нельзя: видно лишь, что
 * карточка собралась неполной. Слепок отвечает на этот вопрос за секунду и не
 * хранит ни текста, ни файлов — только имена полей и типы значений.
 */
function shapeOf(node, depth = 0) {
  if (node === null || node === undefined) return null;
  if (Array.isArray(node)) {
    if (!node.length) return [];
    // Элементы массива однотипны — одного примера достаточно.
    return [`×${node.length}`, shapeOf(node[0], depth + 1)];
  }
  if (typeof node === "object") {
    if (depth > 5) return "{…}";
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = shapeOf(v, depth + 1);
    return out;
  }
  return typeof node;
}

/** Все видео поста — так же, как и фотографии. */
function postVideoIds(post) {
  const ids = [];
  const first = videoFileId(post);
  if (first) ids.push(first);
  for (const root of richRoots(post)) {
    for (const id of richFiles(root).videos) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

// Лучший file_id из сообщения: крупнейшее фото ИЛИ изображение-документ
// (фото, отправленное «файлом» — без сжатия, в полном качестве).
function bestFileId(m) {
  if (Array.isArray(m?.photo) && m.photo.length) {
    const largest = m.photo[m.photo.length - 1];
    return looksLikeBanner(largest) ? null : largest.file_id;
  }
  if (m?.document && /^image\//i.test(m.document.mime_type || ""))
    return m.document.file_id;
  return null;
}

// file_id видео из сообщения (обычное видео или документ с видео-mime).
// file_id видео из сообщения (обычное видео или документ с видео-mime).
function videoFileId(m) {
  if (m?.video?.file_id) return m.video.file_id;
  if (m?.document && /^video\//i.test(m.document.mime_type || ""))
    return m.document.file_id;
  return null;
}

/**
 * file_id кадра-обложки для видео.
 *
 * Телеграм прикладывает к каждому видео картинку первого кадра. Без неё
 * браузер до конца закачки показывает чёрный прямоугольник, а закачка идёт
 * через наш сервер и у тяжёлого отзыва занимает секунды. Обложка весит
 * килобайты и появляется сразу.
 *
 * Поле зовётся thumbnail; в старых версиях Bot API — thumb, и телеграм всё
 * ещё присылает оба. Проверяем оба, иначе обложка потеряется на части
 * сообщений.
 */
function posterFileId(m) {
  for (const src of [m?.video, m?.document]) {
    const t = src?.thumbnail || src?.thumb;
    if (t?.file_id) return t.file_id;
  }
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

/**
 * Отпечаток машины — по нему узнаём повторную публикацию.
 *
 * Берём то, что описывает конкретный экземпляр и не зависит от оформления
 * поста: модель, год, комплектацию, пробег и цену. Фотографии и текст не в
 * счёт — у повторов они как раз разные.
 *
 * Модель приводим к общему виду: в постах она пишется то через дефис, то
 * через пробел, то в разном регистре.
 *
 * Тот же расчёт продублирован на сайте (src/lib/duplicates.ts) для поиска
 * уже накопившихся повторов. Держать их в одном файле нельзя — воркер и сайт
 * это две разные сборки, — поэтому при правке одного правьте и второй.
 */
function carFingerprint(car) {
  const model = String(car.model || "")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "");
  const price = car.priceTverRub ?? car.priceRub ?? 0;
  return [
    model,
    car.year ?? 0,
    String(car.trim || "").toLowerCase().trim(),
    car.mileageKm ?? 0,
    price,
  ].join("|");
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

/**
 * Постоянный идентификатор записи, собранной из поста канала.
 *
 * Раньше это был просто номер сообщения: «tg-1234». Внутри одного канала он
 * уникален, и пока канал был один, всё сходилось. Но нумерация сообщений у
 * КАЖДОГО канала своя и начинается с единицы — а значит пост №1234 из нового
 * канала опознавался бы как уже существующая карточка из старого и МОЛЧА
 * затирал её: цену, фотографии, описание. Не «дубль появился», а «машина
 * подменилась чужой».
 *
 * Поэтому в новый идентификатор входит и канал. Альбомы (media_group_id)
 * обходятся без него: этот номер у Telegram глобальный.
 */
function postSrcId(post, groupId) {
  if (groupId) return "tg-" + groupId;
  const chat = String(post.chat?.id ?? "").replace(/^-100/, "");
  return chat ? `tg-${chat}-${post.message_id}` : "tg-" + post.message_id;
}

/**
 * Как та же запись называлась раньше.
 *
 * Нужен для поиска, а не для записи: всё, что уже лежит в каталоге, отзывах и
 * новостях, сохранено под старым именем. Без этого правка в старом посте не
 * обновляла бы карточку, а создавала бы рядом вторую.
 */
function legacySrcId(post, groupId) {
  return "tg-" + (groupId || post.message_id);
}

/**
 * Найти карточку каталога, которую этот пост уже создавал.
 *
 * Сначала — по новому имени, с каналом внутри: тут двусмысленности нет.
 *
 * Дальше сложнее. Всё, что лежит в каталоге с прежних времён, названо просто
 * по номеру сообщения, и по этому имени в него может «попасть» пост из
 * другого канала с тем же номером — а номера у каждого канала свои и
 * начинаются с единицы. Поэтому старую карточку принимаем за ту же самую
 * только если совпала модель. Не совпала — считаем это другой машиной и
 * заводим отдельную карточку.
 *
 * Так худший исход — лишняя карточка, которую видно и которую можно убрать
 * в админке. Без проверки худшим исходом была бы молча подменённая машина:
 * чужая цена, чужие фотографии, чужое описание на месте настоящей.
 *
 * Карточки, записанные после этой правки, помечены каналом (chatId) — их
 * этот запасной путь не касается вовсе.
 */
function findCarBySrc(catalog, srcId, legacyId, caption) {
  const exact = catalog.find((c) => c.id === srcId);
  if (exact) return exact;

  // Карточка могла вобрать в себя второй пост об этой же машине (см. слияние
  // ниже). Тогда правка того поста должна обновлять её, а не заводить новую.
  const merged = catalog.find(
    (c) => Array.isArray(c.mergedFrom) && c.mergedFrom.includes(srcId),
  );
  if (merged) return merged;

  if (legacyId === srcId) return undefined;

  const legacy = catalog.find((c) => c.id === legacyId && !c.chatId);
  if (!legacy || !caption) return undefined;

  const model = String(parseCaption(caption).model || "").trim().toLowerCase();
  if (!model) return undefined;
  return String(legacy.model || "").trim().toLowerCase() === model ? legacy : undefined;
}

// Авто-публикация: пост канала → карточка в каталоге (upsert по стабильному id).
async function publishFromPost(env, post, caption, fileIds, groupId, origin, videoId) {
  const srcId = postSrcId(post, groupId);
  const legacyId = legacySrcId(post, groupId);
  /*
   * Снимков теперь может быть сразу много.
   *
   * Альбом Telegram присылает отдельными сообщениями — по одному фото в
   * каждом, и карточка набирала их постепенно. Статья приходит целиком: вся
   * карусель в одном обновлении. Поэтому здесь список, а не единственный
   * файл, — иначе от статьи с десятью снимками в каталоге остался бы один.
   */
  const ids = Array.isArray(fileIds) ? fileIds : fileIds ? [fileIds] : [];
  const urls = ids.map((id) => photoUrl(origin, id)).filter(Boolean);
  const vurl = videoId ? videoUrl(origin, videoId) : null;
  let catalog = (await kvGet(env, "catalog", [])) || [];
  if (!Array.isArray(catalog)) catalog = [];
  // Ищем и по новому имени, и по старому: карточки, добавленные до этой
  // правки, лежат под старым — правка поста не должна плодить дубли.
  let car = findCarBySrc(catalog, srcId, legacyId, caption);
  const isNewCar = !car;

  if (!car) {
    // Умное распознавание: создаём карточку только из реального объявления
    // об авто. Благодарности/новости/видеоотчёты в каталог не попадают.
    const parsed = parseCaption(caption);
    if (!isCarListing(parsed, caption)) return;

    /*
     * Без внятного названия карточку не заводим.
     *
     * Так в каталоге появились «ДО МОСКВЫ ПОД КЛЮЧ - ВСЕГО»: разбор не понял
     * пост, но цена в нём была, и запись всё равно создалась. Пустая карточка
     * на витрине хуже её отсутствия — она уже видна покупателю. Молчать тоже
     * нельзя: владелец узнает о пропаже, только не найдя машину на сайте.
     */
    const badModel =
      !parsed.model || NOT_MODEL_RE.test(parsed.model) || !looksLikeModel(parsed.model);
    if (badModel) {
      /*
       * Про один и тот же пост предупреждаем один раз.
       *
       * Правку поста Telegram присылает как новое событие, и вчера владелец
       * получил четыре одинаковых предупреждения подряд об одной публикации.
       */
      const warned = `warned:${srcId}`;
      if (env.TELEGRAM_CHAT_ID && !(await kvGet(env, warned, null))) {
        await kvPut(env, warned, Date.now());
        /*
         * К предупреждению сразу прикладываем устройство поста.
         *
         * Просить в ответ «пришлите /пост» — значит терять день на каждый
         * неразобранный формат: владелец видит проблему, а разработчик её не
         * видит. Здесь же лежит всё, что нужно для правки: какими полями
         * пришла публикация и что из неё удалось достать. Содержимого поста
         * в слепке нет — только имена полей и типы значений.
         */
        const shape = JSON.stringify(shapeOf(post), null, 1).slice(0, 2600);
        const lines = String(caption || "").split("\n").filter(Boolean);
        await api(env, "sendMessage", {
          chat_id: env.TELEGRAM_CHAT_ID,
          text:
            "⚠️ Пост из канала не попал в каталог: не удалось разобрать название авто.\n" +
            `Строк текста: ${lines.length} · фото: ${ids.length}\n` +
            (lines.length ? `Первые строки: ${lines.slice(0, 4).join(" / ").slice(0, 300)}\n` : "") +
            "\nКак пришёл пост:\n```\n" + shape + "\n```",
          parse_mode: "Markdown",
        });
      }
      return;
    }
    const fresh = carFromPost(parsed, srcId, urls);

    /*
     * Прежде чем заводить карточку — проверяем, нет ли такой же.
     *
     * Одна машина попадает в канал несколькими постами чаще, чем кажется.
     * Telegram разрешает в альбоме не больше десяти фотографий, и если их
     * снять больше, приложение само разбивает публикацию на два альбома с
     * РАЗНЫМИ номерами. Для бота это два поста об одной машине, и он заводил
     * две карточки: одинаковые модель, год, пробег и цена, но разные фото.
     * Так же выглядит и обычная перепубликация — когда пост удалили и
     * выложили заново.
     *
     * Отличить это от второй такой же машины на складе нечем: совпадают все
     * поля. Выбор в пользу слияния сознательный — повтор в каталоге видит
     * каждый посетитель, а второй экземпляр всё равно продаётся по одной
     * карточке, и менеджер разберётся, какой именно отдать. Если карточки
     * действительно нужны две, вторую можно завести руками в админке.
     *
     * Фотографии из обоих постов складываем: это ровно то, ради чего альбом
     * и разбивался.
     */
    const twinIdx = catalog.findIndex(
      (c) => carFingerprint(c) === carFingerprint(fresh),
    );
    if (twinIdx !== -1) {
      const twin = catalog[twinIdx];
      if (Array.isArray(twin.images)) {
        for (const u of urls) if (!twin.images.includes(u)) twin.images.push(u);
      }
      if (vurl && !twin.video) twin.video = vurl;
      // Помним, какие посты слились в эту карточку: без этого правка второго
      // поста выглядела бы как появление новой машины из ниоткуда.
      twin.mergedFrom = [...new Set([...(twin.mergedFrom || []), srcId])];
      twin.chatId = String(post.chat?.id ?? "");
      await kvPut(env, "catalog", catalog);
      return;
    }

    car = fresh;
    car.addedAt = Date.now(); // дата добавления в каталог
    catalog.unshift(car); // новые авто — в начало списка
  } else {
    if (!Array.isArray(car.images)) car.images = [];
    for (const u of urls) if (!car.images.includes(u)) car.images.push(u);
    if (caption) {
      const imgs = car.images;
      const vid = car.video;
      // Идентификатор оставляем прежним. Карточка могла быть заведена под
      // старым именем, и на неё уже ссылаются: избранное у посетителей,
      // ссылки в переписке с клиентом, открытая карточка в мини-аппе. Смена
      // имени при первой же правке поста порвала бы их все.
      const keepId = car.id;
      Object.assign(car, carFromPost(parseCaption(caption), keepId, imgs));
      car.id = keepId;
      car.images = imgs;
      if (vid) car.video = vid;
    }
  }
  // Видео из поста (первое найденное) — прикрепляем к карточке.
  if (vurl && !car.video) car.video = vurl;
  /*
   * Помечаем карточку каналом-источником.
   *
   * Это не украшение: по этой отметке видно, что карточка заведена уже с
   * учётом номера канала, и её не надо искать по старому двусмысленному
   * имени. Со временем помеченными станут все, и запасной путь отомрёт сам.
   */
  car.chatId = String(post.chat?.id ?? "");
  await kvPut(env, "catalog", catalog);
  // Возвращаем карточку и признак новизны: дублировать в MAX имеет смысл
  // только новые машины, правка поста туда уже не поедет.
  const result = { car, isNew: isNewCar };
  if (isNewCar && env.TELEGRAM_CHAT_ID) {
    await api(env, "sendMessage", {
      chat_id: env.TELEGRAM_CHAT_ID,
      text:
        `✅ Авто из канала опубликовано в каталог: ${car.model}` +
        (car.priceRub ? ` · ${car.priceRub.toLocaleString("ru-RU")} ₽` : "") +
        // Число снимков в уведомлении — самая дешёвая проверка разбора: если
        // в статье их десять, а тут единица, это видно сразу, а не через
        // неделю по жалобе «в карточке одно фото».
        `\nФото: ${car.images?.length || 0}`,
    });
  }
  return result;
}

/**
 * Один ли это отзыв — по тексту.
 *
 * Сравниваем начала: чтобы вызвать перечитывание поста, владелец его правит,
 * и текст после этого редко совпадает дословно — то точка в конце появится,
 * то пробел уедет. Сорока приведённых символов достаточно, чтобы отличить
 * свой отзыв от чужого, и мало, чтобы мелкая правка помешала узнать его.
 */
function sameReviewText(a, b) {
  const norm = (s) =>
    String(s || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 40);
  const x = norm(a);
  const y = norm(b);
  return x.length >= 12 && x === y;
}

// Пост из канала отзывов → карточка отзыва (текст + фото/видео) в KV reviews.
/*
 * Потолок, выше которого Bot API файл боту не отдаёт: 20 МБ.
 *
 * Ограничение чужое и обойти его нечем. Важно другое: видео с телефона легко
 * весит впятеро больше, и до этой проверки такой отзыв спокойно сохранялся —
 * а на сайте выходила карточка, у которой плеер отвечает «404». Снаружи это
 * неотличимо от поломки сайта, и именно так отзывы «пропадали».
 */
const TG_FILE_LIMIT = 20 * 1024 * 1024;

/** Размер видео в посте, если Telegram его сообщил. */
function videoBytes(post) {
  return Number(post?.video?.file_size || post?.document?.file_size || 0);
}

async function publishReviewFromPost(env, post, origin) {
  // Отзывы в канале тоже стали статьями: текст и карусель лежат блоками.
  const text = postText(post);
  const photoIds = postPhotoIds(post);
  const fileId = photoIds[0] || null;
  const rawVideoId = postVideoIds(post)[0] || null;

  // Слишком тяжёлое видео считаем отсутствующим: лучше не опубликовать
  // отзыв вовсе, чем опубликовать карточку с мёртвым плеером.
  const heavy = rawVideoId && videoBytes(post) > TG_FILE_LIMIT ? videoBytes(post) : 0;
  const videoId = heavy ? null : rawVideoId;

  if (!text && !fileId && !videoId) {
    return heavy ? { videos: 0, images: 0, tooBigMb: Math.round(heavy / 1048576) } : undefined;
  }
  const groupId = post.media_group_id || null;
  const srcId = postSrcId(post, groupId);
  const medias = photoIds.map((id) => photoUrl(origin, id)).filter(Boolean);
  const media = medias[0] || "";
  const video = videoId ? videoUrl(origin, videoId) : "";
  // Обложка нужна только видео: у поста с фотографией её роль играет фото.
  const posterId = videoId ? posterFileId(post) : null;
  const poster = posterId ? photoUrl(origin, posterId) : "";

  let reviews = (await kvGet(env, "reviews", [])) || [];
  if (!Array.isArray(reviews)) reviews = [];
  /*
   * Ищем сначала по новому имени, с каналом внутри: тут двусмысленности нет.
   */
  let ex = reviews.find((r) => r.id === srcId);

  /*
   * Если не нашли — пробуем старое имя, но только при совпадении текста.
   *
   * Зачем нужно. Отзывы, заведённые до разделения каналов, названы просто по
   * номеру сообщения. Правка такого поста создавала бы рядом второй отзыв
   * вместо обновления первого. Это и есть путь возврата видео, потерянных
   * правкой в админке: владелец трогает пост в канале — бот заново
   * прикладывает к ТОЙ ЖЕ записи фото и видео.
   *
   * Почему с проверкой текста. Просто по номеру брать нельзя: нумерация
   * сообщений у каждого канала своя и начинается с единицы, поэтому пост №7
   * из нового канала подменил бы собой настоящий отзыв клиента под именем
   * «tg-7». Совпадение текста делает такую подмену практически невозможной,
   * а свой же пост узнаёт даже после мелкой правки.
   */
  if (!ex && text) {
    const legacy = reviews.find(
      (r) => r.id === legacySrcId(post, groupId) && sameReviewText(r.text, text),
    );
    if (legacy) {
      // Переименовываем в новое имя: дальше правки будут находиться сразу.
      legacy.id = srcId;
      ex = legacy;
    }
  }

  if (ex) {
    // Альбом/правка: копим все фото и видео поста, а не только первые.
    if (text && !ex.text) ex.text = text;
    if (!Array.isArray(ex.images)) ex.images = ex.media ? [ex.media] : [];
    if (!Array.isArray(ex.videos)) ex.videos = ex.video ? [ex.video] : [];
    for (const m of medias) if (!ex.images.includes(m)) ex.images.push(m);
    if (video && !ex.videos.includes(video)) ex.videos.push(video);
    // media/video оставляем для совместимости со старыми клиентами.
    ex.media = ex.media || media;
    ex.video = ex.video || video;
    // Обложка отдельно от images: иначе кадр из видео встал бы в ленту
    // миниатюр как ещё одна «фотография» отзыва.
    ex.poster = ex.poster || poster;
  } else {
    reviews.unshift({
      id: srcId,
      name: post.author_signature || "Клиент ДиАвто69",
      text,
      rating: 5,
      media,
      video,
      poster,
      images: medias,
      videos: video ? [video] : [],
      chatId: String(post.chat?.id ?? ""),
      ts: Date.now(),
    });
  }
  await kvPut(env, "reviews", reviews.slice(0, 100));

  /*
   * Итог возвращаем вызывающему, чтобы бот мог отчитаться честно.
   * Раньше он в любом случае отвечал «опубликован» — в том числе когда
   * вложение прочитать не смог и сохранил один текст. Именно поэтому
   * потерянные видео так долго не замечали.
   */
  const saved = reviews.find((r) => r.id === srcId) || {};
  return {
    videos: (saved.videos || []).length,
    images: (saved.images || []).length,
    tooBigMb: heavy ? Math.round(heavy / 1048576) : 0,
  };
}

// Пост из канала новостей → карточка новости (заголовок + текст + фото/видео).
async function publishNewsFromPost(env, post, origin) {
  // Новости из канала тоже приходят статьями.
  const raw = postText(post);
  const photoIds = postPhotoIds(post);
  const fileId = photoIds[0] || null;
  const videoId = postVideoIds(post)[0] || null;
  if (!raw && !fileId && !videoId) return;
  const groupId = post.media_group_id || null;
  const srcId = postSrcId(post, groupId);
  const media = fileId ? photoUrl(origin, fileId) : "";
  const video = videoId ? videoUrl(origin, videoId) : "";
  // Заголовок — первая содержательная строка, текст — остальное.
  const lines = raw.split("\n").map((s) => s.trim()).filter(Boolean);
  const title = (lines[0] || "Новость").slice(0, 120);
  const text = lines.slice(1).join("\n");

  let news = (await kvGet(env, "news", [])) || [];
  if (!Array.isArray(news)) news = [];
  // Как и с отзывами: только новое имя, чтобы пост из другого канала с тем
  // же номером не подменил собой уже опубликованную новость.
  const ex = news.find((n) => n.id === srcId);
  if (ex) {
    if (raw && !ex.text && !ex.title) {
      ex.title = title;
      ex.text = text;
    }
    if (media && !ex.media) ex.media = media;
    if (video && !ex.video) ex.video = video;
  } else {
    news.unshift({
      id: srcId,
      title,
      text,
      media,
      video,
      chatId: String(post.chat?.id ?? ""),
      ts: Date.now(),
    });
  }
  await kvPut(env, "news", news.slice(0, 60));
}

/**
 * Текст карточки для канала MAX.
 *
 * Пост Telegram целиком туда не годится: в MAX нет ни таблиц, ни врезок, а
 * подпись поста написана под другую ленту — с призывами, ссылками и
 * оформлением. Собираем короткую карточку из уже разобранных полей: то же
 * самое видит покупатель на сайте.
 */
function maxCardText(car) {
  const specs = [
    car.year ? `${car.year} г.` : "",
    car.mileageKm ? `${car.mileageKm.toLocaleString("ru-RU")} км` : "новый, 0 км",
    car.powerHp ? `${car.powerHp} л.с.` : "",
    car.gearbox,
    car.drive ? `${car.drive.toLowerCase()} привод` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    `🚗 ${car.model}`,
    specs,
    car.priceRub ? `Под ключ до Москвы — ${car.priceRub.toLocaleString("ru-RU")} ₽` : "",
    "",
    `Каталог: ${SITE_CATALOG_URL}`,
  ]
    .filter((line) => line !== undefined && line !== null)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Продублировать карточку в канал MAX.
 *
 * Повторную публикацию отсекаем по идентификатору поста: правка поста в
 * Telegram прилетает тем же путём, что и новая публикация, и без этой отметки
 * канал MAX собирал бы по карточке на каждую запятую.
 */
async function mirrorToMax(env, car, srcId, images) {
  const st = await getSettings(env);
  const channel = String(st.maxChannelId || "").trim();
  if (!channel || !env.MAX_BOT_TOKEN || !car) return;

  const mark = `max:posted:${srcId}`;
  if (await kvGet(env, mark, null)) return;

  const r = await maxPostToChat(env, channel, maxCardText(car), images);
  await kvPut(env, mark, { at: Date.now(), ok: !!r.ok });

  if (!r.ok && env.TELEGRAM_CHAT_ID) {
    await api(env, "sendMessage", {
      chat_id: env.TELEGRAM_CHAT_ID,
      text:
        "⚠️ Не удалось опубликовать авто в канал MAX.\n" +
        `Ответ MAX: ${String(r.error || JSON.stringify(r.data || {})).slice(0, 300)}`,
    });
  }
}

async function handleChannelPost(env, post, opts = {}) {
  if (!env.STORE) return;
  // Пост-статья: текст и карусель лежат блоками, а не в caption/photo.
  const caption = postText(post);
  const fileIds = postPhotoIds(post);
  const videoId = postVideoIds(post)[0] || null;
  const groupId = post.media_group_id || null;
  if (!fileIds.length && !videoId && !caption) return;

  // Полностью автоматический режим — сразу в каталог.
  if (opts.auto) {
    const done = await publishFromPost(env, post, caption, fileIds, groupId, opts.origin, videoId);
    if (done?.isNew) {
      await mirrorToMax(env, done.car, postSrcId(post, groupId), done.car.images || []);
    }
    return;
  }

  // Иначе — черновик для ручной проверки (прежнее поведение).
  const drafts = (await kvGet(env, "drafts", [])) || [];
  if (groupId) {
    const ex = drafts.find((d) => d.groupId === groupId);
    if (ex) {
      for (const id of fileIds) if (!ex.fileIds.includes(id)) ex.fileIds.push(id);
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
    fileIds,
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
async function handleAdmin(env, action, payload, perm, user, origin) {
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
        "gateChannelId",
        "gateInviteUrl",
        "gateText",
        "gateSubscribeButton",
        "gateCheckButton",
        "catalogChatId",
        "reviewsChatId",
        "newsChatId",
        "leadChatId",
        // Канал MAX, куда дублируются карточки из телеграм-канала.
        "maxChannelId",
      ];
      const next = { ...cur };
      for (const k of allowed)
        if (typeof payload?.[k] === "string") next[k] = payload[k];
      if (typeof payload?.autoPublish === "boolean")
        next.autoPublish = payload.autoPublish;
      if (typeof payload?.gateEnabled === "boolean")
        next.gateEnabled = payload.gateEnabled;
      await kvPut(env, "settings", next);
      return json({ ok: true, settings: next });
    }

    case "leads.list":
      return json({ ok: true, leads: (await kvGet(env, "leads", [])) || [] });

    case "subs.list":
      return json({ ok: true, subs: (await kvGet(env, "subs", [])) || [] });

    case "reviews.list":
      return json({ ok: true, reviews: (await kvGet(env, "reviews", [])) || [] });

    /*
     * Правка отзыва из админки.
     *
     * ВАЖНО: собранная запись НАКЛАДЫВАЕТСЯ на прежнюю, а не заменяет её.
     *
     * Раньше здесь собирался новый объект из шести полей — имя, текст, авто,
     * оценка, дата — и клался на место старого целиком. Всё остальное при
     * этом пропадало: фотографии, видео, ссылка на канал. То есть достаточно
     * было открыть отзыв, поправить опечатку в имени и нажать «Сохранить», —
     * и видео-отзыв навсегда становился текстовым. Ни ошибки, ни следа:
     * текст на месте, видео нет.
     *
     * Так и потерялись видео-отзывы на сайте. Восстановить из самой записи их
     * нельзя — но можно из канала, см. publishReviewFromPost.
     *
     * Медиа берём ТОЛЬКО из прежней записи, а не из присланного: админка их
     * не редактирует и присылать не должна, а доверять произвольным ссылкам
     * из запроса незачем.
     */
    case "reviews.save": {
      const list = (await kvGet(env, "reviews", [])) || [];
      const id = payload?.id || "r" + Date.now();
      const idx = list.findIndex((x) => x.id === id);
      const prev = idx >= 0 ? list[idx] : {};
      const rev = {
        ...prev,
        id,
        name: String(payload?.name || "").slice(0, 80),
        text: String(payload?.text || "").slice(0, 1000),
        car: String(payload?.car || "").slice(0, 120),
        rating: Math.max(1, Math.min(5, Number(payload?.rating) || 5)),
        ts: payload?.ts || prev.ts || Date.now(),
      };
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

    // Переподписка вебхука на актуальный список событий. Нужна после
    // выкладки, которая этот список меняет: Telegram помнит старый.
    case "webhook.setup": {
      const out = await bindWebhook(env, origin);
      const menu = await bindMenuButton(env, await getSettings(env));
      return json({
        ok: !!out?.ok,
        telegram: out,
        updates: WEBHOOK_UPDATES,
        menuButton: menu,
      });
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
