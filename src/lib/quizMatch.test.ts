import assert from "node:assert/strict";
import test from "node:test";

import { displayPrice } from "./price";
import { matchQuizCars, relaxedLabel, type QuizCar } from "./quizMatch";

/**
 * Финал квиза — самый дорогой экран воронки: человек прошёл пять шагов,
 * значит был готов. Пустой список здесь означает, что мы довели его до конца
 * и ничего не показали.
 */

type Car = QuizCar & { id: string };

const каталог: Car[] = [
  { id: "kia-новый-кроссовер-кр", priceRub: 2_200_000, bodyType: "Кроссовер", country: "kr", isNew: true },
  { id: "vw-пробег-седан-кн", priceRub: 2_300_000, bodyType: "Седан", country: "cn", isNew: false },
  { id: "audi-новый-седан-кн", priceRub: 2_400_000, bodyType: "Седан", country: "cn", isNew: true },
  { id: "дорогой-кроссовер-кн", priceRub: 5_400_000, bodyType: "Кроссовер", country: "cn", isNew: true },
  { id: "дешёвый-седан-кр", priceRub: 1_600_000, bodyType: "Седан", country: "kr", isNew: false },
];

const бюджет = { budgetMin: 2_000_000, budgetMax: 2_500_000 };

test("точное совпадение возвращается как точное", () => {
  const r = matchQuizCars(каталог, { ...бюджет, body: "Седан", country: "cn", condition: "new" });
  assert.equal(r.exact, true);
  assert.deepEqual(r.cars.map((c) => c.id), ["audi-новый-седан-кн"]);
  assert.deepEqual(r.relaxed, []);
});

test("вместо пустоты ослабляется состояние — самое гибкое условие", () => {
  // Кроссовера из Кореи с пробегом в бюджете нет, новый — есть.
  const r = matchQuizCars(каталог, { ...бюджет, body: "Кроссовер", country: "kr", condition: "used" });
  assert.equal(r.exact, false);
  assert.deepEqual(r.relaxed, ["состояния"]);
  assert.deepEqual(r.cars.map((c) => c.id), ["kia-новый-кроссовер-кр"]);
});

test("если состояния мало — снимается ещё и страна", () => {
  // Седана из Кореи в бюджете нет ни нового, ни с пробегом.
  const r = matchQuizCars(каталог, { ...бюджет, body: "Седан", country: "kr", condition: "new" });
  assert.equal(r.exact, false);
  assert.deepEqual(r.relaxed, ["состояния", "страны"]);
  assert.equal(r.cars.length, 2);
});

test("кузов снимается только после состояния и страны", () => {
  // Кабриолетов нет вообще — дойдём до снятия кузова.
  const r = matchQuizCars(каталог, { ...бюджет, body: "Кабриолет", country: "kr", condition: "new" });
  assert.equal(r.exact, false);
  assert.deepEqual(r.relaxed, ["состояния", "страны", "кузова"]);
  assert.equal(r.cars.length, 3);
});

test("бюджет расширяется последним и только на четверть", () => {
  // Ничего в 3,0–3,2 млн нет; ближайшее — 2,4 млн, попадает в -25%.
  const r = matchQuizCars(каталог, { budgetMin: 3_000_000, budgetMax: 3_200_000 });
  assert.equal(r.exact, false);
  assert.deepEqual(r.relaxed, ["бюджета"]);
  assert.ok(r.cars.length > 0);
  // Машина за 5,4 млн выходит за +25% от 3,2 млн — её быть не должно.
  assert.ok(!r.cars.some((c) => c.id === "дорогой-кроссовер-кн"));
});

test("близкие сортируются по близости к бюджету", () => {
  const r = matchQuizCars(каталог, { ...бюджет, body: "Седан", country: "kr", condition: "new" });
  const цены = r.cars.map(displayPrice);
  // Середина бюджета — 2,25 млн: 2,3 млн ближе, чем 2,4 млн.
  assert.deepEqual(цены, [2_300_000, 2_400_000]);
});

test("условие «не важно» в подпись не попадает", () => {
  // Страна не задана — снятие страны не должно упоминаться.
  const r = matchQuizCars(каталог, { ...бюджет, body: "Кабриолет", country: "any", condition: "any" });
  assert.equal(r.exact, false);
  assert.deepEqual(r.relaxed, ["кузова"]);
});

test("ступень «и больше» не отбрасывает нижнюю границу", () => {
  // Верхняя ступень квиза — «2,5 млн и больше», верхней границы у неё нет.
  // Пока требовались обе границы, такой ответ считался за «бюджет не указан»
  // и в подбор лезли машины за 1,8 млн — прямо обратное тому, что выбрали.
  const r = matchQuizCars(каталог, { budgetMin: 2_500_000, budgetMax: Infinity });
  assert.equal(r.exact, true);
  assert.deepEqual(r.cars.map((c) => c.id), ["дорогой-кроссовер-кн"]);
  assert.ok(r.cars.every((c) => displayPrice(c) >= 2_500_000));
});

test("у открытой ступени сортировка целится в нижнюю границу", () => {
  const много: Car[] = [
    { id: "почти", priceRub: 2_600_000, country: "cn" },
    { id: "далеко", priceRub: 9_000_000, country: "cn" },
  ];
  const r = matchQuizCars(много, { budgetMin: 2_500_000, budgetMax: Infinity, body: "Кабриолет" });
  assert.equal(r.exact, false);
  assert.equal(r.cars[0].id, "почти");
});

test("когда подходит вообще нечего — список пуст, а не выдуман", () => {
  const r = matchQuizCars([], { ...бюджет, body: "Седан" });
  assert.deepEqual(r.cars, []);
  assert.equal(r.exact, false);
});

test("подпись читается по-русски", () => {
  assert.equal(relaxedLabel([]), "");
  assert.equal(
    relaxedLabel(["состояния"]),
    "Точного совпадения нет — показываем близкое, без учёта состояния",
  );
  assert.equal(
    relaxedLabel(["состояния", "страны"]),
    "Точного совпадения нет — показываем близкое, без учёта состояния и страны",
  );
  assert.equal(
    relaxedLabel(["состояния", "страны", "кузова"]),
    "Точного совпадения нет — показываем близкое, без учёта состояния, страны и кузова",
  );
});
