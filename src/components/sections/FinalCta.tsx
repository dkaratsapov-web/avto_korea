import { Send } from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { Button } from "@/components/ui/Button";
import { CarSilhouette } from "@/components/icons/CarSilhouette";
import { site } from "@/lib/site";

export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(900px_440px_at_20%_20%,#27313d_0%,#11151A_60%)] py-[84px] text-white">
      <div className="chrome-line absolute inset-x-0 top-0" />
      <CarSilhouette className="pointer-events-none absolute -bottom-6 right-[-40px] w-[480px] opacity-[0.06]" />

      <div className="wrap relative grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="mb-3 flex items-center gap-3 text-[14px] font-bold uppercase tracking-[0.14em] text-chrome">
            <span className="slash" aria-hidden /> Финальный шаг
          </div>
          <h2 className="text-[clamp(30px,4.4vw,52px)] text-white">
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
              <Send className="h-[18px] w-[18px]" />
              Написать в Telegram
            </Button>
          </div>
        </div>

        <div className="rounded-card border border-line-dark bg-white/[0.04] p-6 sm:p-7">
          <LeadForm
            layout="compact"
            tone="dark"
            source="Финальный CTA"
            submitLabel="Получить расчёт"
          />
        </div>
      </div>
    </section>
  );
}
