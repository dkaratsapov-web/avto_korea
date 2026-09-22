import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "@/App";
import { UIProvider } from "@/lib/ui";
import { CarsProvider } from "@/lib/carsStore";
import { captureAttribution } from "@/lib/attribution";
import "@/index.css";

// Рекламные метки снимаем до отрисовки: адрес с utm-метками живёт ровно до
// первого перехода внутри сайта, дальше их взять уже негде.
captureAttribution();

// Самовосстановление при устаревшем деплое: если динамический чанк страницы
// не подгрузился (старая вкладка + новый деплой удалил старые чанки),
// перезагружаем страницу автоматически — без «пустого экрана».
if (typeof window !== "undefined") {
  const reloadOnce = () => {
    const KEY = "diauto:chunk-reload";
    if (sessionStorage.getItem(KEY)) return; // защита от цикла
    sessionStorage.setItem(KEY, "1");
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault();
    reloadOnce();
  });
  window.addEventListener("error", (e) => {
    const msg = String(e?.message || "");
    if (/dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(msg))
      reloadOnce();
  });
  // Успешная загрузка страницы — снимаем флаг, чтобы будущие сбои снова
  // могли перезагрузить.
  window.addEventListener("load", () =>
    sessionStorage.removeItem("diauto:chunk-reload"),
  );
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <CarsProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </CarsProvider>
    </BrowserRouter>
  </StrictMode>,
);
