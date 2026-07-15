import { LeadForm } from "@/components/LeadForm";
import { EstimateMockup } from "@/components/HeroEstimate";
import { Flag } from "@/components/icons/Flag";
import type { CountryCode } from "@/lib/site";

const badges = [
  { strong: "15 мин", rest: " — расчёт под ключ" },
  { strong: "от 25", rest: " дней доставка" },
  { pre: "Цена ", strong: "под ключ" },
];

const flags: { code: CountryCode; title: string }[] = [
  { code: "kr", title: "Корея" },
  { code: "cn", title: "Китай" },
  { code: "jp", title: "Япония" },
  { code: "eu", title: "ЕС" },
];

// Узкий hero без фонового изображения — тёмная подложка, форма и мокап сметы.
export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-[linear-gradient(160deg,#0b0f13_0%,#11151A_55%,#161d25_100%)] text-white after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-[3px] after:bg-[linear-gradient(90deg,transparent,#5C6D76,#AEBAC2,#5C6D76,transparent)] after:content-['']"
    >
      <div className="glow-blob right-[10%] top-[8%] h-64 w-64 animate-glow-pan bg-bordeaux/25" aria-hidden />
      <div className="glow-blob bottom-[6%] left-[2%] h-56 w-56 animate-glow-pan bg-steel/15 [animation-delay:-6s]" aria-hidden />
      <div className="grain absolute inset-0" aria-hidden />

      <div className="wrap relative z-10 grid items-center gap-8 pb-8 pt-[96px] md:grid-cols-[1.05fr_0.95fr] md:pb-9 md:pt-[104px]">
        <div className="animate-fade-up">
          <div className="mb-4 inline-flex items-center gap-3 rounded-full border border-line-dark bg-graphite-2/50 py-1.5 pl-2 pr-4 text-[12.5px] font-bold uppercase tracking-[0.14em] text-chrome">
            <span className="slash" aria-hidden /> Импорт авто под ключ · 69 регион
          </div>

          <h1 className="mb-3.5 text-[clamp(30px,4.2vw,54px)] leading-[1.03] text-white [text-shadow:0_2px_20px_rgba(0,0,0,.4)]">
            Авто из Кореи, Китая и Японии{" "}
            <em className="not-italic text-shine">под ключ</em>
          </h1>

          <p className="mb-5 max-w-[520px] text-[16px] text-[#D2D9DF]">
            Считаем честно и показываем реальную цену с доставкой и растаможкой —
            без скрытых наценок.
          </p>

          <div className="mb-5 flex flex-wrap gap-2">
            {badges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-line-dark bg-graphite-2/60 px-[13px] py-2 text-[13.5px] font-semibold text-[#DCE2E7]"
              >
                {b.pre}
                <b className="text-chrome">{b.strong}</b>
                {b.rest}
              </span>
            ))}
          </div>

          <div id="hero-form" className="scroll-mt-24">
            <LeadForm
              source="Hero — первый экран"
              submitLabel="Получить расчёт"
              withCar={false}
              withContacts
            />
          </div>

          <div className="mt-4 flex items-center gap-2.5 text-[13.5px] text-[#AEB7BE]">
            Возим из:
            {flags.map((f) => (
              <Flag key={f.code} code={f.code} className="h-4 w-6" />
            ))}
          </div>
        </div>

        {/* Мокап сметы под ключ с печатью */}
        <div className="hidden items-center justify-center md:flex">
          <div className="relative">
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 animate-spin-slow rounded-full border border-chrome/15 [border-style:dashed]"
              aria-hidden
            />
            <div className="animate-fade-up">
              <EstimateMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
