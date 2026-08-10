import { useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Sparkles } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { showToast } from "@/lib/toast";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

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

export function CostQuiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

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
      source: "Квиз — расчёт стоимости",
    };
    const endpoint = import.meta.env.VITE_LEAD_ENDPOINT as string | undefined;
    if (!endpoint) {
      setDone(true);
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
      setDone(true);
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
          <div className="text-[16px] font-bold text-white">
            Куда прислать расчёт?
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
