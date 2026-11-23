import assert from "node:assert/strict";
import { test } from "node:test";
import { calcTotals, money, moneyShort, parseMoney } from "./money";

const base = {
  carPrice: 0,
  exchangeRate: 0,
  deliveryCost: 0,
  customsDuty: 0,
  utilFee: 0,
  brokerCost: 0,
  otherCost: 0,
  commission: 0,
  paidAmount: 0,
};

test("цена авто переводится в рубли по курсу", () => {
  const totals = calcTotals({ ...base, carPrice: 25000, exchangeRate: 92.5 });
  assert.equal(totals.carPriceRub, 2312500);
});

test("курс 0 означает «курс не задан» — цена авто в сумму не входит", () => {
  // Иначе сделка обнулялась бы в момент, когда цена введена, а курс ещё нет.
  const totals = calcTotals({ ...base, carPrice: 25000, exchangeRate: 0, deliveryCost: 180000 });
  assert.equal(totals.carPriceRub, 0);
  assert.equal(totals.costRub, 180000);
});

test("себестоимость складывается из всех расходов", () => {
  const totals = calcTotals({
    ...base,
    carPrice: 25000,
    exchangeRate: 92.5,
    deliveryCost: 180000,
    customsDuty: 760000,
    utilFee: 5200,
    brokerCost: 45000,
    otherCost: 1000,
  });
  assert.equal(totals.costRub, 2312500 + 180000 + 760000 + 5200 + 45000 + 1000);
});

test("итог к оплате — себестоимость плюс комиссия, остаток — минус оплаченное", () => {
  const totals = calcTotals({
    ...base,
    carPrice: 25000,
    exchangeRate: 92.5,
    deliveryCost: 180000,
    customsDuty: 760000,
    utilFee: 5200,
    brokerCost: 45000,
    commission: 250000,
    paidAmount: 500000,
  });

  assert.equal(totals.totalRub, 3552700);
  assert.equal(totals.dueRub, 3052700);
  assert.equal(totals.profitRub, 250000);
});

test("переплата даёт отрицательный остаток, а не ноль", () => {
  // Ноль скрыл бы от менеджера, что клиенту нужно вернуть деньги.
  const totals = calcTotals({ ...base, commission: 100000, paidAmount: 150000 });
  assert.equal(totals.dueRub, -50000);
});

test("копейки не накапливают ошибку округления", () => {
  const totals = calcTotals({ ...base, carPrice: 0.1, exchangeRate: 3, commission: 0.2 });
  assert.equal(totals.totalRub, 0.5);
});

test("нечисловые значения считаются нулём, а не ломают расчёт", () => {
  const totals = calcTotals({ ...base, commission: Number.NaN, paidAmount: Infinity });
  assert.equal(totals.totalRub, 0);
  assert.equal(totals.dueRub, 0);
});

test("parseMoney понимает пробелы, неразрывные пробелы и запятую", () => {
  assert.equal(parseMoney("1 200 000,50"), 1200000.5);
  assert.equal(parseMoney("1 200 000"), 1200000);
  assert.equal(parseMoney("не число"), 0);
});

test("money и moneyShort дают читаемые подписи", () => {
  assert.equal(money(3552700).replace(/ /g, " "), "3 552 700 ₽");
  assert.equal(moneyShort(3552700), "3,55 млн ₽");
  assert.equal(moneyShort(250000), "250 тыс ₽");
  assert.equal(moneyShort(900).replace(/ /g, " "), "900 ₽");
});
