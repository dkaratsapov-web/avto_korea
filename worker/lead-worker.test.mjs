import test from "node:test";
import assert from "node:assert/strict";
import worker from "./lead-worker.js";

/** Хранилище-заглушка вместо KV. */
function makeStore(seed = {}) {
  const data = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  return {
    data,
    async get(k) {
      return data.has(k) ? JSON.parse(data.get(k)) : null;
    },
    async put(k, v) {
      data.set(k, v);
    },
  };
}

/** Перехват вызовов Telegram. Возвращает журнал. */
function stubTelegram() {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push({ method, body, at: Date.now() });
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  return calls;
}

/** Ждёт отложенные дела, как это делает Cloudflare после ответа. */
function makeCtx() {
  const pending = [];
  return {
    ctx: { waitUntil: (p) => pending.push(p) },
    settle: () => Promise.all(pending),
    pending,
  };
}

function startUpdate(text, userId = 555) {
  return {
    update_id: 1,
    message: {
      message_id: 1,
      text,
      chat: { id: userId, type: "private" },
      from: { id: userId, first_name: "Иван", username: "ivan" },
    },
  };
}

async function run(update, { store, env: extra = {}, ctx }) {
  const env = {
    TELEGRAM_BOT_TOKEN: "T",
    TELEGRAM_CHAT_ID: "-100999",
    STORE: store,
    ...extra,
  };
  const req = new Request("https://w.dev/tg", {
    method: "POST",
    body: JSON.stringify(update),
  });
  return worker.fetch(req, env, ctx);
}

test("новый человек получает приветствие, уведомление админам не задерживает его", async () => {
  const store = makeStore();
  const calls = stubTelegram();
  const { ctx, settle, pending } = makeCtx();

  const res = await run(startUpdate("/start"), { store, ctx });
  assert.equal(res.status, 200);

  // К моменту ответа приветствие УЖЕ отправлено...
  const beforeSettle = calls.map((c) => c.method);
  assert.ok(
    beforeSettle.some((m) => m === "sendMessage" || m === "sendPhoto"),
    "приветствие должно уйти до возврата ответа, было: " + beforeSettle.join(","),
  );

  // ...а уведомление админам отложено на «после ответа».
  assert.ok(pending.length > 0, "служебные дела должны быть отложены");

  await settle();
  const texts = calls
    .filter((c) => c.method === "sendMessage")
    .map((c) => String(c.body.text || ""));
  assert.ok(
    texts.some((t) => t.includes("Новый пользователь")),
    "уведомление о новом человеке должно уйти после ответа",
  );
});

test("метка диплинка сохраняется и не перезаписывается повторным /start", async () => {
  // Гейт выключаем явно: по умолчанию он включён, и вариант «a» упёрся бы
  // в стену подписки — проверяем здесь не её, а сохранение метки.
  const store = makeStore({ settings: { gateEnabled: false } });
  stubTelegram();

  let c = makeCtx();
  await run(startUpdate("/start a-yd_koreya"), { store, ctx: c.ctx });
  await c.settle();

  let users = await store.get("users");
  assert.equal(users["555"].v, "a", "вариант теста должен записаться");
  assert.equal(users["555"].src, "yd_koreya", "источник должен записаться");
  assert.ok(users["555"].openedAt > 0, "отметка открытия должна сохраниться");

  // Тот же человек вернулся без метки — группа теста меняться не должна.
  c = makeCtx();
  await run(startUpdate("/start"), { store, ctx: c.ctx });
  await c.settle();

  users = await store.get("users");
  assert.equal(users["555"].v, "a", "повторный /start не должен менять вариант");
  assert.equal(users["555"].src, "yd_koreya", "и не должен стирать источник");
});

test("стена подписки: без подписки приветствия нет, отметок тоже", async () => {
  const store = makeStore({
    settings: { gateEnabled: true, gateChannelId: "-100777" },
  });
  const calls = stubTelegram();
  // getChatMember отвечает «вышел» — значит не подписан.
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    const body = init?.body ? JSON.parse(init.body) : {};
    calls.push({ method, body });
    const result = method === "getChatMember" ? { status: "left" } : {};
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const c = makeCtx();
  await run(startUpdate("/start a-direct"), { store, ctx: c.ctx });
  await c.settle();

  const users = await store.get("users");
  assert.equal(users["555"].subAt, undefined, "неподписанному отметку ставить нельзя");
  assert.equal(users["555"].openedAt, undefined, "и отметку открытия тоже");
});

test("подписанный проходит стену: обе отметки сохраняются одной записью", async () => {
  const store = makeStore({
    settings: { gateEnabled: true, gateChannelId: "-100777" },
  });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    calls.push({ method });
    const result = method === "getChatMember" ? { status: "member" } : {};
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const c = makeCtx();
  await run(startUpdate("/start a-direct"), { store, ctx: c.ctx });
  await c.settle();

  const users = await store.get("users");
  assert.ok(users["555"].subAt > 0, "отметка подписки должна сохраниться");
  assert.ok(users["555"].openedAt > 0, "и отметка открытия — вместе с ней");
});

test("без ctx (вызов вне Cloudflare) ничего не теряется", async () => {
  const store = makeStore();
  const calls = stubTelegram();

  await run(startUpdate("/start"), { store, ctx: undefined });

  const users = await store.get("users");
  assert.ok(users["555"].openedAt > 0, "отметка должна записаться и без отложенных дел");
  assert.ok(
    calls.some((c) => String(c.body.text || "").includes("Новый пользователь")),
    "уведомление админам должно уйти и без отложенных дел",
  );
});


