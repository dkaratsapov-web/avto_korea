import { useState } from "react";
import { ArrowRight, Loader2, Paperclip } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { Button } from "@/components/ui/Button";
import { showToast } from "@/lib/toast";
import { countries, site } from "@/lib/site";

type Layout = "compact" | "full";
type Tone = "dark" | "light";

// --- фильтры ввода: только цифры ---
function onlyDigits(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  el.value = el.value.replace(/\D/g, "");
}
function onlyDigitsGrouped(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  const digits = el.value.replace(/\D/g, "");
  el.value = digits ? Number(digits).toLocaleString("ru-RU").replace(/ /g, " ") : "";
}
// Маска российского номера: +7 (XXX) XXX-XX-XX
function maskPhone(e: React.FormEvent<HTMLInputElement>) {
  const el = e.currentTarget;
  let d = el.value.replace(/\D/g, "");
  if (d[0] === "8") d = "7" + d.slice(1);
  else if (d[0] === "9") d = "7" + d;
  else if (d.length > 0 && d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);

  const rest = d.slice(1);
  if (rest.length === 0) {
    el.value = d ? "+7" : "";
    return;
  }
  let out = "+7 (" + rest.slice(0, 3);
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += " " + rest.slice(3, 6);
  if (rest.length >= 6) out += "-" + rest.slice(6, 8);
  if (rest.length >= 8) out += "-" + rest.slice(8, 10);
  el.value = out;
}

export type LeadFormProps = {
  layout?: Layout;
  tone?: Tone;
  /** Метка источника заявки — уходит менеджеру вместе с данными. */
  source: string;
  submitLabel?: string;
  className?: string;
  /** Преселект страны для формы-калькулятора. */
  defaultCountry?: keyof typeof countries;
  /** Показывать поле «Марка и модель» в compact-форме (на карточке авто не нужно). */
  withCar?: boolean;
  /** Показывать быстрые кнопки-мессенджеры (MAX / Telegram). */
  withContacts?: boolean;
  /** Форма без собственной рамки/подложки и на всю ширину (когда уже внутри карточки). */
  bare?: boolean;
};

export function LeadForm({
  layout = "compact",
  tone = "dark",
  source,
  submitLabel = "Получить расчёт",
  className = "",
  defaultCountry,
  withCar = true,
  withContacts = false,
  bare = false,
}: LeadFormProps) {
  const [loading, setLoading] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const fieldClass = tone === "dark" ? "field-dark" : "field-light";

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Фото слишком большое (до 5 МБ)", "error");
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result));
      setPhotoName(file.name);
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    // Эндпоинт приёма заявок задаётся через VITE_LEAD_ENDPOINT (бэкенд/serverless/Telegram-прокси).
    // Если не задан — демо-режим: показываем успех без реальной отправки.
    const endpoint = import.meta.env.VITE_LEAD_ENDPOINT as string | undefined;
    if (!endpoint) {
      form.reset();
      setPhoto(null);
      setPhotoName("");
      showToast("Демо-режим: заявка принята. На боевом сайте — звонок за 15 минут.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, photo: photo || undefined, source }),
      });
      if (!res.ok) throw new Error("bad response");
      form.reset();
      setPhoto(null);
      setPhotoName("");
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
      Нажимая кнопку, вы соглашаетесь с{" "}
      <a
        href="/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline hover:opacity-80"
      >
        обработкой персональных данных
      </a>
      . Перезвоним в течение 15 минут.
    </p>
  );

  if (layout === "compact") {
    return (
      <div className={className}>
        <form
          onSubmit={handleSubmit}
          className={`flex flex-wrap items-center gap-[10px] ${
            bare
              ? "w-full"
              : "max-w-[560px] rounded-card border border-line-dark bg-white/[0.04] p-4"
          }`}
        >
          <input
            type="text"
            name="name"
            placeholder="Ваше имя"
            aria-label="Имя"
            className={`${fieldClass} min-w-0 basis-full sm:flex-1 sm:basis-0`}
          />
          {withCar ? (
            <input
              type="text"
              name="car"
              placeholder="Марка и модель"
              aria-label="Авто или бюджет"
              className={`${fieldClass} min-w-0 basis-full sm:flex-1 sm:basis-0`}
            />
          ) : null}
          <input
            type="tel"
            name="phone"
            inputMode="tel"
            placeholder="Ваш телефон"
            aria-label="Телефон"
            required
            onInput={maskPhone}
            className={`${fieldClass} min-w-0 basis-full sm:flex-1 sm:basis-0`}
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

          {withContacts ? (
            <div className="flex w-full basis-full flex-wrap items-center gap-2.5 border-t border-line-dark pt-3">
              <span className="text-[12.5px] font-semibold text-[#8C97A1]">
                Или напишите:
              </span>
              <a
                href={site.maxHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Написать в MAX"
                title="MAX"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-dark bg-white/[0.05] transition-colors hover:border-steel hover:bg-white/[0.1]"
              >
                <MaxIcon className="h-[22px] w-[22px]" />
              </a>
              <a
                href={site.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Написать в Telegram"
                title="Telegram"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-dark bg-white/[0.05] transition-colors hover:border-steel hover:bg-white/[0.1]"
              >
                <TelegramIcon className="h-[22px] w-[22px]" />
              </a>
            </div>
          ) : null}
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
      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2 sm:col-span-2">
        Имя
        <input
          type="text"
          name="name"
          placeholder="Как к вам обращаться"
          className={fieldClass}
        />
      </label>

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
              {c.label}
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
          maxLength={4}
          placeholder="2022"
          onInput={onlyDigits}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2">
        Бюджет, ₽
        <input
          type="text"
          name="budget"
          inputMode="numeric"
          placeholder="4 000 000"
          onInput={onlyDigitsGrouped}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2 sm:col-span-2">
        Телефон
        <input
          type="tel"
          name="phone"
          inputMode="tel"
          placeholder="+7 (___) ___-__-__"
          required
          onInput={maskPhone}
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2 sm:col-span-2">
        Ссылка на авто (необязательно)
        <input
          type="url"
          name="link"
          placeholder="Ссылка с encar / che168 и т.п."
          className={fieldClass}
        />
      </label>

      <div className="flex flex-col gap-1.5 text-[13px] font-semibold text-ink-2 sm:col-span-2">
        Фото желаемого авто (необязательно)
        <label
          className={`flex cursor-pointer items-center justify-center gap-2 rounded-[11px] border border-dashed px-4 py-3 text-[13.5px] font-semibold ${
            tone === "dark"
              ? "border-line-dark text-chrome hover:border-steel"
              : "border-line text-ink-2 hover:border-steel"
          }`}
        >
          <Paperclip className="h-[18px] w-[18px]" />
          {photoName ? photoName : "Прикрепить фото"}
          <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        </label>
        {photoName ? (
          <button
            type="button"
            onClick={() => {
              setPhoto(null);
              setPhotoName("");
            }}
            className="self-start text-[12.5px] font-bold text-bordeaux hover:underline"
          >
            Убрать фото
          </button>
        ) : null}
      </div>

      <label className="flex items-start gap-2.5 text-[12.5px] text-ink-2 sm:col-span-2">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 flex-none accent-bordeaux"
        />
        <span>
          Согласен с{" "}
          <a href="/consent" target="_blank" rel="noopener noreferrer" className="underline">
            обработкой персональных данных
          </a>{" "}
          и{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline">
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
