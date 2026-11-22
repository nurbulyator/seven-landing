"use client";

import { useEffect, useRef } from "react";

import { SEVEN_PATH } from "@/components/Logo";
import { usePageGL } from "@/components/v3/gl/PageGL";
import { reelV3 } from "@/content/v3";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Большой ролик /v6 — как PLAY ▶ REEL у lusion, только SEVEN «7» HILLS. Слова стоят в центре
 * будущего ролика: пока карточка из вступления летит сюда, они широко разведены и видны под ней
 * цветом текста страницы; по мере полёта сходятся, а когда под них приезжает видео — белеют.
 * В конце между ними раскрывается капсула со знаком «7» — как кнопка ▶ у lusion.
 * Шкала p та же, что у полёта карточки в PageGL.
 */
export function ReelV6() {
  const boxRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const wordsRef = useRef<HTMLDivElement>(null);
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
      const p = clamp01((vh * 0.98 - r.top) / (vh * 0.86));
      // слова попадают на экран примерно с середины полёта — сходятся они именно там, на виду
      const meet = clamp01((p - 0.45) / 0.55);
      const apart = (1 - meet * meet * (3 - 2 * meet)) * window.innerWidth * 0.32;
      if (leftRef.current) leftRef.current.style.transform = `translateX(${-apart}px)`;
      if (rightRef.current) rightRef.current.style.transform = `translateX(${apart}px)`;
      // цвет: текст страницы → белый, когда видео уже под словами
      if (wordsRef.current) wordsRef.current.style.setProperty("--on-video", String(clamp01((p - 0.55) / 0.25)));
      if (markRef.current) {
        const k = ease(clamp01((p - 0.7) / 0.3));
        markRef.current.style.width = `${k * 1.9}em`;
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
        ref={wordsRef}
        aria-hidden
        style={{ color: "color-mix(in srgb, var(--fg), #fff calc(var(--on-video, 0) * 100%))" }}
        className="pointer-events-none relative z-10 -mt-[max(min(82svh,56vw),22rem)] flex h-[min(82svh,56vw)] min-h-[22rem] items-center justify-center gap-[0.25em] text-[clamp(2.4rem,7vw,7rem)] leading-none font-semibold tracking-[-0.05em]"
      >
        <span ref={leftRef} className="will-change-transform">
          {reelV3.left}
        </span>
        <span
          ref={markRef}
          className="grid h-[0.9em] w-0 shrink-0 place-items-center overflow-hidden rounded-full bg-white/85 text-[#00bbc4] opacity-0 backdrop-blur-md"
        >
          <svg viewBox="0 0 203.3 285.92" className="h-[0.46em] w-auto shrink-0" aria-hidden>
            <path d={SEVEN_PATH} fill="currentColor" />
          </svg>
        </span>
        <span ref={rightRef} className="will-change-transform">
          {reelV3.right}
        </span>
      </div>
      <p className="mx-auto mt-6 max-w-[90rem] px-3 text-[1.05rem] leading-snug text-muted sm:px-6">{reelV3.caption}</p>
    </section>
  );
}
