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

const steps = [
  { n: "01", t: "Заявка и бриф", d: "Уточняем бюджет под ключ, класс авто и пожелания." },
  { n: "02", t: "Подбор и проверка", d: "Находим варианты, показываем фото, историю и диагностику." },
  { n: "03", t: "Выкуп и доставка", d: "Выкупаем, готовим к отправке и везём в Россию." },
  { n: "04", t: "Растаможка и выдача", d: "Оформляем документы и передаём готовое к учёту авто." },
];

const team = [
  { name: "[ЗАГЛУШКА: имя]", role: "Основатель · подбор и выкуп" },
  { name: "[ЗАГЛУШКА: имя]", role: "Логистика и таможенное оформление" },
  { name: "[ЗАГЛУШКА: имя]", role: "Менеджер по работе с клиентами" },
];

export function AboutPage() {
  useMeta(
    "О компании ДиАвто69 — импорт авто под ключ",
    "ДиАвто69 — импорт автомобилей из Кореи, Китая, Японии и ЕС под ключ. Честный расчёт с доставкой и растаможкой, работа по договору, полное сопровождение. Тверь, 69 регион.",
  );

  return (
    <main className="bg-paper pb-[96px]">
      {/* Hero */}
      <section className="grain relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-10 pt-[104px] text-white">
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
            <span className="mt-2 block text-[14px] text-[#8C97A1]">
              [ЗАГЛУШКА: добавить 1–2 предложения истории компании — с какого года
              на рынке, сколько авто привезли, чем гордитесь.]
            </span>
          </p>
          <div className="mt-6 flex items-center gap-2.5 text-[14px] text-[#AEB7BE]">
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
      <section className="wrap mt-14">
        <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold uppercase text-ink">
          Почему нам доверяют
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((v) => (
            <div key={v.title} className="rounded-card border border-line bg-white p-6 transition-shadow hover:shadow-card">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-graphite text-chrome">
                <v.icon className="h-6 w-6" />
              </div>
              <h3 className="mb-2 text-[19px] font-extrabold text-ink">{v.title}</h3>
              <p className="text-[14.5px] leading-relaxed text-ink-2">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Как работаем */}
      <section className="wrap mt-14">
        <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold uppercase text-ink">
          Как мы работаем
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div key={s.n} className="rounded-card border border-line bg-white p-6">
              <div className="font-num text-[30px] font-extrabold text-bordeaux/25">{s.n}</div>
              <h3 className="mt-2 text-[18px] font-extrabold text-ink">{s.t}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Команда — заглушки */}
      <section className="wrap mt-14">
        <h2 className="text-[clamp(24px,3vw,36px)] font-extrabold uppercase text-ink">
          Команда
        </h2>
        <p className="mt-2 text-[14px] text-ink-2">
          [ЗАГЛУШКА: пришлите фото и имена сотрудников — заменю карточки ниже.]
        </p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {team.map((m, i) => (
            <div key={i} className="rounded-card border border-line bg-white p-6">
              <div className="mb-4 h-20 w-20 rounded-full bg-gradient-to-br from-graphite-2 to-graphite" aria-hidden />
              <div className="text-[17px] font-extrabold text-ink">{m.name}</div>
              <div className="mt-1 text-[13.5px] text-ink-2">{m.role}</div>
            </div>
          ))}
        </div>
      </section>

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
