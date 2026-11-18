"use client";

import { useCallback, useRef } from "react";

import { numbers } from "@/content/site";
import { useScrollProgress } from "@/lib/scroll";

/** Цифры компании сменяют друг друга на закреплённом экране, как характеристики на страницах Apple. */
export function Numbers() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const onProgress = useCallback((p: number) => {
    const pos = p * numbers.length - 0.5;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = pos - i;
      const k = Math.max(0, 1 - Math.abs(d) * 1.6);
      el.style.opacity = String(k);
      el.style.transform = `translateY(${-d * 70}px) scale(${0.94 + k * 0.06})`;
    });
    const active = Math.min(numbers.length - 1, Math.max(0, Math.round(pos)));
    dotRefs.current.forEach((el, i) => {
      if (el) el.dataset.active = String(i === active);
    });
  }, []);
  useScrollProgress(sectionRef, onProgress);

  return (
    <section id="about" ref={sectionRef} data-ribbon="numbers" className="relative h-[480svh] bg-bg-2">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-5">
        <p className="absolute top-[max(6rem,14svh)] text-[1rem] font-medium text-muted">Seven Hills в цифрах</p>
        <div className="relative h-[clamp(13rem,40svh,24rem)] w-full max-w-[60rem]">
          {numbers.map((n, i) => (
            <div
              key={n.value}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-0"
            >
              <p className="text-brand text-[clamp(6rem,24vw,17rem)] leading-none font-bold tracking-[-0.05em]">
                {n.value}
              </p>
              <p className="mt-4 max-w-[26rem] text-[1.1rem] leading-snug text-muted sm:text-[1.35rem]">{n.caption}</p>
            </div>
          ))}
        </div>
        <div aria-hidden className="absolute bottom-[10svh] flex gap-2">
          {numbers.map((n, i) => (
            <span
              key={n.value}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              className="h-1.5 w-1.5 rounded-full bg-fg/25 transition-all duration-300 data-[active=true]:w-6 data-[active=true]:bg-fg"
            />
          ))}
        </div>
        <ul className="sr-only">
          {numbers.map((n) => (
            <li key={n.value}>
              {n.value} — {n.caption}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
