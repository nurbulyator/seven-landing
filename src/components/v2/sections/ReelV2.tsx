"use client";

import { useEffect, useRef } from "react";

import { SEVEN_PATH } from "@/components/Logo";
import { usePageGL } from "@/components/v2/gl/PageGL";
import { reelV2 } from "@/content/v2";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Большой ролик. Карточку сюда «приносит» лента из вступления (морф в PageGL);
 * пока она летит, слова SEVEN и HILLS стоят врозь и сходятся, когда карточка встала на место.
 */
export function ReelV2() {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const leftRef = useRef<HTMLSpanElement>(null);
  const rightRef = useRef<HTMLSpanElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const gl = usePageGL();

  useEffect(() => {
    const b = boxRef.current;
    const video = videoRef.current;
    const a = document.querySelector<HTMLElement>('[data-ribbon="intro-card"]');
    if (!b || !video || !a || !gl) return;
    return gl.morph({ a, b, video, dip: "dip" });
  }, [gl]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const b = boxRef.current;
      if (!b) return;
      const r = b.getBoundingClientRect();
      const vh = window.innerHeight;
      if (r.bottom < 0 || r.top > vh) return;
      // та же шкала, что у полёта карточки в PageGL
      const p = clamp01((vh * 0.98 - r.top) / (vh * 0.86));
      const apart = (1 - p) * window.innerWidth * 0.16;
      if (leftRef.current) leftRef.current.style.transform = `translateX(${-apart}px)`;
      if (rightRef.current) rightRef.current.style.transform = `translateX(${apart}px)`;
      if (markRef.current) {
        const k = clamp01((p - 0.75) / 0.25);
        markRef.current.style.transform = `scale(${k})`;
        markRef.current.style.opacity = String(k);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section data-ribbon="reel" aria-label="Видео: центр обработки данных" className="px-2.5 pb-20 sm:px-4 lg:pb-28">
      <div ref={boxRef} data-ribbon="reel-card" className="relative h-[min(82svh,56vw)] min-h-[22rem] overflow-hidden rounded-[28px]">
        <video
          ref={videoRef}
          src="/v2/media/corridor.mp4"
          poster="/v2/media/corridor.jpg"
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          aria-hidden
          className="gl-hide absolute inset-0 h-full w-full object-cover"
        />
      </div>
      <div
        aria-hidden
        className="pointer-events-none relative z-10 -mt-[max(min(82svh,56vw),22rem)] flex h-[min(82svh,56vw)] min-h-[22rem] items-center justify-center gap-[0.3em] text-[clamp(2.4rem,7vw,7rem)] leading-none font-semibold tracking-[-0.05em] text-white"
      >
        <span ref={leftRef}>{reelV2.left}</span>
        <span ref={markRef} className="grid size-[0.9em] shrink-0 place-items-center rounded-full bg-white text-[#00bbc4] opacity-0">
          <svg viewBox="0 0 203.3 285.92" className="h-[0.46em] w-auto" aria-hidden>
            <path d={SEVEN_PATH} fill="currentColor" />
          </svg>
        </span>
        <span ref={rightRef}>{reelV2.right}</span>
      </div>
      <p className="mx-auto mt-6 max-w-[90rem] px-3 text-[1.05rem] leading-snug text-muted sm:px-6">{reelV2.caption}</p>
    </section>
  );
}
