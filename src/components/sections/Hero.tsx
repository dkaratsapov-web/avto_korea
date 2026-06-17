import { useRef, useState, type PointerEvent } from "react";
import { Clock, Truck, Globe2, ArrowRight } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { ParticleHeadline } from "@/components/ui/particle-text-effect";

const HEADLINE_LINES = ["Авто из Кореи,", "Китая и Японии", "под ключ"];

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

export function Hero({ start = true }: { start?: boolean }) {
  const ref = useRef<HTMLElement | null>(null);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5, active: false });
  const [reduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [assembled, setAssembled] = useState(reduced);

  function onMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPointer({
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
      active: true,
    });
  }

  const px = (pointer.x - 0.5) * 2; // -1..1
  const py = (pointer.y - 0.5) * 2;

  return (
    <section
      id="top"
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => setPointer((p) => ({ ...p, active: false }))}
      className="relative isolate overflow-hidden bg-graphite text-white after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-[3px] after:bg-[linear-gradient(90deg,transparent,#5C6D76,#AEBAC2,#5C6D76,transparent)] after:content-['']"
    >
      {/* Фоновое фото + затемняющие слои + параллакс */}
      <div className="absolute inset-0 -z-10">
        <img
          src={HERO_IMAGE}
          alt=""
          aria-hidden
          style={{
            transform: `translate3d(${px * -16}px, ${py * -12}px, 0) scale(1.08)`,
          }}
          className="absolute inset-0 h-full w-full object-cover object-[50%_58%] brightness-[.78] saturate-[.9] transition-transform duration-300 ease-out"
        />
        <div className="absolute inset-0 bg-graphite/50" />
        <div className="absolute inset-0 bg-gradient-to-r from-graphite via-graphite/80 to-graphite/55" />
        <div className="absolute inset-0 bg-gradient-to-t from-graphite via-transparent to-graphite/60" />
        {/* световое пятно-прожектор за курсором */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: pointer.active ? 1 : 0,
            background: `radial-gradient(420px circle at ${pointer.x * 100}% ${pointer.y * 100}%, rgba(174,186,194,.16), transparent 60%)`,
          }}
          aria-hidden
        />
        <div className="glow-blob right-[12%] top-[12%] h-72 w-72 animate-glow-pan bg-bordeaux/25" aria-hidden />
        <div className="glow-blob left-[2%] bottom-[6%] h-72 w-72 animate-glow-pan bg-steel/15 [animation-delay:-6s]" aria-hidden />
        <div className="grain absolute inset-0" aria-hidden />
      </div>

      <div className="wrap grid items-center gap-10 pb-[64px] pt-[120px] max-md:gap-[18px] max-md:pb-[56px] max-md:pt-[104px] md:grid-cols-[1.08fr_0.92fr] md:pb-[100px] md:pt-[140px]">
        <div className="relative z-10 animate-fade-up">
          <div className="mb-[22px] inline-flex items-center gap-3 rounded-full border border-line-dark bg-graphite-2/50 py-2 pl-2 pr-4 text-[13px] font-bold uppercase tracking-[0.14em] text-chrome backdrop-blur-sm">
            <span className="slash" aria-hidden /> Импорт авто под ключ · 69 регион
          </div>

          <div className="relative mb-[18px]">
            <h1
              className={`text-[clamp(40px,5.4vw,72px)] text-white transition-opacity duration-700 [text-shadow:0_2px_24px_rgba(0,0,0,.45)] ${
                assembled ? "opacity-100" : "opacity-0"
              }`}
            >
              Авто из Кореи,
              <br />
              Китая и Японии
              <br />
              <em className="not-italic text-shine">под ключ</em>
            </h1>
            {!reduced && !assembled ? (
              <ParticleHeadline
                className="pointer-events-none absolute inset-0"
                lines={HEADLINE_LINES}
                accentIndex={2}
                start={start}
                onDone={() => setAssembled(true)}
              />
            ) : null}
          </div>

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

        {/* Карточка-оффер */}
        <div className="relative z-10 hidden items-center justify-end md:flex">
          <div
            className="relative w-full max-w-[400px]"
            style={{ transform: `translate(${px * 6}px, ${py * 5}px)` }}
          >
            {/* фирменный хром-акцент */}
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 animate-spin-slow rounded-full border border-chrome/15 [border-style:dashed]"
              aria-hidden
            />
            <div className="glass animate-fade-up rounded-card p-7 shadow-glow">
              <div className="flex items-center gap-3 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
                <span className="slash" aria-hidden /> Цена под ключ
              </div>

              <div className="mt-5 text-[12px] font-bold uppercase tracking-[0.1em] text-[#9AA4B2]">
                под ключ от
              </div>
              <div className="font-num text-[clamp(34px,4.4vw,46px)] font-bold leading-none text-bordeaux-bright">
                2 190 000 ₽
              </div>

              <div className="chrome-line my-5 opacity-60" />

              <ul className="space-y-3.5">
                <OfferRow icon={<Globe2 className="h-5 w-5" />}>
                  Корея · Китай · Япония · ЕС
                </OfferRow>
                <OfferRow icon={<Clock className="h-5 w-5" />}>
                  Честный расчёт за 15 минут
                </OfferRow>
                <OfferRow icon={<Truck className="h-5 w-5" />}>
                  Доставка 30–45 дней, с растаможкой
                </OfferRow>
              </ul>

              <a
                href="#catalog"
                className="btn btn-primary mt-6 w-full"
              >
                Смотреть наличие
                <ArrowRight className="h-[18px] w-[18px]" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* индикатор прокрутки */}
      <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 hidden justify-center md:flex">
        <div className="flex h-9 w-6 items-start justify-center rounded-full border border-chrome/40 p-1.5">
          <span className="h-2 w-1 animate-scroll-cue rounded-full bg-chrome" />
        </div>
      </div>
    </section>
  );
}

function OfferRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 text-[14.5px] font-semibold text-[#C7CFD6]">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[11px] bg-white/[0.06] text-chrome">
        {icon}
      </span>
      {children}
    </li>
  );
}
