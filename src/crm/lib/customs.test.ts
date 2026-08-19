import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ageGroupFromYear,
  calcClearanceFeeRub,
  calcCustoms,
  calcDutyEur,
  calcUtilFeeRub,
} from './customs';

test('до 3 лет: берётся процент, когда он больше минимума по объёму', () => {
  // 20 000 € попадает в диапазон до 42 300 €: 48% = 9600 €, минимум 5.5 €/см³ × 1600 = 8800 €
  const { dutyEur } = calcDutyEur({
    ageGroup: 'UNDER_3',
    engineType: 'PETROL',
    engineCc: 1600,
    priceEur: 20000,
  });
  assert.equal(dutyEur, 9600);
});

test('до 3 лет: берётся минимум по объёму, когда он больше процента', () => {
  // 20 000 € × 48% = 9600 €, минимум 5.5 €/см³ × 3000 = 16 500 €
  const { dutyEur } = calcDutyEur({
    ageGroup: 'UNDER_3',
    engineType: 'PETROL',
    engineCc: 3000,
    priceEur: 20000,
  });
  assert.equal(dutyEur, 16500);
});

test('до 3 лет: дешёвое авто считается по ставке 54%', () => {
  // 5000 € × 54% = 2700 €, минимум 2.5 × 1000 = 2500 €
  const { dutyEur } = calcDutyEur({
    ageGroup: 'UNDER_3',
    engineType: 'PETROL',
    engineCc: 1000,
    priceEur: 5000,
  });
  assert.equal(dutyEur, 2700);
});

test('от 3 до 5 лет: ставка зависит только от объёма', () => {
  const cases: [number, number][] = [
    [900, 900 * 1.5],
    [1400, 1400 * 1.7],
    [1600, 1600 * 2.5],
    [2000, 2000 * 2.7],
    [2500, 2500 * 3.0],
    [4000, 4000 * 3.6],
  ];

  for (const [cc, expected] of cases) {
    const { dutyEur } = calcDutyEur({
      ageGroup: 'FROM_3_TO_5',
      engineType: 'PETROL',
      engineCc: cc,
      priceEur: 15000,
    });
    assert.equal(dutyEur, expected, `объём ${cc} см³`);
  }
});

test('от 3 до 5 лет: цена авто на пошлину не влияет', () => {
  const cheap = calcDutyEur({ ageGroup: 'FROM_3_TO_5', engineType: 'PETROL', engineCc: 2000, priceEur: 5000 });
  const pricey = calcDutyEur({ ageGroup: 'FROM_3_TO_5', engineType: 'PETROL', engineCc: 2000, priceEur: 90000 });
  assert.equal(cheap.dutyEur, pricey.dutyEur);
});

test('старше 5 лет: ставки выше, чем для 3–5 лет', () => {
  const younger = calcDutyEur({ ageGroup: 'FROM_3_TO_5', engineType: 'PETROL', engineCc: 2000, priceEur: 10000 });
  const older = calcDutyEur({ ageGroup: 'OVER_5', engineType: 'PETROL', engineCc: 2000, priceEur: 10000 });
  assert.ok(older.dutyEur > younger.dutyEur);
  assert.equal(older.dutyEur, 2000 * 4.8);
});

test('границы диапазонов по объёму включают верхнее значение', () => {
  // 1500 см³ должно попасть в диапазон «до 1500», а не в следующий
  const at = calcDutyEur({ ageGroup: 'FROM_3_TO_5', engineType: 'PETROL', engineCc: 1500, priceEur: 10000 });
  const above = calcDutyEur({ ageGroup: 'FROM_3_TO_5', engineType: 'PETROL', engineCc: 1501, priceEur: 10000 });
  assert.equal(at.dutyEur, 1500 * 1.7);
  assert.equal(above.dutyEur, 1501 * 2.5);
});

test('электромобиль: 15% от стоимости независимо от возраста и объёма', () => {
  const young = calcDutyEur({ ageGroup: 'UNDER_3', engineType: 'ELECTRIC', engineCc: 0, priceEur: 30000 });
  const old = calcDutyEur({ ageGroup: 'OVER_5', engineType: 'ELECTRIC', engineCc: 0, priceEur: 30000 });
  assert.equal(young.dutyEur, 4500);
  assert.equal(old.dutyEur, 4500);
});

test('гибрид считается как обычный двигатель по объёму', () => {
  const hybrid = calcDutyEur({ ageGroup: 'FROM_3_TO_5', engineType: 'HYBRID', engineCc: 2000, priceEur: 10000 });
  const petrol = calcDutyEur({ ageGroup: 'FROM_3_TO_5', engineType: 'PETROL', engineCc: 2000, priceEur: 10000 });
  assert.equal(hybrid.dutyEur, petrol.dutyEur);
});

test('утильсбор: личное пользование дешевле коммерческого ввоза', () => {
  assert.equal(calcUtilFeeRub('UNDER_3'), 3400);
  assert.equal(calcUtilFeeRub('OVER_5'), 5200);
  assert.ok(calcUtilFeeRub('UNDER_3', true) > calcUtilFeeRub('UNDER_3'));
});

test('сбор за оформление растёт ступенями по стоимости', () => {
  assert.equal(calcClearanceFeeRub(150000), 1067);
  assert.equal(calcClearanceFeeRub(200000), 1067);
  assert.equal(calcClearanceFeeRub(200001), 2134);
  assert.equal(calcClearanceFeeRub(3000000), 16524);
});

test('полный расчёт складывает пошлину, утильсбор и сбор за оформление', () => {
  const result = calcCustoms({
    ageGroup: 'FROM_3_TO_5',
    engineType: 'PETROL',
    engineCc: 2000,
    priceEur: 20000,
    eurRate: 100,
  });

  // пошлина 2000 × 2.7 = 5400 € × 100 = 540 000 ₽
  assert.equal(result.dutyEur, 5400);
  assert.equal(result.dutyRub, 540000);
  assert.equal(result.utilFeeRub, 5200);
  // таможенная стоимость 2 000 000 ₽ → диапазон до 2 700 000
  assert.equal(result.clearanceFeeRub, 11746);
  assert.equal(result.totalRub, 540000 + 5200 + 11746);
});

test('возрастная группа определяется по году выпуска', () => {
  const now = new Date('2026-06-15T00:00:00Z');
  assert.equal(ageGroupFromYear(2025, now), 'UNDER_3');
  assert.equal(ageGroupFromYear(2024, now), 'UNDER_3');
  assert.equal(ageGroupFromYear(2023, now), 'FROM_3_TO_5');
  assert.equal(ageGroupFromYear(2021, now), 'FROM_3_TO_5');
  assert.equal(ageGroupFromYear(2020, now), 'OVER_5');
});
