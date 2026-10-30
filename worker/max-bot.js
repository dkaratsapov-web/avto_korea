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

/**
 * Ссылка, по которой менеджер откроет переписку с человеком в MAX.
 *
 * Из Telegram в чат MAX не перейти, поэтому уведомление без ссылки почти
 * бесполезно: имя есть, а написать нечем. Ссылку не выдумываем — спрашиваем
 * у самого MAX про этот диалог и берём ту, что он вернёт. Не вернул —
 * пробуем ник (у мессенджеров профиль обычно открывается по нему), а нет и
 * ника — честно возвращаем пустоту, и уведомление зовёт ответить через бота.
 */
export async function maxChatLink(env, chatId, username) {
  if (chatId) {
    const r = await maxCall(env, "GET", `/chats/${encodeURIComponent(chatId)}`);
    const link = r.data?.link || r.data?.chat?.link || "";
    if (link) return String(link).startsWith("http") ? link : `https://max.ru/${String(link).replace(/^@/, "")}`;
  }
  return username ? `https://max.ru/${String(username).replace(/^@/, "")}` : "";
}

/**
 * Опубликовать карточку в канал MAX.
 *
 * Отличие от сообщения человеку — единственное: адресат задаётся как чат, а не
 * как пользователь. Фотографии уходят ссылками на наш сайт, как и везде: сами
 * файлы лежат в Telegram, и перекачивать их ради каждой публикации незачем.
 *
 * Возвращаем ответ MAX как есть — вызывающему важно отличить «опубликовано»
 * от «бот не админ канала», а не получить голое false.
 */
export async function maxPostToChat(env, chatId, text, images = []) {
  const attachments = images
    .filter(Boolean)
    .slice(0, 10)
    .map((url) => ({ type: "image", payload: { url } }));

  return maxCall(env, "POST", `/messages?chat_id=${encodeURIComponent(chatId)}`, {
    text: String(text || "").slice(0, 4000),
    ...(attachments.length ? { attachments } : {}),
  });
}

/**
 * Написать человеку в MAX из другого места — например, ответом менеджера,
 * пришедшим в Telegram. Отдельная обёртка, чтобы воркеру не нужно было
 * знать про устройство запросов к MAX.
 */
export async function maxWrite(env, userId, text) {
  return maxSend(env, userId, text);
}

/** Ответ на нажатие кнопки: убирает «часики» и, если надо, шлёт новое окно. */
function maxAnswer(env, callbackId, notification) {
  return maxCall(env, "POST", `/answers?callback_id=${encodeURIComponent(callbackId)}`, {
    ...(notification ? { notification } : {}),
  });
}

/* ------------------------------------------------------------------ тексты */

const SITE = "https://xn---69-5cdk0b2aocjmsg.xn--p1ai";

/* --------------------------------------------------------------- клавиатуры */

/** Мини-приложение — тот же экран, что в Telegram. */
const MINI_APP = `${SITE}/tma?ms=max`;

/*
 * Кнопки, открывающей мини-приложение, в меню нет — и это не упущение.
 *
 * Перепробовано три способа: вложение «open_app» в двух написаниях (MAX
 * отверг оба), ссылка на наш сайт (открывает браузер поверх мессенджера) и
 * внутренняя ссылка вида max.ru/<бот>/app («ссылка устарела или не
 * работает»). Кнопка, уводящая человека из чата в браузер, хуже, чем её
 * отсутствие: он теряет и переписку, и место в каталоге.
 *
 * Поэтому «Каталог авто» показывает, КУДА нажать — словами и картинкой.
 * Когда выяснится, как MAX называет кнопку приложения, эта развилка
 * схлопнется в одну строчку.
 */
/*
 * Личный чат менеджера — внутри MAX, а не в Telegram.
 *
 * Раньше кнопка вела в телеграм: человек, пришедший в MAX, выпадал в другой
 * мессенджер, где у него может не быть ни аккаунта, ни желания его заводить.
 * Ссылка та же, что на сайте (site.ts, maxHref).
 */
const MANAGER_MAX =
  "https://max.ru/u/f9LHodD0cOK99itT-N_bHuA1p3GsBqirk2M9jbFjvwmFCq-XGojB1Qb32ic";

