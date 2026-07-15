import { useEffect, useRef, useState } from "react";
import {
  geoOrthographic,
  geoPath,
  geoGraticule,
  geoDistance,
  geoInterpolate,
  geoBounds,
} from "d3-geo";
import { timer } from "d3-timer";
import { Logo } from "@/components/ui/Logo";

const BEIJING: [number, number] = [116.4, 39.9];
const MOSCOW: [number, number] = [37.62, 55.75];
// Контур суши лежит локально (public/), грузится с нашего же хоста — без задержек
// и без зависимости от GitHub (важно для РФ-сетей).
const LAND_URL = `${import.meta.env.BASE_URL}land-110m.json`;

type Ring = number[][];

function pointInPolygon(point: [number, number], polygon: Ring): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function pointInFeature(point: [number, number], feature: any): boolean {
  const g = feature.geometry;
  if (g.type === "Polygon") {
    if (!pointInPolygon(point, g.coordinates[0])) return false;
    for (let i = 1; i < g.coordinates.length; i++) {
      if (pointInPolygon(point, g.coordinates[i])) return false;
    }
    return true;
  }
  if (g.type === "MultiPolygon") {
    for (const poly of g.coordinates) {
      if (pointInPolygon(point, poly[0])) {
        let inHole = false;
        for (let i = 1; i < poly.length; i++) {
          if (pointInPolygon(point, poly[i])) {
            inHole = true;
            break;
          }
        }
        if (!inHole) return true;
      }
    }
  }
  return false;
}

