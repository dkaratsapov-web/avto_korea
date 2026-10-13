import { test } from "node:test";
import assert from "node:assert/strict";

import { splitTrimCountry } from "./carText";

/*
 * Эти два бага уже доехали до витрины: «HIGH LINE СТРАНА ОАЭ» в подписи
 * комплектации и флаг Японии на машинах из ОАЭ. Проверка держит оборону.
 */

test("хвост «страна …» отрезается от комплектации", () => {
  assert.deepEqual(splitTrimCountry("HIGH LINE СТРАНА ОАЭ"), { trim: "HIGH LINE", country: "ae" });
  assert.deepEqual(splitTrimCountry("DELUXE EDITION СТРАНА КИТАЙ"), { trim: "DELUXE EDITION", country: "cn" });
  assert.deepEqual(splitTrimCountry("PREMIUM СТРАНА КОРЕЯ"), { trim: "PREMIUM", country: "kr" });
  assert.deepEqual(splitTrimCountry("SPORT СТРАНА ЯПОНИЯ"), { trim: "SPORT", country: "jp" });
  assert.deepEqual(splitTrimCountry("COMFORT страна: оаэ"), { trim: "COMFORT", country: "ae" });
});

test("чистая комплектация остаётся как есть", () => {
  assert.deepEqual(splitTrimCountry("Luxury Smart"), { trim: "Luxury Smart", country: null });
  assert.deepEqual(splitTrimCountry(""), { trim: "", country: null });
  assert.deepEqual(splitTrimCountry(undefined), { trim: "", country: null });
});

test("кириллица в названии страны ловится (а не отваливается на \\w)", () => {
  // Регресс: /кита\w*/ не матчит «китай», потому что \w в JS — только латиница.
  assert.equal(splitTrimCountry("X СТРАНА КИТАЙ").country, "cn");
  assert.equal(splitTrimCountry("X СТРАНА КОРЕЯ").country, "kr");
});
