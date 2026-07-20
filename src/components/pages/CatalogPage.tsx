import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { CatalogBrowser } from "@/components/catalog/CatalogBrowser";

export function CatalogPage() {
  return (
    <main className="bg-paper pb-[96px]">
      {/* Компактная шапка */}
      <section className="grain relative overflow-hidden bg-[radial-gradient(760px_360px_at_82%_-20%,#27313d,#11151A_60%)] pb-5 pt-[96px] text-white">
        <div className="relative mx-auto w-full max-w-[1760px] px-6">
          <nav className="mb-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[#9AA4B2]">
            <Link to="/" className="transition-colors hover:text-white">Главная</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-chrome">Каталог</span>
          </nav>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <div className="mb-1.5 flex items-center gap-2.5 text-[12px] font-extrabold uppercase tracking-[0.16em] text-chrome">
                <span className="slash" aria-hidden /> Каталог под ключ
              </div>
              <h1 className="text-[clamp(26px,3.2vw,40px)] leading-[1.02] text-shine">
                Авто в наличии
              </h1>
            </div>
            <p className="max-w-md text-[13.5px] leading-snug text-[#AEB7BE]">
              Цена уже под ключ в РФ — доставка, растаможка, утильсбор и ЭПТС.
              Подберите по параметрам и откройте карточку с фото.
            </p>
          </div>
        </div>
        <div className="chrome-line absolute inset-x-0 bottom-0" />
      </section>

      <CatalogBrowser />
    </main>
  );
}
