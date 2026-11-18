"use client";

import { useEffect, type RefObject } from "react";

/** 0…1 — насколько секция прокручена внутри своей высоты (с учётом высоты экрана). */
export function sectionProgress(el: HTMLElement): number {
  const rect = el.getBoundingClientRect();
  const total = rect.height - window.innerHeight;
  if (total <= 0) return rect.top <= 0 ? 1 : 0;
  return Math.min(1, Math.max(0, -rect.top / total));
}

/** Вызывает onProgress на каждом кадре прокрутки, пока секция на экране. */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, onProgress: (progress: number) => void) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      onProgress(sectionProgress(el));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, onProgress]);
}

/** Плавная «полоса» видимости: 0 до a, 1 между a+fade и b−fade, 0 после b. */
export function band(p: number, a: number, b: number, fade = 0.05): number {
  if (p <= a || p >= b) return 0;
  return Math.min(1, (p - a) / fade, (b - p) / fade);
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
