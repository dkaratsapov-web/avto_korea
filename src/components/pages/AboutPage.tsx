import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ChevronRight,
  ShieldCheck,
  HandCoins,
  Search,
  FileCheck2,
  Truck,
  Users,
} from "lucide-react";
import { LeadForm } from "@/components/LeadForm";
import { Flag } from "@/components/icons/Flag";
import { Team } from "@/components/sections/Team";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Faq } from "@/components/sections/Faq";
import { Reveal } from "@/components/ui/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { HeroBackdrop } from "@/components/ui/HeroBackdrop";
import { site } from "@/lib/site";

// СТРАНИЦА-ЧЕРНОВИК. Места с [ЗАГЛУШКА] заполнит заказчик — они помечены на странице.
function useMeta(title: string, description: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    const tag = document.querySelector('meta[name="description"]');
    const prevDesc = tag?.getAttribute("content") ?? "";
    if (tag) tag.setAttribute("content", description);
    return () => {
      document.title = prev;
      if (tag) tag.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}

const values = [
  { icon: HandCoins, title: "Честная цена под ключ", text: "Раскладываем стоимость на составляющие и фиксируем в договоре — без доплат в процессе." },
  { icon: Search, title: "Проверка до выкупа", text: "Осмотр, диагностика и история автомобиля до того, как за него внесены деньги." },
  { icon: ShieldCheck, title: "Работаем по договору", text: "Прописанные сроки и зоны ответственности. Официально, без «серых» схем." },
  { icon: FileCheck2, title: "Все документы на нас", text: "Растаможка, утильсбор, ЭПТС и помощь с постановкой на учёт в ГИБДД." },
  { icon: Truck, title: "Полное сопровождение", text: "Ведём от заявки до выдачи ключей: подбор, торг, выкуп, доставка." },
  { icon: Users, title: "На связи на каждом шаге", text: "Показываем фото и статусы, отвечаем на вопросы до и после сделки." },
];

export function AboutPage() {
  useMeta(
    "О компании ДиАвто69 — импорт авто под ключ",
    "ДиАвто69 — импорт автомобилей из Кореи, Китая, Японии и ЕС под ключ. Честный расчёт с доставкой и растаможкой, работа по договору, полное сопровождение. Тверь, 69 регион.",
  );

  return (
    <main className="bg-paper pb-[96px]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-10 pt-[104px] text-white">
        <HeroBackdrop />
        <div className="wrap relative">
          <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">О нас</span>
          </nav>
          <div className="mb-2 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <span className="slash" aria-hidden /> О компании
          </div>
          <h1 className="max-w-3xl text-[clamp(28px,3.8vw,50px)] leading-[1.04] text-shine">
            ДиАвто69 — импорт авто под ключ честно и прозрачно
          </h1>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-[#C7CFD6]">
            Помогаем купить автомобиль из Кореи, Китая, Японии и ЕС с доставкой и
            растаможкой под ключ. Берём на себя весь процесс — от подбора до
            постановки на учёт — и показываем реальную цену без скрытых наценок.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Работаем по договору", "Растаможка под ключ", "Полное сопровождение"].map(
              (t) => (
                <span
                  key={t}
                  className="rounded-full border border-line-dark bg-white/[0.05] px-3.5 py-1.5 text-[13px] font-semibold text-[#DCE2E7]"
                >
                  {t}
                </span>
              ),
            )}
          </div>
          <div className="mt-5 flex items-center gap-2.5 text-[14px] text-[#AEB7BE]">
            Возим из:
            <Flag code="kr" className="h-4 w-6" />
            <Flag code="cn" className="h-4 w-6" />
            <Flag code="jp" className="h-4 w-6" />
            <Flag code="eu" className="h-4 w-6" />
          </div>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      {/* Ценности */}
      <section className="wrap mt-16">
        <Reveal>
          <SectionHeading
            eyebrow="Почему мы"
            title="Почему нам доверяют"
            description="Прозрачность и ответственность на каждом шаге — от первого расчёта до выдачи ключей."
          />
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((v, i) => (
            <div
              key={v.title}
              className="group relative animate-fade-up overflow-hidden rounded-card border border-line bg-white p-6 [animation-fill-mode:both] transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-[0_28px_54px_-26px_rgba(20,25,32,0.5)]"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              <span className="pointer-events-none absolute inset-x-0 top-0 h-[3px] scale-x-0 bg-gradient-to-r from-bordeaux-deep via-bordeaux-bright to-chrome transition-transform duration-500 group-hover:scale-x-100" />
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-graphite text-chrome transition-colors duration-300 group-hover:bg-bordeaux group-hover:text-white">
                <v.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-[19px] font-extrabold text-ink">{v.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-ink-2">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Как это работает */}
      <HowItWorks />

      {/* Команда */}
      <Team />

      {/* Вопросы и ответы */}
      <Faq />

      {/* Реквизиты + форма — рядом, по половине экрана */}
      <section className="wrap mt-14 grid items-stretch gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-white p-6">
          <h2 className="text-[20px] font-extrabold uppercase text-ink">Реквизиты</h2>
          <div className="mt-3 grid gap-x-8 gap-y-2 text-[14px] text-ink-2 sm:grid-cols-2">
            <div className="sm:col-span-2">Организация: <b className="text-ink">{site.requisites.nameFull}</b></div>
            <div>ИНН: <b className="text-ink">{site.requisites.inn}</b></div>
            <div>ОГРНИП: <b className="text-ink">{site.requisites.ogrnip}</b></div>
            <div>Телефон: <b className="text-ink">{site.phone}</b></div>
            <div>E-mail: <b className="text-ink">{site.email}</b></div>
            <div>Расчётный счёт: <b className="text-ink">{site.requisites.account}</b></div>
            <div>Банк: <b className="text-ink">{site.requisites.bank}</b></div>
            <div>БИК: <b className="text-ink">{site.requisites.bik}</b></div>
            <div>Корр. счёт: <b className="text-ink">{site.requisites.corrAccount}</b></div>
            <div>ИНН банка: <b className="text-ink">{site.requisites.bankInn}</b></div>
            <div className="sm:col-span-2">Адрес банка: <b className="text-ink">{site.requisites.bankAddress}</b></div>
          </div>
        </div>

        <div className="flex flex-col justify-center rounded-card border border-line bg-graphite p-6 text-white sm:p-8">
          <h2 className="text-[24px] font-extrabold uppercase text-white">
            Готовы подобрать ваше авто
          </h2>
          <p className="mb-6 mt-2 max-w-xl text-[14px] text-[#9AA4B2]">
            Оставьте заявку — покажем реальную цену под ключ с доставкой и
            растаможкой и ответим на все вопросы.
          </p>
          <LeadForm source="Страница «О нас»" submitLabel="Получить расчёт" withCar={false} withContacts />
        </div>
      </section>
    </main>
  );
}
