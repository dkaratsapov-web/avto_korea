import { useEffect, useRef } from "react";

type RGB = { r: number; g: number; b: number };

class Particle {
  pos: { x: number; y: number };
  vel = { x: 0, y: 0 };
  acc = { x: 0, y: 0 };
  target = { x: 0, y: 0 };
  maxSpeed: number;
  maxForce: number;
  size: number;
  color: RGB;
  weight = 0;
  blend: number;

  constructor(x: number, y: number, color: RGB) {
    this.pos = { x, y };
    this.color = color;
    this.maxSpeed = Math.random() * 6 + 4;
    this.maxForce = this.maxSpeed * 0.05;
    this.size = Math.random() * 1.4 + 1.1;
    this.blend = Math.random() * 0.03 + 0.012;
  }

  move() {
    const dx = this.target.x - this.pos.x;
    const dy = this.target.y - this.pos.y;
    const dist = Math.hypot(dx, dy);
    let prox = 1;
    if (dist < 100) prox = dist / 100;

    let tx = dx;
    let ty = dy;
    const mag = Math.hypot(tx, ty);
    if (mag > 0) {
      tx = (tx / mag) * this.maxSpeed * prox;
      ty = (ty / mag) * this.maxSpeed * prox;
    }
    let sx = tx - this.vel.x;
    let sy = ty - this.vel.y;
    const sm = Math.hypot(sx, sy);
    if (sm > 0) {
      sx = (sx / sm) * this.maxForce;
      sy = (sy / sm) * this.maxForce;
    }
    this.acc.x += sx;
    this.acc.y += sy;
    this.vel.x += this.acc.x;
    this.vel.y += this.acc.y;
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
    this.acc.x = 0;
    this.acc.y = 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    this.weight = Math.min(this.weight + this.blend, 1);
    ctx.globalAlpha = this.weight;
    ctx.fillStyle = `rgb(${this.color.r}, ${this.color.g}, ${this.color.b})`;
    ctx.fillRect(this.pos.x, this.pos.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

const WHITE: RGB = { r: 236, g: 240, b: 243 };
const BORDEAUX: RGB = { r: 156, g: 26, b: 18 };

export function ParticleHeadline({
  lines,
  accentIndex = -1,
  start,
  onDone,
  className = "",
}: {
  lines: string[];
  accentIndex?: number;
  start: boolean;
  onDone: () => void;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!start) return;
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const fire = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
    };

    const w = Math.max(1, Math.round(wrap.clientWidth));
    const h = Math.max(1, Math.round(wrap.clientHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      fire();
      return;
    }
    ctx.scale(dpr, dpr);

    // оффскрин для сэмплинга пикселей текста
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const octx = off.getContext("2d");
    if (!octx) {
      fire();
      return;
    }

    const lineH = h / lines.length;
    const fontSize = Math.min(lineH * 0.82, w * 0.16);
    const step = w > 760 ? 5 : 7;
    const particles: Particle[] = [];

    lines.forEach((line, li) => {
      octx.clearRect(0, 0, w, h);
      octx.fillStyle = "#fff";
      octx.font = `800 ${fontSize}px "Saira Condensed", system-ui, sans-serif`;
      octx.textAlign = "left";
      octx.textBaseline = "middle";
      octx.fillText(line.toUpperCase(), 0, li * lineH + lineH / 2);

      const data = octx.getImageData(0, 0, w, h).data;
      const color = li === accentIndex ? BORDEAUX : WHITE;
      for (let y = 0; y < h; y += step) {
        for (let x = 0; x < w; x += step) {
          if (data[(y * w + x) * 4 + 3] > 128) {
            const sx = Math.random() * w;
            const sy = Math.random() * h;
            const p = new Particle(sx, sy, color);
            p.target.x = x;
            p.target.y = y;
            particles.push(p);
          }
        }
      }
    });

    let raf = 0;
    let frame = 0;
    const render = () => {
      ctx.clearRect(0, 0, w, h);
      let settled = 0;
      for (const p of particles) {
        p.move();
        p.draw(ctx);
        if (Math.hypot(p.target.x - p.pos.x, p.target.y - p.pos.y) < 1.5) settled++;
      }
      frame++;
      // готово, когда почти всё на месте (или по таймауту-страховке)
      if (frame > 60 && settled > particles.length * 0.9) {
        fire();
        // даём кадрам ещё немного дорисоваться и останавливаемся
        if (frame > 200) return;
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);

    const safety = window.setTimeout(fire, 4000);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(safety);
    };
  }, [start, lines, accentIndex, onDone]);

  return (
    <div ref={wrapRef} className={className} aria-hidden>
      <canvas ref={canvasRef} className="block" />
    </div>
  );
}