test("бот не админ канала: стена не запирает человека навсегда", async () => {
  const store = makeStore({
    settings: { gateEnabled: true, gateChannelId: "-100777" },
  });
  const calls = [];
  // Так Telegram отвечает, когда бот не администратор канала.
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    calls.push({ method, body: init?.body ? JSON.parse(init.body) : {} });
    if (method === "getChatMember") {
      return new Response(
        JSON.stringify({ ok: false, error_code: 400, description: "Bad Request: chat not found" }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const c = makeCtx();
  await run(startUpdate("/start a-direct"), { store, ctx: c.ctx });
  await c.settle();

  const texts = calls
    .filter((x) => x.method === "sendMessage")
    .map((x) => String(x.body.text || ""));
  assert.ok(
    !texts.some((t) => t.includes("Каталог открыт подписчикам")),
    "непроверяемая подписка не должна приводить к стене, было: " + texts.join(" | "),
  );

  const users = await store.get("users");
  assert.ok(users["555"].openedAt > 0, "человека должно пустить дальше");
  assert.equal(
    users["555"].subAt,
    undefined,
    "но подписанным его считать нельзя — мы этого не знаем",
  );
});

test("кнопка «Я подписался» не зацикливается, когда проверить нечем", async () => {
  const store = makeStore({
    settings: { gateEnabled: true, gateChannelId: "-100777" },
  });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    calls.push({ method, body: init?.body ? JSON.parse(init.body) : {} });
    if (method === "getChatMember") {
      return new Response(JSON.stringify({ ok: false, description: "chat not found" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const c = makeCtx();
  const req = new Request("https://w.dev/tg", {
    method: "POST",
    body: JSON.stringify({
      update_id: 2,
      callback_query: {
        id: "q1",
        data: "gate_check",
        from: { id: 555 },
        message: { chat: { id: 555 } },
      },
    }),
  });
  await worker.fetch(
    req,
    { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-1", STORE: store },
    c.ctx,
  );
  await c.settle();

  const answer = calls.find((x) => x.method === "answerCallbackQuery");
  assert.ok(answer, "на нажатие надо ответить");
  assert.ok(
    String(answer.body.text).includes("Открываю каталог"),
    "должно открыть, а не просить подписаться ещё раз: " + answer.body.text,
  );
});

test("настоящая неподписка стену по-прежнему показывает", async () => {
  const store = makeStore({
    settings: { gateEnabled: true, gateChannelId: "-100777" },
  });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    calls.push({ method, body: init?.body ? JSON.parse(init.body) : {} });
    const result = method === "getChatMember" ? { status: "left" } : {};
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const c = makeCtx();
  await run(startUpdate("/start a-direct"), { store, ctx: c.ctx });
  await c.settle();

  const texts = calls
    .filter((x) => x.method === "sendMessage")
    .map((x) => String(x.body.text || ""));
  assert.ok(
    texts.some((t) => t.includes("Каталог открыт подписчикам")),
    "тому, кто честно не подписан, стена нужна",
  );
});

/* ---------- Разделение каналов и сохранность каталога ---------- */

function channelPost(chatId, msgId, text) {
  return {
    update_id: 3,
    channel_post: {
      message_id: msgId,
      chat: { id: chatId, type: "channel", title: "Канал " + chatId },
      text,
    },
  };
}

const CAR_POST =
  "Hyundai Palisade\nЦена: 4 200 000 ₽\nГод: 2023\nПробег: 30 000 км\nСтрана: Корея";
const CAR_POST_2 =
  "Kia Carnival\nЦена: 3 100 000 ₽\nГод: 2022\nПробег: 45 000 км\nСтрана: Корея";

async function catalogOf(store) {
  return (await store.get("catalog")) || [];
}

test("новый канал наполняет каталог", async () => {
  const store = makeStore({
    settings: { catalogChatId: "-1002000000001", autoPublish: true },
  });
  stubTelegram();
  const c = makeCtx();

  await run(channelPost("-1002000000001", 5, CAR_POST), { store, ctx: c.ctx });
  await c.settle();

  const cat = await catalogOf(store);
  assert.equal(cat.length, 1, "машина из назначенного канала должна доехать");
  assert.equal(cat[0].priceRub, 4200000, "цена должна разобраться");
});

test("тот же канал может быть и источником каталога, и каналом подписки", async () => {
  const store = makeStore({
    settings: {
      catalogChatId: "-1002000000001",
      gateChannelId: "-1002000000001",
      gateEnabled: true,
      autoPublish: true,
    },
  });
  stubTelegram();
  const c = makeCtx();

  await run(channelPost("-1002000000001", 6, CAR_POST), { store, ctx: c.ctx });
  await c.settle();

  const cat = await catalogOf(store);
  assert.equal(cat.length, 1, "совпадение каналов не должно мешать каталогу");
});

test("посторонний канал каталог не наполняет, когда источник назначен", async () => {
  const store = makeStore({
    settings: { catalogChatId: "-1002000000001", autoPublish: true },
  });
  stubTelegram();
  const c = makeCtx();

  await run(channelPost("-1009999999999", 7, CAR_POST), { store, ctx: c.ctx });
  await c.settle();

  assert.equal((await catalogOf(store)).length, 0, "чужой канал в каталог не пишет");
});

test("пустой источник — прежнее поведение, каталог продолжает обновляться", async () => {
  const store = makeStore({ settings: { catalogChatId: "", autoPublish: true } });
  stubTelegram();
  const c = makeCtx();

  await run(channelPost("-1002000000001", 8, CAR_POST), { store, ctx: c.ctx });
  await c.settle();

  assert.equal(
    (await catalogOf(store)).length,
    1,
    "у тех, кто не заполнил настройку, ничего не должно сломаться",
  );
});

test("ГЛАВНОЕ: пост из нового канала не затирает старую карточку", async () => {
  /*
   * Нумерация сообщений у каждого канала своя и начинается с единицы.
   * Старый каталог собран под именами вида «tg-42». Если новый канал
   * опубликует свой пост №42, он не должен подменить собой чужую машину.
   */
  const store = makeStore({
    catalog: [
      {
        id: "tg-42",
        model: "Toyota Land Cruiser 300",
        priceRub: 9500000,
        year: 2021,
        images: ["/api/tgphoto?id=old"],
      },
    ],
    settings: { catalogChatId: "-1002000000001", autoPublish: true },
  });
  stubTelegram();
  const c = makeCtx();

  await run(channelPost("-1002000000001", 42, CAR_POST_2), { store, ctx: c.ctx });
  await c.settle();

  const cat = await catalogOf(store);
  const old = cat.find((x) => x.id === "tg-42");
  assert.ok(old, "старая карточка должна остаться на месте");
  assert.equal(old.model, "Toyota Land Cruiser 300", "и не должна подмениться");
  assert.equal(old.priceRub, 9500000, "цена старой карточки должна уцелеть");
  assert.deepEqual(old.images, ["/api/tgphoto?id=old"], "и фотографии тоже");
  assert.equal(cat.length, 2, "новая машина добавляется рядом, а не вместо");
});

test("правка старого поста обновляет ту же карточку, а не создаёт вторую", async () => {
  const store = makeStore({
    catalog: [
      {
        id: "tg-77",
        model: "Hyundai Palisade",
        priceRub: 4500000,
        year: 2023,
        images: ["/api/tgphoto?id=old"],
      },
    ],
    settings: { catalogChatId: "-1002000000001", autoPublish: true },
  });
  stubTelegram();
  const c = makeCtx();

  // Тот же пост, что завёл карточку раньше, — теперь отредактирован.
  await run(
    {
      update_id: 4,
      edited_channel_post: {
        message_id: 77,
        chat: { id: "-1002000000001", type: "channel" },
        text: CAR_POST,
      },
    },
    { store, ctx: c.ctx },
  );
  await c.settle();

  const cat = await catalogOf(store);
  assert.equal(cat.length, 1, "дубля быть не должно");
  assert.equal(cat[0].id, "tg-77", "идентификатор карточки менять нельзя");
  assert.equal(cat[0].priceRub, 4200000, "новая цена должна примениться");
});

test("отзывы: пост из нового канала не затирает старый отзыв", async () => {
  const store = makeStore({
    reviews: [{ id: "tg-3", name: "Пётр", text: "Спасибо, всё отлично!", rating: 5 }],
    settings: { reviewsChatId: "-1002000000002" },
  });
  stubTelegram();
  const c = makeCtx();

  await run(channelPost("-1002000000002", 3, "Новый отзыв из другого канала"), {
    store,
    ctx: c.ctx,
  });
  await c.settle();

  const reviews = (await store.get("reviews")) || [];
  const old = reviews.find((r) => r.id === "tg-3");
  assert.ok(old, "старый отзыв должен остаться");
  assert.equal(old.text, "Спасибо, всё отлично!", "и не должен подмениться");
  assert.equal(reviews.length, 2, "новый добавляется рядом");
});

/* ---------- Потеря видео при правке отзыва в админке ---------- */

/**
 * Подписанные данные входа мини-аппа — те же, что присылает Telegram.
 * Подделать их нельзя, поэтому для теста подписываем настоящим алгоритмом
 * тем же «токеном бота», с которым запускаем воркер.
 */
async function signedInitData(botToken, userId) {
  const enc = new TextEncoder();
  const hmac = async (key, data) => {
    const k = await crypto.subtle.importKey(
      "raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    return new Uint8Array(await crypto.subtle.sign("HMAC", k, data));
  };
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    user: JSON.stringify({ id: userId, first_name: "Хозяин" }),
  });
  const check = [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join("\n");
  const secret = await hmac(enc.encode("WebAppData"), enc.encode(botToken));
  const sig = await hmac(secret, enc.encode(check));
  params.set("hash", [...sig].map((b) => b.toString(16).padStart(2, "0")).join(""));
  return params.toString();
}

/** Вызов админского действия от владельца. */
async function admin(action, payload, store) {
  const initData = await signedInitData("T", 777);
  const req = new Request("https://w.dev/api/admin", {
    method: "POST",
    body: JSON.stringify({ action, payload, initData }),
  });
  return worker.fetch(req, {
    TELEGRAM_BOT_TOKEN: "T",
    TELEGRAM_CHAT_ID: "-100999",
    ADMIN_IDS: "777",
    STORE: store,
  });
}

/*
 * Так и пропали видео-отзывы с сайта: админка собирала запись заново из шести
 * текстовых полей и клала её на место старой целиком. Достаточно было
 * поправить опечатку в имени — и видео исчезало навсегда, молча.
 */
test("правка отзыва в админке не должна стирать видео", async () => {
  const store = makeStore({
    reviews: [
      {
        id: "tg-2875062656-40",
        name: "Клиент ДиАвто69",
        text: "Спасибо за новый автомобиль!",
        rating: 5,
        media: "/api/tgphoto?id=PHOTO_A",
        video: "/api/tgvideo?id=VIDEO_A",
        images: ["/api/tgphoto?id=PHOTO_A"],
        videos: ["/api/tgvideo?id=VIDEO_A"],
        chatId: "-1002875062656",
        ts: 1000,
      },
    ],
  });
  stubTelegram();

  const res = await admin(
    "reviews.save",
    { id: "tg-2875062656-40", name: "София С.", text: "Спасибо за новый автомобиль!", rating: 5 },
    store,
  );
  const body = await res.json();
  assert.equal(body.ok, true, "сохранение должно пройти: " + JSON.stringify(body));

  const r = ((await store.get("reviews")) || [])[0];
  assert.equal(r.name, "София С.", "имя должно поправиться");
  assert.deepEqual(r.videos, ["/api/tgvideo?id=VIDEO_A"], "видео должно уцелеть");
  assert.deepEqual(r.images, ["/api/tgphoto?id=PHOTO_A"], "фото должно уцелеть");
  assert.equal(r.video, "/api/tgvideo?id=VIDEO_A", "и поле первой версии тоже");
  assert.equal(r.chatId, "-1002875062656", "канал не должен потеряться");
});

/*
 * Возврат уже потерянного: владелец трогает пост в канале, бот перечитывает
 * его и прикладывает медиа к ТОЙ ЖЕ записи. Отзыв заведён до разделения
 * каналов, поэтому лежит под старым именем «tg-<номер>».
 */
test("правка поста в канале возвращает медиа в старую запись, без дубля", async () => {
  const store = makeStore({
    reviews: [
      { id: "tg-40", name: "София С.", text: "Спасибо за новый автомобиль!", rating: 5, ts: 1000 },
    ],
    settings: { reviewsChatId: "-1002000000002" },
  });
  stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 7,
      edited_channel_post: {
        message_id: 40,
        chat: { id: "-1002000000002", type: "channel" },
        caption: "Спасибо за новый автомобиль!",
        video: { file_id: "VIDEO_BACK" },
      },
    },
    { store, ctx: c.ctx },
  );
  await c.settle();

  const list = (await store.get("reviews")) || [];
  assert.equal(list.length, 1, "второй записи появиться не должно");
  assert.ok(
    list[0].videos?.[0]?.includes("VIDEO_BACK"),
    "видео должно вернуться в существующий отзыв, было: " + JSON.stringify(list[0].videos),
  );
  assert.equal(list[0].name, "София С.", "правленое в админке имя должно остаться");
  assert.equal(list[0].id, "tg-2000000002-40", "запись переезжает на новое имя");
});

/*
 * Обратная сторона того же механизма: по одному лишь номеру сообщения
 * связывать нельзя. Нумерация у каждого канала своя, и пост №40 из чужого
 * канала не должен подменять собой настоящий отзыв клиента.
 */
test("чужой пост с тем же номером не подменяет отзыв", async () => {
  const store = makeStore({
    reviews: [
      { id: "tg-40", name: "София С.", text: "Спасибо за новый автомобиль!", rating: 5, ts: 1000 },
    ],
    settings: { reviewsChatId: "-1002000000002" },
  });
  stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 8,
      channel_post: {
        message_id: 40,
        chat: { id: "-1002000000002", type: "channel" },
        caption: "Совершенно другой отзыв о другой машине",
        video: { file_id: "VIDEO_OTHER" },
      },
    },
    { store, ctx: c.ctx },
  );
  await c.settle();

  const list = (await store.get("reviews")) || [];
  assert.equal(list.length, 2, "должен появиться отдельный отзыв");
  const old = list.find((r) => r.id === "tg-40");
  assert.ok(old, "старый отзыв должен остаться на месте");
  assert.equal(old.text, "Спасибо за новый автомобиль!", "и не должен подмениться");
  assert.equal(old.videos, undefined, "и не должен получить чужое видео");
});

/* ---------- Приём заявок на вступление в канал ---------- */

function joinRequest(chatId, userId = 777) {
  return {
    update_id: 9,
    chat_join_request: {
      chat: { id: chatId, type: "channel", title: "DI AUTO 69" },
      from: { id: userId, first_name: "Пётр" },
      date: Math.floor(Date.now() / 1000),
    },
  };
}

test("заявка одобряется ПЕРВЫМ действием, приветствие — после ответа", async () => {
  const store = makeStore({
    settings: { gateChannelId: "-1002875062656", gateEnabled: false },
  });
  const calls = stubTelegram();
  const c = makeCtx();

  await run(joinRequest("-1002875062656"), { store, ctx: c.ctx });

  // Главное — порядок: одобрение уходит первым, раньше всего остального.
  assert.equal(
    calls[0]?.method,
    "approveChatJoinRequest",
    "одобрение должно быть первым, было: " + calls.map((x) => x.method).join(","),
  );
  // А приветствие ответа вебхука не задерживает: оно вынесено в отложенные
  // дела. Слаться параллельно оно может — важно, что его не ждут.
  assert.ok(
    c.pending.length > 0,
    "приветствие и отметки должны быть отложены, а не ожидаться",
  );

  await c.settle();
  assert.ok(
    calls.some((x) => x.method === "sendMessage" || x.method === "sendPhoto"),
    "приветствие должно уйти после одобрения",
  );
});

test("заявка одобряется и при выключенной стене подписки", async () => {
  const store = makeStore({
    settings: { gateChannelId: "-1002875062656", gateEnabled: false },
  });
  const calls = stubTelegram();
  const c = makeCtx();

  await run(joinRequest("-1002875062656"), { store, ctx: c.ctx });
  await c.settle();

  assert.ok(
    calls.some((x) => x.method === "approveChatJoinRequest"),
    "выключенная стена не должна отменять приём заявок",
  );
});

test("канал задан только как источник каталога — заявка всё равно одобряется", async () => {
  const store = makeStore({
    settings: { catalogChatId: "-1002875062656", gateChannelId: "" },
  });
  const calls = stubTelegram();
  const c = makeCtx();

  await run(joinRequest("-1002875062656"), { store, ctx: c.ctx });
  await c.settle();

  assert.ok(
    calls.some((x) => x.method === "approveChatJoinRequest"),
    "канал компании опознаётся по любому из двух полей",
  );
});

test("заявка из чужого канала не одобряется, но админам приходит разбор", async () => {
  const store = makeStore({
    settings: { gateChannelId: "-1002875062656", catalogChatId: "-1002875062656" },
  });
  const calls = stubTelegram();
  const c = makeCtx();

  await run(joinRequest("-100OTHER"), { store, ctx: c.ctx });
  await c.settle();

  assert.ok(
    !calls.some((x) => x.method === "approveChatJoinRequest"),
    "чужой канал одобрять нельзя",
  );
  const warn = calls.find((x) =>
    String(x.body?.text || "").includes("НЕизвестного канала"),
  );
  assert.ok(warn, "о промахе надо сообщить, а не молчать");
  assert.ok(
    String(warn.body.text).includes("-100OTHER") &&
      String(warn.body.text).includes("-1002875062656"),
    "в сообщении должны быть оба id, чтобы было что с чем сверить",
  );
  assert.equal(
    warn.body.parse_mode,
    undefined,
    "разметки быть не должно: id с минусами и подчёркиваниями её ломают",
  );
});

test("стена подписки по умолчанию выключена: /start сразу открывает бота", async () => {
  // Настроек нет вовсе — значит работают значения по умолчанию.
  const store = makeStore();
  const calls = stubTelegram();
  const c = makeCtx();

  await run(startUpdate("/start a-direct"), { store, ctx: c.ctx });
  await c.settle();

  const texts = calls
    .filter((x) => x.method === "sendMessage")
    .map((x) => String(x.body.text || ""));
  assert.ok(
    !texts.some((t) => t.includes("Каталог открыт подписчикам")),
    "стены быть не должно даже у варианта «a»",
  );
  const users = await store.get("users");
  assert.ok(users["555"].openedAt > 0, "человека должно пустить в бот сразу");
});

/* ---------- Скорость: сколько раз бот ходит в хранилище ---------- */

/** Хранилище с приборами: считает обращения по ключам. */
function countingStore(seed = {}) {
  const data = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  const gets = [];
  const puts = [];
  return {
    gets,
    puts,
    async get(k) {
      gets.push(k);
      return data.has(k) ? JSON.parse(data.get(k)) : null;
    },
    async put(k, v) {
      puts.push(k);
      data.set(k, v);
    },
  };
}

test("/start трогает список пользователей ровно один раз на чтение и один на запись", async () => {
  /*
   * Список пользователей хранится одним куском и растёт с каждым новым
   * человеком. Раньше /start читал и писал его трижды: на трёх тысячах
   * пользователей это больше мегабайта в каждую сторону на одно нажатие.
   * Плюс три записи подряд в один ключ — это гонка: у Cloudflare запись в
   * ключ ограничена одним разом в секунду.
   */
  const store = countingStore({ settings: { gateEnabled: false } });
  stubTelegram();
  const c = makeCtx();

  await run(startUpdate("/start b-direct"), { store, ctx: c.ctx });
  await c.settle();

  const usersGets = store.gets.filter((k) => k === "users").length;
  const usersPuts = store.puts.filter((k) => k === "users").length;
  assert.equal(usersGets, 1, "чтений списка пользователей должно быть одно, было " + usersGets);
  assert.equal(usersPuts, 1, "записей списка пользователей должна быть одна, было " + usersPuts);

  // И всё равно всё сохранилось.
  const users = await store.get("users");
  assert.equal(users["555"].src, "direct", "источник должен сохраниться");
  assert.ok(users["555"].openedAt > 0, "отметка открытия должна сохраниться");
  assert.ok(users["555"].ts > 0, "дата первого запуска должна сохраниться");
  assert.equal(users["555"].name, "Иван", "имя должно сохраниться");
});

test("упёршемуся в стену метка кампании всё равно сохраняется", async () => {
  // Иначе при повторном заходе он попадёт в другую группу А/Б-теста.
  const store = makeStore({
    settings: { gateEnabled: true, gateChannelId: "-100777" },
  });
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    calls.push({ method, body: init?.body ? JSON.parse(init.body) : {} });
    const result = method === "getChatMember" ? { status: "left" } : {};
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  };

  const c = makeCtx();
  await run(startUpdate("/start a-yd_koreya"), { store, ctx: c.ctx });
  await c.settle();

  const users = await store.get("users");
  assert.equal(users["555"].v, "a", "вариант теста должен зафиксироваться и у неподписанного");
  assert.equal(users["555"].src, "yd_koreya", "и источник тоже");
  assert.equal(users["555"].openedAt, undefined, "но бота он не открывал");
});

test("счётчики просмотров и избранного не задерживают ответ", async () => {
  for (const [path, body, key] of [
    ["/api/view", { id: "tg-1" }, "stats"],
    ["/api/fav", { id: "tg-1", on: true }, "stats"],
  ]) {
    const store = countingStore({ stats: {} });
    stubTelegram();
    const c = makeCtx();
    const res = await worker.fetch(
      new Request("https://w.dev" + path, { method: "POST", body: JSON.stringify(body) }),
      { TELEGRAM_BOT_TOKEN: "T", STORE: store },
      c.ctx,
    );
    assert.equal(res.status, 200, path + " должен отвечать сразу");
    assert.equal(
      store.puts.length,
      0,
      path + ": до ответа записей быть не должно, было " + store.puts.join(","),
    );
    await c.settle();
    assert.ok(store.puts.includes(key), path + ": после ответа счётчик должен записаться");
  }
});

/* ---------- Повторная публикация одной машины ---------- */

const COROLLA =
  "Toyota Corolla\nELITE EDITION\nЦена: 1 660 000 ₽\nГод: 2023\nПробег: 68 000 км\nСтрана: Китай";

function photoPost(chatId, msgId, text, fileId, groupId) {
  return {
    update_id: 20 + msgId,
    channel_post: {
      message_id: msgId,
      chat: { id: chatId, type: "channel" },
      caption: text,
      photo: [{ file_id: fileId, file_unique_id: fileId, width: 1280, height: 720, file_size: 100 }],
      ...(groupId ? { media_group_id: groupId } : {}),
    },
  };
}

test("альбом, разбитый Telegram надвое, даёт ОДНУ карточку", async () => {
  /*
   * В альбоме не больше десяти фотографий. Снял двенадцать — приложение само
   * разбивает публикацию на два альбома с разными номерами, и для бота это
   * два поста об одной машине.
   */
  const store = makeStore({
    settings: { catalogChatId: "-100SRC", autoPublish: true },
    catalog: [],
  });
  stubTelegram();
  const c = makeCtx();

  await run(photoPost("-100SRC", 101, COROLLA, "photoA", "alb1"), { store, ctx: c.ctx });
  await run(photoPost("-100SRC", 111, COROLLA, "photoB", "alb2"), { store, ctx: c.ctx });
  await c.settle();

  const cat = (await store.get("catalog")) || [];
  assert.equal(cat.length, 1, "должна остаться одна карточка, было " + cat.length);
  assert.equal(cat[0].images.length, 2, "фотографии из обоих постов должны сложиться");
});

test("перепубликация того же поста не плодит карточку", async () => {
  const store = makeStore({
    settings: { catalogChatId: "-100SRC", autoPublish: true },
    catalog: [],
  });
  stubTelegram();
  const c = makeCtx();

  await run(photoPost("-100SRC", 201, COROLLA, "p1"), { store, ctx: c.ctx });
  await run(photoPost("-100SRC", 202, COROLLA, "p2"), { store, ctx: c.ctx });
  await run(photoPost("-100SRC", 203, COROLLA, "p3"), { store, ctx: c.ctx });
  await c.settle();

  const cat = (await store.get("catalog")) || [];
  assert.equal(cat.length, 1, "три поста об одной машине — одна карточка");
  assert.deepEqual(
    cat[0].mergedFrom?.length,
    2,
    "в карточке должны отметиться два поглощённых поста",
  );
});

test("правка поглощённого поста обновляет ту же карточку, а не создаёт новую", async () => {
  const store = makeStore({
    settings: { catalogChatId: "-100SRC", autoPublish: true },
    catalog: [],
  });
  stubTelegram();
  let c = makeCtx();

  await run(photoPost("-100SRC", 301, COROLLA, "p1"), { store, ctx: c.ctx });
  await run(photoPost("-100SRC", 302, COROLLA, "p2"), { store, ctx: c.ctx });
  await c.settle();

  // Правим ВТОРОЙ пост — тот, что слился в карточку первого.
  c = makeCtx();
  await run(
    {
      update_id: 400,
      edited_channel_post: {
        message_id: 302,
        chat: { id: "-100SRC", type: "channel" },
        caption: COROLLA.replace("1 660 000", "1 590 000"),
      },
    },
    { store, ctx: c.ctx },
  );
  await c.settle();

  const cat = (await store.get("catalog")) || [];
  assert.equal(cat.length, 1, "дубля появиться не должно");
  assert.equal(cat[0].priceRub, 1590000, "новая цена должна примениться");
});

test("разные машины по-прежнему заводят разные карточки", async () => {
  const store = makeStore({
    settings: { catalogChatId: "-100SRC", autoPublish: true },
    catalog: [],
  });
  stubTelegram();
  const c = makeCtx();

  await run(photoPost("-100SRC", 501, COROLLA, "p1"), { store, ctx: c.ctx });
  await run(
    photoPost(
      "-100SRC",
      502,
      "BMW 320L\nM-SPORT\nЦена: 3 790 000 ₽\nГод: 2023\nПробег: 23 000 км\nСтрана: Китай",
      "p2",
    ),
    { store, ctx: c.ctx },
  );
  // Та же модель и год, но другой пробег — это другая машина.
  await run(
    photoPost(
      "-100SRC",
      503,
      "Toyota Corolla\nELITE EDITION\nЦена: 1 660 000 ₽\nГод: 2023\nПробег: 41 000 км\nСтрана: Китай",
      "p3",
    ),
    { store, ctx: c.ctx },
  );
  await c.settle();

  const cat = (await store.get("catalog")) || [];
  assert.equal(cat.length, 3, "три разные машины — три карточки, было " + cat.length);
});

/* ---------- Потерянные видео-отзывы ---------- */

/** Пересылка владельцем в личку боту — так отзывы и заводят руками. */
function forwardToBot(extra, caption = "Спасибо за новый автомобиль!") {
  return {
    update_id: 30,
    message: {
      message_id: 501,
      chat: { id: 777, type: "private" },
      from: { id: 777, first_name: "Хозяин" },
      caption,
      forward_origin: { type: "channel" },
      ...extra,
    },
  };
}

async function runAsOwner(update, store) {
  const c = makeCtx();
  const res = await worker.fetch(
    new Request("https://w.dev/tg", { method: "POST", body: JSON.stringify(update) }),
    { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", ADMIN_IDS: "777", STORE: store },
    c.ctx,
  );
  await c.settle();
  return res;
}

/*
 * Главная причина пропавших отзывов: клиент записывает видео «кружком»
 * (video_note), владелец пересылает его боту — а бот такое вложение не
 * распознавал, сохранял один текст и отвечал «опубликован».
 */
test("не понял вложение — говорит об этом, а не рапортует об успехе", async () => {
  const store = makeStore();
  const calls = stubTelegram();

  // Голосовое: не фото и не видео — сохранить нечего.
  await runAsOwner(forwardToBot({ voice: { file_id: "VOICE_FILE" } }), store);

  const reply = calls.filter((c) => c.method === "sendMessage").pop();
  const text = String(reply?.body?.text || "");
  assert.ok(!/✅/.test(text), "галочки быть не должно, было: " + text);
  assert.match(text, /БЕЗ файлов/, "должен прямо сказать, что файлов нет");
});

test("обычное видео по-прежнему работает и отчёт верный", async () => {
  const store = makeStore();
  const calls = stubTelegram();
  await runAsOwner(
    forwardToBot({ video: { file_id: "PLAIN_VIDEO", thumbnail: { file_id: "PLAIN_THUMB" } } }),
    store,
  );
  const r = ((await store.get("reviews")) || [])[0];
  assert.ok(r?.videos?.[0]?.includes("PLAIN_VIDEO"));
  const reply = calls.filter((c) => c.method === "sendMessage").pop();
  assert.match(String(reply?.body?.text), /✅/, "успех должен подтверждаться");
});

/* ---------- Адрес мини-аппа ---------- */

/** Кнопки приветствия при заданных настройках. */
async function menuOf(settings) {
  const store = makeStore({ settings });
  const calls = stubTelegram();
  const c = makeCtx();
  await run(startUpdate("/start"), { store, ctx: c.ctx });
  await c.settle();
  const msg = calls.find((x) => x.method === "sendMessage" && x.body.reply_markup);
  return msg?.body?.reply_markup?.inline_keyboard?.[0]?.[0] ?? null;
}

/*
 * Реальный случай: к адресу в настройке дописали текст без слэша, всё
 * слиплось с именем домена, и главная кнопка бота открывала страницу
 * «не удалось найти IP-адрес сервера». Метка такого домена — 126 символов
 * при пределе в 63, то есть его не существует в принципе.
 */
test("склеенный адрес мини-аппа не уходит в кнопку", async () => {
  const broken =
    "https://xn---69-ved3475ghjb1yja62ua767ca454aa2xt7zvhm9mjwsjoyg32a4rjsilp7ly783fg8ciygha944qo2rha7842eha1af1ed9ab4e0iqi3a4kqe9a3l5cp64g.xn--rg4c00a/tma";
  const btn = await menuOf({ gateEnabled: false, miniAppUrl: broken });
  assert.ok(btn, "кнопка должна быть");
  assert.equal(btn.web_app, undefined, "мини-апп по битому адресу открывать нельзя");
  assert.match(btn.url || "", /\/catalog$/, "должен остаться рабочий каталог сайта");
});

test("кириллический домен приводится к машинной записи", async () => {
  const btn = await menuOf({
    gateEnabled: false,
    miniAppUrl: "https://автоимпорт-69.рф/tma",
  });
  assert.equal(
    btn?.web_app?.url,
    "https://xn---69-5cdk0b2aocjmsg.xn--p1ai/tma",
    "встроенный браузер Telegram надёжнее открывает машинную запись",
  );
});

test("мусор вместо адреса не ломает меню", async () => {
  for (const bad of ["каталог", "http://сайт.рф/tma", "https://", "https://безточки/tma", ""]) {
    const btn = await menuOf({ gateEnabled: false, miniAppUrl: bad });
    assert.ok(btn, `кнопка должна остаться при значении «${bad}»`);
    assert.equal(btn.web_app, undefined, `«${bad}» не должно уходить в мини-апп`);
    assert.match(btn.url || "", /^https:\/\//, `«${bad}» — запасной адрес должен быть рабочим`);
  }
});

test("нормальный адрес по-прежнему открывает мини-апп", async () => {
  const btn = await menuOf({
    gateEnabled: false,
    miniAppUrl: "https://xn---69-5cdk0b2aocjmsg.xn--p1ai/tma",
  });
  assert.match(btn?.web_app?.url || "", /\/tma$/, "мини-апп должен открываться как раньше");
});

/*
 * Синяя кнопка меню бота настраивалась руками в BotFather, и адрес там лежал
 * с кириллическим доменом. Поэтому правки адреса в коде её не касались:
 * кнопки в сообщениях чинились, а эта продолжала вести в никуда.
 */
test("привязка вебхука выставляет и кнопку меню — в машинной записи", async () => {
  const store = makeStore({
    settings: { miniAppUrl: "https://автоимпорт-69.рф/tma", catalogButtonText: "Каталог" },
  });
  const calls = stubTelegram();

  await worker.fetch(
    new Request("https://w.dev/setup"),
    { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", STORE: store },
    undefined,
  );

  const menu = calls.find((c) => c.method === "setChatMenuButton");
  assert.ok(menu, "кнопка меню должна выставляться, было: " + calls.map((c) => c.method).join(","));
  assert.equal(
    menu.body.menu_button.web_app.url,
    "https://xn---69-5cdk0b2aocjmsg.xn--p1ai/tma",
    "кириллица наружу уходить не должна",
  );
});

test("непригодный адрес — обычное меню команд, а не кнопка в никуда", async () => {
  const store = makeStore({ settings: { miniAppUrl: "каталог" } });
  const calls = stubTelegram();

  await worker.fetch(
    new Request("https://w.dev/setup"),
    { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", STORE: store },
    undefined,
  );

  const menu = calls.find((c) => c.method === "setChatMenuButton");
  assert.equal(menu?.body?.menu_button?.type, "commands", "битый адрес в кнопку попадать не должен");
});

/*
 * Петля, из-за которой владелец оказывался заперт: чтобы починить кнопку
 * запуска мини-аппа, нужно было зайти в админку — которая открывается той
 * самой кнопкой. Команда /fix эту петлю снимает.
 */
test("/fix чинит бота без захода в админку", async () => {
  const store = makeStore({
    settings: { miniAppUrl: "https://автоимпорт-69.рф/tma", catalogButtonText: "Каталог" },
  });
  const calls = stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 90,
      message: {
        message_id: 900,
        text: "/fix",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.ok(calls.some((x) => x.method === "setWebhook"), "вебхук должен перепривязаться");
  const menu = calls.find((x) => x.method === "setChatMenuButton");
  assert.equal(
    menu?.body?.menu_button?.web_app?.url,
    "https://xn---69-5cdk0b2aocjmsg.xn--p1ai/tma",
    "кнопка меню должна получить адрес в машинной записи",
  );
  const reply = calls.filter((x) => x.method === "sendMessage").pop();
  assert.match(String(reply?.body?.text), /Кнопка меню/, "владельцу должен прийти отчёт");
});

test("/fix от постороннего ничего не меняет", async () => {
  const store = makeStore({ settings: { miniAppUrl: "https://автоимпорт-69.рф/tma" } });
  const calls = stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 91,
      message: {
        message_id: 901,
        text: "/fix",
        chat: { id: 555, type: "private" },
        from: { id: 555, first_name: "Чужой" },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.ok(
    !calls.some((x) => x.method === "setChatMenuButton" || x.method === "setWebhook"),
    "настройки бота посторонний менять не должен",
  );
});

/*
 * Ключ CRM. Пульт отзывов на чужом сервере — это ровно та дверь, которую
 * стоит проверить: она открывается без подписи Telegram, одной строкой в
 * заголовке. Поэтому проверяем не «работает ли», а «что через неё нельзя».
 */
async function crmCall(store, key, action, payload) {
  return worker.fetch(
    new Request("https://w.dev/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key === null ? {} : { "X-Crm-Key": key }) },
      body: JSON.stringify({ action, payload }),
    }),
    { TELEGRAM_BOT_TOKEN: "T", STORE: store },
    undefined,
  );
}

test("/crm выдаёт владельцу ключ и запоминает его", async () => {
  const store = makeStore({});
  const calls = stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 92,
      message: {
        message_id: 902,
        text: "/crm",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  const key = await store.get("crmKey");
  assert.ok(typeof key === "string" && key.length >= 32, "ключ должен быть сохранён");
  const reply = calls.filter((x) => x.method === "sendMessage").pop();
  assert.ok(String(reply?.body?.text).includes(key), "ключ должен прийти владельцу");
});

test("повторный /crm показывает тот же ключ, а не отключает CRM", async () => {
  const store = makeStore({ crmKey: "старыйключ" });
  stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 93,
      message: {
        message_id: 903,
        text: "/crm",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.equal(await store.get("crmKey"), "старыйключ");
});

test("«/crm новый» выписывает другой ключ", async () => {
  const store = makeStore({ crmKey: "старыйключ" });
  stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 94,
      message: {
        message_id: 904,
        text: "/crm новый",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.notEqual(await store.get("crmKey"), "старыйключ");
});

test("/crm постороннему ключа не даёт", async () => {
  const store = makeStore({});
  const calls = stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 95,
      message: {
        message_id: 905,
        text: "/crm",
        chat: { id: 555, type: "private" },
        from: { id: 555, first_name: "Чужой" },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.equal(await store.get("crmKey"), null, "ключ выписываться не должен");
  assert.ok(!calls.some((x) => x.method === "sendMessage"), "и отвечать постороннему нечем");
});

test("без ключа в хранилище дверь закрыта", async () => {
  const r = await crmCall(makeStore({ reviews: [{ id: "a" }] }), "kakoy-nibud", "reviews.list");
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, "not_paired");
});

test("чужой ключ отзывы не отдаёт", async () => {
  const store = makeStore({ crmKey: "pravilnyy", reviews: [{ id: "a" }] });
  const r = await crmCall(store, "nepravilnyy", "reviews.list");
  assert.equal(r.status, 401);
  assert.equal((await r.json()).error, "bad_key");
});

test("по своему ключу CRM видит и удаляет отзывы", async () => {
  const store = makeStore({
    crmKey: "pravilnyy",
    reviews: [{ id: "a", text: "Выдача BMW" }, { id: "b", text: "Выдача Kia" }],
  });

  const list = await (await crmCall(store, "pravilnyy", "reviews.list")).json();
  assert.equal(list.reviews.length, 2);

  const left = await (await crmCall(store, "pravilnyy", "reviews.remove", { id: "a" })).json();
  assert.deepEqual(
    left.reviews.map((x) => x.id),
    ["b"],
    "удалиться должен ровно названный отзыв",
  );
  assert.deepEqual((await store.get("reviews")).map((x) => x.id), ["b"]);
});

/*
 * Ключ узкий по замыслу: он лежит на сервере сайта, и его утечка не должна
 * означать доступ к каталогу, заявкам и рассылке.
 */
test("ключом CRM ничего, кроме отзывов, не сделать", async () => {
  const store = makeStore({ crmKey: "pravilnyy", catalog: [{ id: "car" }] });

  for (const action of ["catalog.save", "settings.save", "broadcast.send", "admins.set", "me"]) {
    const r = await crmCall(store, "pravilnyy", action, []);
    assert.equal(r.status, 400, action + " не должно приниматься");
    assert.equal((await r.json()).error, "unknown_action");
  }
  assert.deepEqual(await store.get("catalog"), [{ id: "car" }], "каталог не тронут");
});

/*
 * Видео с телефона легко весит впятеро больше того, что Bot API отдаёт боту.
 * До проверки такой отзыв сохранялся, а на сайте выходила карточка с мёртвым
 * плеером — снаружи неотличимо от поломки сайта.
 */
test("тяжёлое видео не публикуется, а владельцу приходит цифра", async () => {
  const store = makeStore({});
  const calls = stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 96,
      message: {
        message_id: 906,
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
        video: { file_id: "BIG", file_size: 47 * 1024 * 1024 },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.deepEqual(await store.get("reviews"), null, "карточка с мёртвым плеером заводиться не должна");
  const reply = calls.filter((x) => x.method === "sendMessage").pop();
  assert.match(String(reply?.body?.text), /47 МБ/, "владелец должен увидеть размер");
});

test("видео без подписи публикуется как есть", async () => {
  const store = makeStore({});
  stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 97,
      message: {
        message_id: 907,
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
        video: { file_id: "OK", file_size: 8 * 1024 * 1024, thumbnail: { file_id: "THUMB" } },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  const reviews = await store.get("reviews");
  assert.equal(reviews.length, 1, "отзыв должен появиться и без подписи");
  assert.equal(reviews[0].text, "", "подпись не выдумываем");
  assert.equal(reviews[0].videos.length, 1);
  assert.ok(reviews[0].poster, "обложка из кадра видео должна сохраниться");
});

/*
 * Кто может залить файл в бота.
 *
 * Бота можно добавить в чужую группу или чужой канал, зная его имя, — и до
 * этих проверок этого хватало, чтобы посторонняя фотография уехала в наш
 * каталог, а при авто-публикации сразу на сайт.
 */
function groupPhoto(chatId, fromId, extra = {}) {
  return {
    message_id: 1,
    chat: { id: chatId, type: "supergroup", title: "Группа" },
    from: { id: fromId, first_name: "Кто-то" },
    photo: [{ file_id: "PH", file_unique_id: "PH", width: 1280, height: 720 }],
    caption: COROLLA,
    ...extra,
  };
}

test("в чужой группе админ группы каталог не пополняет", async () => {
  const store = makeStore({ settings: { autoPublish: true }, catalog: [] });
  // getChatMember отвечает «создатель»: в своей группе человек всегда админ.
  globalThis.fetch = async (url, init) => {
    const method = String(url).split("/").pop();
    const body = init?.body ? JSON.parse(init.body) : {};
    if (method === "getChatMember") {
      return new Response(JSON.stringify({ ok: true, result: { status: "creator" } }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: {}, method, body }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const c = makeCtx();

  await run(
    { update_id: 100, message: groupPhoto(-100500, 555) },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.deepEqual(await store.get("catalog"), [], "чужая группа в каталог попадать не должна");
  assert.equal(await store.get("drafts"), null, "и черновиком тоже");
});

test("в ненастроенной группе админ бота публикует как раньше", async () => {
  const store = makeStore({ settings: { autoPublish: true }, catalog: [] });
  stubTelegram();
  const c = makeCtx();

  await run(
    { update_id: 101, message: groupPhoto(-100500, 777) },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  const catalog = (await store.get("catalog")) || [];
  assert.equal(catalog.length, 1, "своя публикация должна дойти до каталога");
});

test("в назначенном канале отзывов админ канала публикует отзыв", async () => {
  const store = makeStore({ settings: { autoPublish: true, reviewsChatId: "-100777" }, catalog: [] });
  globalThis.fetch = async (url) => {
    const method = String(url).split("/").pop();
    const result = method === "getChatMember" ? { status: "administrator" } : {};
    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const c = makeCtx();

  await run(
    {
      update_id: 102,
      message: groupPhoto(-100777, 555, { chat: { id: -100777, type: "supergroup", title: "Отзывы" } }),
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  assert.equal(((await store.get("reviews")) || []).length, 1);
});

test("первый канал запоминается, второй в каталог не пускают", async () => {
  const store = makeStore({ settings: { autoPublish: true }, catalog: [] });
  const calls = stubTelegram();
  const c = makeCtx();

  const channelPost = (chatId, title) => ({
    message_id: 5,
    chat: { id: chatId, type: "channel", title },
    photo: [{ file_id: "PH", file_unique_id: "PH", width: 1280, height: 720 }],
    caption: COROLLA,
  });

  await run({ update_id: 103, channel_post: channelPost(-1001, "Наш канал") }, { store, env: {}, ctx: c.ctx });
  await c.settle();
  assert.equal(String(await store.get("catalogChatSeen")), "-1001", "первый канал должен запомниться");
  assert.equal(((await store.get("catalog")) || []).length, 1, "свой канал должен наполнять каталог");

  await run({ update_id: 104, channel_post: channelPost(-1002, "Чужой канал") }, { store, env: {}, ctx: c.ctx });
  await c.settle();
  assert.equal(((await store.get("catalog")) || []).length, 1, "чужой канал каталог не пополняет");
  assert.ok(
    calls.some((x) => x.method === "sendMessage" && /не принят/.test(String(x.body?.text))),
    "админам должно прийти предупреждение о чужом канале",
  );
});

/* ---------- Бот в MAX ---------- */

/*
 * Второй мессенджер работает с тем же складом: каталог и заявки общие.
 * Проверяем именно это — что MAX не заводит свою копию данных и что без
 * токена не уходит ни одного запроса наружу.
 */
function maxUpdate(body) {
  return new Request("https://w.dev/max", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("без токена MAX бот молчит и наружу не ходит", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return new Response("{}");
  };
  const store = makeStore({ catalog: [{ id: "c1", model: "Kia K5" }] });

  const r = await worker.fetch(
    maxUpdate({ update_type: "bot_started", user: { user_id: 42 } }),
    { TELEGRAM_BOT_TOKEN: "T", STORE: store },
    undefined,
  );

  assert.equal(r.status, 200);
  assert.equal(called, false, "без MAX_BOT_TOKEN запросов быть не должно");
});

test("«Каталог авто» в MAX объясняет, где открыть приложение", async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ message: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const store = makeStore({
    catalog: [{ id: "c1", model: "Kia K5", year: 2023, priceMoscowRub: 2100000 }],
  });

  await worker.fetch(
    maxUpdate({
      update_type: "message_callback",
      callback: { callback_id: "cb1", user: { user_id: 42 }, payload: "app" },
    }),
    { TELEGRAM_BOT_TOKEN: "T", MAX_BOT_TOKEN: "M", STORE: store },
    undefined,
  );

  const msg = sent.find((x) => x.url.includes("botapi.max.ru/messages"));
  assert.match(String(msg.body.text), /синюю кнопку слева от поля ввода/);
  // Картинка с примером: без неё «кнопка слева» понятна только тому, кто
  // уже знает, где она.
  const image = msg.body.attachments.find((a) => a.type === "image");
  assert.match(String(image.payload.url), /max-app-hint-4\.png$/);
  // И ни одной машины списком: каталог в этом боте живёт только в приложении.
  assert.ok(!/Kia K5/.test(String(msg.body.text)), "список машин в чат не идёт");
});

test("заявка из MAX попадает в общий список и к менеджеру", async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const store = makeStore({});
  const env = { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", MAX_BOT_TOKEN: "M", STORE: store };

  // Нажал «Подобрать авто» — бот ждёт телефон.
  await worker.fetch(
    maxUpdate({
      update_type: "message_callback",
      callback: { callback_id: "cb2", user: { user_id: 77 }, payload: "lead" },
    }),
    env,
    undefined,
  );
  // Прислал телефон.
  await worker.fetch(
    maxUpdate({
      update_type: "message_created",
      message: { sender: { user_id: 77 }, body: { text: "+7 900 111-22-33, кроссовер до 3 млн" } },
    }),
    env,
    undefined,
  );

  const leads = (await store.get("leads")) || [];
  assert.equal(leads.length, 1, "заявка должна лечь в общий список");
  assert.equal(leads[0].phone, "+7 900 111-22-33");
  assert.match(leads[0].source, /MAX/, "источник должен быть виден в статистике");

  const toManager = sent.find((s) => s.url.includes("api.telegram.org") && s.body?.text);
  assert.match(String(toManager?.body?.text), /Новая заявка/, "менеджеру должно уйти уведомление");
});

test("номер без цифр не превращается в заявку", async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: {} }), { headers: { "Content-Type": "application/json" } });
  const store = makeStore({});
  const env = { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", MAX_BOT_TOKEN: "M", STORE: store };

  await worker.fetch(
    maxUpdate({
      update_type: "message_callback",
      callback: { callback_id: "cb3", user: { user_id: 78 }, payload: "lead" },
    }),
    env,
    undefined,
  );
  await worker.fetch(
    maxUpdate({
      update_type: "message_created",
      message: { sender: { user_id: 78 }, body: { text: "перезвоните мне" } },
    }),
    env,
    undefined,
  );

  assert.equal(await store.get("leads"), null, "заявки без телефона быть не должно");
});

test("/max без токена объясняет, где его завести", async () => {
  const store = makeStore({});
  const calls = stubTelegram();
  const c = makeCtx();

  await run(
    {
      update_id: 110,
      message: {
        message_id: 910,
        text: "/max",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777" }, ctx: c.ctx },
  );
  await c.settle();

  const reply = calls.filter((x) => x.method === "sendMessage").pop();
  assert.match(String(reply?.body?.text), /MAX_BOT_TOKEN/, "владельцу нужно имя секрета");
});

test("/max с токеном подписывает вебхук и отчитывается", async () => {
  const store = makeStore({});
  const seen = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    seen.push(u);
    if (u.includes("botapi.max.ru/me")) {
      return new Response(JSON.stringify({ name: "ДиАвто69" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const c = makeCtx();

  await run(
    {
      update_id: 111,
      message: {
        message_id: 911,
        text: "/max",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777", MAX_BOT_TOKEN: "MAXSECRET123" }, ctx: c.ctx },
  );
  await c.settle();

  assert.ok(
    seen.some((u) => u.includes("botapi.max.ru/subscriptions")),
    "подписка на события MAX должна уйти",
  );
  // Токен уходит только в MAX — в телеграмных адресах его быть не должно.
  assert.ok(
    !seen.some((u) => u.includes("api.telegram.org") && u.includes("MAXSECRET123")),
    "токен MAX не должен попадать в телеграмные адреса",
  );
});

/*
 * MAX перестал принимать токен параметром адреса: «access_token is
 * deprecated, use Authorization header». Ошибка вышла тихой — вебхук просто
 * не подписывался, а бот молчал.
 */
test("токен MAX уходит заголовком, а не в адресе", async () => {
  const store = makeStore({});
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url: String(url), auth: init?.headers?.Authorization ?? null });
    if (String(url).includes("botapi.max.ru")) {
      return new Response(JSON.stringify({ name: "ДиАвто69" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const c = makeCtx();

  await run(
    {
      update_id: 113,
      message: {
        message_id: 913,
        text: "/max",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777", MAX_BOT_TOKEN: "MAXSECRET123" }, ctx: c.ctx },
  );
  await c.settle();

  const toMax = seen.filter((x) => x.url.includes("botapi.max.ru"));
  assert.ok(toMax.length, "запросы к MAX должны уйти");
  for (const x of toMax) {
    assert.ok(!x.url.includes("MAXSECRET123"), "секрет в адресе: " + x.url);
    assert.equal(x.auth, "Bearer MAXSECRET123", "токен должен идти заголовком");
  }
});

/*
 * Если MAX снова передумает насчёт формы заголовка, подключение не должно
 * ломаться молча: на отказ с кодом про токен пробуем голый токен.
 */
test("на отказ по токену пробуем вторую форму заголовка", async () => {
  const store = makeStore({});
  const auths = [];
  globalThis.fetch = async (url, init) => {
    if (String(url).includes("botapi.max.ru")) {
      const auth = init?.headers?.Authorization ?? null;
      auths.push(auth);
      if (auth?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ code: "verify.token", message: "nope" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ name: "ДиАвто69" }), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const c = makeCtx();

  await run(
    {
      update_id: 114,
      message: {
        message_id: 914,
        text: "/max",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777", MAX_BOT_TOKEN: "MAXSECRET123" }, ctx: c.ctx },
  );
  await c.settle();

  assert.ok(auths.includes("MAXSECRET123"), "вторая попытка должна пойти без приставки");
});

test("посторонний командой /max ничего не подключает", async () => {
  const store = makeStore({});
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(String(url));
    return new Response(JSON.stringify({ ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const c = makeCtx();

  await run(
    {
      update_id: 112,
      message: {
        message_id: 912,
        text: "/max",
        chat: { id: 555, type: "private" },
        from: { id: 555, first_name: "Чужой" },
      },
    },
    { store, env: { ADMIN_IDS: "777", MAX_BOT_TOKEN: "M" }, ctx: c.ctx },
  );
  await c.settle();

  assert.ok(!seen.some((u) => u.includes("botapi.max.ru")), "чужому MAX не отвечаем");
});

/*
 * «Привет» — это не заявка.
 *
 * Первая версия заводила заявку из любого текста, и в чат менеджеров приехало
 * «Клиент из MAX, телефон —, авто: привет». Заявка без телефона бесполезна, а
 * список заявок — это то, по чему считают отдачу рекламы.
 */
test("приветствие в MAX открывает меню, а не заводит заявку", async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ ok: true, result: {}, message: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const store = makeStore({ catalog: [] });

  for (const text of ["привет", "Здравствуйте!", "добрый день", "ок", "спасибо"]) {
    await worker.fetch(
      maxUpdate({
        update_type: "message_created",
        message: { sender: { user_id: 91 }, body: { text } },
      }),
      { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", MAX_BOT_TOKEN: "M", STORE: store },
      undefined,
    );
  }

  assert.equal(await store.get("leads"), null, "из приветствий заявок быть не должно");
  const toMax = sent.filter((x) => x.url.includes("botapi.max.ru/messages"));
  assert.equal(toMax.length, 5, "на каждое приветствие — меню");
  assert.match(String(toMax[0].body.text), /С чего начнём/);
});

test("настоящий вопрос уходит менеджеру, но не в список заявок", async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ ok: true, result: {}, message: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const store = makeStore({ catalog: [] });

  await worker.fetch(
    maxUpdate({
      update_type: "message_created",
      message: {
        sender: { user_id: 92 },
        body: { text: "Есть ли Kia Sorento 2023 года до 4 миллионов?" },
      },
    }),
    { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", MAX_BOT_TOKEN: "M", STORE: store },
    undefined,
  );

  assert.equal(await store.get("leads"), null, "вопрос — не заявка");
  const toManager = sent.find(
    (x) => x.url.includes("api.telegram.org") && /Вопрос из MAX/.test(String(x.body?.text)),
  );
  assert.ok(toManager, "менеджеру должно уйти уведомление о вопросе");
  assert.equal(
    String(toManager.body.chat_id),
    "-100999",
    "и только в чат заявок — клиентам такое не рассылается",
  );
});

/*
 * Подсказки команд. Без них человек, свернувший меню, остаётся один на один
 * с пустым полем ввода: кнопки уехали вверх по переписке, а «/start» никто
 * не помнит наизусть.
 */
test("подключение MAX выставляет команды в подсказках", async () => {
  const store = makeStore({});
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(init.body) : null,
    });
    return new Response(JSON.stringify({ name: "ДиАвто69", ok: true, result: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const c = makeCtx();

  await run(
    {
      update_id: 120,
      message: {
        message_id: 920,
        text: "/max",
        chat: { id: 777, type: "private" },
        from: { id: 777, first_name: "Хозяин" },
      },
    },
    { store, env: { ADMIN_IDS: "777", MAX_BOT_TOKEN: "M" }, ctx: c.ctx },
  );
  await c.settle();

  const patch = calls.find((x) => x.url.endsWith("botapi.max.ru/me") && x.method === "PATCH");
  assert.ok(patch, "команды должны выставляться отдельным запросом");
  assert.deepEqual(
    patch.body.commands.map((x) => x.name),
    ["start", "catalog", "lead", "reviews"],
  );
  // Имя и картинку бота человек задал в MAX руками — их не трогаем.
  assert.deepEqual(Object.keys(patch.body), ["commands"]);
});

test("команды из подсказок открывают нужные экраны", async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ ok: true, result: {}, message: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const store = makeStore({
    catalog: [{ id: "c1", model: "Kia K5", year: 2023, priceMoscowRub: 2100000 }],
  });
  const env = { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", MAX_BOT_TOKEN: "M", STORE: store };

  for (const text of ["/start", "/catalog", "/lead"]) {
    await worker.fetch(
      maxUpdate({
        update_type: "message_created",
        message: { sender: { user_id: 93 }, body: { text } },
      }),
      env,
      undefined,
    );
  }

  const texts = sent
    .filter((x) => x.url.includes("botapi.max.ru/messages"))
    .map((x) => String(x.body.text));
  assert.match(texts[0], /С чего начнём/, "/start — меню");
  assert.match(texts[1], /синюю кнопку слева от поля ввода/, "/catalog — где открыть приложение");
  assert.match(texts[2], /номер телефона/, "/lead — приём заявки");
  // И ни одна команда не улетела менеджеру как вопрос.
  assert.ok(
    !sent.some((x) => /Вопрос из MAX/.test(String(x.body?.text || ""))),
    "команды — не вопросы клиента",
  );
});

/*
 * Кнопки, открывающей мини-приложение, в меню быть не должно.
 *
 * Перепробованы три способа: вложение «open_app» в двух написаниях (MAX
 * отверг оба), ссылка на сайт (открывает браузер поверх мессенджера) и
 * внутренняя ссылка max.ru/<бот>/app («ссылка устарела»). Кнопка, уводящая
 * человека из чата в браузер, хуже, чем её отсутствие.
 */
test("меню MAX не уводит человека в браузер", async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ message: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const store = makeStore({});

  await worker.fetch(
    maxUpdate({ update_type: "bot_started", user: { user_id: 97 } }),
    { TELEGRAM_BOT_TOKEN: "T", TELEGRAM_CHAT_ID: "-100999", MAX_BOT_TOKEN: "M", STORE: store },
    undefined,
  );

  const msg = sent.find((x) => x.url.includes("botapi.max.ru/messages"));
  const buttons = msg.body.attachments
    .find((a) => a.type === "inline_keyboard")
    .payload.buttons.flat();

  assert.ok(
    !buttons.some((b) => /автоимпорт|xn--|max\.ru/.test(String(b.url || ""))),
    "ссылок, открывающих браузер поверх чата, в меню быть не должно",
  );
  const catalog = buttons.find((b) => /Каталог/.test(b.text));
  assert.equal(catalog.type, "callback", "кнопка ведёт к инструкции, а не в браузер");
  // И приветствие сразу говорит, что каталог живёт в приложении.
  assert.match(String(msg.body.text), /Каталог открывается в приложении/);

  // Приветствие — ровно одно сообщение: перебирать написания кнопки больше
  // незачем, а три запроса вместо одного человек ждал бы вместо приветствия.
  assert.equal(sent.filter((x) => x.url.includes("/messages")).length, 1);
});


/*
 * «Отзывы» в MAX ведут в справочники, а не показывают наши же видео: в
 * Яндекс.Картах и 2ГИС отзыв нельзя ни стереть, ни дорисовать — именно это
 * человек и проверяет у незнакомой компании.
 */
test("кнопка «Отзывы» в MAX присылает ссылки на Яндекс и 2ГИС", async () => {
  const sent = [];
  globalThis.fetch = async (url, init) => {
    sent.push({ url: String(url), body: init?.body ? JSON.parse(init.body) : null });
    return new Response(JSON.stringify({ message: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const store = makeStore({ reviews: [{ id: "r1", text: "Спасибо!", videos: ["/v.mp4"] }] });

  await worker.fetch(
    maxUpdate({
      update_type: "message_callback",
      callback: { callback_id: "cb", user: { user_id: 99 }, payload: "rev" },
    }),
    { TELEGRAM_BOT_TOKEN: "T", MAX_BOT_TOKEN: "M", STORE: store },
    undefined,
  );

  const msg = sent.find((x) => x.url.includes("botapi.max.ru/messages"));
  const urls = msg.body.attachments
    .find((a) => a.type === "inline_keyboard")
    .payload.buttons.flat()
    .map((b) => String(b.url || ""));

  assert.ok(urls.some((u) => u.includes("yandex.ru/maps")), "нужна ссылка на Яндекс.Карты");
  assert.ok(urls.some((u) => u.includes("2gis.ru")), "нужна ссылка на 2ГИС");
  // Своих отзывов в чат не шлём, даже когда они есть в хранилище.
  assert.equal(sent.filter((x) => x.url.includes("/messages")).length, 1);
});
