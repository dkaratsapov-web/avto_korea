"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/lib/toast";
import { countries } from "@/lib/site";

type Layout = "compact" | "full";
type Tone = "dark" | "light";

export type LeadFormProps = {
  layout?: Layout;
  tone?: Tone;
  /** Метка источника заявки — уходит менеджеру вместе с данными. */
  source: string;
  submitLabel?: string;
  className?: string;
  /** Преселект страны для формы-калькулятора. */
  defaultCountry?: keyof typeof countries;
};

export function LeadForm({
  layout = "compact",
  tone = "dark",
  source,
  submitLabel = "Получить расчёт",
  className = "",
  defaultCountry,
}: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const fieldClass = tone === "dark" ? "field-dark" : "field-light";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // На статическом превью (GitHub Pages) серверного роута нет —
    // показываем успех без реальной отправки.
    if (process.env.NEXT_PUBLIC_DEMO === "true") {
      form.reset();
      showToast("Демо-режим: заявка принята. На боевом сайте — звонок за 15 минут.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, source }),
      });
      if (!res.ok) throw new Error("bad response");
      form.reset();
      showToast("Заявка принята — перезвоним в течение 15 минут.");
    } catch {
      showToast(
        "Не удалось отправить заявку. Напишите нам в Telegram.",
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  const consentNote = (
    <p
      className={`mt-[10px] max-w-[560px] text-[12.5px] ${
        tone === "dark" ? "text-[#8C97A1]" : "text-ink-2"
      }`}
    >
      Нажимая кнопку, вы соглашаетесь с обработкой персональных данных.
      Перезвоним в течение 15 минут.
    </p>
  );

  if (layout === "compact") {
    return (
      <div className={className}>
        <form
          onSubmit={handleSubmit}
          className="flex max-w-[560px] flex-wrap items-center gap-[10px] rounded-card border border-line-dark bg-white/[0.04] p-4"
        >
          <input
            type="text"
            name="car"
            placeholder="Марка и модель или бюджет"
            aria-label="Авто или бюджет"
            className={`${fieldClass} min-w-[150px] flex-1`}
          />
          <input
            type="tel"
            name="phone"
            placeholder="Ваш телефон"
            aria-label="Телефон"
            required
            className={`${fieldClass} min-w-[150px] flex-1`}
          />
          <Button
            type="submit"
            variant="primary"
            disabled={loading}
            className="max-[600px]:w-full"
          >
            {loading ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : null}
            {submitLabel}
          </Button>
        </form>
        {consentNote}
      </div>
    );
  }

  // full — калькулятор
  return (
    <form
      onSubmit={handleSubmit}
      className={`grid gap-4 sm:grid-cols-2 ${className}`}
    >
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Страна
        <select
          name="country"
          defaultValue={defaultCountry ?? ""}
          className={`${fieldClass} appearance-none`}
        >
          <option value="">Любая</option>
          {Object.entries(countries).map(([code, c]) => (
            <option key={code} value={code}>
              {c.flag} {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Марка и модель
        <input
          type="text"
          name="car"
          placeholder="Например, Kia Sorento"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Год выпуска
        <input
          type="text"
          name="year"
          inputMode="numeric"
          placeholder="2022"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Бюджет, ₽
        <input
          type="text"
          name="budget"
          inputMode="numeric"
          placeholder="до 4 000 000"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2 sm:col-span-2">
        Телефон
        <input
          type="tel"
          name="phone"
          placeholder="+7 (___) ___-__-__"
          required
          className={fieldClass}
        />
      </label>

      <label className="flex items-start gap-2.5 text-[12.5px] text-ink-2 sm:col-span-2">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 flex-none accent-bordeaux"
        />
        <span>
          Согласен с обработкой персональных данных и{" "}
          <a href="#contacts" className="underline">
            политикой конфиденциальности
          </a>
          .
        </span>
      </label>

      <Button
        type="submit"
        variant="primary"
        disabled={loading}
        className="sm:col-span-2"
      >
        {loading ? (
          <Loader2 className="h-[18px] w-[18px] animate-spin" />
        ) : (
          <ArrowRight className="h-[18px] w-[18px]" />
        )}
        {submitLabel}
      </Button>
    </form>
  );
}
