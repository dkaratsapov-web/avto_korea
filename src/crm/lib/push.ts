/**
 * Подписка браузера на push-уведомления.
 *
 * Отдельно от интерфейса, потому что здесь много условий, за которыми надо
 * следить: поддержка браузера, разрешение пользователя, установка на домашний
 * экран для iPhone. Экран должен получать один понятный ответ, а не разбирать
 * это сам.
 */

import { api } from "./api";

export type PushState =
  | "unsupported" // браузер не умеет push
  | "ios-needs-install" // Safari умеет, но только у сайта на домашнем экране
  | "denied" // человек запретил уведомления
  | "off" // можно включить
  | "on"; // подписка есть

/** Установлен ли сайт на домашний экран (в браузере это отдельный режим). */
function isInstalled(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // Safari до сих пор использует своё нестандартное свойство.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPad с iPadOS притворяется маком, отличается только наличием касаний.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export async function pushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // На айфоне без установки на домашний экран PushManager просто отсутствует —
    // отличаем этот случай, чтобы не говорить «браузер не умеет» тому, у кого
    // всё умеет, но нужно нажать «На экран „Домой“».
    return isIos() && !isInstalled() ? "ios-needs-install" : "unsupported";
  }

  if (Notification.permission === "denied") return "denied";

  try {
    const registration = await navigator.serviceWorker.getRegistration("/crm");
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? "on" : "off";
  } catch {
    return "off";
  }
}

/**
 * Ключ VAPID приходит строкой base64url, а браузеру нужен массив байтов.
 *
 * Возвращаем ArrayBuffer, а не Uint8Array: подпись subscribe() требует буфер,
 * который заведомо не разделяемый между потоками.
 */
function decodeKey(base64url: string): ArrayBuffer {
  const padded = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);

  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

/** Короткое имя устройства — чтобы в списке было понятно, что откуда. */
function deviceLabel(): string {
  const agent = navigator.userAgent;
  if (/iPhone/.test(agent)) return "iPhone";
  if (/iPad/.test(agent)) return "iPad";
  if (/Android/.test(agent)) return "Android";
  if (/Macintosh/.test(agent)) return "Mac";
  if (/Windows/.test(agent)) return "Windows";
  return "Браузер";
}

/**
 * Включает уведомления: спрашивает разрешение, регистрирует воркер, оформляет
 * подписку и отдаёт её серверу.
 */
export async function pushEnable(vapidPublicKey: string): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      permission === "denied"
        ? "Уведомления запрещены. Разрешите их для сайта в настройках браузера."
        : "Разрешение не получено",
    );
  }

  // Область действия сужаем до /crm: воркер не должен вмешиваться в работу
  // страниц сайта, даже если лежит в корне.
  const registration = await navigator.serviceWorker.register("/crm-sw.js", { scope: "/crm" });
  await navigator.serviceWorker.ready;

  const subscription = await registration.pushManager.subscribe({
    // Без этого флага браузер не подпишет: беззвучные push запрещены.
    userVisibleOnly: true,
    applicationServerKey: decodeKey(vapidPublicKey),
  });

  const json = subscription.toJSON();
  await api.pushSubscribe({
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    auth: json.keys?.auth ?? "",
    label: deviceLabel(),
  });
}

/** Выключает уведомления на этом устройстве. */
export async function pushDisable(): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration("/crm");
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await api.pushUnsubscribe(subscription.endpoint);
    await subscription.unsubscribe();
  }
}
