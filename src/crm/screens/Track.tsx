/**
 * Страница отслеживания заказа — единственный публичный экран CRM.
 *
 * Открывается клиенту по ссылке без входа, поэтому здесь нет ничего, кроме
 * того, что сервер согласился отдать: этап, срок, фото и суммы. Закупочная
 * цена, расходы и комиссия сюда физически не приходят.
 *
 * Оформление светлое и спокойное: это письмо клиенту, а не рабочий инструмент.
 */

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Check, CircleAlert } from "lucide-react";
import { api, ApiError } from "../lib/api";
import { money } from "../lib/money";
import { formatDay } from "../lib/format";
import type { PublicDeal } from "../lib/types";
import { site } from "@/lib/site";
import { Spinner } from "../ui";

export function Track() {
  const { token = "" } = useParams();

  const [deal, setDeal] = useState<PublicDeal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Статус заказа — ДиАвто69";

    // Ссылку клиенту нельзя отдавать поисковикам ни при каких условиях.
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    document.head.appendChild(robots);

    api
      .track(token)
      .then(({ deal: found }) => setDeal(found))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Ссылка недействительна"));

    return () => robots.remove();
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f6f8] px-4">
        <div className="max-w-sm text-center">
          <CircleAlert className="mx-auto mb-3 h-8 w-8 text-[#b42318]" />
          <h1 className="text-[18px] font-bold text-[#111827]">Ссылка недействительна</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-[#6b7480]">
            Возможно, она устарела. Напишите нам — пришлём новую.
          </p>
          <a
            href={site.phoneHref}
            className="mt-5 inline-flex h-11 items-center rounded-lg bg-[#1f2937] px-5 text-[14px] font-bold text-white"
          >
            {site.phone}
          </a>
        </div>
      </div>
    );
  }

  if (!deal) return <Spinner className="min-h-screen" />;

  const progress = deal.isClosed
    ? 100
    : (deal.steps.filter((s) => s.done).length / deal.steps.length) * 100;

  return (
    <div className="min-h-screen bg-[#f4f6f8] px-4 py-8">
      <div className="mx-auto w-full max-w-[560px]">
        <header className="mb-5 text-center">
          <picture>
            <source srcSet="/logo-wordmark.webp" type="image/webp" />
            <img
              src="/logo-wordmark.png"
              alt="ДиАвто69"
              className="mx-auto h-7 w-auto opacity-90"
              decoding="async"
            />
          </picture>
          <h1 className="mt-4 text-[19px] font-bold text-[#111827]">
            Заказ №{deal.number}
          </h1>
          <p className="mt-1 text-[14px] text-[#6b7480]">
            {deal.car || "Автомобиль"}
            {deal.carYear ? `, ${deal.carYear} г.в.` : ""}
            {deal.country ? ` · ${deal.country}` : ""}
          </p>
        </header>

        <section className="rounded-xl border border-[#e3e8ee] bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-bold text-[#111827]">{deal.stageLabel}</span>
            {deal.etaDate && !deal.isClosed ? (
              <span className="text-[13px] text-[#6b7480]">
                прибытие · {formatDay(deal.etaDate)}
              </span>
            ) : null}
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#eef1f5]">
            <div
              className="h-full rounded-full bg-[#16a34a] transition-[width] duration-700"
              style={{ width: `${deal.isLost ? 0 : progress}%` }}
            />
          </div>

          <ol className="mt-5 space-y-3">
            {deal.steps.map((step) => (
              <li key={step.stage} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border ${
                    step.done
                      ? "border-[#16a34a] bg-[#16a34a] text-white"
                      : step.current
                        ? "border-[#1f2937] bg-white"
                        : "border-[#d7dde4] bg-white"
                  }`}
                >
                  {step.done ? <Check className="h-3 w-3" /> : null}
                  {step.current && !step.done ? (
                    <span className="h-1.5 w-1.5 rounded-full bg-[#1f2937]" />
                  ) : null}
                </span>
                <span
                  className={`text-[14px] leading-[18px] ${
                    step.current
                      ? "font-bold text-[#111827]"
                      : step.done
                        ? "text-[#5b6470]"
                        : "text-[#9aa3ae]"
                  }`}
                >
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {deal.photos.length ? (
          <section className="mt-4 rounded-xl border border-[#e3e8ee] bg-white p-4">
            <h2 className="mb-3 text-[14px] font-bold text-[#111827]">Фото автомобиля</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {deal.photos.map((photo) => (
                <a
                  key={photo.id}
                  href={api.trackPhotoUrl(token, photo.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden rounded-lg border border-[#eef1f5]"
                >
                  <img
                    src={api.trackPhotoUrl(token, photo.id)}
                    alt={photo.name}
                    loading="lazy"
                    className="aspect-[4/3] w-full object-cover transition-transform duration-300 hover:scale-[1.04]"
                  />
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-xl border border-[#e3e8ee] bg-white p-5">
          <h2 className="mb-3 text-[14px] font-bold text-[#111827]">Оплата</h2>
          <dl className="divide-y divide-[#eef1f5] text-[14px]">
            <Line label="Сумма заказа" value={money(deal.totalRub)} />
            <Line label="Оплачено" value={money(deal.paidRub)} />
            <Line label="Остаток" value={money(deal.dueRub)} strong />
          </dl>
          {deal.vin ? (
            <p className="mt-3 text-[12.5px] text-[#8a93a0]">VIN {deal.vin}</p>
          ) : null}
        </section>

        <footer className="mt-6 text-center">
          <p className="text-[13.5px] text-[#6b7480]">Вопросы по заказу — звоните:</p>
          <a
            href={site.phoneHref}
            className="mt-2 inline-flex h-11 items-center rounded-lg bg-[#1f2937] px-5 text-[15px] font-bold text-white"
          >
            {site.phone}
          </a>
          <p className="mt-4 text-[11.5px] leading-relaxed text-[#9aa3ae]">
            {site.requisites.name} · ИНН {site.requisites.inn}
          </p>
        </footer>
      </div>
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-[#6b7480]">{label}</dt>
      <dd className={`tnum ${strong ? "text-[16px] font-bold" : "font-semibold"} text-[#111827]`}>
        {value}
      </dd>
    </div>
  );
}