const MENU = [
  [{ type: "callback", text: "🚗 Каталог авто", payload: "app" }],
  [{ type: "callback", text: "📝 Подобрать авто", payload: "lead" }],
  [{ type: "callback", text: "⭐ Отзывы", payload: "rev" }],
  [{ type: "link", text: "Написать менеджеру", url: MANAGER_MAX }],
];

/* -------------------------------------------------------------- обработчики */

/**
 * Учёт пришедших и уведомление о новом человеке.
 *
 * Список хранится отдельно от телеграмного: там лежат адресаты рассылки, и
 * чужие идентификаторы сломали бы её на первом же сообщении — Telegram про
 * пользователя MAX ничего не знает.
 *
 * Уведомление уходит один раз, при первом появлении. Считать «новым» каждое
 * нажатие кнопки нельзя: менеджер перестанет читать уведомления к концу дня.
 */
async function remember(env, who, { kvGet, kvPut, onNewUser }, chatId) {
  const id = who?.user_id ?? who?.userId;
  if (!id) return;

  const users = (await kvGet(env, "max:users", {})) || {};
  const key = String(id);
  if (users[key]) {
    // Отметку последнего визита пишем, но уведомление не шлём.
    users[key].seenAt = Date.now();
    await kvPut(env, "max:users", users);
    return;
  }

  const name =
    [who.first_name, who.last_name].filter(Boolean).join(" ") ||
    who.name ||
    "";
  users[key] = {
    name,
    username: who.username || "",
    chatId: chatId ? String(chatId) : "",
    ts: Date.now(),
    seenAt: Date.now(),
  };
  await kvPut(env, "max:users", users);

  if (onNewUser) {
    await onNewUser(env, {
      id: key,
      name,
      username: who.username || "",
      chatId: chatId ? String(chatId) : "",
    });
  }
}

/**
 * Разбор обновления MAX.
 *
 * kv — те же чтения/записи, что у телеграмного бота: каталог и отзывы общие.
 * lead — сохранение заявки и уведомление менеджеру; их делает вызывающий, так
 * этот файл не тянет за собой половину телеграмного бота.
 */
