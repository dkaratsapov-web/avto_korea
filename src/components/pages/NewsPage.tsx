import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, CalendarDays, Truck, KeyRound, Ship, Camera, Play } from "lucide-react";
import { fetchNews, type NewsItem } from "@/lib/api";

function useMeta(title: string, description: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    const tag = document.querySelector('meta[name="description"]');
    const prevDesc = tag?.getAttribute("content") ?? "";
    if (tag) tag.setAttribute("content", description);
    window.scrollTo({ top: 0 });
    return () => {
      document.title = prev;
      if (tag) tag.setAttribute("content", prevDesc);
    };
  }, [title, description]);
}

// ЗАГЛУШКИ: сюда будут сгружаться реальные новости о привозе/выдаче авто.
// Позже подключим авто-наполнение из Telegram-канала (как отзывы/каталог).
const posts = [
  {
    icon: Ship,
    tag: "Привоз",
    title: "[ЗАГЛУШКА] Новая партия авто из Китая в пути",
    excerpt:
      "Здесь будет краткое описание партии: какие модели, ориентир по срокам прибытия и растаможки.",
  },
  {
    icon: KeyRound,
    tag: "Выдача",
    title: "[ЗАГЛУШКА] Выдали клиенту авто под ключ",
    excerpt:
      "Фото/видео выдачи, модель, срок доставки от заявки до ключей, отзыв клиента.",
  },
  {
    icon: Truck,
    tag: "Логистика",
    title: "[ЗАГЛУШКА] Как проходит доставка до Твери",
    excerpt:
      "Этапы маршрута, сроки, что происходит на каждом шаге — с реальными фото процесса.",
  },
  {
    icon: Camera,
    tag: "Осмотр",
    title: "[ЗАГЛУШКА] Осмотр авто перед выкупом",
    excerpt:
      "Проверка состояния, пробега и истории до покупки — показываем, что берём только проверенное.",
  },
];

function fmtDate(ts: number) {
  try {
    return new Date(ts).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

export function NewsPage() {
  useMeta(
    "Новости ДиАвто69 — привоз и выдача авто",
    "Новости ДиАвто69: привоз автомобилей из Кореи, Китая и Японии, доставка, растаможка и выдача клиентам под ключ. Фото и видео процесса.",
  );

  const [news, setNews] = useState<NewsItem[] | null>(null);
  useEffect(() => {
    fetchNews().then(setNews).catch(() => {});
  }, []);
  const hasNews = news && news.length > 0;

  return (
    <main className="bg-paper pb-[96px]">
      <section className="grain relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-8 pt-[104px] text-white">
        <div className="wrap relative">
          <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">Новости</span>
          </nav>
          <div className="mb-2 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <span className="slash" aria-hidden /> Блог · Новости
          </div>
          <h1 className="text-[clamp(28px,3.6vw,46px)] leading-[1.05] text-shine">
            Привоз, доставка и выдача авто
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[#C7CFD6]">
            Показываем работу изнутри: новые партии из Китая, Кореи и Японии,
            этапы доставки и растаможки, выдачу автомобилей клиентам — с фото и видео.
          </p>
        </div>
      </section>

      <section className="wrap mt-10">
        {hasNews ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {news!.map((n) => (
              <article
                key={n.id}
                className="flex flex-col overflow-hidden rounded-card border border-line bg-white transition-shadow hover:shadow-card"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-graphite">
                  {n.video ? (
                    <video
                      src={n.video}
                      poster={n.media}
                      controls
                      playsInline
                      preload="metadata"
                      className="h-full w-full bg-black object-contain"
                    />
                  ) : n.media ? (
                    // eslint-disable-next-line
                    <img src={n.media} alt={n.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(160deg,#232C36,#11151A)] text-chrome/60">
                      <Play className="h-9 w-9" />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="mb-2 flex items-center gap-1 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-2">
                    <CalendarDays className="h-3.5 w-3.5" /> {fmtDate(n.ts)}
                  </div>
                  <h2 className="text-[16px] font-extrabold leading-snug text-ink">{n.title}</h2>
                  {n.text ? (
                    <p className="mt-2 flex-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-2">
                      {n.text}
                    </p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <>
            <div className="mb-5 rounded-card border border-dashed border-line bg-white px-5 py-4 text-[13.5px] text-ink-2">
              Раздел готовится к наполнению — скоро здесь появятся реальные новости
              о привозе и выдаче авто из нашего Telegram-канала.
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2">
              {posts.map(({ icon: Icon, tag, title, excerpt }, i) => (
                <article
                  key={i}
                  className="group flex overflow-hidden rounded-card border border-line bg-white transition-shadow hover:shadow-card"
                >
                  <div className="flex w-[38%] flex-none items-center justify-center bg-[linear-gradient(160deg,#232C36,#11151A)] text-chrome/70">
                    <Icon className="h-10 w-10" />
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.06em]">
                      <span className="rounded-full bg-bordeaux/10 px-2.5 py-0.5 text-bordeaux">{tag}</span>
                      <span className="flex items-center gap-1 text-ink-2">
                        <CalendarDays className="h-3.5 w-3.5" /> скоро
                      </span>
                    </div>
                    <h2 className="text-[16px] font-extrabold leading-snug text-ink">{title}</h2>
                    <p className="mt-2 flex-1 text-[13.5px] leading-relaxed text-ink-2">{excerpt}</p>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
