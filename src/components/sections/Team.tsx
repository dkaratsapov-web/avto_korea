import { useState } from "react";
import { Phone } from "lucide-react";
import { TelegramIcon } from "@/components/icons/TelegramIcon";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Reveal } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

type Member = (typeof site.team)[number];

function Avatar({ member }: { member: Member }) {
  const [broken, setBroken] = useState(false);
  const initials = member.name.trim().slice(0, 1).toUpperCase();
  if (!member.photo || broken) {
    return (
      <div className="flex aspect-[4/5] w-full items-center justify-center bg-[linear-gradient(160deg,#232C36,#11151A)]">
        <span className="font-display text-[52px] font-extrabold text-chrome/70">
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
      className="aspect-[4/5] w-full object-cover"
    />
  );
}

function Card({ member }: { member: Member }) {
  return (
    <article className="group overflow-hidden rounded-card border border-line bg-white shadow-[0_2px_12px_-6px_rgba(20,25,32,0.18)] transition-shadow hover:shadow-card">
      <div className="relative overflow-hidden">
        <Avatar member={member} />
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
      </div>
      <div className="p-5">
        <h3 className="font-display text-[19px] font-extrabold leading-tight text-ink">
          {member.name}
        </h3>
        <p className="mt-1 text-[13.5px] leading-snug text-ink-2">{member.role}</p>
        <div className="mt-4 flex flex-col gap-2 border-t border-line pt-4">
          <a
            href={member.phoneHref}
            className="flex items-center gap-2 text-[14.5px] font-bold text-ink transition-colors hover:text-bordeaux"
          >
            <Phone className="h-4 w-4 flex-none text-bordeaux-bright" />
            {member.phone}
          </a>
          {member.telegramHref ? (
            <a
              href={member.telegramHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[13.5px] font-semibold text-ink-2 transition-colors hover:text-ink"
            >
              <TelegramIcon className="h-4 w-4 flex-none" />
              {member.telegram}
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function Team({ dark = false }: { dark?: boolean }) {
  if (!site.team.length) return null;
  return (
    <section
      id="team"
      className={`scroll-mt-20 py-[72px] ${dark ? "bg-graphite text-white" : "bg-paper"}`}
    >
      <div className="wrap">
        <Reveal>
          <SectionHeading
            eyebrow="Команда"
            title="Кто ведёт вашу сделку"
            description="Живые специалисты на каждом этапе — от подбора и логистики до выдачи под ключ."
          />
        </Reveal>
        <Reveal className="mt-9">
          <div className="flex flex-wrap justify-center gap-5">
            {site.team.map((m) => (
              <div key={m.name + m.phone} className="w-full sm:w-[330px]">
                <Card member={m} />
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
