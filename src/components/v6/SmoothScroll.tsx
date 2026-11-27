"use client";

import { useEffect } from "react";

/** Инерция прокрутки: чем больше, тем быстрее страница догоняет колесо (1/с). */
const FOLLOW = 9;
/** Длительность «захвата» ролика, мс: за это время страница сама доезжает до раскрытого ролика. */
const CAPTURE_MS = 1400;
/** Длительность «захвата» посадки в Казахстан со сборкой логотипа, мс. */
const LANDING_MS = 3400;
/** Запас у краёв зоны захвата (доля экрана): толчок чуть раньше начала тоже её запускает. */
const LEAD = 0.12;

// мягкий разгон и торможение без рывка в середине (пик скорости ≈1,6 от средней, у кубической — 3)
const easeInOut = (t: number) => (1 - Math.cos(Math.PI * t)) / 2;

/**
 * Прокрутка /v6, как у lusion: колесо целиком ведёт наш код — страница плавно, с инерцией догоняет
 * колесо (без шагов по 100px). В зонах «захвата» стоит чуть толкнуть колесо, и страница сама,
 * с разгоном и торможением, доезжает до конца зоны (вниз) или до её начала (вверх); колесо на это
 * время не учитывается. Зоны: раскрытие карточки вступления в большой ролик и посадка с глобуса
 * в Казахстан со сборкой логотипа (от итоговой фразы до собранного логотипа).
 * Раньше захват жил поверх обычной прокрутки браузера, и её собственная анимация колеса дёргала
 * страницу; теперь прокручивает только этот код, конфликтовать не с чем.
 * Полоса прокрутки, клавиши, якоря и касания работают как обычно — положение подхватывается.
 * Шкала зоны ролика та же, что у полёта карточки в PageGL: старт — верх ролика на 0,98 экрана,
 * конец — на 0,12; шкала посадки — та же, что у сцены глобуса (доли прокрутки секции #world).
 * При «уменьшить движение» выключено.
 * reelFrom — захват ролика начинается раньше, с этой прокрутки (доля экрана), и сам доводит ленту
 * и полёт карточки (/v7: второе движение колеса); reelMs — его длительность. landing={false} —
 * без зоны посадки (/v7: глобус — статичный блок, сажать нечего).
 */
export function SmoothScroll({
  reelFrom,
  reelMs = CAPTURE_MS,
  landing = true,
}: { reelFrom?: number; reelMs?: number; landing?: boolean } = {}) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let current = window.scrollY;
    let target = current;
    let written = current;
    let glide: { from: number; to: number; t0: number; ms: number } | null = null;
    let raf = 0;
    let prev = performance.now();

    const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;

    type Zone = { from: number; to: number; ms: number };
    const zones = (): Zone[] => {
      const vh = window.innerHeight;
      const list: Zone[] = [];
      const card = document.querySelector<HTMLElement>('[data-ribbon="reel-card"]');
      if (card) {
        const top = card.getBoundingClientRect().top + window.scrollY;
        list.push({ from: reelFrom === undefined ? top - vh * 0.98 : vh * reelFrom, to: top - vh * 0.12, ms: reelMs });
      }
      // посадка: от итоговой фразы (полёт закончен) до собранного логотипа — см. WorldV6
      const world = landing ? document.getElementById("world") : null;
      if (world) {
        const top = world.getBoundingClientRect().top + window.scrollY;
        const total = world.offsetHeight - vh;
        list.push({ from: top + total * 0.845, to: top + total * 0.975, ms: LANDING_MS });
      }
      return list;
    };

    const write = (y: number) => {
      written = Math.round(y);
      window.scrollTo({ top: written, behavior: "instant" });
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      if (glide) {
        const k = Math.min(1, (now - glide.t0) / glide.ms);
        current = glide.from + (glide.to - glide.from) * easeInOut(k);
        if (k >= 1) {
          target = current = glide.to;
          glide = null;
        }
        write(current);
        return;
      }
      if (Math.abs(target - current) < 0.5) return;
      current += (target - current) * (1 - Math.exp(-FOLLOW * dt));
      if (Math.abs(target - current) < 0.5) current = target;
      write(current);
    };

    const onWheel = (e: WheelEvent) => {
      // масштаб и горизонтальная прокрутка — браузеру
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      // открытое окно (форма запроса /v7) прокручивается само, страницу под ним не двигаем
      if (e.target instanceof Element && e.target.closest("dialog[open]")) return;
      e.preventDefault();
      if (glide) return;
      const vh = window.innerHeight;
      const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * vh : e.deltaY;
      for (const z of zones()) {
        if (dy > 0 && current >= z.from - vh * LEAD && current < z.to - 2) {
          glide = { from: current, to: z.to, t0: performance.now(), ms: z.ms };
          return;
        }
        if (dy < 0 && current > z.from + 2 && current <= z.to + vh * LEAD) {
          glide = { from: current, to: z.from, t0: performance.now(), ms: z.ms };
          return;
        }
      }
      target = Math.max(0, Math.min(maxScroll(), target + dy));
    };

    // прокрутку сдвинул кто-то ещё (полоса, клавиши, якорь, касание) — продолжаем с этого места
    const onScroll = () => {
      if (Math.abs(window.scrollY - written) > 2) {
        glide = null;
        current = target = written = window.scrollY;
      }
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    raf = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [reelFrom, reelMs, landing]);

  return null;
}
