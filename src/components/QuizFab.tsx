import { useState } from "react";
import { ArrowLeft, ArrowRight, Sparkles, Check, Send } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { LeadForm } from "@/components/LeadForm";
import { CarSilhouette } from "@/components/icons/CarSilhouette";
import { formatPrice, type Car } from "@/data/cars";
import { useCars } from "@/lib/carsStore";
import { useUI } from "@/lib/ui";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

type Step = {
  key: "country" | "body" | "budget" | "state";
  q: string;
  options: { label: string; value: string }[];
};

const ANY = "any";

const STEPS: Step[] = [
  {
    key: "country",
    q: "Из какой страны везём?",
    options: [
      { label: "Корея", value: "kr" },
      { label: "Китай", value: "cn" },
      { label: "Япония", value: "jp" },
      { label: "Европа", value: "eu" },
      { label: "Не важно", value: ANY },
    ],
  },
  {
    key: "body",
    q: "Какой кузов интересует?",
    options: [
      { label: "Седан", value: "седан" },
      { label: "Кроссовер", value: "кроссовер" },
      { label: "Внедорожник", value: "внедорожник" },
      { label: "Не важно", value: ANY },
    ],
  },
  {
    key: "budget",
    q: "Бюджет под ключ?",
    options: [
      { label: "до 2 млн ₽", value: "0-2000000" },
      { label: "2–3 млн ₽", value: "2000000-3000000" },
      { label: "3–5 млн ₽", value: "3000000-5000000" },
      { label: "от 5 млн ₽", value: "5000000-99000000" },
      { label: "Не важно", value: ANY },
    ],
  },
  {
    key: "state",
    q: "Новый или с пробегом?",
    options: [
      { label: "Только новый", value: "new" },
      { label: "Можно с пробегом", value: "used" },
      { label: "Не важно", value: ANY },
    ],
  },
];

/**
 * Подбор по ответам — не жёсткий фильтр, а баллы: у части карточек из
 * Telegram не заполнен кузов или цвет, и строгий отбор оставлял бы пустой
 * результат. Совпадения складываются, машины сортируются по числу баллов.
 */
function pickCars(cars: Car[], a: Record<string, string>): Car[] {
  const [min, max] =
    a.budget && a.budget !== ANY
      ? a.budget.split("-").map(Number)
      : [0, Infinity];

  const scored = cars.map((c) => {
    let score = 0;
    const price = c.priceTverRub ?? c.priceRub;

    if (a.country && a.country !== ANY && c.country === a.country) score += 3;
    if (
      a.body &&
      a.body !== ANY &&
      (c.bodyType || "").toLowerCase().includes(a.body)
    )
      score += 2;
    if (price >= min && price <= max) score += 3;
    else if (price < min) score += 1; // дешевле бюджета — тоже вариант
    if (a.state === "new" && c.isNew) score += 2;
    if (a.state === "used" && !c.isNew) score += 2;
    if (a.state === ANY) score += 1;

    return { car: c, score, price };
  });

  return scored
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score || x.price - y.price)
    .slice(0, 4)
    .map((x) => x.car);
}

function messengerText(a: Record<string, string>, picked: Car[]): string {
  const labelOf = (key: string) => {
    const step = STEPS.find((s) => s.key === key);
    return step?.options.find((o) => o.value === a[key])?.label ?? "";
  };
  const params = [
    labelOf("country"),
    labelOf("body"),
    labelOf("budget"),
    labelOf("state"),
  ]
    .filter((v) => v && v !== "Не важно")
    .join(", ");

  const list = picked
    .map(
      (c, i) =>
        `${i + 1}) ${c.model} ${c.year} — ${formatPrice(c.priceTverRub ?? c.priceRub)}`,
    )
    .join("\n");

  return [
    "Здравствуйте! Прошёл подбор на сайте.",
    params ? `Параметры: ${params}.` : "",
    list ? `Понравились варианты:\n${list}` : "",
    "Пришлите, пожалуйста, полную подборку.",
  ]
    .filter(Boolean)
    .join("\n");
}

