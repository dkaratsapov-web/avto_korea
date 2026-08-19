import assert from "node:assert/strict";
import { test } from "node:test";
import { isPhoneComplete, maskPhone } from "./phone";

test("российский номер приводится к единому виду", () => {
  assert.equal(maskPhone("9001112233"), "+7 (900) 111-22-33");
  assert.equal(maskPhone("89001112233"), "+7 (900) 111-22-33");
  assert.equal(maskPhone("79001112233"), "+7 (900) 111-22-33");
  assert.equal(maskPhone("+7 900 111 22 33"), "+7 (900) 111-22-33");
});

test("маска нарастает по мере набора", () => {
  assert.equal(maskPhone(""), "");
  // Одна семёрка — это ещё код страны, кода оператора нет.
  assert.equal(maskPhone("7"), "+7");
  // А девятка уже первая цифра кода оператора: семёрка подставляется впереди.
  assert.equal(maskPhone("9"), "+7 (9");
  assert.equal(maskPhone("90"), "+7 (90");
  assert.equal(maskPhone("900"), "+7 (900)");
  assert.equal(maskPhone("900111"), "+7 (900) 111");
  assert.equal(maskPhone("90011122"), "+7 (900) 111-22");
});

test("лишние цифры отбрасываются", () => {
  assert.equal(maskPhone("900111223344556677"), "+7 (900) 111-22-33");
});

test("мусор и буквы игнорируются", () => {
  assert.equal(maskPhone("тел. 900-111-22-33"), "+7 (900) 111-22-33");
  assert.equal(maskPhone("абв"), "");
});

test("зарубежный номер маска не трогает", () => {
  // Иначе казахстанский или армянский номер клиента превратился бы
  // в бессмысленный +7 (377) ...
  assert.equal(maskPhone("+37477123456"), "+37477123456");
  assert.equal(maskPhone("+1 415 555 01 99"), "+14155550199");
});

test("номер, начатый с +7 или +8, остаётся российским", () => {
  assert.equal(maskPhone("+79001112233"), "+7 (900) 111-22-33");
  assert.equal(maskPhone("+89001112233"), "+7 (900) 111-22-33");
});

test("повторное применение маски ничего не ломает", () => {
  // Поле форматируется на каждый ввод, поэтому функция всё время получает
  // на вход собственный результат.
  const once = maskPhone("9001112233");
  assert.equal(maskPhone(once), once);
  assert.equal(maskPhone(maskPhone("+37477123456")), "+37477123456");
});

test("полнота номера считается по количеству цифр", () => {
  assert.equal(isPhoneComplete("+7 (900) 111-22-33"), true);
  assert.equal(isPhoneComplete("+7 (900) 111-22"), false);
  assert.equal(isPhoneComplete(""), false);
});
