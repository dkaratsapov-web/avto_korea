import assert from "node:assert/strict";
import test from "node:test";

import { brandOf } from "./brand";

/**
 * Проверка на реальных написаниях из фильтра каталога — там одна и та же марка
 * стояла тремя-четырьмя отдельными пунктами. Ошибка тут не падает и не видна
 * в коде: она проявляется только тем, что покупатель, выбрав «Audi», не находит
 * половину машин этой марки.
 */

test("регистр не создаёт вторую марку", () => {
  assert.equal(brandOf("KIA K5"), "Kia");
  assert.equal(brandOf("Kia K5"), "Kia");
  assert.equal(brandOf("VOLVO XC60"), "Volvo");
  assert.equal(brandOf("JETTA VS7"), "Jetta");
  assert.equal(brandOf("Jetta VS7"), "Jetta");
});

test("марка, слипшаяся с моделью, распознаётся", () => {
  assert.equal(brandOf("AudiQ5"), "Audi");
  assert.equal(brandOf("AudiQ7 2024"), "Audi");
  assert.equal(brandOf("Mazda-Cx5"), "Mazda");
  assert.equal(brandOf("VWT-Roc"), "VW");
});

test("три написания Mercedes сводятся к одному", () => {
  assert.equal(brandOf("Mercedes GLC 300"), "Mercedes-Benz");
  assert.equal(brandOf("Mercedes-Benz E200"), "Mercedes-Benz");
  assert.equal(brandOf("Mercedes-benz C180"), "Mercedes-Benz");
  assert.equal(brandOf("MERCEDES BENZ GLE"), "Mercedes-Benz");
});

test("опечатки в марке исправляются", () => {
  assert.equal(brandOf("Hyunday Tucson"), "Hyundai");
  assert.equal(brandOf("Hyundai Tucson"), "Hyundai");
  assert.equal(brandOf("VJetta VS5"), "Jetta");
});

test("длинное имя не проигрывает короткому", () => {
  // «Linc» — сокращение Lincoln, и оба должны давать одну марку.
  assert.equal(brandOf("Linc Nautilus"), "Lincoln");
  assert.equal(brandOf("Lincoln Nautilus"), "Lincoln");
  // «Jetour» начинается на «Jet», но это не «Jetta».
  assert.equal(brandOf("Jetour X70"), "Jetour");
});

test("похожие марки не склеиваются между собой", () => {
  assert.equal(brandOf("Jetta VS5"), "Jetta");
  assert.equal(brandOf("Jetour Dashing"), "Jetour");
  assert.notEqual(brandOf("Jetour X90"), brandOf("Jetta VS7"));
});

test("незнакомая марка остаётся как есть", () => {
  assert.equal(brandOf("Wuling Bingo"), "Wuling");
  assert.equal(brandOf("Совершенно Новый"), "Совершенно");
});

test("пустое название не ломает разбор", () => {
  assert.equal(brandOf(""), "");
  assert.equal(brandOf("   "), "");
});

test("список марок схлопывается без повторов", () => {
  const из_каталога = [
    "Audi A3",
    "AudiQ5",
    "AudiQ7",
    "KIA K3",
    "Kia K5",
    "Mercedes GLC",
    "Mercedes-Benz E200",
    "Mercedes-benz C180",
    "JETTA VS7",
    "Jetta VS5",
    "VJetta VS7",
    "Hyundai Tucson",
    "Hyunday Tucson",
    "VW Lavida",
    "VWT-Roc",
  ];
  const марки = Array.from(new Set(из_каталога.map(brandOf))).sort();
  assert.deepEqual(марки, ["Audi", "Hyundai", "Jetta", "Kia", "Mercedes-Benz", "VW"]);
});

test("русские буквы-двойники в латинском названии не плодят марки", () => {
  // «НYUNDAI»: русская Н; «HYUNDАI»: русская А.
  assert.equal(brandOf("НYUNDAI Sonata"), "Hyundai");
  assert.equal(brandOf("HYUNDАI Elantra"), "Hyundai");
  assert.equal(brandOf("НYUNDАI Tucson"), "Hyundai");
});

test("незнакомая марка — в одном написании", () => {
  assert.equal(brandOf("FOOCAR X1"), brandOf("Foocar X2"));
  assert.equal(brandOf("byd Han"), "BYD");
});
