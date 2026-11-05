import { test } from "node:test";
import assert from "node:assert/strict";

import { parseCount, median, parsePreview } from "./tg-channel-stats.mjs";

test("parseCount понимает K/M и запятую", () => {
  assert.equal(parseCount("842"), 842);
  assert.equal(parseCount("1.2K"), 1200);
  assert.equal(parseCount("12,5K"), 12500);
  assert.equal(parseCount("3M"), 3_000_000);
  assert.equal(parseCount("abc"), null);
});

test("median на чётном и нечётном числе значений", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3);
  assert.equal(median([]), null);
});

test("parsePreview: подписчики, медиана просмотров, свежесть ленты", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");
  const post = (views, iso) =>
    `<span class="tgme_widget_message_views">${views}</span><time datetime="${iso}" class="time">x</time>`;
  const html =
    `<div class="tgme_channel_info_header_title"><span dir="auto">Клуб Tiggo</span></div>` +
    `<span class="counter_value">8.4K</span> <span class="counter_type">subscribers</span>` +
    post("1.1K", "2026-11-01T10:00:00+00:00") +
    post("900", "2026-11-03T10:00:00+00:00") +
    post("1.5K", "2026-11-04T10:00:00+00:00");
  const s = parsePreview(html, now);
  assert.equal(s.title, "Клуб Tiggo");
  assert.equal(s.subscribers, 8400);
  assert.equal(s.medianViews, 1100);
  assert.equal(s.isFeed, true);
  assert.equal(s.lastPostDaysAgo, 1);
});

test("parsePreview: у чата/закрытого канала ленты нет", () => {
  const s = parsePreview("<html><body>Join group</body></html>");
  assert.equal(s.isFeed, false);
  assert.equal(s.medianViews, null);
});
