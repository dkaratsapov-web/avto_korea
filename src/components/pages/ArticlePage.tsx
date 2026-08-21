import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, Clock, ArrowRight, ArrowLeft } from "lucide-react";
import { getArticle, articles } from "@/data/articles";
import { LeadForm } from "@/components/LeadForm";

function useMeta(title: string, description: string, keywords?: string[]) {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    const desc = document.querySelector('meta[name="description"]');
    const prevDesc = desc?.getAttribute("content") ?? "";
    if (desc) desc.setAttribute("content", description);

    let kw = document.querySelector('meta[name="keywords"]');
    let created = false;
    if (!kw && keywords?.length) {
      kw = document.createElement("meta");
      kw.setAttribute("name", "keywords");
      document.head.appendChild(kw);
      created = true;
    }
    if (kw && keywords?.length) kw.setAttribute("content", keywords.join(", "));

    return () => {
      document.title = prevTitle;
      if (desc) desc.setAttribute("content", prevDesc);
      if (created && kw) kw.remove();
    };
  }, [title, description, keywords]);
}

/**
 * Ссылки прямо в тексте: [подпись](/адрес).
 *
 * Перелинковка должна жить внутри абзацев — там её ждут и читатель, и
 * поисковик. Отдельный блок «читайте также» в подвале такой же вес не даёт.
 * Внешние адреса не поддерживаем намеренно: в статьях ссылаемся только на себя.
 */
function withLinks(text: string) {
  const parts: (string | { label: string; to: string })[] = [];
  const re = /\[([^\]]+)\]\((\/[^)]*)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push({ label: m[1], to: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));

  return parts.map((part, i) =>
    typeof part === "string" ? (
      part
    ) : (
      <Link
        key={i}
        to={part.to}
        className="font-semibold text-bordeaux underline decoration-bordeaux/30 underline-offset-2 transition-colors hover:text-bordeaux-bright hover:decoration-bordeaux"
      >
        {part.label}
      </Link>
    ),
  );
}

export function ArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const article = slug ? getArticle(slug) : undefined;

  useMeta(
    article ? `${article.title} — ДиАвто69` : "Статья не найдена — ДиАвто69",
    article?.description ?? "",
    article?.keywords,
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [slug]);

  if (!article) {
    return (
      <main className="bg-paper pb-24 pt-[140px]">
        <div className="wrap text-center">
          <h1 className="text-[28px] font-extrabold text-ink">Статья не найдена</h1>
          <Link
            to="/articles"
            className="mt-5 inline-flex items-center gap-2 font-bold text-bordeaux"
          >
            <ArrowLeft className="h-4 w-4" /> Ко всем статьям
          </Link>
        </div>
      </main>
    );
  }

  // Что читать дальше: сначала явно указанные в статье, потом добираем
  // остальными, чтобы блок не пустовал у материалов без связей.
  const related = article.related
    .map((slug) => articles.find((a) => a.slug === slug))
    .filter((a): a is (typeof articles)[number] => Boolean(a));
  const other = [
    ...related,
    ...articles.filter(
      (a) => a.slug !== article.slug && !article.related.includes(a.slug),
    ),
  ].slice(0, 2);

  return (
    <main className="bg-paper pb-[96px]">
      <section className="grain relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-8 pt-[104px] text-white">
        <div className="wrap relative">
          <nav className="mb-4 flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link to="/articles" className="transition-colors hover:text-white">Статьи</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">{article.title}</span>
          </nav>
          <div className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-chrome">
            <Clock className="h-4 w-4" /> {article.readMin} мин чтения
          </div>
          <h1 className="max-w-3xl text-[clamp(26px,3.4vw,42px)] font-extrabold leading-[1.08] text-shine">
            {article.title}
          </h1>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      <div className="wrap -mt-1">
        <img
          src={article.cover}
          alt=""
          className="mt-6 max-h-[50vh] w-full rounded-card border border-line object-cover"
          style={{ aspectRatio: "16 / 9" }}
          decoding="async"
        />
      </div>

      <article className="wrap mt-10 max-w-3xl">
        {article.body.map((b, i) => {
          if (b.t === "h2")
            return (
              <h2
                key={i}
                className="mb-3 mt-9 text-[24px] font-extrabold leading-snug text-ink"
              >
                {b.text}
              </h2>
            );
          if (b.t === "ul")
            return (
              <ul key={i} className="my-4 space-y-2.5">
                {b.items.map((it) => (
                  <li key={it} className="flex items-start gap-2.5 text-[16px] leading-relaxed text-ink-2">
                    <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-bordeaux" />
                    <span>{withLinks(it)}</span>
                  </li>
                ))}
              </ul>
            );
          if (b.t === "img")
            return (
              <figure key={i} className="my-8">
                <img
                  src={b.src}
                  alt={b.alt}
                  loading="lazy"
                  decoding="async"
                  className="max-h-[50vh] w-full rounded-card border border-line object-cover"
                />
                {b.caption ? (
                  <figcaption className="mt-2.5 text-[13.5px] leading-snug text-ink-2">
                    {b.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          if (b.t === "note")
            return (
              <aside
                key={i}
                className="my-6 rounded-card border border-line bg-white px-5 py-4 shadow-[inset_3px_0_0_0_theme(colors.bordeaux)]"
              >
                <p className="text-[15.5px] leading-relaxed text-ink">
                  {withLinks(b.text)}
                </p>
              </aside>
            );
          return (
            <p key={i} className="mb-4 text-[16px] leading-[1.75] text-[#333b44]">
              {withLinks(b.text)}
            </p>
          );
        })}

        {/* CTA после статьи */}
        <div className="mt-10 rounded-card border border-line bg-graphite p-6 text-white sm:p-8">
          <h3 className="text-[22px] font-extrabold text-white">
            Рассчитать стоимость под ключ
          </h3>
          <p className="mb-5 mt-2 text-[14px] text-[#9AA4B2]">
            Оставьте контакты — покажем реальную цену конкретного авто с
            доставкой и растаможкой, без скрытых наценок.
          </p>
          <LeadForm source={`Статья: ${article.title}`} submitLabel="Получить расчёт" withCar={false} />
        </div>
      </article>

      {other.length ? (
        <div className="wrap mt-14">
          <h2 className="mb-5 text-[20px] font-extrabold uppercase text-ink">
            Читайте также
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {other.map((a) => (
              <Link
                key={a.slug}
                to={`/articles/${a.slug}`}
                className="group flex flex-col rounded-card border border-line bg-white p-6 transition-[box-shadow,border-color] duration-300 hover:border-[#d4d8de] hover:shadow-card"
              >
                <h3 className="mb-2 text-[18px] font-extrabold leading-snug text-ink">
                  {a.title}
                </h3>
                <p className="mb-4 text-[14px] leading-relaxed text-ink-2">
                  {a.description}
                </p>
                <span className="inline-flex items-center gap-2 text-[14px] font-bold text-bordeaux">
                  Читать <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </main>
  );
}
