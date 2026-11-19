"use client";

import { useSyncExternalStore } from "react";

import { useTheme } from "@/components/ThemeToggle";
import { FluidCanvas } from "@/components/v2/hero/FluidCanvas";
import { ReliefCanvas } from "@/components/v2/hero/ReliefCanvas";
import { ribbonStyles, setRibbonStyle, useRibbonStyle } from "@/components/v2/ribbonStyle";
import { SevenFrames } from "@/components/v2/SevenFrames";
import { heroV2 } from "@/content/v2";

/**
 * Первый экран /v2. По умолчанию — объёмный знак «7» (кадры Blender, поворачивается за курсором);
 * с первым движением колеса он растворяется и «переливается» в ленту, которая уходит вниз по странице.
 * «Поток» и «Рельеф» оставлены как альтернативы в переключателе; версия хранится в адресе (#hero-flow), чтобы ссылкой можно было показать конкретную.
 */
const variants = [
  { key: "seven", label: "Знак" },
  { key: "flow", label: "Поток" },
  { key: "relief", label: "Рельеф" },
] as const;
type Variant = (typeof variants)[number]["key"];

const listeners = new Set<() => void>();
function readVariant(): Variant {
  const hash = window.location.hash.replace("#hero-", "");
  return variants.find((v) => v.key === hash)?.key ?? "seven";
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("hashchange", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("hashchange", listener);
  };
}
function setVariant(v: Variant) {
  history.replaceState(null, "", `#hero-${v}`);
  listeners.forEach((l) => l());
}

export function HeroV2() {
  const variant = useSyncExternalStore<Variant>(subscribe, readVariant, () => "seven");
  const ribbonStyle = useRibbonStyle();
  const theme = useTheme();
  const darkCard = variant === "flow" || theme === "dark";

  return (
    <section id="top" className="relative px-2.5 pt-[4.25rem] sm:px-4">
      <div
        data-ribbon="hero"
        className={`relative h-[calc(100svh-5.75rem)] min-h-[34rem] overflow-hidden rounded-[2rem] ${
          darkCard
            ? "bg-[radial-gradient(120%_90%_at_70%_40%,#13201f_0%,#070c0e_60%)]"
            : "bg-[radial-gradient(120%_90%_at_70%_40%,#ffffff_0%,#e4eaea_70%)]"
        }`}
      >
        {variant === "seven" && (
          <SevenFrames
            ribbonKey="seven-hero"
            className="absolute top-1/2 right-[2%] w-[min(62vw,78svh)] -translate-y-[46%] max-lg:right-1/2 max-lg:w-[min(72vw,40svh)] max-lg:translate-x-1/2 max-lg:-translate-y-[92%]"
          />
        )}
        {variant === "flow" && <FluidCanvas />}
        {variant === "relief" && <ReliefCanvas dark={theme === "dark"} />}

        <div
          className={`pointer-events-none relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 lg:p-14 ${
            darkCard ? "text-white" : "text-[#0b1214]"
          }`}
        >
          <p className={`text-[0.95rem] font-medium ${darkCard ? "text-[#7fe3e8]" : "text-[#00828a]"}`}>{heroV2.eyebrow}</p>
          <h1 className="mt-3 text-[clamp(2.2rem,7.4vw,7.2rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
            {heroV2.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <p className={`max-w-[32rem] text-[1.05rem] leading-snug sm:text-[1.2rem] ${darkCard ? "text-white/75" : "text-[#0b1214]/70"}`}>
              {heroV2.lead}
            </p>
            <div className="pointer-events-auto flex flex-wrap gap-3">
              <a
                href="#contact"
                className="rounded-full bg-[#00bbc4] px-6 py-3 text-[0.98rem] font-medium whitespace-nowrap text-[#050708] transition-transform hover:scale-[1.03]"
              >
                {heroV2.primary}
              </a>
              <a
                href="#directions"
                className={`rounded-full px-6 py-3 text-[0.98rem] font-medium whitespace-nowrap backdrop-blur-md transition-colors ${
                  darkCard ? "bg-white/12 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
                }`}
              >
                {heroV2.secondary}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div aria-hidden className="flex items-center justify-between px-1 py-3 text-[0.72rem] font-medium tracking-[0.08em] text-muted uppercase">
        <span>+</span>
        <span className="hidden sm:inline">+</span>
        <span>Листайте</span>
        <span className="hidden sm:inline">+</span>
        <span>+</span>
      </div>

      {/* переключатели для сравнения вариантов: первый экран и вид ленты */}
      <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2 text-[0.8rem] text-white">
        <div
          role="radiogroup"
          aria-label="Вид ленты"
          className="flex items-center gap-1 rounded-full bg-[#0b1214]/85 p-1 shadow-lg backdrop-blur-xl"
        >
          <span className="hidden px-3 text-white/60 sm:inline">Лента</span>
          {ribbonStyles.map((st) => (
            <button
              key={st.key}
              type="button"
              role="radio"
              aria-checked={ribbonStyle === st.key}
              onClick={() => setRibbonStyle(st.key)}
              className="cursor-pointer rounded-full px-3.5 py-1.5 transition-colors hover:bg-white/10 aria-checked:bg-white aria-checked:text-[#0b1214]"
            >
              {st.label}
            </button>
          ))}
        </div>
        <div
          role="radiogroup"
          aria-label="Версия первого экрана"
          className="flex items-center gap-1 rounded-full bg-[#0b1214]/85 p-1 shadow-lg backdrop-blur-xl"
        >
          <span className="hidden px-3 text-white/60 sm:inline">Первый экран</span>
          {variants.map((v) => (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={variant === v.key}
              onClick={() => setVariant(v.key)}
              className="cursor-pointer rounded-full px-3.5 py-1.5 transition-colors hover:bg-white/10 aria-checked:bg-white aria-checked:text-[#0b1214]"
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
