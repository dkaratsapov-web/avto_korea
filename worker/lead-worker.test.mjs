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
