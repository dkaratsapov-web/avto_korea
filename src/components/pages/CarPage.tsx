import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Check, Heart, Play } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { LeadForm } from "@/components/LeadForm";
import { Button } from "@/components/ui/Button";
import { Flag } from "@/components/icons/Flag";
import {
  EngineIcon,
  MileageIcon,
  GearboxIcon,
  DriveIcon,
} from "@/components/icons/SpecIcons";
import { CarSilhouette } from "@/components/icons/CarSilhouette";
import { formatPrice, type Car } from "@/data/cars";
import { countries, site } from "@/lib/site";
import { useCars } from "@/lib/carsStore";
import { useUI } from "@/lib/ui";
import { carPath, findCarBySlug } from "@/lib/slug";

/** Заголовок и описание страницы — они же уходят в пререндер. */
export function carMeta(car: Car) {
  const country = countries[car.country]?.label ?? "";
  const title = `${car.model} ${car.year} — купить под ключ из ${country} | ДиАвто69`;
  const specs = [
    car.engine,
    car.gearbox,
    car.drive,
    car.mileage,
    car.trim ? `комплектация ${car.trim}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const description = `${car.model} ${car.year} года под ключ до Твери за ${formatPrice(
    car.priceRub,
  )}. ${specs}. Доставка, растаможка и оформление включены — ДиАвто69.`;
  return { title, description };
}

function Spec({ icon, text }: { icon: React.ReactNode; text?: string }) {
  if (!text) return null;
  return (
    <div className="flex items-center gap-2.5 text-[14px] text-ink">
      <span className="text-ink-2">{icon}</span>
      {text}
    </div>
  );
}

export function CarPage() {
  const { slug = "" } = useParams();
  const { cars } = useCars();
  const { isFav, toggleFav } = useUI();
  const car = findCarBySlug(cars, slug);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!car) return;
    const { title, description } = carMeta(car);
    const prevTitle = document.title;
    document.title = title;
    const tag = document.querySelector('meta[name="description"]');
    const prevDesc = tag?.getAttribute("content") ?? "";
    tag?.setAttribute("content", description);
    return () => {
      document.title = prevTitle;
      tag?.setAttribute("content", prevDesc);
    };
  }, [car]);

  if (!car) {
    return (
      <main className="bg-paper pb-24 pt-[140px]">
        <div className="wrap text-center">
          <CarSilhouette className="mx-auto h-24 w-auto text-line" />
          <h1 className="mt-6 text-[26px] font-extrabold uppercase text-ink">
            Автомобиль не найден
          </h1>
          <p className="mt-2 text-[15px] text-ink-2">
            Возможно, он уже продан или адрес изменился.
          </p>
          <Link to="/catalog" className="btn btn-primary mt-6">
            Открыть каталог
          </Link>
        </div>
      </main>
    );
  }

  const country = countries[car.country];
  const fav = isFav(car.id);
  const media = [
    ...(car.video ? [{ type: "video" as const, src: car.video }] : []),
    ...car.images.map((src) => ({ type: "image" as const, src })),
  ];
  const cur = media[idx] ?? media[0];
  const chips = [
    car.isNew ? "Новый" : "С пробегом",
    car.bodyType,
    car.fuelType,
    car.color,
    car.steering ? `${car.steering} руль` : "",
  ].filter(Boolean) as string[];

  return (
    <main className="bg-paper pb-24 pt-[120px]">
      <div className="wrap">
        <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-ink-2">
          <Link to="/" className="transition-colors hover:text-ink">Главная</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to="/catalog" className="transition-colors hover:text-ink">Каталог</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-ink">{car.model}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          {/* Галерея */}
          <div>
            <div className="relative aspect-[4/3] overflow-hidden rounded-card border border-line bg-graphite">
              {cur?.type === "video" ? (
                <video
                  src={cur.src}
                  poster={car.images[0]}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full bg-black object-contain"
                />
              ) : cur ? (
                <img
                  src={cur.src}
                  alt={`${car.model} ${car.year}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <CarSilhouette className="h-1/2 w-auto text-white/15" />
                </div>
              )}
              <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-[12.5px] font-bold text-ink">
                <Flag code={car.country} className="h-4 w-6" /> {country?.label}
              </span>
            </div>

            {media.length > 1 ? (
              <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6">
                {media.map((m, i) => (
                  <button
                    key={m.src + i}
                    type="button"
                    onClick={() => setIdx(i)}
                    aria-label={`Фото ${i + 1}`}
                    className={`relative aspect-[4/3] overflow-hidden rounded-[10px] border transition-colors ${
                      i === idx ? "border-bordeaux" : "border-line hover:border-ink/30"
                    }`}
                  >
                    <img
                      src={m.type === "video" ? car.images[0] : m.src}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {m.type === "video" ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                        <Play className="h-4 w-4 text-white" />
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Данные */}
          <div>
            {car.trim ? (
              <div className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-2">
                {car.trim}
              </div>
            ) : null}
            <h1 className="mt-1 text-[clamp(26px,3vw,38px)] font-extrabold uppercase leading-none text-ink">
              {car.model}
            </h1>
            <div className="mt-2 text-[14.5px] font-semibold text-ink-2">
              {car.year} год · {car.mileage}
            </div>
            {car.addedAt ? (
              <div className="mt-1 text-[12.5px] text-ink-2">
                В каталоге с {new Date(car.addedAt).toLocaleDateString("ru-RU")}
              </div>
            ) : null}

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-card border border-line bg-white p-4">
              <Spec icon={<EngineIcon />} text={car.engine} />
              <Spec icon={<MileageIcon />} text={car.mileage} />
              <Spec icon={<GearboxIcon />} text={car.gearbox} />
              <Spec icon={<DriveIcon />} text={car.drive} />
            </div>

            {car.description ? (
              <p className="mt-5 text-[14.5px] leading-relaxed text-ink-2">
                {car.description}
              </p>
            ) : null}

            {car.highlights.length ? (
              <ul className="mt-5 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {car.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-2 text-[13.5px] text-ink-2">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-success" />
                    {h}
                  </li>
                ))}
              </ul>
            ) : null}

            {chips.length ? (
              <div className="mt-5 flex flex-wrap gap-2">
                {chips.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-ink-2"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-card border border-line bg-white p-4">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-2">
                  Под ключ до Твери
                </div>
                <div className="font-num text-[24px] font-bold text-bordeaux">
                  {formatPrice(car.priceTverRub ?? car.priceRub)}
                </div>
              </div>
              {car.priceMoscowRub ? (
                <div className="rounded-card border border-line bg-white p-4">
                  <div className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-2">
                    Под ключ до Москвы
                  </div>
                  <div className="font-num text-[24px] font-bold text-ink">
                    {formatPrice(car.priceMoscowRub)}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="ghost"
                onClick={() => toggleFav(car.id)}
                className="border border-line"
              >
                <Heart className={`h-[18px] w-[18px] ${fav ? "fill-bordeaux text-bordeaux" : ""}`} />
                {fav ? "В избранном" : "В избранное"}
              </Button>
              <a
                href={site.telegramHref}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                <TelegramIcon className="h-[18px] w-[18px]" /> Спросить в Telegram
              </a>
            </div>
          </div>
        </div>

        {/* Заявка по этому авто */}
        <section className="mt-12 rounded-card border border-line bg-graphite p-6 text-white sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="lg:max-w-sm">
              <h2 className="text-[22px] font-extrabold uppercase">
                Запросить расчёт по этому авто
              </h2>
              <p className="mt-2 text-[14px] text-[#9AA4B2]">
                Оставьте имя и телефон — перезвоним в течение 15 минут и назовём
                финальную цену под ключ.
              </p>
            </div>
            <div className="w-full lg:max-w-xl">
              <LeadForm
                source={`Карточка авто: ${car.model} ${car.year}`}
                submitLabel="Запросить"
                withCar={false}
                withContacts
                bare
              />
            </div>
          </div>
        </section>

        <div className="mt-10">
          <Link to="/catalog" className="text-[14px] font-bold text-bordeaux hover:underline">
            ← Вернуться в каталог
          </Link>
        </div>
      </div>
    </main>
  );
}

export { carPath };
