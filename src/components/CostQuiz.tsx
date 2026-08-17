import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { Flag } from "@/components/icons/Flag";
import { showToast } from "@/lib/toast";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";
import { useCars } from "@/lib/carsStore";
import { formatPrice, type Car } from "@/data/cars";

type Step = { key: string; q: string; options: string[] };

const STEPS: Step[] = [
  {
    key: "country",
    q: "Из какой страны везём?",
    options: ["Корея", "Китай", "Япония", "Любая — посоветуйте"],
  },
  {
    key: "body",
    q: "Какой тип кузова интересует?",
    options: ["Седан", "Кроссовер", "Внедорожник", "Пока не решил"],
  },
  {
    key: "budget",
    q: "Бюджет под ключ?",
    options: ["до 2 млн ₽", "2–3 млн ₽", "3–5 млн ₽", "от 5 млн ₽"],
  },
  {
    key: "when",
    q: "Когда планируете покупку?",
    options: ["Нужен срочно", "В течение 1–2 мес.", "Просто смотрю"],
  },
];

// Маска российского номера: +7 (XXX) XXX-XX-XX
function maskPhone(value: string) {
  let d = value.replace(/\D/g, "");
  if (d[0] === "8") d = "7" + d.slice(1);
  else if (d[0] === "9") d = "7" + d;
  else if (d.length > 0 && d[0] !== "7") d = "7" + d;
  d = d.slice(0, 11);
  const rest = d.slice(1);
  if (!rest) return d ? "+7" : "";
  let out = "+7 (" + rest.slice(0, 3);
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += " " + rest.slice(3, 6);
  if (rest.length >= 6) out += "-" + rest.slice(6, 8);
  if (rest.length >= 8) out += "-" + rest.slice(8, 10);
  return out;
}

/**
 * Квиз-расчёт. По умолчанию сам показывает экран «Заявка принята» — так он
 * работает в блоке калькулятора на сайте. Посадочная страница передаёт
 * onSent и уводит на /thanks: для Директа отдельная страница-цель надёжнее
 * JS-события, она фиксируется даже если счётчик не успел отработать.
 */
const COUNTRY_BY_ANSWER: Record<string, string> = {
  "Корея": "kr",
  "Китай": "cn",
  "Япония": "jp",
};

/** Границы бюджета из ответа квиза. null — сторона не ограничена. */
const BUDGET_BY_ANSWER: Record<string, [number | null, number | null]> = {
  "до 2 млн ₽": [null, 2_000_000],
  "2–3 млн ₽": [2_000_000, 3_000_000],
  "3–5 млн ₽": [3_000_000, 5_000_000],
  "от 5 млн ₽": [5_000_000, null],
};

const priceOf = (c: Car) => c.priceTverRub ?? c.priceRub;

/**
 * Подборка под ответы квиза.
 *
 * Фильтры смягчаем по очереди, а не отбрасываем сразу все: сначала пробуем
 * точное совпадение, потом отпускаем кузов, потом страну. Бюджет держим до
 * конца — превысить его человеку неприятнее, чем получить другой кузов.
 *
 * exact говорит, нашлось ли совпадение по всем заданным условиям: от этого
 * зависит заголовок, и обещать «подобрали ровно то» вслепую нельзя.
 */
function matchCars(cars: Car[], answers: Record<string, string>) {
  const country = COUNTRY_BY_ANSWER[answers.country || ""] || null;
  const body = answers.body && !answers.body.startsWith("Пока") ? answers.body : null;
  const [min, max] = BUDGET_BY_ANSWER[answers.budget || ""] || [null, null];

  const inBudget = (c: Car) => {
    const p = priceOf(c);
    return (min == null || p >= min) && (max == null || p <= max);
  };
  const byFresh = (a: Car, b: Car) => (b.addedAt ?? 0) - (a.addedAt ?? 0);

  const levels: ((c: Car) => boolean)[] = [
    (c) =>
      inBudget(c) &&
      (!country || c.country === country) &&
      (!body || c.bodyType === body),
    (c) => inBudget(c) && (!country || c.country === country),
    (c) => inBudget(c),
  ];

  for (let i = 0; i < levels.length; i++) {
    const found = cars.filter(levels[i]).sort(byFresh);
    if (found.length) return { list: found.slice(0, 3), total: found.length, exact: i === 0 };
  }
  // В бюджет не попал никто — показываем ближайшие по цене к его границе.
  const target = max ?? min ?? 0;
  const near = [...cars]
    .sort((a, b) => Math.abs(priceOf(a) - target) - Math.abs(priceOf(b) - target))
    .slice(0, 3);
  return { list: near, total: near.length, exact: false };
}