export async function handleMaxUpdate(env, update, deps) {
  const { kvGet, kvPut, onLead, onQuestion, onNewUser } = deps;

  const type = update?.update_type || update?.updateType || "";
  const cb = update?.callback;
  const msg = update?.message;

  // Человек нажал кнопку.
  if (cb) {
    const userId = cb.user?.user_id ?? cb.user?.userId;
    const payload = String(cb.payload || "");
    await maxAnswer(env, cb.callback_id ?? cb.callbackId);
    await remember(env, cb.user, { kvGet, kvPut, onNewUser }, cb.message?.recipient?.chat_id);
    await route(env, userId, payload, { kvGet, kvPut, onLead });
    return;
  }

  const who = msg?.sender || update?.user || null;
  const userId =
    msg?.sender?.user_id ??
    msg?.sender?.userId ??
    update?.user?.user_id ??
    update?.user?.userId;
  if (!userId) return;

  await remember(
    env,
    who,
    { kvGet, kvPut, onNewUser },
    msg?.recipient?.chat_id ?? update?.chat_id ?? update?.chatId,
  );

  // Бот только что добавлен/запущен — здороваемся.
  if (type === "bot_started" || type === "bot_added") {
    /*
     * Добавили в канал или группу — здороваться там незачем, там нет
     * собеседника. Зато нужен идентификатор чата: без него автопубликация
     * не знает, куда писать, а узнать его в MAX больше неоткуда.
     */
    const chatId = msg?.recipient?.chat_id ?? update?.chat_id ?? update?.chatId ?? null;
    const chatType = String(
      msg?.recipient?.chat_type ?? update?.chat_type ?? update?.chatType ?? "",
    ).toLowerCase();
    if (chatId && chatType && chatType !== "dialog") {
      await kvPut(env, "max:lastChat", { id: String(chatId), type: chatType, at: Date.now() });
      if (deps.onChatSeen) await deps.onChatSeen(env, { id: String(chatId), type: chatType });
      return;
    }
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
    if (command === "catalog") return appHint(env, userId);
    if (command === "reviews") return reviews(env, userId);
    if (command === "lead") return route(env, userId, "lead", { kvGet, kvPut, onLead });
    // «/start» и всё незнакомое — меню: оно объясняет, что тут вообще есть.
    return welcome(env, userId);
  }

  if (isGreeting(text)) {
    await welcome(env, userId);
    return;
  }
  if (/каталог|авто|машин/i.test(text) && text.length < 30) {
    await appHint(env, userId);
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
  if (payload === "rev") return reviews(env, userId);
  if (payload === "lead") {
    await kvPut(env, `max:wait:${userId}`, { car: "" });
    return maxSend(
      env,
      userId,
      "Напишите номер телефона — менеджер перезвонит и посчитает стоимость под ваш запрос.\n\n" +
        "Можно сразу с пожеланием: «+7 900 000-00-00, кроссовер до 3 млн».",
    );
  }
  if (payload === "app" || payload.startsWith("cat:") || payload.startsWith("car:")) {
    return appHint(env, userId);
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
  "Каталог открывается в приложении — нажмите «Каталог авто», покажу куда.\n\n" +
  "С чего начнём?";

async function welcome(env, userId) {
  return maxSend(env, userId, WELCOME, { keyboard: MENU });
}

/**
 * Куда нажать, чтобы открылся каталог.
 *
 * Списком в переписке каталог больше не показываем — по решению владельца:
 * в приложении те же машины с фильтрами, поиском и всеми фотографиями, а
 * два разных каталога в одном боте только путают.
 *
 * Кнопки, открывающей приложение прямо из сообщения, MAX не даёт (проверено:
 * «open_app» отвергается, ссылка на сайт открывает браузер, внутренняя
 * ссылка на бота не работает). Поэтому единственный честный ответ —
 * показать, куда нажать: словами и картинкой. Без картинки «кнопка слева
 * от поля ввода» звучит понятно только тому, кто уже знает, где она.
 */
async function appHint(env, userId) {
  return maxSend(
    env,
    userId,
    "Каталог открывается в приложении — там все 200+ машин с фото, фильтрами " +
      "по стране и цене и поиском по модели.\n\n" +
      "Нажмите синюю кнопку слева от поля ввода — на картинке она обведена. " +
      "Каталог откроется прямо здесь, не выходя из MAX.",
    {
      /*
       * Номер в имени файла — не украшение.
       *
       * MAX запоминает картинку по адресу: перерисованная подсказка под тем
       * же именем к людям не доехала, у них осталась первая версия. Новое
       * имя — единственный способ показать новую картинку, поэтому при
       * каждой замене номер поднимается.
       *
       * Сама картинка — настоящий снимок экрана, сделанный владельцем, а не
       * нарисованный макет: человек ищет глазами ровно то, что перед ним.
       */
      image: `${SITE}/max-app-hint-4.png`,
      keyboard: MENU,
    },
  );
}

/*
 * Отзывы — ссылками на справочники.
 *
 * Свои видео с выдач у нас есть, но в мессенджере они убеждают хуже: там
 * «нам написали хорошее» показываем мы сами. В Яндекс.Картах и 2ГИС отзыв
 * нельзя ни стереть, ни дорисовать — именно это человек и хочет проверить,
 * когда жмёт «Отзывы» у незнакомой компании.
 */
const YANDEX_REVIEWS = "https://yandex.ru/maps/org/di_avto_treyding/153399449714/reviews/";
const GIS_CARD = "https://2gis.ru/tver/firm/70000001110299440";

async function reviews(env, userId) {
  return maxSend(
    env,
    userId,
    /*
     * Про подделки не пишем.
     *
     * Прошлый текст объяснял, почему справочникам можно верить: «удалить
     * или подделать оценку нельзя». Звучит как оправдание — человек ещё
     * ничего не заподозрил, а ему уже отвечают на подозрение. Достаточно
     * сказать, где смотреть.
     */
    "Что пишут наши клиенты — смотрите на площадках. Там же можно оставить свой отзыв:",
    {
      keyboard: [
        [{ type: "link", text: "⭐ Яндекс.Карты", url: YANDEX_REVIEWS }],
        [{ type: "link", text: "📍 2ГИС", url: GIS_CARD }],
        [{ type: "callback", text: "◀ В меню", payload: "menu" }],
      ],
    },
  );
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
  // Команды живут на отдельном эндпоинте /me/commands. С июльского (2026)
  // обновления MAX перестал принимать их через PATCH /me — тот теперь отвечает
  // «Path /me is not recognized». Имя, описание и аватар через API больше не
  // меняются вовсе (их задают в кабинете бота MAX), поэтому шлём только команды.
  const commands = await maxCall(env, "PATCH", "/me/commands", { commands: COMMANDS });
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
