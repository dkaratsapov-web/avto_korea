import { useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
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

// import.meta.env.BASE_URL учитывает base из vite.config (на GitHub Pages — /avto_korea/).
// TODO: заменить на фото, на которое у заказчика есть права (см. ТЗ).
const HERO_IMAGE = `${import.meta.env.BASE_URL}hero-bg.webp`;
// Фоновый ролик (необязателен): положите файл в public/hero.mp4 — он подхватится
// автоматически. Пока файла нет, video показывает poster (то же фото HERO_IMAGE).
const HERO_VIDEO = `${import.meta.env.BASE_URL}hero.mp4`;

export function Hero() {
  const ref = useRef<HTMLElement | null>(null);
  const [pointer, setPointer] = useState({ x: 0.5, y: 0.5, active: false });
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
      {/* Фоновый ролик (poster = фото) + затемняющие слои + параллакс.
          Нет reduced-motion → video (если есть hero.mp4, иначе poster);
          reduced-motion → статичное фото. */}
      <div className="absolute inset-0 -z-10">
        {reduce ? (
          <img
            src={HERO_IMAGE}
            alt=""
            aria-hidden
            style={{
              transform: `translate3d(${px * -16}px, ${py * -12}px, 0) scale(1.08)`,
            }}
            className="absolute inset-0 h-full w-full object-cover object-[50%_58%] brightness-[.78] saturate-[.9] transition-transform duration-300 ease-out"
          />
        ) : (
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={HERO_IMAGE}
            aria-hidden
            style={{
              transform: `translate3d(${px * -16}px, ${py * -12}px, 0) scale(1.08)`,
            }}
            className="absolute inset-0 h-full w-full object-cover object-[50%_58%] brightness-[.78] saturate-[.9] transition-transform duration-300 ease-out"
          >
            <source src={HERO_VIDEO} type="video/mp4" />
          </video>
        )}
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

      <div className="wrap grid items-center gap-10 pb-8 pt-[120px] max-md:gap-[18px] max-md:pb-6 max-md:pt-[104px] md:grid-cols-[1.08fr_0.92fr] md:pb-8 md:pt-[140px]">
        <div className="relative z-10 animate-fade-up">
          <div className="mb-[22px] inline-flex items-center gap-3 rounded-full border border-line-dark bg-graphite-2/50 py-2 pl-2 pr-4 text-[13px] font-bold uppercase tracking-[0.14em] text-chrome backdrop-blur-sm">
            <span className="slash" aria-hidden /> Импорт авто под ключ · 69 регион
          </div>

          <h1 className="mb-[18px] text-[clamp(40px,5.4vw,72px)] text-white [text-shadow:0_2px_24px_rgba(0,0,0,.45)]">
            Авто из Кореи,
            <br />
            Китая и Японии
            <br />
            <em className="not-italic text-shine">под ключ</em>
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
            <LeadForm
              source="Hero — первый экран"
              submitLabel="Получить расчёт"
              withContacts
            />
          </div>

          <div className="mt-[26px] flex items-center gap-2.5 text-[14px] text-[#AEB7BE]">
            Возим из:
            {flags.map((f) => (
              <Flag key={f.code} code={f.code} className="h-4 w-6" />
            ))}
          </div>
        </div>

        {/* Мокап сметы под ключ с печатью */}
        <div className="relative z-10 hidden items-center justify-center md:flex">
          <div
            className="relative"
            style={{ transform: `translate(${px * 6}px, ${py * 5}px)` }}
          >
            <div
              className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 animate-spin-slow rounded-full border border-chrome/15 [border-style:dashed]"
              aria-hidden
            />
            <div className="animate-fade-up">
              <EstimateMockup />
            </div>
          </div>
        </div>
      </div>

      {/* Большая кнопка в каталог */}
      <div className="wrap relative z-10 pb-[72px] max-md:pb-12">
        <Link
          to="/catalog"
          className="group flex h-[60px] w-full items-center justify-center gap-3 rounded-[16px] border border-chrome/30 bg-white/[0.06] text-[18px] font-extrabold uppercase tracking-[0.03em] text-white backdrop-blur-sm transition-all duration-300 hover:border-bordeaux-bright hover:bg-bordeaux hover:shadow-[0_10px_30px_-8px_rgba(122,20,16,.6)] sm:h-[64px] sm:text-[20px]"
        >
          Перейти в каталог
          <ArrowRight className="h-6 w-6 transition-transform duration-300 group-hover:translate-x-1.5" />
        </Link>
      </div>
    </section>
  );
}
