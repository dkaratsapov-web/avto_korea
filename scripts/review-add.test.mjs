import { test } from "node:test";
import assert from "node:assert/strict";

import { buildReview, mergeReview, removeReviews } from "./review-add.mjs";

/*
 * Проверяем ровно то, что нельзя увидеть глазами до публикации: запись
 * уходит в живое хранилище сайта, и ошибка в ней сразу висит на витрине.
 */

test("отзыв собирается в том же виде, что кладёт бот", () => {
  const r = buildReview({
    id: "site-gac-2026-09-24",
    text: "Выдача GAC S7\n\nЗабрали новый GAC S7.",
    images: ["/reviews/gac/1.webp", "/reviews/gac/2.webp"],
    ts: 1758700000000,
  });

  assert.equal(r.name, "Клиент ДиАвто69", "имени нет — подставляется то же, что у бота");
  assert.equal(r.rating, 5);
  assert.equal(r.media, "/reviews/gac/1.webp", "media — первое фото, его читают старые карточки");
  assert.deepEqual(r.images, ["/reviews/gac/1.webp", "/reviews/gac/2.webp"]);
  assert.deepEqual(r.videos, []);
  assert.equal(r.video, "");
  assert.equal(r.ts, 1758700000000);
});

test("отзыв без текста и без фотографий не собирается", () => {
  assert.throws(() => buildReview({ id: "x" }), /без текста/);
  assert.throws(() => buildReview({ text: "есть" }), /id/);
});

test("новый отзыв встаёт в начало ленты", () => {
  const list = [{ id: "a" }, { id: "b" }];
  const out = mergeReview(list, { id: "c", text: "новый" });
  assert.deepEqual(out.map((r) => r.id), ["c", "a", "b"]);
});

test("повторная публикация обновляет запись, а не задваивает", () => {
  const list = [{ id: "a" }, { id: "b", text: "старый", images: ["1.webp"] }];
  const out = mergeReview(list, { id: "b", text: "новый" });
  assert.equal(out.length, 2, "карточек столько же");
  assert.deepEqual(out.map((r) => r.id), ["a", "b"], "порядок не меняется");
  assert.equal(out[1].text, "новый");
  assert.deepEqual(out[1].images, ["1.webp"], "поля, которых нет в правке, остаются");
});

test("список не растёт бесконечно", () => {
  const list = Array.from({ length: 100 }, (_, i) => ({ id: `old-${i}` }));
  const out = mergeReview(list, { id: "new" });
  assert.equal(out.length, 100);
  assert.equal(out[0].id, "new");
  assert.equal(out.at(-1).id, "old-98", "вытесняется самый старый");
});

test("пустое хранилище — не повод падать", () => {
  assert.deepEqual(mergeReview(null, { id: "a" }).map((r) => r.id), ["a"]);
  assert.deepEqual(mergeReview(undefined, { id: "a" }).map((r) => r.id), ["a"]);
});

test("удаление убирает только названные карточки", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(removeReviews(list, ["b"]).map((r) => r.id), ["a", "c"]);
  // Идентификаторы приходят строкой из поля ввода — с пробелами и запятыми.
  assert.deepEqual(removeReviews(list, [" c ", "a"]).map((r) => r.id), ["b"]);
  assert.deepEqual(removeReviews(list, ["нет-такого"]).map((r) => r.id), ["a", "b", "c"]);
  assert.deepEqual(removeReviews(null, ["a"]), []);
});
