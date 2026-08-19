/**
 * Печатные формы: счёт на оплату и договор оказания услуг.
 *
 * Собираются в браузере и сохраняются в PDF его же средствами — отдельная
 * библиотека ради двух документов не нужна, а вёрстку можно править без
 * пересборки. Всё лишнее скрывается при печати классом crm-no-print.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Printer } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { money } from "../lib/money";
import { formatDay } from "../lib/format";
import {
  carDescription,
  deliveryDays,
  missingClientRequisites,
  documentNumber,
  documentTotals,
  missingRequisites,
  prepaymentPercent,
  sellerName,
} from "../lib/documents";
import type { Deal, Settings } from "../lib/types";
import { Button, Spinner } from "../ui";

export function PrintPage() {
  const { id = "", kind = "invoice" } = useParams();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.deal(id), api.settings()])
      .then(([d, s]) => {
        setDeal(d.deal);
        setSettings(s.settings);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Не удалось загрузить документ"));
  }, [id]);

  useEffect(() => {
    if (deal) {
      document.title = `${kind === "contract" ? "Договор" : "Счёт"} №${deal.number} — ДиАвто69`;
    }
  }, [deal, kind]);

  if (error) {
    return <p className="p-8 text-center text-[14px] text-crm-danger">{error}</p>;
  }
  if (!deal || !settings) return <Spinner />;

  const isContract = kind === "contract";
  const missing = [
    ...missingRequisites(settings, isContract ? "contract" : "invoice"),
    // Для договора нужны ещё и данные заказчика — без них он не подписывается.
    ...(isContract ? missingClientRequisites(deal) : []),
  ];

  return (
    <div className="crm-force-light crm-print min-h-screen bg-crm-bg py-6">
      <div className="crm-no-print mx-auto mb-4 flex w-[210mm] max-w-[calc(100%-2rem)] items-center justify-between gap-3">
        <div>
          {missing.length ? (
            <p className="rounded-lg bg-crm-warn-soft px-3 py-2 text-[12.5px] text-crm-warn">
              В реквизитах не хватает: <b>{missing.join(", ")}</b> — документ выйдет с пропусками.
            </p>
          ) : null}
        </div>
        <Button variant="primary" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Печать / PDF
        </Button>
      </div>

      <article className="mx-auto w-[210mm] max-w-[calc(100%-2rem)] bg-white p-[16mm] text-[11.5pt] leading-relaxed text-black shadow-[0_10px_40px_-20px_rgba(0,0,0,0.4)] print:w-full print:max-w-none print:p-0 print:shadow-none">
        {isContract ? (
          <Contract deal={deal} settings={settings} />
        ) : (
          <Invoice deal={deal} settings={settings} />
        )}
      </article>
    </div>
  );
}

/* -------------------------------------------------------------------- счёт */

