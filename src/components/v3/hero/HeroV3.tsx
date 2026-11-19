"use client";

import { useSyncExternalStore } from "react";

import { useTheme } from "@/components/ThemeToggle";
import { FluidCanvas } from "@/components/v3/hero/FluidCanvas";
import { ReliefCanvas } from "@/components/v3/hero/ReliefCanvas";
import { SevenFrames } from "@/components/v3/SevenFrames";
import { heroV3 } from "@/content/v3";

/**
 * Первый экран /v3. По умолчанию — объёмный знак «7» (кадры Blender, поворачивается за курсором);
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

/** Наполнение первого экрана — пока сравниваем варианты; выбор хранится в браузере зрителя. */
const fills = [
  { key: "none", label: "Нет" },
  { key: "facts", label: "Факты" },
  { key: "status", label: "Статус" },
  { key: "both", label: "Оба" },
] as const;
type Fill = (typeof fills)[number]["key"];
const FILL_KEY = "v3-hero-fill";
const fillListeners = new Set<() => void>();
function readFill(): Fill {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(FILL_KEY);
  } catch {}
  return fills.find((f) => f.key === saved)?.key ?? "both";
}
function subscribeFill(listener: () => void) {
  fillListeners.add(listener);
  return () => fillListeners.delete(listener);
}
function setFill(f: Fill) {
  try {
    localStorage.setItem(FILL_KEY, f);
  } catch {}
  fillListeners.forEach((l) => l());
}

/** Панель «системы работают»: подкрепляет заголовок, точки мягко пульсируют. */
function StatusPanel({ dark }: { dark: boolean }) {
  const st = heroV3.status;
  return (
    <div
      aria-label={st.title}
      className={`pointer-events-none absolute right-6 bottom-6 z-10 w-[15.5rem] rounded-[1.25rem] p-5 backdrop-blur-xl max-lg:hidden lg:right-10 lg:bottom-10 ${
        dark ? "bg-white/[0.06] text-white shadow-[0_0_0_1px_rgb(255_255_255/0.08)]" : "bg-white/70 text-[#0b1214] shadow-[0_0_0_1px_rgb(17_22_24/0.06),0_20px_50px_-30px_rgb(17_22_24/0.35)]"
      }`}
    >
      <p className={`text-[0.72rem] font-medium tracking-[0.06em] uppercase ${dark ? "text-white/55" : "text-[#0b1214]/50"}`}>{st.title}</p>
      <ul className="mt-3 space-y-2.5">
        {st.items.map((item, i) => (
          <li key={item} className="flex items-center justify-between gap-3 text-[0.92rem]">
            <span className="flex items-center gap-2.5">
              <span className="relative flex size-2">
                <span
                  className="absolute inset-0 animate-ping rounded-full bg-[#2bd47d] opacity-60"
                  style={{ animationDuration: "2.4s", animationDelay: `${i * 0.6}s` }}
                />
                <span className="relative size-2 rounded-full bg-[#2bd47d]" />
              </span>
              {item}
            </span>
            <span className={`text-[0.78rem] ${dark ? "text-white/45" : "text-[#0b1214]/45"}`}>{st.state}</span>
          </li>
        ))}
      </ul>
      <p className={`mt-4 border-t pt-3 text-[0.78rem] ${dark ? "border-white/10 text-white/55" : "border-black/5 text-[#0b1214]/55"}`}>{st.footer}</p>
    </div>
  );
}

export function HeroV3() {
  const variant = useSyncExternalStore<Variant>(subscribe, readVariant, () => "seven");
  const fill = useSyncExternalStore<Fill>(subscribeFill, readFill, () => "both");
  const showFacts = fill === "facts" || fill === "both";
  const showStatus = fill === "status" || fill === "both";
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
        {showStatus && <StatusPanel dark={darkCard} />}

        <div
          className={`pointer-events-none relative z-10 flex h-full flex-col justify-end p-6 sm:p-10 lg:p-14 ${
            darkCard ? "text-white" : "text-[#0b1214]"
          }`}
        >
          <p className={`text-[0.95rem] font-medium ${darkCard ? "text-[#7fe3e8]" : "text-[#00828a]"}`}>{heroV3.eyebrow}</p>
          <h1 className="mt-3 text-[clamp(2.2rem,7.4vw,7.2rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
            {heroV3.title.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </h1>
          <div className="mt-6 flex flex-col items-start gap-6">
            <p className={`max-w-[32rem] text-[1.05rem] leading-snug sm:text-[1.2rem] ${darkCard ? "text-white/75" : "text-[#0b1214]/70"}`}>
              {heroV3.lead}
            </p>
            <div className="pointer-events-auto flex flex-wrap gap-3">
              <a
                href="#contact"
                className="rounded-full bg-[#00bbc4] px-6 py-3 text-[0.98rem] font-medium whitespace-nowrap text-[#050708] transition-transform hover:scale-[1.03]"
              >
                {heroV3.primary}
              </a>
              <a
                href="#directions"
                className={`rounded-full px-6 py-3 text-[0.98rem] font-medium whitespace-nowrap backdrop-blur-md transition-colors ${
                  darkCard ? "bg-white/12 hover:bg-white/20" : "bg-black/5 hover:bg-black/10"
                }`}
              >
                {heroV3.secondary}
              </a>
            </div>
          </div>
          {showFacts && (
            <dl
              className={`mt-8 grid max-w-[56rem] grid-cols-2 gap-x-8 gap-y-4 border-t pt-6 sm:grid-cols-4 ${
                darkCard ? "border-white/10" : "border-black/[0.07]"
              }`}
            >
              {heroV3.facts.map((f) => (
                <div key={f.label}>
                  <dt className="sr-only">{f.label}</dt>
                  <dd className="text-[clamp(1.5rem,2.4vw,2.2rem)] leading-none font-semibold tracking-[-0.03em]">{f.value}</dd>
                  <dd className={`mt-1.5 text-[0.85rem] ${darkCard ? "text-white/60" : "text-[#0b1214]/55"}`}>{f.label}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <div aria-hidden className="flex items-center justify-between px-1 py-3 text-[0.72rem] font-medium tracking-[0.08em] text-muted uppercase">
        <span>+</span>
        <span className="hidden sm:inline">+</span>
        <span>Листайте</span>
        <span className="hidden sm:inline">+</span>
        <span>+</span>
      </div>

      {/* переключатели для сравнения вариантов: наполнение и первый экран
          (справа под шапкой, чтобы не закрывали содержимое) */}
      <div className="fixed top-[4.6rem] right-4 z-50 flex flex-col items-end gap-2 text-[0.8rem] text-white">
        <div
          role="radiogroup"
          aria-label="Наполнение первого экрана"
          className="flex items-center gap-1 rounded-full bg-[#0b1214]/85 p-1 shadow-lg backdrop-blur-xl"
        >
          <span className="hidden px-3 text-white/60 sm:inline">Наполнение</span>
          {fills.map((f) => (
            <button
              key={f.key}
              type="button"
              role="radio"
              aria-checked={fill === f.key}
              onClick={() => setFill(f.key)}
              className="cursor-pointer rounded-full px-3.5 py-1.5 transition-colors hover:bg-white/10 aria-checked:bg-white aria-checked:text-[#0b1214]"
            >
              {f.label}
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