function ResultCard({ car, onOpen }: { car: Car; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex gap-3 rounded-[14px] border border-line-dark bg-graphite p-2.5 text-left transition-colors hover:border-chrome/40"
    >
      <div className="h-16 w-24 flex-none overflow-hidden rounded-[10px] bg-graphite-2">
        {car.images[0] ? (
          <img
            src={car.images[0]}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <CarSilhouette className="h-full w-full p-2 text-white/20" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-extrabold uppercase text-white">
          {car.model}
        </div>
        <div className="text-[12.5px] text-[#9AA4B2]">
          {car.year} · {car.mileage}
        </div>
        <div className="mt-0.5 font-num text-[15px] font-bold text-bordeaux-bright">
          {formatPrice(car.priceTverRub ?? car.priceRub)}
        </div>
      </div>
    </button>
  );
}

function QuizModal({ onClose }: { onClose: () => void }) {
  const { cars } = useCars();
  const { openCar } = useUI();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const done = step >= STEPS.length;
  const picked = done ? pickCars(cars, answers) : [];
  const progress = Math.round(
    (Math.min(step, STEPS.length) / STEPS.length) * 100,
  );

  function choose(value: string) {
    setAnswers((prev) => ({ ...prev, [STEPS[step].key]: value }));
    setStep((s) => s + 1);
  }

  const text = messengerText(answers, picked);
  const tgHref = `${site.telegramHref}?text=${encodeURIComponent(text)}`;

  return (
    <Modal onClose={onClose} label="Подбор автомобиля" className="max-w-lg">
      <div className="max-h-[92vh] overflow-y-auto p-5 text-white sm:p-7">
        <div className="mb-1 flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.14em] text-chrome">
          <Sparkles className="h-4 w-4" /> Подбор за 4 вопроса
        </div>

        {!done ? (
          <>
            <h2 className="text-[22px] font-extrabold uppercase leading-tight">
              {STEPS[step].q}
            </h2>

            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-bordeaux to-bordeaux-bright transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-5 grid gap-2.5">
              {STEPS[step].options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => choose(o.value)}
                  className="flex items-center justify-between rounded-[14px] border border-line-dark bg-graphite px-4 py-3.5 text-left text-[15px] font-semibold transition-colors hover:border-chrome/50 hover:bg-white/[0.04]"
                >
                  {o.label}
                  <ArrowRight className="h-4 w-4 text-chrome" />
                </button>
              ))}
            </div>

            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="mt-4 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-[#9AA4B2] transition-colors hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" /> Назад
              </button>
            ) : null}
          </>
        ) : (
          <>
            <h2 className="text-[22px] font-extrabold uppercase leading-tight">
              {picked.length
                ? "Что подходит под ваш запрос"
                : "Подберём вручную"}
            </h2>
            <p className="mt-2 text-[14px] text-[#9AA4B2]">
              {picked.length
                ? "Это ближайшие варианты из наличия. Полную подборку под ваш бюджет пришлём в мессенджер."
                : "Под такие параметры в наличии сейчас ничего нет — подберём под заказ и пришлём варианты."}
            </p>

            {picked.length ? (
              <div className="mt-4 grid gap-2.5">
                {picked.map((c) => (
                  <ResultCard
                    key={c.id}
                    car={c}
                    onOpen={() => {
                      onClose();
                      openCar(c.id);
                    }}
                  />
                ))}
              </div>
            ) : null}

            <div className="mt-5 grid gap-2.5">
              <a
                href={tgHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  reachGoal(GOALS.telegram, { place: "Квиз-подбор" })
                }
                className="btn btn-primary"
              >
                <Send className="h-[18px] w-[18px]" /> Подборку в Telegram
              </a>
            </div>

            <div className="mt-6 border-t border-line-dark pt-5">
              <div className="mb-3 flex items-center gap-2 text-[14px] font-bold text-white">
                <Check className="h-4 w-4 text-success" />
                Или оставьте номер — вышлем полный список
              </div>
              <LeadForm
                source="Квиз-подбор на сайте"
                submitLabel="Получить подборку"
                onSent={onClose}
                withCar={false}
                withContacts={false}
                bare
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setStep(0);
                setAnswers({});
              }}
              className="mt-4 text-[13.5px] font-semibold text-[#9AA4B2] transition-colors hover:text-white"
            >
              Пройти заново
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

/** Постоянная кнопка подбора слева — на всех страницах сайта. */
export function QuizFab() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Подобрать автомобиль за 4 вопроса"
        className="fixed bottom-5 left-5 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-4 py-3.5 font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_10px_30px_rgba(122,20,16,.5)] ring-2 ring-white/85 transition-transform hover:scale-[1.04] sm:px-5"
      >
        <Sparkles className="h-[18px] w-[18px] flex-none" />
        <span className="text-[14px] max-sm:hidden">Подобрать авто</span>
      </button>

      {open ? <QuizModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
