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
  Task,
  User,
} from "./types";
import type { Stage } from "./stages";

const BASE = "/crm/api";

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

async function request<T>(path: string, options: Options = {}): Promise<T> {
  const init: RequestInit = {
    method: options.method ?? (options.body || options.form ? "POST" : "GET"),
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
    throw new ApiError("Нет связи с сервером", "network", 0);
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
    request<{ tasks: Task[] }>("/tasks", { body: input }),

  updateTask: (id: string, patch: Record<string, unknown>) =>
    request<{ task: Task; tasks: Task[] }>(`/tasks/${id}`, { method: "PATCH", body: patch }),

  deleteTask: (id: string) => request<unknown>(`/tasks/${id}`, { method: "DELETE" }),

  // --- файлы ---
  uploadFile: (dealId: string, file: File, kind: FileKind) => {
    const form = new FormData();
    form.append("dealId", dealId);
    form.append("kind", kind);
    form.append("file", file);
    return request<{ files: DealFile[] }>("/files", { form });
  },

  deleteFile: (id: string) => request<unknown>(`/files/${id}`, { method: "DELETE" }),

  fileUrl: (id: string) => `${BASE}/files/${id}`,

  // --- прочее ---
  settings: () => request<{ settings: Settings }>("/settings"),

  saveSettings: (values: Settings) =>
    request<{ settings: Settings }>("/settings", { method: "PUT", body: values }),

  dashboard: (period: string) => request<Dashboard>(`/dashboard?period=${period}`),

  rate: (currency: string) =>
    request<{ currency: string; rate: number; date: string | null }>(`/rate?currency=${currency}`),

  track: (token: string) => request<{ deal: PublicDeal }>(`/track/${token}`),

  trackPhotoUrl: (token: string, fileId: string) => `${BASE}/track/${token}/photo/${fileId}`,
};
