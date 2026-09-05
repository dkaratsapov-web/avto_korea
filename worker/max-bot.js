/**
 * Бот в MAX — второе окно в тот же каталог.
 *
 * Второй мессенджер не значит вторая система. Каталог, заявки и отзывы лежат
 * в том же хранилище, что и у телеграмного бота, и правятся в одном месте —
 * в админке Telegram и в CRM. Здесь только показ: витрина, расчёт, заявка,
 * связь с менеджером. Ни админки, ни публикации постов, ни рассылок — по
 * замыслу: два пульта от одного склада однажды разъедутся, и никто не поймёт,
 * какой из них главный.
 *
 * Про API. У MAX свой Bot API (https://botapi.max.ru), устроенный иначе, чем
 * телеграмный: токен идёт заголовком Authorization, вложения приезжают
 * отдельным списком, кнопки — вложением inline_keyboard. Поэтому весь диалог
 * с MAX собран здесь, а общая начинка (каталог, заявки) переиспользуется как
 * есть.
 *
 * Бот спит, пока в секретах воркера нет MAX_BOT_TOKEN: без токена ни одного
 * запроса наружу не уходит, и вебхук отвечает «не настроен».
 */

const API = "https://botapi.max.ru";

/** Сколько машин показываем в одном сообщении списка. */
const PAGE = 5;

/* ------------------------------------------------------------------ вызовы */

/**
 * Запрос к MAX.
 *
 * Токен уходит заголовком Authorization: параметром в адресе MAX его больше
 * не принимает («access_token is deprecated»). Заголовок и правильнее по
 * сути — адреса попадают в журналы прокси и в историю браузера, секретам
 * там не место.
 *
 * Форму заголовка подбираем на месте: сначала «Bearer <токен>», а если MAX
 * ответил, что токен не проверен, — тем же токеном без приставки. Так
 * подключение переживёт и обратную смену требований, и наши догадки о них.
 *
 * Ответ всегда разбираем, даже когда он с ошибкой: текст ошибки — то немногое,
 * что расскажет, чем именно наш формат не подошёл. Первое живое сообщение
 * должно объяснять причину, а не молчать.
 */