function Invoice({ deal, settings }: { deal: Deal; settings: Settings }) {
  const totals = documentTotals(deal, settings);
  const number = documentNumber(deal, "СЧ");

  return (
    <>
      {/* Банковская шапка — привычная форма платёжного документа. */}
      <table className="w-full border-collapse text-[9.5pt]">
        <tbody>
          <tr>
            <td className="w-[62%] border border-black p-1.5 align-top">
              {settings.bankName || "—"}
              <div className="mt-1 text-[8.5pt] text-[#444]">Банк получателя</div>
            </td>
            <td className="border border-black p-1.5 align-top">
              <div className="text-[8.5pt] text-[#444]">БИК</div>
              <div className="tnum">{settings.bankBic || "—"}</div>
            </td>
            <td className="border border-black p-1.5 align-top">
              <div className="text-[8.5pt] text-[#444]">Сч. №</div>
              <div className="tnum">{settings.bankCorr || "—"}</div>
            </td>
          </tr>
          <tr>
            <td className="border border-black p-1.5 align-top">
              <div>
                ИНН {settings.inn || "—"}
                {settings.ogrn ? ` · ОГРН ${settings.ogrn}` : ""}
              </div>
              <div className="mt-1">{sellerName(settings)}</div>
              <div className="mt-1 text-[8.5pt] text-[#444]">Получатель</div>
            </td>
            <td className="border border-black p-1.5 align-top" colSpan={2}>
              <div className="text-[8.5pt] text-[#444]">Сч. №</div>
              <div className="tnum">{settings.bankAccount || "—"}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <h1 className="mt-6 text-[16pt] font-bold">
        Счёт на оплату {number} от {formatDay(new Date().toISOString().slice(0, 10))}
      </h1>

      <dl className="mt-4 space-y-1 text-[10.5pt]">
        <Pair label="Поставщик" value={`${sellerName(settings)}, ИНН ${settings.inn || "—"}, ${settings.legalAddress || "—"}`} />
        <Pair label="Покупатель" value={deal.clientName} />
      </dl>

      <table className="mt-5 w-full border-collapse text-[10pt]">
        <thead>
          <tr>
            <th className="border border-black p-1.5 text-left">№</th>
            <th className="border border-black p-1.5 text-left">Наименование</th>
            <th className="border border-black p-1.5 text-right">Кол-во</th>
            <th className="border border-black p-1.5 text-right">Сумма</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-black p-1.5">1</td>
            <td className="border border-black p-1.5">
              Услуги по подбору, приобретению и доставке автомобиля: {carDescription(deal)}
            </td>
            <td className="border border-black p-1.5 text-right">1</td>
            <td className="tnum border border-black p-1.5 text-right">{money(totals.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 text-right text-[10.5pt]">
        <div>
          Итого: <b className="tnum">{money(totals.total)}</b>
        </div>
        {totals.paid > 0 ? (
          <>
            <div>
              Оплачено: <span className="tnum">{money(totals.paid)}</span>
            </div>
            <div>
              К оплате: <b className="tnum">{money(totals.due)}</b>
            </div>
          </>
        ) : null}
        <div className="mt-1 text-[9.5pt] text-[#444]">Без НДС</div>
      </div>

      <p className="mt-4 text-[10.5pt]">
        Всего к оплате: <b>{totals.totalWords}</b>
      </p>

      <div className="mt-12 flex items-end justify-between">
        <div>
          <div className="w-[70mm] border-b border-black" />
          <div className="mt-1 text-[9.5pt]">
            {settings.signerPosition || "Руководитель"} · {settings.signerName || "—"}
          </div>
        </div>
        <div className="text-[9pt] text-[#666]">М.П.</div>
      </div>
    </>
  );
}

/* ----------------------------------------------------------------- договор */

function Contract({ deal, settings }: { deal: Deal; settings: Settings }) {
  const totals = documentTotals(deal, settings);
  const number = documentNumber(deal, "Д");
  const date = formatDay(new Date().toISOString().slice(0, 10));

  return (
    <>
      <h1 className="text-center text-[14pt] font-bold">Договор оказания услуг {number}</h1>
      <p className="mt-1 text-center text-[10.5pt]">
        г. Тверь · {date}
      </p>

      <p className="mt-5 text-[10.5pt] leading-relaxed">
        {sellerName(settings)}, ИНН {settings.inn || "—"}, именуемый в дальнейшем «Исполнитель»,
        с одной стороны, и {deal.clientFullName || deal.clientName}, именуемый в дальнейшем
        «Заказчик», с другой стороны, заключили настоящий договор о нижеследующем.
      </p>

      <Clause n="1" title="Предмет договора">
        <p>
          1.1. Исполнитель обязуется оказать Заказчику услуги по подбору, приобретению за рубежом,
          доставке на территорию Российской Федерации и таможенному оформлению автомобиля:{" "}
          <b>{carDescription(deal)}</b>
          {deal.country ? `, страна приобретения — ${deal.country}` : ""}.
        </p>
        <p>1.2. Заказчик обязуется принять услуги и оплатить их в порядке, установленном разделом 2.</p>
      </Clause>

      <Clause n="2" title="Стоимость и порядок расчётов">
        <p>
          2.1. Общая стоимость услуг составляет <b className="tnum">{money(totals.total)}</b>{" "}
          ({totals.totalWords}). НДС не облагается.
        </p>
        <p>
          2.2. Заказчик вносит предоплату в размере {prepaymentPercent(deal)}% —{" "}
          <b className="tnum">{money(totals.prepayment)}</b> ({totals.prepaymentWords}) — в течение
          трёх рабочих дней с даты подписания договора.
        </p>
        <p>2.3. Оставшаяся сумма вносится до момента передачи автомобиля Заказчику.</p>
        <p>
          2.4. Стоимость зафиксирована в рублях и не подлежит изменению в одностороннем порядке,
          за исключением случаев изменения ставок таможенных платежей и утилизационного сбора
          после подписания договора.
        </p>
      </Clause>

      <Clause n="3" title="Сроки">
        <p>
          3.1. Срок оказания услуг — {deliveryDays(deal)} календарных дней с даты поступления
          предоплаты.
          {deal.etaDate ? ` Ориентировочная дата прибытия автомобиля — ${formatDay(deal.etaDate)}.` : ""}
        </p>
        <p>
          3.2. Срок продлевается на время задержек, вызванных действиями таможенных органов,
          перевозчиков и иными обстоятельствами вне контроля Исполнителя.
        </p>
      </Clause>

      <Clause n="4" title="Права и обязанности сторон">
        <p>
          4.1. Исполнитель обязуется информировать Заказчика о ходе исполнения договора и
          предоставлять подтверждающие документы по каждому этапу.
        </p>
        <p>
          4.2. Заказчик обязуется своевременно предоставить сведения и документы, необходимые
          для таможенного оформления и регистрации автомобиля.
        </p>
      </Clause>

      <Clause n="5" title="Ответственность сторон">
        <p>
          5.1. За неисполнение обязательств стороны несут ответственность в соответствии
          с законодательством Российской Федерации.
        </p>
        <p>
          5.2. Исполнитель не отвечает за техническое состояние автомобиля, не выявленное
          при проверке до приобретения, если такая проверка была ограничена продавцом.
        </p>
      </Clause>

      <Clause n="6" title="Реквизиты сторон">
        <div className="mt-2 grid grid-cols-2 gap-6 text-[10pt]">
          <div>
            <p className="font-bold">Исполнитель</p>
            <p>{sellerName(settings)}</p>
            <p>ИНН {settings.inn || "—"}</p>
            {settings.ogrn ? <p>ОГРН {settings.ogrn}</p> : null}
            <p>{settings.legalAddress || "—"}</p>
            {settings.phone ? <p>{settings.phone}</p> : null}
            {settings.bankAccount ? (
              <p className="tnum mt-1">
                р/с {settings.bankAccount}, {settings.bankName}, БИК {settings.bankBic}
              </p>
            ) : null}
            <div className="mt-8 w-[60mm] border-b border-black" />
            <p className="mt-1 text-[9pt]">{settings.signerName || "—"}</p>
          </div>
          <div>
            <p className="font-bold">Заказчик</p>
            <p>{deal.clientFullName || deal.clientName}</p>
            {deal.clientBirthDate ? <p>Дата рождения: {formatDay(deal.clientBirthDate)}</p> : null}
            {deal.clientPassport ? <p>Паспорт {deal.clientPassport}</p> : null}
            {deal.clientPassportIssued ? <p>{deal.clientPassportIssued}</p> : null}
            {deal.clientAddress ? <p>{deal.clientAddress}</p> : null}
            {deal.clientPhone ? <p>{deal.clientPhone}</p> : null}
            {deal.clientEmail ? <p>{deal.clientEmail}</p> : null}
            <div className="mt-8 w-[60mm] border-b border-black" />
            <p className="mt-1 text-[9pt]">{deal.clientFullName || deal.clientName}</p>
          </div>
        </div>
      </Clause>
    </>
  );
}

function Clause({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-4 text-[10.5pt] leading-relaxed">
      <h2 className="mb-1 text-[11pt] font-bold">
        {n}. {title}
      </h2>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function Pair({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[28mm] flex-none text-[#444]">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}
