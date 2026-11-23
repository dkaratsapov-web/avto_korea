import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, type MotionValue } from "framer-motion";

/**
 * 3D scroll-анимация: заголовок поднимается, карточка «ложится» из наклона
 * (rotateX) и масштабируется по мере прокрутки секции к центру экрана.
 * Адаптировано под Vite/React и фирменную стилистику (графит + хром).
 */
export function ContainerScroll({
  titleComponent,
  children,
}: {
  titleComponent: ReactNode;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "center center"],
  });

  const rotate = useTransform(scrollYProgress, [0, 1], [22, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1]);
  const titleY = useTransform(scrollYProgress, [0, 1], [60, 0]);

  return (
    <div
      ref={containerRef}
      className="relative"
      style={{ perspective: "1200px" }}
    >
      <motion.div style={{ y: titleY }} className="mx-auto mb-10 max-w-3xl">
        {titleComponent}
      </motion.div>
      <Card rotate={rotate} scale={scale}>
        {children}
      </Card>
    </div>
  );
}

function Card({
  rotate,
  scale,
  children,
}: {
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  children: ReactNode;
}) {
  return (
    <motion.div
      style={{
        rotateX: rotate,
        scale,
        boxShadow:
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003, 0 120px 160px -60px rgba(0,0,0,.55)",
      }}
      className="relative mx-auto w-full rounded-[34px] bg-[linear-gradient(145deg,#3b424a_0%,#23272d_45%,#15181c_100%)] p-2.5 ring-1 ring-black/50 [box-shadow:inset_0_1px_0_rgba(255,255,255,.12),inset_0_0_0_1px_rgba(0,0,0,.4)] md:rounded-[46px] md:p-4"
    >
      {/* металлический блик по краю + фронтальная камера */}
      <span
        className="pointer-events-none absolute inset-0 rounded-[34px] [background:linear-gradient(180deg,rgba(255,255,255,.10),transparent_18%,transparent_82%,rgba(255,255,255,.05))] md:rounded-[46px]"
        aria-hidden
      />
      <span
        className="absolute left-1/2 top-[7px] h-[5px] w-[5px] -translate-x-1/2 rounded-full bg-black/70 ring-1 ring-white/10 md:top-2.5"
        aria-hidden
      />
      <div className="grain relative overflow-hidden rounded-[24px] bg-graphite p-5 ring-1 ring-black/60 md:rounded-[34px] md:p-7">
        <div className="glow-blob -right-10 -top-10 h-56 w-56 animate-glow-pan bg-bordeaux/20" aria-hidden />
        <div className="relative">{children}</div>
      </div>
    </motion.div>
  );
}
