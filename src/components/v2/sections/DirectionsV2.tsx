"use client";

import { useCallback, useRef } from "react";

import { DirectionArt } from "@/components/sections/DirectionArt";
import { directionsV2 } from "@/content/v2";
import { useScrollProgress } from "@/lib/scroll";

/**
 * Направления — горизонтальная лента: прокрутка вниз двигает карточки вбок.
 * На каждой карточке — живая схема, одна фраза и теги, без длинного текста.
 */
export function DirectionsV2() {
  const ref = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);

  const onProgress = useCallback((p: number) => {
    const track = trackRef.current;
    if (!track) return;
    const max = track.scrollWidth - window.innerWidth;
    track.style.transform = `translate3d(${-p * Math.max(0, max)}px,0,0)`;
    if (barRef.current) barRef.current.style.transform = `scaleX(${p})`;
  }, []);
  useScrollProgress(ref, onProgress);

  return (
    <section id="directions" ref={ref} data-ribbon="directions" data-pin className="relative h-[420svh]">
      <div data-ribbon="directions-stage" className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div className="mx-auto mb-8 flex w-full max-w-[90rem] flex-wrap items-end justify-between gap-4 px-5 sm:px-8 lg:mb-12">
          <h2 className="text-[clamp(2.6rem,6.6vw,6.4rem)] leading-[0.95] font-semibold tracking-[-0.045em]">{directionsV2.title}</h2>
          <p className="max-w-[20rem] text-[1.05rem] text-muted">{directionsV2.lead}</p>
        </div>
        <div ref={trackRef} className="flex w-max gap-4 px-5 will-change-transform sm:gap-5 sm:px-8">
          {directionsV2.list.map((d, i) => (
            <article
              key={d.id}
              data-occlude={i % 2 === 0 || undefined}
              className="flex h-[min(58svh,32rem)] w-[min(78vw,26rem)] shrink-0 flex-col justify-between rounded-[24px] bg-card p-6 shadow-[0_1px_0_var(--line),0_24px_50px_-34px_var(--shadow)] sm:p-8"
            >
              <div className="flex items-start justify-between">
                <span className="text-[0.85rem] font-medium text-muted tabular-nums">{String(i + 1).padStart(2, "0")} / 07</span>
                <DirectionArt art={d.art} />
              </div>
              <div>
                <h3 className="text-[clamp(1.9rem,3vw,2.6rem)] leading-none font-semibold tracking-[-0.03em]">{d.title}</h3>
                <p className="mt-3 text-[1.08rem] leading-snug text-fg/75">{d.short}</p>
                <ul className="mt-5 flex flex-wrap gap-1.5">
                  {d.items.map((item) => (
                    <li key={item} className="rounded-full bg-fg/5 px-3 py-1 text-[0.8rem] text-fg/70">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-10 w-full max-w-[90rem] px-5 sm:px-8">
          <div className="h-px w-full bg-line">
            <span ref={barRef} className="block h-px w-full origin-left scale-x-0 bg-fg" />
          </div>
        </div>
      </div>
    </section>
  );
}
