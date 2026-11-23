/**
 * Подготовка данных для счёта и договора.
 *
 * Печатные формы собираются в браузере и сохраняются в PDF средствами самого
 * браузера: отдельная библиотека ради двух документов не нужна, а вёрстка
 * остаётся редактируемой без пересборки.
 */

import { calcTotals } from "./money";
import { moneyToWords } from "./numToWords";
import type { Deal, Settings } from "./types";

/** Полное наименование продавца: «ИП Петренко Дмитрий Анатольевич». */
export function sellerName(settings: Settings): string {
  const form = settings.legalForm.trim();
  const name = settings.companyName.trim();
  if (!name) return "—";
  return form ? `${form} ${name}` : name;
}

/** Описание автомобиля одной строкой для таблицы документа. */
export function carDescription(deal: Pick<Deal, "carBrand" | "carModel" | "carYear" | "vin">): string {
  const base = [deal.carBrand, deal.carModel].filter(Boolean).join(" ") || "Автомобиль";
  const details: string[] = [];
  if (deal.carYear) details.push(`${deal.carYear} г.в.`);
  if (deal.vin) details.push(`VIN ${deal.vin}`);
  return details.length ? `${base}, ${details.join(", ")}` : base;
}

/** «СЧ-0001» — номер документа с ведущими нулями. */
export function documentNumber(deal: Pick<Deal, "number">, prefix: string): string {
  return `${prefix}-${String(deal.number).padStart(4, "0")}`;
}

/** Доля предоплаты по сделке. Не задана — считаем половину. */
export function prepaymentPercent(deal: Deal): number {
  return deal.prepaymentPercent ?? 50;
}

/** Срок поставки по сделке. Не задан — берём типовые 60 дней. */
export function deliveryDays(deal: Deal): number {
  return deal.deliveryDays ?? 60;
}

/**
 * Суммы, которые попадают в договор и счёт.
 *
 * Доля предоплаты берётся из сделки, а не из реквизитов компании: по одной
 * машине договариваются на треть вперёд, по другой — на всю сумму.
 */
export function documentTotals(deal: Deal, _settings: Settings) {
  const totals = calcTotals(deal);
  const prepayment = Math.round((totals.totalRub * prepaymentPercent(deal)) / 100);

  return {
    total: totals.totalRub,
    totalWords: moneyToWords(totals.totalRub),
    paid: deal.paidAmount,
    due: totals.dueRub,
    prepayment,
    prepaymentWords: moneyToWords(prepayment),
  };
}

/**
 * Чего не хватает в реквизитах для конкретного документа.
 *
 * Показываем списком до печати: пустая строка в готовом счёте обнаруживается
 * обычно уже у клиента.
 */
export function missingRequisites(settings: Settings, kind: "invoice" | "contract"): string[] {
  const missing: string[] = [];

  if (!settings.companyName.trim()) missing.push("наименование компании");
  if (!settings.inn.trim()) missing.push("ИНН");
  if (!settings.legalAddress.trim()) missing.push("адрес");
  if (!settings.signerName.trim()) missing.push("подписант");

  if (kind === "invoice") {
    if (!settings.bankName.trim()) missing.push("банк");
    if (!settings.bankAccount.trim()) missing.push("расчётный счёт");
    if (!settings.bankBic.trim()) missing.push("БИК");
  }

  return missing;
}

/**
 * Чего не хватает в данных заказчика для договора.
 *
 * Договор без паспорта и адреса регистрации подписать нельзя, а обнаруживается
 * это обычно уже за столом с клиентом.
 */
export function missingClientRequisites(deal: Deal): string[] {
  const missing: string[] = [];

  if (!deal.clientFullName?.trim()) missing.push("ФИО заказчика полностью");
  if (!deal.clientPassport?.trim()) missing.push("паспорт заказчика");
  if (!deal.clientAddress?.trim()) missing.push("адрес заказчика");

  return missing;
}
