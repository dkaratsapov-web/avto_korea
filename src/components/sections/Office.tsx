import { MapPin, Navigation } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

// Блок «Наш офис» с реальным фото шоурума (public/office.jpg).
export function Office() {
  return (
    <section className="bg-paper py-[72px]">
      <div className="wrap grid items-center gap-8 lg:grid-cols-2">
        <Reveal>
          <div className="overflow-hidden rounded-card border border-line shadow-[0_20px_50px_-24px_rgba(20,25,32,0.5)]">
            {/* eslint-disable-next-line */}
            <img
              src={`${import.meta.env.BASE_URL}office.jpg`}
              alt="Офис ДиАвто69 в Твери — подбор, проверка и доставка авто"
              loading="lazy"
              className="w-full object-cover"
            />
          </div>
        </Reveal>

        <Reveal>
          <SectionHeading
            eyebrow="Наш офис"
            title="Приезжайте к нам в Тверь"
            description="Реальный офис и зона выдачи — не онлайн-посредник. Подберём авто, покажем расчёт и оформим сделку лично или удалённо — как удобно."
          />
          <div className="mt-5 flex items-start gap-3 rounded-card border border-line bg-white p-4">
            <MapPin className="mt-0.5 h-5 w-5 flex-none text-bordeaux-bright" />
            <div>
              <div className="text-[12px] font-bold uppercase tracking-wide text-ink-2">Адрес</div>
              <div className="font-bold text-ink">{site.addressFull}</div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={site.mapHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-bordeaux-bright to-bordeaux px-6 py-3 text-[14.5px] font-extrabold uppercase tracking-[0.02em] text-white shadow-[0_10px_26px_-10px_rgba(122,20,16,.6)] transition-transform hover:scale-[1.03]"
            >
              <Navigation className="h-[18px] w-[18px]" /> Построить маршрут
            </a>
            <a
              href={site.map2gisHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-6 py-3 text-[14.5px] font-bold text-ink transition-colors hover:bg-paper"
            >
              Мы в 2ГИС
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
