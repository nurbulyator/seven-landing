"use client";

import { useCallback, useEffect, useRef } from "react";

import { hero } from "@/content/site";
import { band, clamp01, useScrollProgress } from "@/lib/scroll";

const FRAME_COUNT = 120;
const frameSrc = (i: number) => `/hero/seven/${String(i + 1).padStart(3, "0")}.webp`;

/** Доля прокрутки, на которой проигрывается анимация знака (до и после — пауза под текст). */
const ANIM_START = 0.06;
const ANIM_END = 0.92;

/**
 * Первый экран в духе страниц Apple: знак «7», отрендеренный в Blender покадрово,
 * поворачивается и разбирается на части по мере прокрутки, подписи сменяют друг друга.
 */
export function SevenHero() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const phaseRefs = useRef<(HTMLDivElement | null)[]>([]);
  const calloutRefs = useRef<(HTMLDivElement | null)[]>([]);
  const shadowRef = useRef<HTMLDivElement>(null);
  const objectRef = useRef<HTMLDivElement>(null);
  const images = useRef<(HTMLImageElement | null)[]>([]);
  const current = useRef(0);

  const draw = useCallback((index: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // если нужный кадр ещё грузится, показываем ближайший готовый
    let img: HTMLImageElement | null = null;
    for (let d = 0; d < FRAME_COUNT && !img; d++) {
      const a = images.current[index - d];
      const b = images.current[index + d];
      if (a?.complete && a.naturalWidth) img = a;
      else if (b?.complete && b.naturalWidth) img = b;
    }
    if (!img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const size = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      draw(current.current);
    };
    const observer = new ResizeObserver(size);
    observer.observe(canvas);

    // Сначала первый кадр, потом остальные по порядку — чтобы прокрутка сразу работала.
    let cancelled = false;
    const load = (i: number) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = img.onerror = () => {
          if (!cancelled && Math.abs(i - current.current) < 3) draw(current.current);
          resolve();
        };
        img.src = frameSrc(i);
        images.current[i] = img;
      });
    (async () => {
      await load(0);
      for (let i = 1; i < FRAME_COUNT && !cancelled; i += 4) {
        await Promise.all([i, i + 1, i + 2, i + 3].filter((n) => n < FRAME_COUNT).map(load));
      }
    })();

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [draw]);

  const onProgress = useCallback(
    (p: number) => {
      const t = clamp01((p - ANIM_START) / (ANIM_END - ANIM_START));
      const index = Math.round(t * (FRAME_COUNT - 1));
      if (index !== current.current) {
        current.current = index;
        draw(index);
      }

      const intro = introRef.current;
      if (intro) {
        const k = 1 - clamp01((p - 0.04) / 0.08);
        intro.style.opacity = String(k);
        intro.style.transform = `translateY(${(1 - k) * -24}px)`;
        intro.style.visibility = k < 0.01 ? "hidden" : "visible";
      }

      const ranges: [number, number][] = [
        [0.15, 0.37],
        [0.37, 0.53],
        [0.53, 0.69],
        [0.76, 1.01],
      ];
      phaseRefs.current.forEach((el, i) => {
        if (!el) return;
        const k = band(p, ranges[i][0], ranges[i][1], 0.035);
        el.style.opacity = String(k);
        el.style.transform = `translateY(${(1 - k) * 16}px)`;
      });
      calloutRefs.current.forEach((el, i) => {
        if (!el) return;
        const k = band(p, ranges[i + 1][0] + 0.02, ranges[i + 1][1], 0.03);
        el.style.opacity = String(k);
      });
      // как у Apple: в начале знак меньше и уступает место заголовку, при прокрутке вырастает
      const object = objectRef.current;
      if (object) {
        const grow = clamp01(p / 0.12);
        const eased = grow * grow * (3 - 2 * grow);
        object.style.transform = `scale(${0.74 + eased * 0.26})`;
      }

      const shadow = shadowRef.current;
      if (shadow) shadow.style.opacity = String(1 - band(t, 0.3, 0.8, 0.12) * 0.7);
    },
    [draw],
  );
  useScrollProgress(sectionRef, onProgress);

  const phases = hero.phases;

  return (
    <section id="top" ref={sectionRef} className="relative h-[420svh] lg:h-[520svh]">
      <div className="sticky top-0 flex h-svh flex-col items-center overflow-hidden">
        <div ref={introRef} className="relative z-10 mt-[max(5.5rem,11svh)] px-5 text-center">
          <p className="text-[0.95rem] font-medium text-accent-ink sm:text-[1.05rem]">{hero.eyebrow}</p>
          <h1 className="mt-2 text-[clamp(2.6rem,7.4vw,6.4rem)] leading-[1.02] font-bold tracking-[-0.035em]">
            {hero.title}
          </h1>
          <p className="mx-auto mt-4 max-w-[38rem] text-[1.05rem] leading-snug text-muted sm:text-[1.3rem]">
            {hero.lead}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-3">
            <a
              href="#contact"
              className="rounded-full bg-accent px-6 py-3 text-[0.98rem] font-medium whitespace-nowrap text-[#050708] transition-opacity hover:opacity-85"
            >
              {hero.primary}
            </a>
            <a href="#directions" className="text-[0.98rem] font-medium whitespace-nowrap text-accent-ink hover:underline">
              {hero.secondary} ›
            </a>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-[2svh] flex justify-center">
          <div
            ref={objectRef}
            className="relative aspect-square w-[min(66svh,104vw)] origin-bottom scale-[0.74] lg:w-[min(82svh,60rem)]"
          >
            <div
              ref={shadowRef}
              aria-hidden
              className="absolute bottom-[3%] left-1/2 h-[7%] w-[46%] -translate-x-1/2 rounded-[50%] bg-[radial-gradient(closest-side,var(--shadow),transparent)] blur-md"
            />
            <canvas
              ref={canvasRef}
              role="img"
              aria-label="Знак «7» Seven Hills из анодированного алюминия"
              className="relative h-full w-full"
            />
            {[phases[1], phases[2]].map((phase, i) => (
              <div
                key={phase.title}
                ref={(el) => {
                  calloutRefs.current[i] = el;
                }}
                aria-hidden
                className={`pointer-events-none absolute flex items-center gap-2 text-[0.8rem] font-medium whitespace-nowrap opacity-0 sm:text-[0.9rem] ${
                  i === 0 ? "top-[30%] left-[2%] sm:left-[6%]" : "top-[14%] right-[0%] flex-row-reverse sm:right-[6%]"
                }`}
              >
                <span className="rounded-full border border-line bg-(--glass) px-3 py-1 backdrop-blur-md">
                  {"callout" in phase ? phase.callout : null}
                </span>
                <span className="h-px w-8 bg-fg/40 sm:w-14" />
                <span className="size-1.5 rounded-full bg-fg" />
              </div>
            ))}
          </div>
        </div>

        <div className="absolute inset-x-0 top-[max(5.5rem,11svh)] px-5">
          {phases.map((phase, i) => (
            <div
              key={phase.title}
              ref={(el) => {
                phaseRefs.current[i] = el;
              }}
              className="absolute inset-x-5 mx-auto max-w-[44rem] text-center opacity-0"
            >
              <h2 className="text-[clamp(1.9rem,4.6vw,3.8rem)] leading-[1.06] font-bold tracking-[-0.03em]">
                {phase.title}
              </h2>
              <p className="mx-auto mt-3 max-w-[34rem] text-[1.02rem] leading-snug text-muted sm:text-[1.2rem]">
                {phase.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
