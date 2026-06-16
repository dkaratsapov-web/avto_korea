import { LeadForm } from "@/components/LeadForm";

const badges = [
  { strong: "15 мин", rest: " — расчёт под ключ" },
  { strong: "30–45", rest: " дней доставка" },
  { pre: "Цена ", strong: "с растаможкой" },
];

const flags = [
  { flag: "🇰🇷", title: "Корея" },
  { flag: "🇨🇳", title: "Китай" },
  { flag: "🇯🇵", title: "Япония" },
  { flag: "🇪🇺", title: "ЕС" },
];

// import.meta.env.BASE_URL учитывает base из vite.config (на GitHub Pages — /avto_korea/).
// TODO: заменить на фото, на которое у заказчика есть права (см. ТЗ).
const HERO_IMAGE = `${import.meta.env.BASE_URL}hero-bg.jpg`;

export function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-graphite text-white after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-[3px] after:bg-[linear-gradient(90deg,transparent,#5C6D76,#AEBAC2,#5C6D76,transparent)] after:content-['']"
    >
      {/* Фоновое фото + затемняющие слои для читаемости */}
      <div className="absolute inset-0 -z-10">
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-[50%_58%] brightness-[.82] saturate-[.9]"
        />
        {/* общий тон */}
        <div className="absolute inset-0 bg-graphite/45" />
        {/* затемнение слева под текст */}
        <div className="absolute inset-0 bg-gradient-to-r from-graphite via-graphite/85 to-graphite/45" />
        {/* блендинг сверху и снизу */}
        <div className="absolute inset-0 bg-gradient-to-t from-graphite via-transparent to-graphite/60" />
      </div>

      <div className="wrap grid items-center gap-10 py-[60px] max-md:gap-[18px] max-md:py-[48px] md:grid-cols-[1.05fr_0.95fr] md:py-[80px] md:pb-[96px]">
        <div className="animate-fade-up">
          <div className="mb-[22px] flex items-center gap-3 text-[14px] font-bold uppercase tracking-[0.14em] text-chrome">
            <span className="slash" aria-hidden /> Импорт авто под ключ · 69 регион
          </div>

          <h1 className="mb-[18px] text-[clamp(40px,5.4vw,72px)] text-white [text-shadow:0_2px_24px_rgba(0,0,0,.45)]">
            Авто из Кореи,
            <br />
            Китая и Японии
            <br />
            <em className="not-italic text-bordeaux-bright">под ключ</em>
          </h1>

          <p className="mb-[26px] max-w-[520px] text-[19px] text-[#D2D9DF]">
            Считаем честно и показываем реальную цену с доставкой и растаможкой —
            без скрытых наценок.
          </p>

          <div className="mb-[30px] flex flex-wrap gap-2.5">
            {badges.map((b, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 rounded-full border border-line-dark bg-graphite-2/60 px-[14px] py-[9px] text-[14px] font-semibold text-[#DCE2E7] backdrop-blur-sm"
              >
                {b.pre}
                <b className="text-chrome">{b.strong}</b>
                {b.rest}
              </span>
            ))}
          </div>

          <div id="hero-form" className="scroll-mt-24">
            <LeadForm source="Hero — первый экран" submitLabel="Получить расчёт" />
          </div>

          <div className="mt-[26px] flex items-center gap-2.5 text-[14px] text-[#AEB7BE]">
            Возим из:
            {flags.map((f) => (
              <span key={f.title} title={f.title} className="text-[22px]">
                {f.flag}
              </span>
            ))}
          </div>
        </div>

        {/* Плавающий прайс-чип поверх фото */}
        <div className="relative hidden min-h-[320px] items-center justify-center md:flex">
          <div className="relative w-full max-w-[520px]">
            {/* хром-овал — фирменный акцент */}
            <div className="absolute left-1/2 top-1/2 h-[260px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-chrome/20 bg-chrome/[0.03]" />
            <div className="absolute right-[4%] top-[12%] rotate-[1deg] rounded-[14px] bg-white px-4 py-3 text-ink shadow-chip">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-2">
                под ключ от
              </div>
              <div className="font-num text-[24px] font-bold text-bordeaux">
                2 190 000 ₽
              </div>
            </div>
            <div className="absolute bottom-[14%] left-[2%] rotate-[-1deg] rounded-[14px] border border-line-dark bg-graphite-2/80 px-4 py-3 backdrop-blur-md">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-chrome">
                расчёт
              </div>
              <div className="font-num text-[20px] font-bold text-white">
                за 15 минут
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
