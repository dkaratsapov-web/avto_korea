import test from "node:test";
import assert from "node:assert/strict";
import { isPremium, PREMIUM_MIN_PRICE } from "@/lib/premium";
import type { Car } from "@/data/cars";

function car(model: string, priceTverRub: number): Car {
  return {
    id: model + priceTverRub,
    model,
    year: 2023,
    country: "kr",
    engine: "2.0 л · 200 л.с.",
    trim: "",
    mileage: "10 000 км",
    mileageKm: 10000,
    gearbox: "АКПП",
    drive: "Полный",
    bodyType: "Кроссовер",
    fuelType: "Бензин",
    steering: "",
    engineCc: 2000,
    powerHp: 200,
    color: "",
    priceRub: priceTverRub,
    priceTverRub,
    priceMoscowRub: priceTverRub,
    status: "in_stock",
    isNew: false,
    images: [],
    highlights: [],
    description: "",
  } as Car;
}

test("порог — 4,5 млн", () => {
  assert.equal(PREMIUM_MIN_PRICE, 4_500_000);
});

test("все семь марок попадают в премиум при цене от порога", () => {
  const models = [
    "Mercedes-Benz E300",
    "BMW X5",
    "Audi Q7",
    "Hyundai Palisade",
    "Zeekr 001",
    "Lexus RX350",
    "VW Touareg",
  ];
  for (const m of models) {
    assert.equal(isPremium(car(m, PREMIUM_MIN_PRICE)), true, m + " должен быть премиумом");
  }
});

test("ровно на пороге — премиум, на рубль ниже — нет", () => {
  assert.equal(isPremium(car("BMW X5", PREMIUM_MIN_PRICE)), true);
  assert.equal(isPremium(car("BMW X5", PREMIUM_MIN_PRICE - 1)), false);
});

test("написание из канала не мешает: слитно, в разном регистре, с опечаткой", () => {
  /*
   * Модели приходят из постов, набранных руками. Прежнее правило сверяло
   * начало строки и на таких написаниях ошибалось.
   */
  const same = [
    "AudiQ7", // слитно, без пробела
    "MERCEDES-BENZ E300", // капсом
    "Mercedes E300", // без «Benz»
    "Hyunday Palisade", // частая опечатка
    "VOLKSWAGEN TOUAREG", // полное имя вместо «VW»
  ];
  for (const m of same) {
    assert.equal(isPremium(car(m, 5_000_000)), true, m + " должен опознаться");
  }
});

test("марки вне подборки не попадают, какой бы ни была цена", () => {
  const others = ["Toyota Land Cruiser 300", "Kia Carnival", "Geely Monjaro", "Li Auto L9"];
  for (const m of others) {
    assert.equal(isPremium(car(m, 12_000_000)), false, m + " не входит в подборку");
  }
});

test("дешёвая машина премиум-марки в подборку не идёт", () => {
  assert.equal(isPremium(car("Hyundai Solaris", 1_600_000)), false);
  assert.equal(isPremium(car("VW Lavida", 1_990_000)), false);
});

test("цена берётся тверская, а не базовая", () => {
  const c = car("Lexus RX350", 4_600_000);
  c.priceRub = 1_000_000; // базовая ниже порога
  assert.equal(isPremium(c), true, "решает цена под ключ до Твери");
});
