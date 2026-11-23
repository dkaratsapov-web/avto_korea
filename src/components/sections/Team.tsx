import { useState } from "react";
import { Phone } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

type Member = (typeof site.team)[number];

function Photo({ member }: { member: Member }) {
  const [broken, setBroken] = useState(false);
  const initials = member.name.trim().slice(0, 1).toUpperCase();
  if (!member.photo || broken) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#232C36,#11151A)]">
        <span className="font-display text-[64px] font-extrabold text-chrome/60">
          {initials}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line
    <img
      src={member.photo}
      alt={member.name}
      loading="lazy"
      onError={() => setBroken(true)}
      className="h-full w-full object-cover transition-transform duration-[700ms] ease-out group-hover:scale-[1.05]"
    />
  );
}

function Card({ member }: { member: Member }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[22px] border border-black/[0.06] bg-white shadow-[0_4px_20px_-10px_rgba(20,25,32,0.25)] transition-[transform,box-shadow] duration-300 hover:-translate-y-2 hover:shadow-[0_34px_60px_-28px_rgba(20,25,32,0.6)]">
      {/* акцент-линия сверху при наведении */}
      <span className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[3px] scale-x-0 bg-gradient-to-r from-bordeaux-deep via-bordeaux-bright to-chrome transition-transform duration-500 group-hover:scale-x-100" />

      {/* Фото — акцент */}
      <div className="relative aspect-[4/5] overflow-hidden">
        <Photo member={member} />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5">
          <h3 className="font-display text-[24px] font-extrabold uppercase leading-none text-white [text-shadow:0_2px_12px_rgba(0,0,0,.5)]">
            {member.name}
          </h3>
          <p className="mt-2 text-[13px] font-semibold leading-snug text-[#DCE2E7]">
            {member.role}
          </p>
        </div>
      </div>

      {/* Контакты */}
      <div className="flex flex-col gap-2.5 p-5">
        <a
          href={member.phoneHref}
          className="flex items-center gap-2.5 text-[15px] font-bold text-ink transition-colors hover:text-bordeaux"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-bordeaux/10 text-bordeaux-bright">
            <Phone className="h-4 w-4" />
          </span>
          {member.phone}
        </a>
        {member.telegramHref ? (
          <a
            href={member.telegramHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 text-[14px] font-semibold text-ink-2 transition-colors hover:text-ink"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] bg-paper">
              <TelegramIcon className="h-[18px] w-[18px]" />
            </span>
            {member.telegram}
          </a>
        ) : null}
      </div>
    </article>
  );
}

export function Team({ dark = false }: { dark?: boolean }) {
  if (!site.team.length) return null;
  return (
    <section
      id="team"
      className={`scroll-mt-20 py-[76px] ${dark ? "bg-graphite text-white" : "bg-paper"}`}
    >
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Команда"
            title="Кто ведёт вашу сделку"
            description="Живые специалисты на каждом этапе — от подбора и логистики до выдачи под ключ."
          />
        </Reveal>
        <Reveal className="mt-10">
          <div className="mx-auto flex max-w-[1160px] flex-wrap justify-center gap-6">
            {site.team.map((m, i) => (
              <div
                key={m.name + m.phone}
                className="w-full animate-fade-up [animation-fill-mode:both] sm:w-[calc(50%-12px)] lg:w-[362px]"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <Card member={m} />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
