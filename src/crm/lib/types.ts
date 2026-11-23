import type { Stage } from "./stages";

export type Role = "OWNER" | "MANAGER";

export type User = {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
};

export type Deal = {
  id: string;
  number: number;
  stage: Stage;
  managerId: string;
  managerName: string | null;

  clientName: string;
  clientPhone: string | null;
  clientTelegram: string | null;
  source: string | null;

  /** Реквизиты клиента для договора. */
  clientFullName: string | null;
  clientBirthDate: string | null;
  clientPassport: string | null;
  clientPassportIssued: string | null;
  clientAddress: string | null;
  clientEmail: string | null;

  carBrand: string | null;
  carModel: string | null;
  carYear: number | null;
  carMileage: number | null;
  vin: string | null;
  country: string | null;
  lotUrl: string | null;

  currency: string;
  carPrice: number;
  exchangeRate: number;
  deliveryCost: number;
  customsDuty: number;
  utilFee: number;
  brokerCost: number;
  otherCost: number;
  commission: number;
  paidAmount: number;

  purchaseDate: string | null;
  etaDate: string | null;
  closedAt: string | null;

  /** Когда обещали перезвонить клиенту. Дата со временем, без часового пояса. */
  callbackAt: string | null;

  /** Условия договора по этой машине. */
  deliveryDays: number | null;
  prepaymentPercent: number | null;

  notes: string | null;
  publicToken: string | null;

  createdAt: string;
  updatedAt: string;

  totals: {
    carPriceRub: number;
    costRub: number;
    totalRub: number;
    dueRub: number;
    profitRub: number;
  };

  /** Сколько задач по сделке горит — считается на сервере для списка. */
  dueTasks?: number;
};

export type DealEventType =
  | "CREATED"
  | "STAGE_CHANGED"
  | "UPDATED"
  | "COMMENT"
  | "TASK_ADDED"
  | "TASK_UPDATED"
  | "TASK_DONE"
  | "TASK_REOPENED"
  | "TASK_DELETED"
  | "FILE_ADDED"
  | "FILE_DELETED";

export type DealEvent = {
  id: string;
  type: DealEventType;
  text: string | null;
  from: string | null;
  to: string | null;
  userName: string | null;
  createdAt: string;
};

export type TaskUrgency = "overdue" | "today" | "planned" | "someday" | "done";

export type Task = {
  id: string;
  dealId: string;
  dealNumber: number | null;
  dealClient: string | null;
  assigneeId: string;
  assigneeName: string | null;
  title: string;
  dueDate: string | null;
  isDone: boolean;
  doneAt: string | null;
  createdAt: string;
  urgency: TaskUrgency;
};

export type FileKind = "PHOTO" | "INVOICE" | "CONTRACT" | "CUSTOMS" | "CLIENT_DOC" | "OTHER";

export type DealFile = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  kind: FileKind;
  uploaderName: string | null;
  createdAt: string;
};

export type Settings = {
  companyName: string;
  legalForm: string;
  inn: string;
  ogrn: string;
  legalAddress: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccount: string;
  bankCorr: string;
  bankBic: string;
  signerName: string;
  signerPosition: string;
};

export type Dashboard = {
  period: string;
  stats: {
    deals: number;
    won: number;
    lost: number;
    revenue: number;
    profit: number;
    expected: number;
    averageCheck: number;
    conversion: number;
    averageDays: number;
  };
  byStage: Record<Stage, number>;
  byManager: {
    managerId: string;
    managerName: string | null;
    deals: number;
    won: number;
    revenue: number;
    profit: number;
  }[];
};

/** Данные заказа для клиента по ссылке отслеживания. */
export type PublicDeal = {
  number: number;
  clientName: string;
  car: string;
  carYear: number | null;
  country: string | null;
  vin: string | null;
  stage: Stage;
  stageLabel: string;
  steps: { stage: Stage; label: string; done: boolean; current: boolean }[];
  isClosed: boolean;
  isLost: boolean;
  totalRub: number;
  paidRub: number;
  dueRub: number;
  etaDate: string | null;
  photos: { id: string; name: string }[];
  updatedAt: string;
};

/**
 * Отзыв с сайта.
 *
 * Живёт не в базе CRM, а у бота: владелец пересылает ему видео с выдачи, и тот
 * публикует запись на сайте и в мини-аппе. CRM показывает список и умеет
 * удалять — поля здесь ровно те, что нужны для показа карточки.
 */
export type SiteReview = {
  id: string;
  name: string;
  text: string;
  car?: string;
  rating: number;
  media?: string;
  video?: string;
  images?: string[];
  videos?: string[];
  /** Кадр-обложка видео — его присылает Telegram вместе с файлом. */
  poster?: string;
  ts: number;
};
