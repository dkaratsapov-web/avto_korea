import { test } from "node:test";
import assert from "node:assert/strict";

import { removeFromCatalog } from "./catalog-audit.mjs";

/*
 * Удаление идёт прямо в живой каталог. Ошибка здесь — пропавшие не те авто в
 * бою, поэтому точечность проверяем отдельно.
 */

test("removeFromCatalog убирает только указанные id, порядок остальных сохраняется", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(removeFromCatalog(list, ["b"]).map((c) => c.id), ["a", "c"]);
});

test("несколько id, пробелы и пустые значения обрабатываются корректно", () => {
  const list = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.deepEqual(removeFromCatalog(list, [" a ", "", "c"]).map((c) => c.id), ["b"]);
});

test("id сравнивается как строка (на случай числовых id)", () => {
  const list = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(removeFromCatalog(list, ["1"]).map((c) => c.id), [2]);
});

test("мусор вместо списка не роняет функцию", () => {
  assert.deepEqual(removeFromCatalog(null, ["x"]), []);
  assert.deepEqual(removeFromCatalog(undefined, ["x"]), []);
});