async function maxCall(env, method, path, body) {
  const token = env.MAX_BOT_TOKEN;
  if (!token) return { ok: false, error: "no_token" };

  const url = `${API}${path}`;

  const once = async (authorization) => {
    const r = await fetch(url, {
      method,
      headers: {
        Authorization: authorization,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* MAX ответил не-JSON: оставляем текст как есть — он и будет диагнозом */
    }
    return { ok: r.ok, status: r.status, data, raw: data ? null : text.slice(0, 300) };
  };

  try {
    const first = await once(`Bearer ${token}`);
    // «verify.token» — MAX не понял, чем мы представились. Пробуем голый токен.
    const rejected = !first.ok && String(first.data?.code || "").includes("token");
    return rejected ? await once(token) : first;
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Отправка сообщения человеку. */
function maxSend(env, userId, text, { keyboard, image } = {}) {
  const attachments = [];

  /*
   * Фотографию отдаём ссылкой на наш сайт, а не файлом.
   *
   * Оригиналы лежат в Telegram, и перекачивать их через воркер ради каждого
   * показа — лишний трафик и лишние секунды. Сайт те же файлы уже отдаёт со
   * своего адреса и держит в кэше.
   */
  if (image) attachments.push({ type: "image", payload: { url: image } });
  if (keyboard) attachments.push({ type: "inline_keyboard", payload: { buttons: keyboard } });

  return maxCall(env, "POST", `/messages?user_id=${encodeURIComponent(userId)}`, {
    text,
    ...(attachments.length ? { attachments } : {}),
  });
}

/** Ответ на нажатие кнопки: убирает «часики» и, если надо, шлёт новое окно. */
function maxAnswer(env, callbackId, notification) {
  return maxCall(env, "POST", `/answers?callback_id=${encodeURIComponent(callbackId)}`, {
    ...(notification ? { notification } : {}),
  });
}

/* ------------------------------------------------------------------ тексты */

const SITE = "https://xn---69-5cdk0b2aocjmsg.xn--p1ai";

function money(n) {
  return Number(n || 0).toLocaleString("ru-RU").replace(/ /g, " ");
}

/** Цена, которую показываем везде — под ключ до Москвы. */
function price(car) {
  return car.priceMoscowRub || car.priceRub || 0;
}

/** Короткая строка для списка. */
function carLine(car, i) {
  const bits = [car.year, car.mileage, car.gearbox].filter(Boolean).join(" · ");
  return `${i}. ${car.model}\n   ${money(price(car))} ₽ · ${bits}`;
}

/** Развёрнутая карточка одной машины. */
function carCard(car) {
  const rows = [
    car.year ? `Год: ${car.year}` : "",
    car.mileage ? `Пробег: ${car.mileage}` : "",
    car.engine ? `Двигатель: ${car.engine}` : "",
    car.gearbox ? `Коробка: ${car.gearbox}` : "",
    car.drive ? `Привод: ${car.drive}` : "",
    car.color ? `Цвет: ${car.color}` : "",
    car.trim ? `Комплектация: ${car.trim}` : "",
  ].filter(Boolean);

  return (
    `${car.model}\n\n` +
    `${money(price(car))} ₽ — под ключ до Москвы\n\n` +
    rows.join("\n") +
    "\n\nВ цену входит выкуп, доставка, растаможка и оформление."
  );
}

/* --------------------------------------------------------------- клавиатуры */

/** Мини-приложение — тот же экран, что в Telegram. */
const MINI_APP = `${SITE}/tma?ms=max`;

/*
 * Кнопки, открывающей мини-приложение, в меню нет — и это осознанно.
 *
 * Перепробовано три способа: вложение «open_app» в двух написаниях (MAX
 * отверг оба), ссылка на наш сайт (открывает браузер поверх мессенджера) и
 * внутренняя ссылка вида max.ru/<бот>/app («ссылка устарела или не
 * работает»). Кнопка, уводящая человека из чата в браузер, хуже, чем её
 * отсутствие: он теряет и чат, и место в каталоге.
 *
 * Поэтому в меню — список машин прямо в переписке, а про полный каталог с
 * фильтрами сказано словами: он открывается штатной кнопкой мессенджера
 * рядом с полем ввода, ту настроил владелец в кабинете бота.
 *
 * Когда выяснится, как MAX называет такую кнопку, здесь появится одна
 * строчка — остальное менять не придётся.
 */
const MENU = [
  [{ type: "callback", text: "🚗 Каталог авто", payload: "cat:0" }],
  [{ type: "callback", text: "📝 Подобрать авто", payload: "lead" }],
  [{ type: "callback", text: "⭐ Отзывы", payload: "rev" }],
  [{ type: "link", text: "Написать менеджеру", url: "https://t.me/diavto69" }],
];

function catalogKeyboard(page, total, cars) {
  const rows = cars.map((c, i) => [
    { type: "callback", text: `${page * PAGE + i + 1}. ${c.model}`, payload: `car:${c.id}` },
  ]);

  const nav = [];
  if (page > 0) nav.push({ type: "callback", text: "◀ Назад", payload: `cat:${page - 1}` });
  if ((page + 1) * PAGE < total)
    nav.push({ type: "callback", text: "Ещё ▶", payload: `cat:${page + 1}` });
  if (nav.length) rows.push(nav);

  rows.push([{ type: "callback", text: "◀ В меню", payload: "menu" }]);
  return rows;
}

/* -------------------------------------------------------------- обработчики */

/**
 * Разбор обновления MAX.
 *
 * kv — те же чтения/записи, что у телеграмного бота: каталог и отзывы общие.
 * lead — сохранение заявки и уведомление менеджеру; их делает вызывающий, так
 * этот файл не тянет за собой половину телеграмного бота.
 */
export async function handleMaxUpdate(env, update, deps) {
  const { kvGet, kvPut, onLead, onQuestion } = deps;

  const type = update?.update_type || update?.updateType || "";
  const cb = update?.callback;
  const msg = update?.message;

  // Человек нажал кнопку.
  if (cb) {
    const userId = cb.user?.user_id ?? cb.user?.userId;
    const payload = String(cb.payload || "");
    await maxAnswer(env, cb.callback_id ?? cb.callbackId);
    await route(env, userId, payload, { kvGet, kvPut, onLead });
    return;
  }

  const userId =
    msg?.sender?.user_id ??
    msg?.sender?.userId ??
    update?.user?.user_id ??
    update?.user?.userId;
  if (!userId) return;

  // Бот только что добавлен/запущен — здороваемся.
  if (type === "bot_started" || type === "bot_added") {
    await welcome(env, userId);
    return;
  }

  const text = String(msg?.body?.text || msg?.text || "").trim();
  if (!text) return;

  // Ждём ли от этого человека телефон.
  const waiting = (await kvGet(env, `max:wait:${userId}`, null)) || null;
  if (waiting) {
    await kvPut(env, `max:wait:${userId}`, null);
    await saveLead(env, userId, text, waiting, onLead);
    return;
  }

  // Команда из подсказок. Пишется она как «/catalog», но человек может
  // дописать что-то следом — берём только первое слово.
  const command = (text.match(/^\/([a-z_]+)/i) || [])[1]?.toLowerCase();
  if (command) {
    if (command === "catalog") return catalogPage(env, userId, 0, kvGet);
    if (command === "reviews") return reviews(env, userId, kvGet);
    if (command === "lead") return route(env, userId, "lead", { kvGet, kvPut, onLead });
    // «/start» и всё незнакомое — меню: оно объясняет, что тут вообще есть.
    return welcome(env, userId);
  }

  if (isGreeting(text)) {
    await welcome(env, userId);
    return;
  }
  if (/каталог|авто|машин/i.test(text) && text.length < 30) {
    await catalogPage(env, userId, 0, kvGet);
    return;
  }

  /*
   * Осмысленный вопрос передаём менеджеру — но не заявкой.
   *
   * Первая версия заводила из любого текста заявку, и «привет» приехал в
   * общий список как «Клиент из MAX, телефон —, авто: привет». Заявка без
   * телефона бесполезна менеджеру и портит статистику: по этому списку
   * считают, сколько обращений принесла реклама. Вопрос — это вопрос:
   * менеджеру уходит уведомление, в списке заявок его нет.
   */
  await onQuestion(env, userId, text.slice(0, 500));
  await maxSend(
    env,
    userId,
    "Передал вопрос менеджеру — ответит в ближайшее время.\n\n" +
      "А пока можно посмотреть каталог: там актуальные машины с ценой под ключ до Москвы.",
    { keyboard: MENU },
  );
}

/**
 * Приветствие ли это.
 *
 * Отдельная проверка нужна, потому что первое сообщение человека почти
 * всегда «привет» или «здравствуйте» — и оно означает «покажи, что у вас
 * есть», а не вопрос. Сюда же короткие «ок», «спасибо» и смайлики: гнать
 * их менеджеру незачем.
 */
function isGreeting(text) {
  const t = text.toLowerCase().replace(/[!,.…\s]+$/g, "");
  if (/^\/?(start|menu)$/.test(t)) return true;
  if (/^(привет|здравствуй|здравствуйте|добрый (день|вечер|утро)|доброе утро|хай|ку|меню|menu|hello|hi)\b/.test(t))
    return true;
  // Совсем короткая реплика без цифр — не вопрос, а вежливость.
  return t.length <= 12 && !/\d/.test(t);
}

async function route(env, userId, payload, { kvGet, kvPut, onLead }) {
  if (payload === "menu") return welcome(env, userId);
  if (payload === "rev") return reviews(env, userId, kvGet);
  if (payload === "lead") {
    await kvPut(env, `max:wait:${userId}`, { car: "" });
    return maxSend(
      env,
      userId,
      "Напишите номер телефона — менеджер перезвонит и посчитает стоимость под ваш запрос.\n\n" +
        "Можно сразу с пожеланием: «+7 900 000-00-00, кроссовер до 3 млн».",
    );
  }
  if (payload.startsWith("cat:")) {
    return catalogPage(env, userId, Number(payload.slice(4)) || 0, kvGet);
  }
  if (payload.startsWith("car:")) {
    return carDetails(env, userId, payload.slice(4), kvGet);
  }
  if (payload.startsWith("want:")) {
    const id = payload.slice(5);
    const cars = (await kvGet(env, "catalog", [])) || [];
    const car = cars.find((c) => String(c.id) === id);
    await kvPut(env, `max:wait:${userId}`, { car: car ? car.model : "" });
    return maxSend(
      env,
      userId,
      (car ? `${car.model} — отличный выбор.\n\n` : "") +
        "Оставьте номер телефона, менеджер свяжется и расскажет по срокам и оплате.",
    );
  }
  return welcome(env, userId);
}

const WELCOME =
  "Добрый день! Это ДиАвто69 — привозим автомобили из Кореи, Китая, Японии и ЕС под ключ.\n\n" +
  "В каталоге — машины в наличии и в пути, цена сразу с доставкой, растаможкой и оформлением до Москвы.\n\n" +
  "Полный каталог с фильтрами и фото открывается кнопкой приложения слева от поля ввода. " +
  "А списком можно посмотреть прямо здесь.\n\n" +
  "С чего начнём?";

async function welcome(env, userId) {
  return maxSend(env, userId, WELCOME, { keyboard: MENU });
}

async function catalogPage(env, userId, page, kvGet) {
  const cars = (await kvGet(env, "catalog", [])) || [];
  if (!cars.length) {
    return maxSend(
      env,
      userId,
      "Каталог сейчас обновляется. Напишите, какая машина нужна и на какой бюджет — подберём вручную.",
      { keyboard: MENU },
    );
  }

  const from = Math.max(0, page) * PAGE;
  const slice = cars.slice(from, from + PAGE);
  const lines = slice.map((c, i) => carLine(c, from + i + 1)).join("\n\n");

  return maxSend(
    env,
    userId,
    `Каталог — ${cars.length} авто в наличии и в пути.\nЦены под ключ до Москвы.\n\n${lines}\n\nОткрыть карточку — кнопкой ниже.`,
    { keyboard: catalogKeyboard(page, cars.length, slice) },
  );
}

async function carDetails(env, userId, id, kvGet) {
  const cars = (await kvGet(env, "catalog", [])) || [];
  const car = cars.find((c) => String(c.id) === String(id));
  if (!car) return catalogPage(env, userId, 0, kvGet);

  return maxSend(env, userId, carCard(car), {
    image: siteMedia(car.images?.[0]),
    keyboard: [
      [{ type: "callback", text: "Хочу это авто", payload: `want:${car.id}` }],
      [{ type: "link", text: "Открыть карточку", url: `${MINI_APP}&car=${encodeURIComponent(car.id)}` }],
      [{ type: "callback", text: "◀ К каталогу", payload: "cat:0" }],
    ],
  });
}

async function reviews(env, userId, kvGet) {
  const all = (await kvGet(env, "reviews", [])) || [];
  const withPhoto = all.filter((r) => r.images?.length || r.media).slice(0, 3);

  if (!withPhoto.length) {
    return maxSend(env, userId, `Отзывы и видео с выдач — на сайте: ${SITE}/reviews`, {
      keyboard: MENU,
    });
  }

  for (const r of withPhoto) {
    await maxSend(env, userId, (r.text || "Выдача автомобиля клиенту").slice(0, 400), {
      image: siteMedia(r.images?.[0] || r.media),
    });
  }
  return maxSend(env, userId, `Все отзывы и видео: ${SITE}/reviews`, { keyboard: MENU });
}

/**
 * Ссылка на файл — обязательно на наш домен.
 *
 * В хранилище адреса лежат с доменом воркера, а он в России у провайдеров
 * закрыт: MAX картинку по такой ссылке может и не забрать. Сайт отдаёт те же
 * файлы со своего адреса.
 */
function siteMedia(url) {
  if (!url) return "";
  const path = String(url).replace(/^https?:\/\/[^/]+/, "");
  return path.startsWith("/api/") ? SITE + path : String(url);
}

async function saveLead(env, userId, text, waiting, onLead) {
  const phone = (text.match(/[\d+][\d\s()-]{9,}/) || [""])[0].trim();

  if (!phone) {
    return maxSend(
      env,
      userId,
      "Не разобрал номер. Напишите его цифрами — например, +7 900 000-00-00.",
    );
  }

  await onLead(env, {
    name: "Клиент из MAX",
    phone,
    car: [waiting?.car, text.replace(phone, "").trim()].filter(Boolean).join(" · ").slice(0, 300),
    source: "Бот MAX",
  });

  return maxSend(
    env,
    userId,
    "Спасибо! Менеджер перезвонит в течение 15 минут.\n\nПока можно посмотреть каталог.",
    { keyboard: MENU },
  );
}

/* ---------------------------------------------------------------- настройка */

/**
 * Подсказки команд в чате.
 *
 * Без них человек, свернувший меню, остаётся один на один с пустым полем
 * ввода: кнопки уехали вверх по переписке, а «/start» никто не помнит
 * наизусть. Список повторяет кнопки меню — другого набора действий у бота
 * и нет, а расхождение между подсказкой и кнопкой сбивает.
 */
const COMMANDS = [
  { name: "start", description: "Главное меню" },
  { name: "catalog", description: "Каталог авто" },
  { name: "lead", description: "Подобрать авто" },
  { name: "reviews", description: "Отзывы клиентов" },
];

/** Подписать MAX на наш адрес, выставить команды и проверить токен. */
export async function maxBind(env, origin) {
  const me = await maxCall(env, "GET", "/me");
  const hook = await maxCall(env, "POST", "/subscriptions", {
    url: `${origin}/max`,
    update_types: ["message_created", "message_callback", "bot_started", "bot_added"],
  });
  // PATCH меняет только переданные поля: имя, описание и картинка бота,
  // выставленные в MAX руками, остаются как были.
  const commands = await maxCall(env, "PATCH", "/me", { commands: COMMANDS });
  return { me, hook, commands };
}

/** Показания приборов: виден ли токен, кто бот, куда подписан. */
export async function maxDiag(env, kv) {
  if (!env.MAX_BOT_TOKEN) return { ok: false, error: "MAX_BOT_TOKEN не задан" };
  const me = await maxCall(env, "GET", "/me");
  const subs = await maxCall(env, "GET", "/subscriptions");
  return {
    ok: true,
    me: me.data ?? me,
    subscriptions: subs.data ?? subs,
    appButton: kv ? await kv(env, "max:appBtn", -1) : null,
    appButtonRefusals: kv ? await kv(env, "max:appBtnErr", null) : null,
  };
}

/** Человекочитаемый отчёт про кнопку приложения — для команды /max. */
export async function maxAppButtonReport() {
  return (
    "ℹ️ Каталог в чате — списком. Мини-приложение открывается штатной кнопкой " +
    "мессенджера рядом с полем ввода: кнопку в сообщении MAX не принимает."
  );
}
