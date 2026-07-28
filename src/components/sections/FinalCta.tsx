import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { LeadForm } from "@/components/LeadForm";
import { Button } from "@/components/ui/Button";
import { CarSilhouette } from "@/components/icons/CarSilhouette";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="grain relative overflow-hidden bg-[radial-gradient(900px_440px_at_20%_20%,#27313d_0%,#11151A_60%)] py-[96px] text-white">
      <div className="chrome-line absolute inset-x-0 top-0" />
      <div className="glow-blob left-[10%] top-[10%] h-80 w-80 animate-glow-pan bg-bordeaux/30" aria-hidden />
      <div className="glow-blob right-[8%] bottom-[6%] h-72 w-72 animate-glow-pan bg-steel/20 [animation-delay:-7s]" aria-hidden />
      <CarSilhouette className="pointer-events-none absolute -bottom-6 right-[-40px] w-[480px] animate-float opacity-[0.06]" />

      <div className="wrap relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal direction="right">
          <div className="mb-3 flex items-center gap-3 text-[14px] font-bold uppercase tracking-[0.14em] text-chrome">
            <span className="slash" aria-hidden /> Финальный шаг
          </div>
          <h2 className="text-[clamp(30px,4.4vw,52px)] text-shine">
            Оставьте заявку — пришлём честный расчёт сегодня
          </h2>
          <p className="mt-4 max-w-lg text-[18px] text-[#C7CFD6]">
            Подберём авто под ваш бюджет и покажем реальную цену под ключ в РФ.
            Перезвоним в течение 15 минут.
          </p>
          <div className="mt-6">
            <Button
              href={site.telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              variant="ghost"
            >
              <TelegramIcon className="h-[18px] w-[18px]" />
              Написать в Telegram
            </Button>
          </div>
        </Reveal>

        <Reveal direction="left" delay={120}>
          <div className="glass rounded-card p-6 shadow-glow sm:p-7">
            <LeadForm
              layout="compact"
              tone="dark"
              source="Финальный CTA"
              submitLabel="Оставить заявку"
              withCar={false}
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
