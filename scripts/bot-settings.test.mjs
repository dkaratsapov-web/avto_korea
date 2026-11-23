import { test } from "node:test";
import assert from "node:assert/strict";

import { applyPatch } from "./bot-settings.mjs";

/*
 * Эта правка идёт прямо в живые настройки бота. Ошибка здесь — не красный тест,
 * а снесённая конфигурация в бою, поэтому проверяем точечность патча отдельно.
 */

test("патч меняет только переданные поля, остальное не трогает", () => {
  const cur = { gateInviteUrl: "старая", welcomeText: "привет", gateEnabled: true };
  const { next } = applyPatch(cur, { gateInviteUrl: "https://t.me/diavto_69" });
  assert.equal(next.gateInviteUrl, "https://t.me/diavto_69");
  assert.equal(next.welcomeText, "привет", "соседние поля остаются");
  assert.equal(next.gateEnabled, true);
});

test("неразрешённые ключи и неверные типы отклоняются", () => {
  const { next, changed } = applyPatch({}, { token: "секрет", gateEnabled: "да" });
  assert.equal(next.token, undefined, "чужой ключ в настройки не попадает");
  assert.equal(next.gateEnabled, undefined, "строка вместо булева не проходит");
  assert.ok(changed.every((c) => c.skipped), "оба изменения помечены пропущенными");
});

test("пустые/битые текущие настройки не роняют патч", () => {
  assert.deepEqual(applyPatch(null, { gateInviteUrl: "x" }).next, { gateInviteUrl: "x" });
  assert.deepEqual(applyPatch(undefined, { gateInviteUrl: "x" }).next, { gateInviteUrl: "x" });
});
