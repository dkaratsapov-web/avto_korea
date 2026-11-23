/**
 * Клиент API CRM.
 *
 * Единственная точка, через которую интерфейс общается с сервером. Ошибка
 * сервера превращается в исключение с человеческим текстом — экраны просто
 * ловят его и показывают, не разбирая коды.
 */

import type {
  Dashboard,
  Deal,
  DealEvent,
  DealFile,
  FileKind,
  PublicDeal,
  Settings,
  SiteReview,
  Task,
  User,
} from "./types";
import type { Stage } from "./stages";

/** Публикация контент-плана Instagram. */
export type ContentPost = {
  id: string;
  n: number;
  date: string;
  rubric: string;
  format: string;
  goal: string;
  topic: string;
  hook: string;
  visual: string;
  note: string;
  /** Короткий (охват) или длинный (доверие, сохранения) контент. */
  length?: "short" | "long" | "";
  /** Хронометраж или объём: «60–90 с», «12 слайдов». */
  size?: string;
  /** Нацелен на ЦА Тверь: минимум один такой Reels в неделю. */
  local?: boolean;
  status: "idea" | "progress" | "ready" | "published";
};
/** seed — версия стартового плана, от которой пошли правки. */
export type ContentPlanData = { posts: ContentPost[]; seed?: number; updatedAt?: string; updatedBy?: string };
export type ContentBrief = { answers: Record<string, string>; updatedAt?: string | null; updatedBy?: string };

const BASE = "/crm/api";

/** Потолок вложения. Тот же, что и на сервере (routes/files.php). */
export const FILE_MAX_BYTES = 8 * 1024 * 1024;

