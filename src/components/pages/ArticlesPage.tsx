import { useEffect } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Clock, ArrowRight, BookOpen } from "lucide-react";
import { articles, coverThumb } from "@/data/articles";

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

export function ArticlesPage() {
  useMeta(
    "Полезные статьи об импорте авто под ключ — ДиАвто69",
    "Полезные статьи о покупке и растаможке авто из Кореи, Китая и Японии под ключ: пошаговые гиды, расчёт стоимости, пошлины и утильсбор, сравнение направлений.",
  );

  return (
    <main className="bg-paper pb-[96px]">
      <section className="grain relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-8 pt-[104px] text-white">
        <div className="wrap relative">
          <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">Полезные статьи</span>
          </nav>
          <div className="mb-2 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
            <BookOpen className="h-4 w-4" /> База знаний
          </div>
          <h1 className="text-[clamp(28px,3.6vw,46px)] leading-[1.05] text-shine">
            Полезные статьи про импорт авто
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[#C7CFD6]">
            Разбираем всё, что важно знать перед покупкой авто из-за рубежа под
            ключ: как проходит подбор и доставка, из чего складывается цена,
            сколько стоит растаможка и откуда выгоднее везти.
          </p>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      {/* Карточки-строки: узкая миниатюра слева, текст справа. Большая
          обложка 16:9 занимала пол-экрана на материал, и до второй статьи
          нужно было доскроллить — при восьми статьях список важнее картинок. */}
      <div className="wrap mt-10 grid gap-4 md:grid-cols-2">
        {articles.map((a) => (
          <Link
            key={a.slug}
            to={`/articles/${a.slug}`}
            className="group flex gap-4 rounded-card border border-line bg-white p-4 transition-[box-shadow,border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-[#d4d8de] hover:shadow-card"
          >
            <img
              src={coverThumb(a.cover)}
              alt=""
              loading="lazy"
              decoding="async"
              width={148}
              height={83}
              className="h-[62px] w-[110px] flex-none rounded-[10px] object-cover sm:h-[83px] sm:w-[148px]"
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <h2 className="line-clamp-3 text-[15px] font-extrabold leading-snug text-ink sm:line-clamp-2 sm:text-[16px]">
                {a.title}
              </h2>
              <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-ink-2 max-sm:hidden">
                {a.description}
              </p>
              <div className="mt-auto flex items-center gap-2 pt-2.5 text-[12px] font-semibold text-ink-2">
                <Clock className="h-3.5 w-3.5 text-steel" /> {a.readMin} мин
                <span className="ml-auto inline-flex items-center gap-1.5 text-bordeaux">
                  Читать
                  <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
