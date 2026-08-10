import { ArrowRight, ScanLine } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { MaxIcon } from "@/components/icons/MaxIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";
import { GOALS, reachGoal } from "@/lib/metrika";

/**
 * Наши каналы: переход в Telegram и MAX.
 *
 * QR-коды лежат статикой в /public и ведут на те же адреса, что и кнопки.
 * Если ссылки на каналы в site.ts поменяются, коды надо перевыпустить:
 *   npx qrcode -t svg -o public/qr-telegram.svg "<ссылка>"
 * На телефоне QR бесполезен — там показываем только кнопку.
 */
const channels = [
  {
    key: "tg",
    name: "Telegram",
    href: site.telegramChannelHref,
    goal: GOALS.telegramChannel,
    qr: "/qr-telegram.svg",
    text: "Новые поступления, цены под ключ и обзоры привезённых авто.",
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
    text: "Тот же каталог и расчёты в российском мессенджере — без VPN.",
    icon: <MaxIcon className="h-7 w-7" />,
    accent: "bg-ink text-white shadow-[0_14px_34px_-16px_rgba(17,21,26,0.8)]",
    ring: "group-hover:border-[#7B4DFF]/40",
  },
];

export function Channels() {
  return (
    <section className="bg-paper py-14 sm:py-16">
      <div className="wrap">
        <SectionHeading
          eyebrow="Наши каналы"
          title="Новые авто — в Telegram и MAX"
          description="Публикуем свежие поступления с ценой под ключ раньше, чем они попадают в каталог."
          align="center"
          className="max-w-3xl"
        />

        <div className="mt-9 grid gap-4 md:grid-cols-2 md:gap-5">
          {channels.map((c, i) => (
            <Reveal key={c.key} direction="up" delay={i * 90}>
              <article className="group flex h-full items-center gap-5 rounded-card border border-line bg-white p-5 transition-colors hover:border-line/80 sm:gap-6 sm:p-6">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    {c.icon}
                    <h3 className="text-[19px] font-extrabold uppercase leading-none text-ink">
                      {c.name}
                    </h3>
                  </div>
                  <p className="mt-3 text-[14.5px] leading-relaxed text-ink-2">
                    {c.text}
                  </p>
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => reachGoal(c.goal, { place: "Блок каналов" })}
                    className={`btn mt-5 w-full sm:w-auto ${c.accent}`}
                  >
                    Перейти в {c.name}
                    <ArrowRight className="h-[18px] w-[18px]" />
                  </a>
                </div>

                {/* QR — только для десктопа: с телефона его некому сканировать. */}
                <div className="hidden w-[152px] shrink-0 text-center lg:block">
                  <div
                    className={`rounded-2xl border border-line bg-white p-2.5 transition-colors ${c.ring}`}
                  >
                    <img
                      src={c.qr}
                      alt={`QR-код: канал ${c.name}`}
                      width={132}
                      height={132}
                      className="h-[132px] w-[132px]"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <span className="mt-2 flex items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.06em] text-ink-2">
                    <ScanLine className="h-3 w-3 flex-none" />
                    Наведите камеру
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
