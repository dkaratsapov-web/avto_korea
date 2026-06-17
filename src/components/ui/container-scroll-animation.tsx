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
          "0 0 #0000004d, 0 9px 20px #0000004a, 0 37px 37px #00000042, 0 84px 50px #00000026, 0 149px 60px #0000000a, 0 233px 65px #00000003, 0 120px 160px -60px rgba(0,0,0,.5)",
      }}
      className="mx-auto w-full rounded-[28px] border border-line-dark bg-graphite-2 p-3 md:p-5"
    >
      <div className="grain relative overflow-hidden rounded-[20px] bg-graphite p-5 md:p-7">
        <div className="glow-blob -right-10 -top-10 h-56 w-56 animate-glow-pan bg-bordeaux/20" aria-hidden />
        <div className="relative">{children}</div>
      </div>
    </motion.div>
  );
}
