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