function formatBytes(bytes: number): string {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} МБ`
    : `${Math.max(1, Math.round(bytes / 1024))} КБ`;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  /** Для загрузки файлов: тело уходит как есть, без JSON-заголовка. */
  form?: FormData;
};

/**
 * Текст для случая, когда запрос вообще не дошёл до ответа.
 *
 * Раньше на все три случая было одно «Нет связи с сервером», и менеджер
 * не понимал ни причины, ни того, что делать дальше. Хуже всего это работало
 * при сохранении: запрос мог упасть уже ПОСЛЕ записи в базу, и повторная
 * отправка заводила второй раз то же самое.
 */
function networkMessage(method: string): string {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Нет интернета — проверьте связь и повторите";
  }
  if (method === "GET") {
    return "Сервер не ответил. Обновите страницу";
  }
  return "Сервер не ответил. Обновите страницу — возможно, изменение уже сохранилось";
}

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const method = options.method ?? (options.body || options.form ? "POST" : "GET");
  const init: RequestInit = {
    method,
    // Кука сессии ограничена путём /crm, но включить её нужно явно.
    credentials: "same-origin",
  };

  if (options.form) {
    init.body = options.form;
  } else if (options.body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(BASE + path, init);
  } catch {
    // Чтение повторяем один раз: одиночный сбой связи на общем хостинге —
    // обычное дело, и показывать из-за него ошибку не за что. Запись
    // не повторяем никогда: сервер мог её принять, и второй заход создал бы
    // дубль сделки или задачи.
    if (method !== "GET") {
      throw new ApiError(networkMessage(method), "network", 0);
    }

    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      response = await fetch(BASE + path, init);
    } catch {
      throw new ApiError(networkMessage(method), "network", 0);
    }
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Сервер мог отдать HTML — например, страницу ошибки хостинга.
    throw new ApiError(
      `Сервер ответил неожиданно (${response.status})`,
      "bad_response",
      response.status,
    );
  }

  const data = payload as { ok?: boolean; error?: string; message?: string };

  if (!response.ok || data?.ok === false) {
    throw new ApiError(
      data?.message ?? `Ошибка ${response.status}`,
      data?.error ?? "unknown",
      response.status,
    );
  }

  return payload as T;
}

/**
 * Ответ раздела отзывов.
 *
 * `connected` — подключён ли раздел к боту. Пустой список без этого флага
 * читался бы двусмысленно: то ли отзывов нет, то ли ключ не вставлен.
 */
type ReviewsReply = { connected: boolean; reviews: SiteReview[] };

/** Состояние раздела копий. */
type BackupsReply = {
  backups: { name: string; size: number; createdAt: string }[];
  telegram: boolean;
  everyHours: number;
  keep: number;
};

export const api = {
  // --- доступ ---
  me: () => request<{ user: User | null; needsSetup: boolean }>("/auth/me"),

  login: (email: string, password: string) =>
    request<{ user: User }>("/auth/login", { body: { email, password } }),

  logout: () => request<unknown>("/auth/logout", { method: "POST" }),

  setup: (name: string, email: string, password: string) =>
    request<{ user: User }>("/auth/setup", { body: { name, email, password } }),

  changePassword: (current: string, next: string) =>
    request<unknown>("/auth/password", { body: { current, next } }),

  // --- сотрудники ---
  users: () => request<{ users: User[] }>("/users"),

  createUser: (input: { name: string; email: string; password: string; role: string }) =>
    request<{ user: User }>("/users", { body: input }),

  updateUser: (id: string, patch: Record<string, unknown>) =>
    request<{ user: User }>(`/users/${id}`, { method: "PATCH", body: patch }),

  // --- сделки ---
  deals: () => request<{ deals: Deal[] }>("/deals"),

  deal: (id: string) =>
    request<{ deal: Deal; events: DealEvent[]; tasks: Task[]; files: DealFile[] }>(`/deals/${id}`),

  createDeal: (input: Record<string, unknown>) =>
    request<{ deal: Deal }>("/deals", { body: input }),

  updateDeal: (id: string, patch: Record<string, unknown>) =>
    request<{ deal: Deal; events: DealEvent[] }>(`/deals/${id}`, { method: "PATCH", body: patch }),

  deleteDeal: (id: string) => request<unknown>(`/deals/${id}`, { method: "DELETE" }),

  setStage: (id: string, stage: Stage) =>
    request<{ deal: Deal; events: DealEvent[] }>(`/deals/${id}/stage`, { body: { stage } }),

  comment: (id: string, text: string) =>
    request<{ events: DealEvent[] }>(`/deals/${id}/comment`, { body: { text } }),

  trackToken: (id: string, revoke = false) =>
    request<{ publicToken: string | null }>(`/deals/${id}/token`, { body: { revoke } }),

  // --- задачи ---
  tasks: (scope: "mine" | "all" = "mine", withDone = false) =>
    request<{ tasks: Task[] }>(`/tasks?scope=${scope}${withDone ? "&done=1" : ""}`),

  createTask: (input: { dealId: string; title: string; dueDate?: string; assigneeId?: string }) =>
    request<{ tasks: Task[]; events: DealEvent[] }>("/tasks", { body: input }),

  updateTask: (id: string, patch: Record<string, unknown>) =>
    request<{ task: Task; tasks: Task[]; events: DealEvent[] }>(`/tasks/${id}`, {
      method: "PATCH",
      body: patch,
    }),

  deleteTask: (id: string) =>
    request<{ events: DealEvent[] }>(`/tasks/${id}`, { method: "DELETE" }),

  // --- файлы ---
  uploadFile: (dealId: string, file: File, kind: FileKind) => {
    // Размер проверяем ДО отправки. Слишком большое тело хостинг обрывает
    // на своём уровне, не доходя до PHP: браузер видит разрыв соединения,
    // и вместо понятного «файл больше 8 МБ» менеджер получал «нет связи
    // с сервером» — на ровном месте и без единой подсказки, что делать.
    if (file.size > FILE_MAX_BYTES) {
      return Promise.reject(
        new ApiError(
          `«${file.name}» — ${formatBytes(file.size)}, а можно до 8 МБ`,
          "file_too_large",
          413,
        ),
      );
    }

    const form = new FormData();
    form.append("dealId", dealId);
    form.append("kind", kind);
    form.append("file", file);
    return request<{ files: DealFile[]; events: DealEvent[] }>("/files", { form });
  },

  deleteFile: (id: string) =>
    request<{ events: DealEvent[] }>(`/files/${id}`, { method: "DELETE" }),

  fileUrl: (id: string) => `${BASE}/files/${id}`,

  /** Уменьшенная копия для сетки превью — оригиналы там неподъёмны. */
  fileThumbUrl: (id: string) => `${BASE}/files/${id}?thumb=1`,

  // --- уведомления ---
  notifyState: () =>
    request<{
      telegramConfigured: boolean;
      telegramLinked: boolean;
      muted: boolean;
      linkCode: string | null;
      botUsername: string;
      vapidPublicKey: string | null;
      pushDevices: number;
    }>("/notify"),

  saveTelegram: (token: string, botUsername: string) =>
    request<{ telegramConfigured: boolean }>("/notify/telegram", { body: { token, botUsername } }),

  checkTelegram: () =>
    request<{ bot: string; webhook: boolean; webhookUrl: string }>("/notify/telegram-check", {
      method: "POST",
    }),

  unlinkTelegram: () => request<unknown>("/notify/unlink", { method: "POST" }),

  muteNotifications: (muted: boolean) =>
    request<{ muted: boolean }>("/notify/mute", { body: { muted } }),

  testNotification: () => request<{ sent: string[] }>("/notify/test", { method: "POST" }),

  pushSubscribe: (input: { endpoint: string; p256dh: string; auth: string; label: string }) =>
    request<unknown>("/notify/push", { body: input }),

  pushUnsubscribe: (endpoint: string) =>
    request<unknown>("/notify/push", { method: "DELETE", body: { endpoint } }),

  // --- отзывы сайта (данные у бота, CRM — пульт) ---
  reviews: () => request<ReviewsReply>("/reviews"),

  connectReviews: (key: string) => request<ReviewsReply>("/reviews/key", { body: { key } }),

  deleteReview: (id: string) => request<ReviewsReply>(`/reviews/${id}`, { method: "DELETE" }),

  saveReview: (id: string, patch: { name: string; text: string; car: string; rating: number }) =>
    request<ReviewsReply>(`/reviews/${id}`, { body: patch }),

  deleteAllReviews: () => request<ReviewsReply>("/reviews", { method: "DELETE" }),

  // Раздел «Контент»: контент-план Instagram. null — в базе ещё пусто.
  contentPlan: () => request<{ plan: ContentPlanData | null }>("/content"),
  saveContentPlan: (posts: ContentPost[], seed: number) =>
    request<{ plan: ContentPlanData }>("/content", { body: { posts, seed } }),
  contentBrief: () => request<{ brief: ContentBrief }>("/content/brief"),
  saveBriefAnswer: (id: string, answer: string) =>
    request<{ brief: ContentBrief }>("/content/brief", { body: { id, answer } }),

  // Раздел «Бот»: админка бота целиком, через сервер CRM.
  botStatus: () => request<{ connected: boolean; owner?: boolean }>("/bot"),
  connectBot: (key: string) => request<{ connected: boolean }>("/bot/key", { body: { key } }),
  /**
   * Действие админки бота. Ответ бота возвращается как есть — даже отказ
   * (ok: false) админка разбирает сама, поэтому request() здесь не годится:
   * он превратил бы любой отказ в исключение.
   */
  botCall: async (action: string, payload?: unknown): Promise<unknown> => {
    const r = await fetch(BASE + "/bot/call", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });
    const data = (await r.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
    if (!data) return { ok: false, error: `Сервер ответил неожиданно (${r.status})` };
    // Отказ самой CRM (нет связи с ботом, неверный ключ) — с человеческим текстом.
    if (data.ok === false && data.message) return { ok: false, error: data.message };
    return data;
  },

  // --- резервные копии ---
  backups: () => request<BackupsReply>("/backup"),

  makeBackup: () => request<BackupsReply & { sent: boolean }>("/backup", { method: "POST" }),

  restoreBackup: (name: string) =>
    request<BackupsReply & { safety: string; restored: Record<string, number> }>(
      `/backup/${name}/restore`,
      { method: "POST" },
    ),

  deleteBackup: (name: string) => request<BackupsReply>(`/backup/${name}`, { method: "DELETE" }),

  /** Ссылка на выгрузку файла копии — скачивается браузером, не через fetch. */
  backupUrl: (name: string) => `${BASE}/backup/${name}`,

  // --- прочее ---
  settings: () => request<{ settings: Settings }>("/settings"),

  saveSettings: (values: Settings) =>
    request<{ settings: Settings }>("/settings", { method: "PUT", body: values }),

  dashboard: (period: string) => request<Dashboard>(`/dashboard?period=${period}`),

  rate: (currency: string) =>
    request<{ currency: string; rate: number; date: string | null }>(`/rate?currency=${currency}`),

  track: (token: string) => request<{ deal: PublicDeal }>(`/track/${token}`),

  trackPhotoUrl: (token: string, fileId: string, thumb = false) =>
    `${BASE}/track/${token}/photo/${fileId}${thumb ? "?thumb=1" : ""}`,
};