export function Preloader({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setLeaving(true), 4200);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(onDone, 700);
    return () => clearTimeout(t);
  }, [leaving, onDone]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = Math.min(
      460,
      window.innerWidth - 48,
      window.innerHeight - 240,
    );
    const radius = size / 2.25;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const projection = geoOrthographic()
      .scale(radius)
      .translate([size / 2, size / 2])
      .clipAngle(90)
      .rotate([-90, -48]);
    const path = geoPath(projection, ctx as unknown as CanvasRenderingContext2D);
    const graticule = geoGraticule().step([20, 20]);

    type Dot = { p: [number, number]; v: [number, number, number] };
    let land: any = null;
    const dots: Dot[] = [];
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const toVec = (lng: number, lat: number): [number, number, number] => {
      const a = (lng * Math.PI) / 180;
      const b = (lat * Math.PI) / 180;
      const cb = Math.cos(b);
      return [cb * Math.cos(a), cb * Math.sin(a), Math.sin(b)];
    };
    const viewCenter = (): [number, number, number] => {
      const r = projection.rotate();
      return toVec(-r[0], -r[1]);
    };

    const isVisible = (p: [number, number]) => {
      const r = projection.rotate();
      return geoDistance(p, [-r[0], -r[1]]) < Math.PI / 2 - 0.02;
    };

    const drawPoint = (
      p: [number, number],
      label: string,
      pulse: number,
      side: "left" | "right",
    ) => {
      if (!isVisible(p)) return;
      const pt = projection(p);
      if (!pt) return;
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], pulse + 3, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(156,26,18,.35)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 3.4, 0, 2 * Math.PI);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pt[0], pt[1], 1.7, 0, 2 * Math.PI);
      ctx.fillStyle = "#9C1A12";
      ctx.fill();
      ctx.font = "700 13px 'Saira Condensed', system-ui, sans-serif";
      ctx.fillStyle = "#E6EAED";
      ctx.textBaseline = "middle";
      if (side === "left") {
        ctx.textAlign = "left";
        ctx.fillText(label, pt[0] + 12, pt[1]);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(label, pt[0] - 12, pt[1]);
      }
    };

    // Дуга-маршрут из origin в Москву + стрелка на конце.
    const drawRoute = (origin: [number, number]) => {
      const interp = geoInterpolate(origin, MOSCOW);
      const N = 80;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#9C1A12";
      ctx.shadowColor = "rgba(156,26,18,.85)";
      ctx.shadowBlur = 12;
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i <= N; i++) {
        const p = interp(i / N) as [number, number];
        if (isVisible(p)) {
          const pt = projection(p);
          if (!pt) continue;
          if (!drawing) {
            ctx.moveTo(pt[0], pt[1]);
            drawing = true;
          } else {
            ctx.lineTo(pt[0], pt[1]);
          }
        } else {
          drawing = false;
        }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      if (isVisible(MOSCOW)) {
        const pEnd = projection(MOSCOW);
        const pPrev = projection(interp(0.94) as [number, number]);
        if (pEnd && pPrev) {
          const ang = Math.atan2(pEnd[1] - pPrev[1], pEnd[0] - pPrev[0]);
          const len = 11;
          ctx.fillStyle = "#9C1A12";
          ctx.beginPath();
          ctx.moveTo(pEnd[0], pEnd[1]);
          ctx.lineTo(
            pEnd[0] - len * Math.cos(ang - 0.4),
            pEnd[1] - len * Math.sin(ang - 0.4),
          );
          ctx.lineTo(
            pEnd[0] - len * Math.cos(ang + 0.4),
            pEnd[1] - len * Math.sin(ang + 0.4),
          );
          ctx.closePath();
          ctx.fill();
        }
      }
    };

    const drawArc = (elapsed: number) => {
      drawRoute(BEIJING);

      const pulse = 3 + Math.sin(elapsed / 280) * 1.6;
      // Китай у правого края — подпись рисуем слева от точки, иначе обрежется.
      drawPoint(BEIJING, "КИТАЙ", pulse, "right");
      drawPoint(MOSCOW, "РОССИЯ", pulse, "right");
    };

    const render = (elapsed: number) => {
      ctx.clearRect(0, 0, size, size);

      ctx.beginPath();
      ctx.arc(size / 2, size / 2, radius, 0, 2 * Math.PI);
      ctx.fillStyle = "#0c1014";
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "rgba(174,186,194,.5)";
      ctx.stroke();

      ctx.beginPath();
      path(graticule());
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = "rgba(174,186,194,.14)";
      ctx.stroke();

      if (land) {
        ctx.beginPath();
        path(land);
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = "rgba(174,186,194,.45)";
        ctx.stroke();

        ctx.fillStyle = "rgba(92,109,118,.85)";
        const c = viewCenter();
        for (const d of dots) {
          if (d.v[0] * c[0] + d.v[1] * c[1] + d.v[2] * c[2] <= 0.06) continue;
          const pt = projection(d.p);
          if (!pt) continue;
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 1.1, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      drawArc(elapsed);
    };

    const genFeature = (feature: any) => {
      const [[minLng, minLat], [maxLng, maxLat]] = geoBounds(feature);
      const step = 3.4;
      for (let lng = minLng; lng <= maxLng; lng += step) {
        for (let lat = minLat; lat <= maxLat; lat += step) {
          const p: [number, number] = [lng, lat];
          if (pointInFeature(p, feature)) dots.push({ p, v: toVec(lng, lat) });
        }
      }
    };

    let lastRender = -100;
    const t = timer((elapsed) => {
      if (!reduce) projection.rotate([-90 + elapsed * 0.004, -48]);
      if (elapsed - lastRender < 33) return; // ~30fps
      lastRender = elapsed;
      render(elapsed);
    });

    // Контур с нашего хоста — мгновенно. Все точки генерируем сразу,
    // чтобы суша и точки появлялись вместе, а не «доезжали» по кадрам.
    fetch(LAND_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((geo: any) => {
        for (const f of geo.features) genFeature(f);
        land = geo;
      })
      .catch(() => {
        /* без суши — глобус с дугой всё равно показывается */
      });

    return () => t.stop();
  }, []);

  return (
    <div
      className={`grain fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 overflow-hidden bg-graphite transition-opacity duration-700 ${
        leaving ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="glow-blob left-[15%] top-[15%] h-72 w-72 animate-glow-pan bg-bordeaux/25" aria-hidden />
      <div className="glow-blob right-[12%] bottom-[12%] h-64 w-64 animate-glow-pan bg-steel/15 [animation-delay:-7s]" aria-hidden />

      <div className="relative animate-fade-up">
        <Logo className="h-16 w-auto md:h-20" />
      </div>

      <canvas ref={canvasRef} className="relative" />

      <div className="relative text-center">
        <p className="font-display text-[clamp(18px,3vw,26px)] font-extrabold uppercase tracking-[0.02em] text-shine">
          Возим из Китая в Россию — под ключ
        </p>
        <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.18em] text-steel">
          Готовим витрину…
        </p>
      </div>
    </div>
  );
}
