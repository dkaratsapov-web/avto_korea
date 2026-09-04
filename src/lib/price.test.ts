import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { displayPrice, PRICE_LABEL, PRICE_LABEL_SHORT } from "./price";

const src = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = path.dirname(src);

test("показываем цену до Москвы", () => {
  assert.equal(
    displayPrice({ priceRub: 3_000_000, priceMoscowRub: 2_950_000 }),
    2_950_000,
  );
});

test("без московской цены берём общую, а не пустоту", () => {
  assert.equal(displayPrice({ priceRub: 3_000_000 }), 3_000_000);
  assert.equal(displayPrice({ priceRub: 3_000_000, priceMoscowRub: undefined }), 3_000_000);
});

test("ноль — это цена, а не «не задано»", () => {
  // ?? вместо ||: у машины «по запросу» цена 0, и подставлять вместо неё
  // общую нельзя — иначе в карточке появится сумма, которой не объявляли.
  assert.equal(displayPrice({ priceRub: 3_000_000, priceMoscowRub: 0 }), 0);
});

test("подписи говорят про тот же город, что и цена", () => {
  assert.match(PRICE_LABEL, /Москв/);
  assert.match(PRICE_LABEL_SHORT, /Москв/);
});

/*
 * Главная проверка. Правило «какую цену показывать» раньше было переписано
 * в двух десятках мест, и при смене города одно из них обязательно
 * оставалось старым: в каталоге цена одна, в фильтре другая, в сравнении
 * третья. Теперь правило одно, и здесь мы следим, чтобы мимо него не
 * появилось нового обходного пути.
 */
test("никто не считает цену в обход общего правила", () => {
  const skip = new Set([
    "price.ts", // сам источник правила
    "price.test.ts",
    "duplicates.ts", // отпечаток повтора: считается от неизменной цены хранения
    "cars.ts", // объявление полей
    /*
     * Формы админки. Там такое же выражение, но смысл обратный: оно решает,
     * что ЗАПИСАТЬ в карточку при сохранении, а не что показать. Показ в этих
     * же файлах идёт через displayPrice, как и везде.
     */
    "AdminPage.tsx",
    "TmaAdmin.tsx",
  ]);
  const bad: string[] = [];

  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      if (fs.statSync(p).isDirectory()) {
        walk(p);
        continue;
      }
      if (!/\.tsx?$/.test(name) || skip.has(name)) continue;
      const src = fs.readFileSync(p, "utf8");
      // Ручной вывод цены: «priceTverRub ?? priceRub» и его вариации.
      const hits = src.match(/price(Tver|Moscow)Rub\s*(\?\?|\|\|)\s*[\w.]*price/gi);
      if (hits) bad.push(`${path.relative(root, p)}: ${hits.join(", ")}`);
    }
  };
  walk(src);

  assert.deepEqual(
    bad,
    [],
    "цену надо брать через displayPrice из @/lib/price:\n  " + bad.join("\n  "),
  );
});
