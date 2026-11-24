"use client";

import { useEffect, useRef } from "react";

import { numbers } from "@/content/site";
import { aboutV7 } from "@/content/v7";

/** Цифры-количества досчитывают от нуля, когда до них доходит лента; год и «24/7» просто проявляются. */
const COUNTED = new Set<string>(["20", "250+", "150+"]);
/** Длительность счёта, мс. */
const COUNT_MS = 1400;
/** Цифры стартуют по очереди: следующая — не раньше чем через столько мс после предыдущей. */
const GAP_MS = 450;
/** Появление цифры в её очередь: выезжает снизу из размытия, мс (счёт идёт параллельно). */
const REVEAL_MS = 750;

/**
 * Блок цифр /v7 — вместо закреплённого экрана /v3–/v6, где цифры сменялись прокруткой.
 * Обычной высоты, листается как любой блок: на полотне [data-sheet] «О компании» и все пять цифр.
 * Лента строго за прокруткой ныряет под ткань и один раз проходит под цифрами (ribbonRouteV7):
 * цифра над головой ленты приподнимается и бирюзовеет, подпись проявляется (--k ставит PageGL
 * по data-lift). До прохода ленты цифр не видно (--w = 1); голова прошла цифру (data-pass) — в
 * свою очередь (GAP_MS) цифра выезжает снизу из размытия, подпись проявляется, а количества ещё
 * и досчитывают от нуля, один раз. Пока цифра считает, она приподнята и бирюзовая (--c). Без WebGL (и при «уменьшить движение») цифры сразу на месте.
 * data-ribbon="num-i" — центры цифр, через них идёт лента.
 */
export function NumbersV7() {
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const valueRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    const items = numbers.map((n, i) => ({
      n,
      count: COUNTED.has(n.value) ? /^(\d+)(\D*)$/.exec(n.value) : null,
      state: "run" as "run" | "wait" | "queued" | "done", // queued — ждёт очереди, run — досчитывает
      t0: 0,
      i,
    }));
    const born = performance.now();
    let lastStart = -Infinity;
    let armed = false;
    let raf = 0;
    const tick = (now: number) => {
      // WebGL-слой включается эффектом PageGL (он выше по дереву, срабатывает позже) — ждём его;
      // не включился за 3 с — значит, ленты не будет, цифры остаются как есть
      if (!armed) {
        if (root.dataset.gl !== "on") {
          if (now - born < 3000) raf = requestAnimationFrame(tick);
          return;
        }
        armed = true;
        const vh = window.innerHeight;
        for (const it of items) {
          const el = itemRefs.current[it.i];
          // уже на экране (перезагрузка посреди страницы) — без анимации
          if (!el || el.getBoundingClientRect().top < vh) {
            it.state = "done";
            continue;
          }
          it.state = "wait";
          el.style.setProperty("--w", "1");
          const v = valueRefs.current[it.i];
          if (v && it.count) v.textContent = `0${it.count[2]}`;
        }
      }
      let busy = false;
      for (const it of items) {
        const el = itemRefs.current[it.i];
        const v = valueRefs.current[it.i];
        if (!el || !v || it.state === "done") continue;
        busy = true;
        if (it.state === "wait") {
          // голова ленты прошла точку цифры на маршруте (data-passed ставит PageGL) — даже если
          // при быстрой прокрутке проскочила её за один кадр
          if (!el.hasAttribute("data-passed")) continue;
          it.state = "queued";
          it.t0 = lastStart = Math.max(now, lastStart + GAP_MS);
        }
        if (it.state === "queued") {
          if (now < it.t0) continue;
          it.state = "run";
        }
        const r = Math.min(1, (now - it.t0) / REVEAL_MS);
        el.style.setProperty("--w", Math.pow(1 - r, 3).toFixed(3));
        const f = Math.min(1, (now - it.t0) / COUNT_MS);
        if (it.count) v.textContent = `${Math.round(Number(it.count[1]) * (1 - Math.pow(1 - f, 3)))}${it.count[2]}`;
        // пока считает — цифра приподнята и бирюзовая, к концу счёта мягко опускается
        el.style.setProperty("--c", (1 - f * f).toFixed(3));
        if (f >= 1) {
          v.textContent = it.n.value;
          el.style.setProperty("--c", "0");
          el.style.setProperty("--w", "0");
          it.state = "done";
        }
      }
      if (busy) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <section id="about" data-ribbon="numbers" className="relative px-2.5 py-10 sm:px-4 lg:py-16">
      <div
        data-sheet
        data-ribbon="numbers-stage"
        className="relative rounded-[2rem] bg-bg-2 px-6 py-14 shadow-[0_1px_0_var(--line),0_30px_80px_-40px_var(--shadow)] sm:px-10 lg:px-16 lg:py-24"
      >
        {/* поверх холста PageGL (z-[5]): бугорок ткани ложится под текст, а не на него */}
        <div className="relative z-[6] mx-auto grid max-w-[90rem] gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="text-[clamp(2.4rem,5.4vw,5rem)] leading-[0.98] font-semibold tracking-[-0.045em] lg:col-span-5">
            {aboutV7.title}
          </h2>
          <p className="max-w-[40rem] text-[1.1rem] leading-relaxed text-fg/75 sm:text-[1.25rem] lg:col-span-7">{aboutV7.text}</p>
        </div>

        <div className="relative z-[6] mx-auto mt-16 grid max-w-[90rem] grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:mt-24 lg:grid-cols-5">
          {numbers.map((n, i) => (
            <div
              key={n.value}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              data-lift
              data-pass={`num-${i}`}
              className="flex flex-col items-center text-center"
            >
              <p
                data-ribbon={`num-${i}`}
                style={{
                  color: "color-mix(in srgb, var(--fg), var(--accent) calc(max(var(--k, 0), var(--c, 0)) * 100%))",
                  transform:
                    "translateY(calc(max(var(--k, 0), var(--c, 0)) * -0.12em)) scale(calc(1 + max(var(--k, 0), var(--c, 0)) * 0.06))",
                }}
                className="text-[clamp(2.8rem,6.4vw,6.4rem)] leading-none font-semibold tracking-[-0.05em] will-change-transform"
              >
                {/* появление — на внутреннем span: прямоугольник цифры (к нему привязана лента) не сдвигается */}
                <span
                  ref={(el) => {
                    valueRefs.current[i] = el;
                  }}
                  style={{
                    opacity: "calc(1 - var(--w, 0))",
                    transform: "translateY(calc(var(--w, 0) * 0.5em))",
                    filter: "blur(calc(var(--w, 0) * 0.22em))",
                  }}
                  className="inline-block will-change-[transform,filter]"
                >
                  {n.value}
                </span>
              </p>
              <p
                style={{ opacity: "calc((0.5 + max(var(--k, 0), var(--c, 0)) * 0.5) * (1 - var(--w, 0)))" }}
                className="mt-4 max-w-[15rem] text-[0.98rem] leading-snug text-muted sm:text-[1.05rem]"
              >
                {n.caption}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
