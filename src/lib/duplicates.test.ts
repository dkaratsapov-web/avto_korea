import test from "node:test";
import assert from "node:assert/strict";
import { carFingerprint, findDuplicates, suggestedRemovals } from "./duplicates";
import type { Car } from "@/data/cars";

const DAY = 86400000;

function car(over: Partial<Car> & { id: string }): Car {
  return {
    model: "BMW 320L",
    year: 2023,
    country: "cn",
    engine: "2.0 л · 156 л.с.",
    trim: "M-SPORT",
    mileage: "23 000 км",
    mileageKm: 23000,
    gearbox: "АКПП",
    drive: "Задний",
    bodyType: "Седан",
    fuelType: "Бензин",
    steering: "",
    engineCc: 2000,
    powerHp: 156,
    color: "",
    priceRub: 3790000,
    priceTverRub: 3790000,
    priceMoscowRub: 3790000,
    status: "in_stock",
    isNew: false,
    images: [],
    highlights: [],
    description: "",
    addedAt: Date.now(),
    ...over,
  } as Car;
}

test("одна и та же машина из двух каналов опознаётся как повтор", () => {
  const cars = [
    car({ id: "tg-2875062656-17", addedAt: Date.now() }),
    car({ id: "tg-1234", addedAt: Date.now() - 5 * DAY }),
  ];
  const groups = findDuplicates(cars);
  assert.equal(groups.length, 1, "должна найтись одна группа");
  assert.equal(groups[0].cars.length, 2);
  assert.equal(groups[0].certainty, "sure", "пробег совпал — это уверенный повтор");
  assert.equal(groups[0].cars[0].id, "tg-2875062656-17", "свежая карточка идёт первой");
});

test("разные машины в одну группу не попадают", () => {
  const cars = [
    car({ id: "a" }),
    car({ id: "b", model: "Audi Q3", priceRub: 2490000, priceTverRub: 2490000 }),
    car({ id: "c", mileageKm: 25300, mileage: "25 300 км" }),
    car({ id: "d", year: 2022 }),
    car({ id: "e", trim: "BASE" }),
  ];
  assert.equal(findDuplicates(cars).length, 0);
});

test("две новые машины с нулевым пробегом — только «возможно», удалять не предлагаем", () => {
  /*
   * У новых машин пробег нулевой у всех, а цена одинаковая — это норма.
   * Отличить второй экземпляр на складе от повтора публикации нечем,
   * поэтому решение оставляем человеку.
   */
  const cars = [
    car({ id: "n1", mileageKm: 0, mileage: "Новый, 0 км", isNew: true, addedAt: Date.now() }),
    car({ id: "n2", mileageKm: 0, mileage: "Новый, 0 км", isNew: true, addedAt: Date.now() - DAY }),
  ];
  const groups = findDuplicates(cars);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].certainty, "maybe");
  assert.deepEqual(suggestedRemovals(groups), [], "по умолчанию не удаляем ничего");
});

test("из уверенной группы предлагаем убрать всё, кроме самой свежей", () => {
  const cars = [
    car({ id: "старая", addedAt: Date.now() - 10 * DAY }),
    car({ id: "свежая", addedAt: Date.now() }),
    car({ id: "средняя", addedAt: Date.now() - 3 * DAY }),
  ];
  const removals = suggestedRemovals(findDuplicates(cars));
  assert.deepEqual(
    removals.map((c) => c.id).sort(),
    ["средняя", "старая"],
    "остаётся только самая свежая — она из действующего канала",
  );
});

test("разное написание модели не мешает найти повтор", () => {
  const cars = [
    car({ id: "1", model: "CHANGAN UNI-ZX" }),
    car({ id: "2", model: "Changan Uni ZX", addedAt: Date.now() - DAY }),
  ];
  assert.equal(findDuplicates(cars).length, 1, "дефис и регистр не должны разводить карточки");
});

test("отпечаток не зависит от фотографий, описания и даты", () => {
  const a = car({ id: "1", images: ["/a.jpg"], description: "Текст", addedAt: 1 });
  const b = car({ id: "2", images: [], description: "Другой текст", addedAt: 999 });
  assert.equal(carFingerprint(a), carFingerprint(b));
});

test("уверенные группы идут раньше спорных", () => {
  const cars = [
    car({ id: "new1", model: "Changan Uni-ZX", mileageKm: 0, isNew: true }),
    car({ id: "new2", model: "Changan Uni-ZX", mileageKm: 0, isNew: true }),
    car({ id: "used1" }),
    car({ id: "used2" }),
  ];
  const groups = findDuplicates(cars);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].certainty, "sure", "уверенная группа должна быть первой");
});

test("пустой каталог и каталог без повторов не ломают поиск", () => {
  assert.deepEqual(findDuplicates([]), []);
  assert.deepEqual(findDuplicates([car({ id: "one" })]), []);
});
