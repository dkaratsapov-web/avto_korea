import assert from 'node:assert/strict';
import { test } from 'node:test';
import { integerToWords, moneyToWords, plural } from './numToWords';

test('склонение по числу', () => {
  const forms: [string, string, string] = ['рубль', 'рубля', 'рублей'];
  assert.equal(plural(1, forms), 'рубль');
  assert.equal(plural(2, forms), 'рубля');
  assert.equal(plural(4, forms), 'рубля');
  assert.equal(plural(5, forms), 'рублей');
  assert.equal(plural(11, forms), 'рублей');
  assert.equal(plural(14, forms), 'рублей');
  assert.equal(plural(21, forms), 'рубль');
  assert.equal(plural(22, forms), 'рубля');
  assert.equal(plural(111, forms), 'рублей');
  assert.equal(plural(0, forms), 'рублей');
});

test('числа до сотни', () => {
  assert.equal(integerToWords(0), 'ноль');
  assert.equal(integerToWords(1), 'один');
  assert.equal(integerToWords(11), 'одиннадцать');
  assert.equal(integerToWords(19), 'девятнадцать');
  assert.equal(integerToWords(20), 'двадцать');
  assert.equal(integerToWords(42), 'сорок два');
  assert.equal(integerToWords(90), 'девяносто');
});

test('сотни и тысячи', () => {
  assert.equal(integerToWords(100), 'сто');
  assert.equal(integerToWords(945), 'девятьсот сорок пять');
  assert.equal(integerToWords(1000), 'одна тысяча');
  assert.equal(integerToWords(2000), 'две тысячи');
  assert.equal(integerToWords(5000), 'пять тысяч');
  assert.equal(integerToWords(21000), 'двадцать одна тысяча');
});

test('тысячи в женском роде, миллионы в мужском', () => {
  assert.equal(integerToWords(1001), 'одна тысяча один');
  assert.equal(integerToWords(2002), 'две тысячи два');
  assert.equal(integerToWords(1000000), 'один миллион');
  assert.equal(integerToWords(2000000), 'два миллиона');
});

test('пропуск нулевых разрядов', () => {
  assert.equal(integerToWords(1000001), 'один миллион один');
  assert.equal(integerToWords(1000000), 'один миллион');
  assert.equal(integerToWords(1000500), 'один миллион пятьсот');
});

test('сумма сделки прописью', () => {
  assert.equal(
    moneyToWords(2826946),
    'Два миллиона восемьсот двадцать шесть тысяч девятьсот сорок шесть рублей 00 копеек',
  );
});

test('копейки записываются двумя знаками', () => {
  assert.equal(moneyToWords(1.05), 'Один рубль 05 копеек');
  assert.equal(moneyToWords(2.5), 'Два рубля 50 копеек');
  assert.equal(moneyToWords(0), 'Ноль рублей 00 копеек');
});

test('копейки округляются, перенос в рубли не теряется', () => {
  assert.equal(moneyToWords(1.994), 'Один рубль 99 копеек');
  assert.equal(moneyToWords(1.999), 'Два рубля 00 копеек');
});

test('плавающая точка не ломает копейки', () => {
  assert.equal(moneyToWords(0.1 + 0.2), 'Ноль рублей 30 копеек');
});

test('отрицательная сумма', () => {
  assert.equal(moneyToWords(-50), 'Минус пятьдесят рублей 00 копеек');
});

test('первая буква заглавная', () => {
  assert.ok(/^[А-Я]/.test(moneyToWords(150000)));
});
