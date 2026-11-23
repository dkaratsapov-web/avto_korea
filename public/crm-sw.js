/**
 * Service worker CRM — принимает push-уведомления.
 *
 * Лежит в корне сайта, а не в /crm/: браузер разрешает воркеру управлять
 * только тем каталогом, где он находится и ниже, но область действия при
 * регистрации сужается до /crm — на страницы сайта он не распространяется.
 *
 * Ничего не кэширует намеренно. Оффлайн-режим CRM не нужен: работать со
 * сделками без связи нельзя, а устаревшие данные в рабочем инструменте
 * опаснее их отсутствия.
 */

self.addEventListener("install", () => {
  // Новый воркер начинает работать сразу, не дожидаясь закрытия всех вкладок:
  // иначе исправление доезжает до сотрудника через сутки.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "CRM ДиАвто69", body: "", url: "/crm" };

  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Сообщение без разбираемого тела всё равно стоит показать: факт события
    // важнее его содержания.
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/favicon-192.png",
      badge: "/favicon-48.png",
      // Одинаковый тег заменяет предыдущее уведомление вместо нового звонка,
      // поэтому тег свой на каждое событие.
      tag: payload.tag || `crm-${Date.now()}`,
      data: { url: payload.url || "/crm" },
      lang: "ru",
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/crm";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Если CRM уже открыта — переводим фокус на неё, а не плодим вкладки.
      for (const client of clients) {
        if (client.url.includes("/crm") && "focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
