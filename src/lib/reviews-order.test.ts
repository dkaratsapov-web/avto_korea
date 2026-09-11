import assert from "node:assert/strict";
import test from "node:test";

import { orderReviews } from "./reviews-order";

/**
 * Порядок ленты отзывов нельзя проверить глазами: на витрине это два десятка
 * почти одинаковых карточек с машинами, и перестановка замечается не сразу, а
 * через неделю — когда свежая выдача оказывается в самом низу страницы.
 */

const CUT = Date.UTC(2026, 8, 9, 21);
const day = 86400000;

/** Хранилище бота: новая запись всегда в начале массива. */
const store = [
  { id: "новый-2", ts: CUT + 2 * day },
  { id: "новый-1", ts: CUT + day },
  { id: "архив-последний", ts: CUT - day },
  { id: "архив-средний", ts: CUT - 2 * day },
  { id: "архив-первый", ts: CUT - 3 * day },
];

test("свежие отзывы идут первыми, самый новый — в начале", () => {
  const order = orderReviews(store, CUT).map((r) => r.id);
  assert.deepEqual(order.slice(0, 2), ["новый-2", "новый-1"]);
});

test("архив разворачивается: от первой выдачи к последней", () => {
  const order = orderReviews(store, CUT).map((r) => r.id);
  assert.deepEqual(order.slice(2), [
    "архив-первый",
    "архив-средний",
    "архив-последний",
  ]);
});

test("следующий отзыв из бота встаёт в начало, не трогая архив", () => {
  const next = [{ id: "новый-3", ts: CUT + 5 * day }, ...store];
  const order = orderReviews(next, CUT).map((r) => r.id);
  assert.equal(order[0], "новый-3");
  assert.deepEqual(order.slice(3), [
    "архив-первый",
    "архив-средний",
    "архив-последний",
  ]);
});

test("записи без метки времени — самые старые, идут в конец ленты", () => {
  // Без метки сохранял ещё прежний бот; в хранилище они лежат ниже всех.
  const withOld: { id: string; ts?: number }[] = [
    ...store,
    { id: "без-метки-новее" },
    { id: "без-метки-старее" },
  ];
  const order = orderReviews(withOld, CUT).map((r) => r.id);
  assert.deepEqual(order.slice(2, 4), ["без-метки-старее", "без-метки-новее"]);
  assert.equal(order.at(-1), "архив-последний");
});

test("исходный массив не меняется", () => {
  const copy = store.map((r) => r.id);
  orderReviews(store, CUT);
  assert.deepEqual(
    store.map((r) => r.id),
    copy,
  );
});
