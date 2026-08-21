import assert from "node:assert/strict";
import test from "node:test";

import { telegramAppLink } from "./telegram";

/**
 * Приглашение в закрытый канал и публичный канал открываются разными методами
 * Telegram. Ошибка здесь не падает и не логируется — приложение просто молча
 * не открывается, и заметить это можно только вручную на телефоне.
 */

test("приглашение в закрытый канал открывается методом join", () => {
  assert.equal(
    telegramAppLink("https://t.me/+QTRyuliyCAM2M2Ri"),
    "tg://join?invite=QTRyuliyCAM2M2Ri",
  );
});

test("старый формат приглашения тоже понимается", () => {
  assert.equal(
    telegramAppLink("https://t.me/joinchat/AAAAAE1bC2d3e4"),
    "tg://join?invite=AAAAAE1bC2d3e4",
  );
});

test("публичный канал открывается по имени", () => {
  assert.equal(
    telegramAppLink("https://t.me/Dmitriicarexport"),
    "tg://resolve?domain=Dmitriicarexport",
  );
});

test("хвост у ссылки не мешает", () => {
  assert.equal(
    telegramAppLink("https://t.me/+QTRyuliyCAM2M2Ri?start=direct"),
    "tg://join?invite=QTRyuliyCAM2M2Ri",
  );
});

test("дефис в хэше приглашения не обрезается", () => {
  assert.equal(
    telegramAppLink("https://t.me/+ab-CD_ef12"),
    "tg://join?invite=ab-CD_ef12",
  );
});

test("служебные разделы t.me за канал не принимаются", () => {
  assert.equal(telegramAppLink("https://t.me/share/url?url=x"), null);
  assert.equal(telegramAppLink("https://t.me/addstickers/set"), null);
});

test("не телеграмовская ссылка отбрасывается", () => {
  assert.equal(telegramAppLink("https://example.com/channel"), null);
  assert.equal(telegramAppLink(""), null);
});
