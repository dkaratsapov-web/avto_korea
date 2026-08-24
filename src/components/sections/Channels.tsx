import { ArrowRight, Bot } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Наши каналы: Telegram, MAX и бот.
 *
 * Бот стоит третьим и последним намеренно. Каналы — это подписка «на потом»,
 * а бот отвечает прямо сейчас: показывает каталог и считает цену без
 * менеджера. Кто дочитал до этого блока и всё ещё выбирает, тому нужен
 * именно он, поэтому у бота фирменный красный, а не блёклый — он должен
 * выделяться среди двух мессенджеров.
 *
 * QR-коды лежат статикой в /public и ведут на те же адреса, что и кнопки.
 * Если ссылки в site.ts поменяются, коды надо перевыпустить:
 *   npx qrcode -t svg -o public/qr-telegram.svg "<ссылка>"
 * и обязательно проверить, что в картинке действительно новый адрес.
 * На телефоне QR бесполезен — там показываем только кнопку.
 */
const channels = [
  {
    key: "tg",
    name: "Telegram",
    href: site.telegramChannelHref,
    goal: GOALS.telegramChannel,
    qr: "/qr-telegram.svg",
    cta: "Перейти в Telegram",
    icon: <TelegramIcon className="h-7 w-7" />,
    // Фирменный синий Telegram.
    accent:
      "bg-[#229ED9] text-white shadow-[0_14px_34px_-16px_rgba(34,158,217,0.9)]",
    ring: "group-hover:border-[#229ED9]/40",
  },
  {
    key: "max",
    name: "MAX",
    href: site.maxChannelHref,
    goal: GOALS.maxChannel,
    qr: "/qr-max.svg",
    cta: "Перейти в MAX",
    icon: <MaxIcon className="h-7 w-7" />,
    accent: "bg-ink text-white shadow-[0_14px_34px_-16px_rgba(17,21,26,0.8)]",
    ring: "group-hover:border-[#7B4DFF]/40",
  },
  {
    key: "bot",
    name: "Наш бот",
    href: site.botHref,
    goal: GOALS.bot,
    qr: "/qr-bot.svg",
    cta: "Открыть бота",
    icon: <Bot className="h-7 w-7 text-bordeaux" />,
    // Фирменный красный: бот — не третий мессенджер, а способ получить
    // ответ сразу, и глазом он должен читаться иначе, чем два канала.
    accent:
      "bg-gradient-to-b from-bordeaux-bright to-bordeaux text-white shadow-[0_14px_34px_-16px_rgba(122,20,16,0.9)]",
    ring: "group-hover:border-bordeaux/40",
  },
];

export function Channels() {
  return (
    <section className="bg-paper py-14 sm:py-16">
      <div className="wrap">
        <SectionHeading
          eyebrow="Наши каналы"
          title="Новые авто — в Telegram, MAX и боте"
          description="В каналах публикуем свежие поступления с ценой под ключ раньше, чем они попадают в каталог. В боте — весь каталог с фильтрами и расчёт под ваш бюджет, без звонка менеджеру."
          align="center"
          className="max-w-3xl"
        />

        {/* До планшета — в столбик, на планшете по две (третья во всю
            ширину), от ноутбука — три в ряд.

            Колонка расширена с 3xl до 6xl: на трёх карточках прежней ширины
            не хватало, и надпись «Перейти в Telegram» обрезалась — ей нужно
            194 px, а оставалось 172. Замерено, не на глаз. */}
        <div className="mx-auto mt-8 grid max-w-6xl gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          {channels.map((c, i) => (
            <Reveal key={c.key} direction="up" delay={i * 90}>
              <article className="group flex h-full items-center gap-4 rounded-card border border-line bg-white p-4 transition-colors hover:border-line/80">
                <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                  <div className="flex items-center gap-2">
                    {c.icon}
                    <h3 className="text-[17px] font-extrabold uppercase leading-none text-ink">
                      {c.name}
                    </h3>
                  </div>
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => reachGoal(c.goal, { place: "Блок каналов" })}
                    className={`btn !min-h-0 w-full !px-4 !py-3 text-[14px] ${c.accent}`}
                  >
                    {c.cta}
                    <ArrowRight className="h-4 w-4 flex-none" />
                  </a>
                </div>

                {/* QR — только для широкого экрана: с телефона его некому
                    сканировать, а на ноутбуке в три колонки он съедает ту
                    самую ширину, которой не хватает надписи на кнопке.
                    Порог поднят с lg до xl именно поэтому. */}
                <div
                  className={`hidden shrink-0 rounded-xl border border-line p-1.5 transition-colors xl:block ${c.ring}`}
                >
                  <img
                    src={c.qr}
                    alt={`QR-код: ${c.name}`}
                    width={96}
                    height={96}
                    className="h-24 w-24"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
