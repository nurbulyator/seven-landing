"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { directionsV7 } from "@/content/v7";

/**
 * «Наши направления» (/v7) — «Галерея»: одно крупное фото на всю ширину, поверх большими буквами
 * название направления и чем занимаемся; само переключается на следующее (фото растворением), под
 * фото — все шесть направлений строкой с полоской времени, клик — переход.
 */

const list = directionsV7.list;
const N = list.length;

/** Сдвиг карточки i относительно текущей: от −⌊N/2⌋ до ⌈N/2⌉−1 (по кругу). */
const offsetOf = (i: number, active: number) => ((((i - active) % N) + N + Math.floor(N / 2)) % N) - Math.floor(N / 2);

/**
 * Счётчик шагов: растёт сам через stepMs после каждого шага, пока вкладка видна. Текущее
 * направление — step по модулю N. setStep — ручной переход; отсчёт до следующего шага начинается
 * заново. На паузе (paused) не растёт; после паузы досчитывает оставшееся время, а не всё заново —
 * в лад с полоской времени, которая на паузе замирает.
 */
function useAutoStep(stepMs: number, paused = false) {
  const [step, setStep] = useState(0);
  const left = useRef(stepMs);
  // новый шаг — отсчёт с начала (эффект объявлен раньше, поэтому срабатывает до взвода таймера)
  useEffect(() => {
    left.current = stepMs;
  }, [stepMs, step]);
  useEffect(() => {
    if (paused) return;
    const remaining = left;
    let id = 0;
    let t0 = 0;
    const arm = (ms: number) => {
      t0 = performance.now();
      id = window.setTimeout(() => {
        if (document.hidden) arm(stepMs);
        else setStep((a) => a + 1);
      }, ms);
    };
    arm(remaining.current);
    return () => {
      window.clearTimeout(id);
      remaining.current = Math.max(0, remaining.current - (performance.now() - t0));
    };
  }, [stepMs, step, paused]);
  return [step, setStep] as const;
}

const ENTER = "animate-[dir-in_800ms_cubic-bezier(0.16,1,0.3,1)_both]";

/**
 * «Галерея»: одно крупное фото на всю ширину блока, поверх — большими буквами название направления
 * и под ним, чем мы занимаемся (заголовок, текст, теги). Сама переключается на следующее
 * направление (stepMs): фото (статичное) сменяется растворением, текст проявляется заново.
 * Под фото — все шесть направлений строкой с полоской времени у текущего: видно, чем занимаемся,
 * клик — переход. Стрелки «назад/вперёд» — в углу фото. Пока курсор на фото — пауза.
 */
export function GalleryShowcase({ stepMs }: { stepMs: number }) {
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useAutoStep(stepMs, paused);
  const active = ((step % N) + N) % N;
  const d = list[active];
  const pick = (i: number) => setStep((s) => s + offsetOf(i, ((s % N) + N) % N));

  return (
    <div>
      <div
        className="relative h-[min(76svh,46rem)] overflow-hidden rounded-[24px] bg-[#050708] max-md:h-[36rem]"
        onMouseEnter={() => window.matchMedia("(hover: hover)").matches && setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {list.map((c, i) => {
          const on = i === active;
          return (
            <div
              key={c.id}
              aria-hidden={!on}
              className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${on ? "z-[1] opacity-100" : "opacity-0"}`}
            >
              {/* фото статичное — только смена растворением */}
              <Image src={c.image} alt={c.alt} fill sizes="(max-width: 1440px) 100vw, 1440px" className="object-cover" />
            </div>
          );
        })}
        {/* затемнение слева и снизу — под текст */}
        <div className="absolute inset-0 z-[2] bg-gradient-to-r from-[#050708]/85 via-[#050708]/45 to-transparent max-md:bg-gradient-to-t max-md:via-[#050708]/55" />
        <div className="absolute inset-x-0 bottom-0 z-[2] h-1/2 bg-gradient-to-t from-[#050708]/60 to-transparent" />

        <div key={step} className="absolute inset-0 z-[3] flex flex-col justify-end p-7 text-white sm:p-12 lg:p-16">
          <p className={`text-[1rem] font-semibold text-[#7fe3e8] tabular-nums ${ENTER}`}>
            {d.id} <span className="text-white/45">/ {list[N - 1].id}</span>
          </p>
          <h3
            className={`mt-4 max-w-[15ch] text-[clamp(2.4rem,5.6vw,5.8rem)] leading-[0.95] font-semibold tracking-[-0.045em] ${ENTER}`}
            style={{ animationDelay: "80ms" }}
          >
            {d.label}
          </h3>
          <p className={`mt-6 max-w-[38rem] text-[clamp(1.15rem,1.7vw,1.55rem)] leading-snug font-medium text-white/90 ${ENTER}`} style={{ animationDelay: "180ms" }}>
            {d.title}
          </p>
          <p className={`mt-2 max-w-[36rem] text-[1.02rem] leading-snug text-white/70 sm:text-[1.1rem] ${ENTER}`} style={{ animationDelay: "240ms" }}>
            {d.text}
          </p>
          <div className={`mt-6 flex flex-wrap gap-2 ${ENTER}`} style={{ animationDelay: "300ms" }}>
            {d.tags.map((t) => (
              <span key={t} className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[0.85rem] text-white/90 backdrop-blur-md">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* стрелки — в правом нижнем углу фото */}
        <div className="absolute right-5 bottom-5 z-[4] flex gap-2 sm:right-8 sm:bottom-8">
          {([-1, 1] as const).map((dir) => (
            <button
              key={dir}
              type="button"
              aria-label={dir < 0 ? "Предыдущее направление" : "Следующее направление"}
              onClick={() => setStep((s) => s + dir)}
              className="grid size-12 cursor-pointer place-items-center rounded-full border border-white/25 bg-white/10 text-white backdrop-blur-md transition-[background-color,transform] duration-300 hover:scale-[1.05] hover:bg-white/20"
            >
              <svg viewBox="0 0 20 20" className={`size-5 ${dir < 0 ? "rotate-180" : ""}`} aria-hidden>
                <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      {/* все направления строкой: полоска времени у текущего, клик — переход */}
      <div className="mt-5 grid grid-cols-6 gap-4 max-lg:flex max-lg:gap-3 max-lg:overflow-x-auto max-lg:[scrollbar-width:none]">
        {list.map((c, i) => {
          const on = i === active;
          return (
            <button
              key={c.id}
              type="button"
              aria-current={on || undefined}
              onClick={() => pick(i)}
              // содержимое — от верха: иначе кнопка центрирует его по высоте, и у однострочных подписей
              // полоска съезжает ниже, чем у двухстрочных
              className="group flex cursor-pointer flex-col justify-start pt-1 text-left outline-none max-lg:min-w-[12rem] focus-visible:ring-2 focus-visible:ring-accent"
            >
              <span className="block h-[3px] w-full overflow-hidden rounded-full bg-fg/12">
                {on && (
                  <span
                    key={step}
                    className="block h-full origin-left rounded-full bg-accent"
                    style={{ animation: `dir-progress ${stepMs}ms linear both`, animationPlayState: paused ? "paused" : "running" }}
                  />
                )}
              </span>
              <span className={`mt-3 block text-[0.85rem] font-semibold tabular-nums transition-colors ${on ? "text-accent-ink dark:text-accent" : "text-fg/40"}`}>
                {c.id}
              </span>
              <span className={`mt-1 block text-[1rem] leading-snug font-medium transition-colors ${on ? "text-fg" : "text-fg/50 group-hover:text-fg/80"}`}>
                {c.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
