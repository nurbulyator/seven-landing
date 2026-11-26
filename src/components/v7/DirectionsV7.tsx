"use client";

import { useSyncExternalStore } from "react";

import { useTheme } from "@/components/ThemeToggle";
import {
  CubeShowcase,
  FanShowcase,
  FocusShowcase,
  LensShowcase,
  MosaicShowcase,
  OrbitShowcase,
  SphereShowcase,
  WipeShowcase,
} from "@/components/v7/DirectionsShowcase";
import { directionsV7 } from "@/content/v7";

/**
 * «Наши направления» /v7 — вместо «Своих продуктов» и прежнего блока направлений. Статичный блок:
 * заголовок и шесть направлений с сайта компании. Подачу пока сравниваем — переключатель
 * «Направления» внизу справа (выбор хранится в браузере зрителя). Все подачи листаются сами, по
 * времени (STEP_SEC), колесо мыши достаётся странице:
 *  - «Шар» — Infinite Menu из React Bits со своими подписями и стрелками (SphereShowcase);
 *  - «Фокус», «Шторка», «Веер», «Орбита», «Мозаика», «Куб», «Линза» — свои (DirectionsShowcase).
 * Лента по фото не ездит: тело блока — data-occlude, она проходит за ним целиком. Кроме «Фокуса»:
 * там заслоняют сами карточки, и лента проходит под ними, а не под невидимым прямоугольником блока.
 * Секция обрезана только по горизонтали — карточки «Фокуса» могут выходить за сцену вверх и вниз.
 */
const variants = [
  { key: "sphere", label: "Шар (Infinite Menu)" },
  { key: "focus", label: "Фокус" },
  { key: "wipe", label: "Шторка" },
  { key: "fan", label: "Веер" },
  { key: "orbit", label: "Орбита" },
  { key: "mosaic", label: "Мозаика" },
  { key: "cube", label: "Куб" },
  { key: "lens", label: "Линза" },
] as const;
type Variant = (typeof variants)[number]["key"];
const STORAGE_KEY = "v7-directions";
const DEFAULT: Variant = "sphere";

const listeners = new Set<() => void>();
function readVariant(): Variant {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {}
  return variants.find((v) => v.key === saved)?.key ?? DEFAULT;
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function setVariant(v: Variant) {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {}
  listeners.forEach((l) => l());
}

/** Сколько секунд показывается одно направление. */
const STEP_SEC = 3.5;

export function DirectionsV7() {
  const variant = useSyncExternalStore<Variant>(subscribe, readVariant, () => DEFAULT);
  const theme = useTheme() === "dark" ? "dark" : "light";


  return (
    <section id="directions" data-ribbon="dirs" className="relative overflow-x-clip px-5 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-[90rem]">
        {/* над сценой: уезжающая карточка «Фокуса» гаснет под заголовком, а не поверх него */}
        <div className="relative z-10 grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="text-[clamp(2.4rem,5.4vw,5rem)] leading-[0.98] font-semibold tracking-[-0.045em] lg:col-span-6">
            {directionsV7.title}
          </h2>
          <p className="max-w-[34rem] text-[1.1rem] leading-relaxed text-fg/75 sm:text-[1.25rem] lg:col-span-5 lg:col-start-8">
            {directionsV7.lead}
          </p>
        </div>

        <div data-ribbon="dirs-body" data-occlude={variant === "focus" ? undefined : true} className="relative mt-14 lg:mt-20">
          {variant === "sphere" && <SphereShowcase stepMs={STEP_SEC * 1000} theme={theme} />}
          {variant === "focus" && <FocusShowcase stepMs={STEP_SEC * 1000} />}
          {variant === "wipe" && <WipeShowcase stepMs={STEP_SEC * 1000} />}
          {variant === "fan" && <FanShowcase stepMs={STEP_SEC * 1000} />}
          {variant === "orbit" && <OrbitShowcase stepMs={STEP_SEC * 1000} />}
          {variant === "mosaic" && <MosaicShowcase stepMs={STEP_SEC * 1000} />}
          {variant === "cube" && <CubeShowcase stepMs={STEP_SEC * 1000} />}
          {variant === "lens" && <LensShowcase stepMs={STEP_SEC * 1000} />}
        </div>
      </div>

      <label className="fixed right-4 bottom-4 z-50 flex items-center gap-1 rounded-full bg-[#0b1214]/85 p-1 text-[0.8rem] text-white shadow-lg backdrop-blur-xl">
        <span className="hidden px-3 text-white/60 sm:inline">Направления</span>
        <span className="relative">
          <select
            aria-label="Подача направлений"
            value={variant}
            onChange={(e) => setVariant(e.target.value as Variant)}
            className="cursor-pointer appearance-none rounded-full bg-white py-1.5 pr-8 pl-3.5 text-[#0b1214] outline-none focus-visible:ring-2 focus-visible:ring-teal"
          >
            {variants.map((v) => (
              <option key={v.key} value={v.key}>
                {v.label}
              </option>
            ))}
          </select>
          <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute top-1/2 right-3 size-3 -translate-y-1/2 text-[#0b1214]">
            <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </label>
    </section>
  );
}
