import { StrictMode } from "react";
import { renderToPipeableStream } from "react-dom/server";
import { StaticRouter } from "react-router";
import { PassThrough } from "node:stream";
import { App } from "@/App";
import { UIProvider } from "@/lib/ui";
import { CarsProvider } from "@/lib/carsStore";
import type { Car } from "@/data/cars";

/**
 * Отрисовка страницы в HTML на этапе сборки.
 *
 * Используется поток с ожиданием onAllReady: страницы подключаются через
 * lazy(), и обычный renderToString отдал бы вместо содержимого заглушку
 * загрузки, не дождавшись динамических импортов.
 */
export function render(url: string, cars?: Car[]): Promise<string> {
  return new Promise((resolve, reject) => {
    let html = "";
    const sink = new PassThrough();
    sink.on("data", (chunk: Buffer) => {
      html += chunk.toString("utf8");
    });
    sink.on("end", () => resolve(html));
    sink.on("error", reject);

    const { pipe, abort } = renderToPipeableStream(
      <StrictMode>
        <StaticRouter location={url}>
          <CarsProvider initialCars={cars}>
            <UIProvider>
              <App />
            </UIProvider>
          </CarsProvider>
        </StaticRouter>
      </StrictMode>,
      {
        onAllReady() {
          pipe(sink);
        },
        onError(err) {
          reject(err);
        },
      },
    );

    // Страховка от зависшего рендера.
    setTimeout(() => abort(), 20_000);
  });
}