export function CostQuiz({
  source = "Квиз — расчёт стоимости",
  onSent,
}: {
  source?: string;
  onSent?: () => void;
} = {}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { cars } = useCars();

  // Считаем только на контактном шаге: до него ответов ещё нет.
  const match = useMemo(
    () => (step === STEPS.length ? matchCars(cars, answers) : null),
    [step, cars, answers],
  );

  const totalSteps = STEPS.length + 1; // + контактный шаг
  const isContact = step === STEPS.length;
  const progress = Math.round((step / totalSteps) * 100);

  function pick(opt: string) {
    setAnswers((a) => ({ ...a, [STEPS[step].key]: opt }));
    setStep((s) => s + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2 || phone.replace(/\D/g, "").length < 11) {
      showToast("Заполните имя и телефон полностью", "error");
      return;
    }
    const payload = {
      name: name.trim(),
      phone,
      car: answers.body && !answers.body.startsWith("Пока") ? answers.body : "",
      country: answers.country || "",
      budget: answers.budget || "",
      comment:
        "Квиз-расчёт: " +
        STEPS.map((s) => answers[s.key])
          .filter(Boolean)
          .join(" · "),
      source,
    };
    const endpoint = import.meta.env.VITE_LEAD_ENDPOINT as string | undefined;
    if (!endpoint) {
      reachGoal(GOALS.lead, { source });
      setDone(true);
      onSent?.();
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error();
      reachGoal(GOALS.lead, { source });
      setDone(true);
      onSent?.();
    } catch {
      showToast("Не удалось отправить. Напишите нам в Telegram.", "error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="glass rounded-card p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          <Check className="h-7 w-7" />
        </div>
        <h3 className="text-[22px] text-white">Заявка принята!</h3>
        <p className="mx-auto mt-2 max-w-sm text-[14px] text-[#9AA4B2]">
          Соберём для вас честный расчёт под ключ и перезвоним в течение 15
          минут.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-card p-6 sm:p-7">
      <div className="mb-4 flex items-center gap-2 text-[13px] font-extrabold uppercase tracking-[0.1em] text-chrome">
        <Sparkles className="h-4 w-4 text-bordeaux-bright" />
        Рассчитать стоимость за минуту
      </div>

      {/* прогресс */}
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-bordeaux to-bordeaux-bright transition-[width] duration-300"
          style={{ width: `${Math.max(progress, 6)}%` }}
        />
      </div>

      {isContact ? (
        <form onSubmit={submit} className="space-y-3">
          {match?.list.length ? (
            <div className="mb-4 rounded-[14px] border border-line-dark bg-white/[0.03] p-3">
              <div className="mb-2.5 text-[14.5px] font-bold text-white">
                {match.exact
                  ? `Под ваши параметры подошло ${match.total} авто`
                  : "Точного совпадения нет — вот близкие варианты"}
              </div>

              <div className="space-y-2">
                {match.list.map((c) => (
                  <div key={c.id} className="flex items-center gap-2.5">
                    {c.images[0] ? (
                      <img
                        src={c.images[0]}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="h-11 w-16 flex-none rounded-[8px] object-cover"
                      />
                    ) : (
                      <span className="h-11 w-16 flex-none rounded-[8px] bg-white/10" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <Flag code={c.country} className="h-3 w-[18px] flex-none" />
                        <span className="truncate text-[13.5px] font-bold text-white">
                          {c.model}
                        </span>
                      </span>
                      <span className="block font-num text-[13px] font-bold text-bordeaux-bright">
                        {formatPrice(priceOf(c))} ₽ под ключ
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <p className="mt-2.5 text-[12.5px] leading-snug text-[#9AA4B2]">
                Оставьте способ связи — вышлем подборку с фото, ценами под ключ
                и расчётом по каждому.
              </p>
            </div>
          ) : null}

          <div className="text-[16px] font-bold text-white">
            Куда прислать подборку?
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ваше имя"
            aria-label="Имя"
            className="field-dark"
          />
          <input
            value={phone}
            onChange={(e) => setPhone(maskPhone(e.target.value))}
            inputMode="tel"
            placeholder="+7 (___) ___-__-__"
            aria-label="Телефон"
            className="field-dark"
          />
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full !h-12"
          >
            {loading ? (
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
            ) : (
              <ArrowRight className="h-[18px] w-[18px]" />
            )}
            Получить расчёт
          </button>
          <a
            href={site.telegramHref}
            onClick={() => reachGoal(GOALS.telegram, { place: "Квиз расчёта" })}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-[13.5px] font-semibold text-chrome transition-colors hover:text-white"
          >
            <TelegramIcon className="h-4 w-4" /> Или задайте вопрос в Telegram
          </a>
        </form>
      ) : (
        <>
          <div className="mb-4 text-[18px] font-bold leading-snug text-white">
            {STEPS[step].q}
          </div>
          <div className="space-y-2.5">
            {STEPS[step].options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => pick(opt)}
                className="group flex w-full items-center justify-between rounded-[12px] border border-line-dark bg-white/[0.04] px-4 py-3 text-left text-[15px] font-semibold text-[#DCE2E7] transition-colors hover:border-bordeaux-bright hover:bg-bordeaux/10 hover:text-white"
              >
                {opt}
                <ArrowRight className="h-4 w-4 -translate-x-1 text-chrome opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-[#8C97A1]">
        <span>
          Шаг {Math.min(step + 1, totalSteps)} из {totalSteps}
        </span>
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="flex items-center gap-1 font-semibold text-chrome transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Назад
          </button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
