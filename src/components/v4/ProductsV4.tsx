"use client";

import { useEffect, useRef, type CSSProperties } from "react";

import { formCenterOnScreen, MorphCanvas } from "@/components/v4/MorphCanvas";
import { MorphPoints } from "@/components/v5/MorphPoints";
import { productsV4 } from "@/content/v4";

/**
 * Свои продукты — список огромных названий; за ними одна 3D-форма перетекает из продукта
 * в продукт по мере прокрутки. Продукт, который сейчас у середины экрана, — «активный»:
 * его название в полную силу, линия под ним заливается бирюзой, остальные приглушены.
 *
 * Наведение на название: буквы слева направо «перекатываются» — каждая опрокидывается вперёд-вниз,
 * а на её место сверху выкатывается копия (см. roll), и название окрашивается в цвет продукта;
 * из центра 3D-формы круг заливает экран тёмным цветом продукта, а форма сразу перетекает
 * в этот продукт и темнеет. Курсор ушёл — заливка тает, буквы не крутятся.
 * На сенсорных экранах то же включается касанием и гаснет при прокрутке.
 */
type Props = {
  /** Чем нарисована форма за списком: "sdf" — гипсовые формы шейдером (/v4), "points" — частицы (/v5). */
  form?: "sdf" | "points";
};

export function ProductsV4({ form = "sdf" }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const floodRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  /** Огромный контурный номер активного продукта за формой (только /v5). */
  const numRef = useRef<HTMLSpanElement>(null);
  /** Что показывает форма: номер продукта с дробной частью (читает MorphCanvas). */
  const morph = useRef(0);
  /** 1 — экран залит, форму рисуем тёмной (читает MorphCanvas). */
  const dark = useRef(0);
  /** 0…1 — список пролистан за последний продукт: частицы уходят лентой вбок (читает MorphPoints). */
  const exit = useRef(0);
  /** 0…1 — первый продукт подходит к середине: лента из частиц прилетает и рассыпается в форму. */
  const enter = useRef(0);

  useEffect(() => {
    const list = listRef.current;
    const flood = floodRef.current;
    const stage = stageRef.current;
    if (!list || !flood || !stage) return;
    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-product]"));
    if (!rows.length) return;
    list.dataset.live = "";

    let scrollMorph = 0;
    let hover = -1;
    let hoverByTouch = false;
    let hoverScrollY = 0;
    const applyMorph = () => {
      morph.current = hover >= 0 ? hover : scrollMorph;
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers: number[] = [];
    /**
     * Перекат букв: слева направо с шагом 25 мс каждая буква мгновенно встаёт в исходное
     * положение (видна нижняя копия, верхняя спрятана над строкой), затем нижняя опрокидывается
     * вперёд-вниз и гаснет, а верхняя через 0,15 с выкатывается на её место. Длительность чуть
     * растёт к концу слова — волна растягивается.
     */
    const roll = (i: number) => {
      if (reduce) return;
      const a = Array.from(rows[i].querySelectorAll<HTMLElement>(".rl-a"));
      const b = Array.from(rows[i].querySelectorAll<HTMLElement>(".rl-b"));
      a.forEach((front, k) => {
        const back = b[k];
        timers.push(
          window.setTimeout(() => {
            front.style.transition = "none";
            front.style.transform = "rotateX(0deg) translateY(0) scaleY(1)";
            front.style.opacity = "1";
            back.style.transition = "none";
            back.style.transform = "rotateX(-75deg) translateY(-0.15em) scaleY(1.2)";
            back.style.opacity = "0";
            void front.offsetWidth; // зафиксировать исходное положение до запуска перехода
            const d = 0.4 + (k * 0.4) / 26;
            front.style.transition = `transform ${d}s ease, opacity ${d}s ease`;
            front.style.transform = "rotateX(75deg) translateY(0.15em) scaleY(1.2)";
            front.style.opacity = "0";
            back.style.transition = `transform ${d}s ease 0.15s, opacity ${d}s ease 0.15s`;
            back.style.transform = "rotateX(0deg) translateY(0) scaleY(1)";
            back.style.opacity = "1";
          }, k * 25),
        );
      });
    };

    const startHover = (i: number) => {
      if (hover === i) return;
      if (hover >= 0) delete rows[hover].dataset.hover;
      hover = i;
      rows[i].dataset.hover = "";
      roll(i);
      // круг растёт из центра 3D-формы; если заливка уже есть — просто меняем цвет
      if (!("on" in flood.dataset)) {
        const c = formCenterOnScreen(stage, form === "points");
        flood.style.setProperty("--fx", `${c.x}px`);
        flood.style.setProperty("--fy", `${c.y}px`);
      }
      flood.style.backgroundColor = productsV4.items[i].flood;
      flood.dataset.on = "";
      list.dataset.flood = "";
      dark.current = 1;
      applyMorph();
    };
    const endHover = () => {
      if (hover < 0) return;
      delete rows[hover].dataset.hover;
      hover = -1;
      delete flood.dataset.on;
      delete list.dataset.flood;
      dark.current = 0;
      applyMorph();
    };

    const names = rows.map((row) => row.querySelector<HTMLElement>("[data-name]"));
    const cleanups = names.map((name, i) => {
      if (!name) return () => {};
      const onEnter = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        hoverByTouch = false;
        startHover(i);
      };
      const onLeave = (e: PointerEvent) => {
        if (e.pointerType === "mouse" && hover === i) endHover();
      };
      const onClick = () => {
        // мышь уже включила всё наведением; касание — включает и выключает
        if (!hoverByTouch && hover === i) return;
        if (hover === i) {
          endHover();
          return;
        }
        hoverByTouch = true;
        hoverScrollY = window.scrollY;
        startHover(i);
      };
      name.addEventListener("pointerenter", onEnter);
      name.addEventListener("pointerleave", onLeave);
      name.addEventListener("click", onClick);
      return () => {
        name.removeEventListener("pointerenter", onEnter);
        name.removeEventListener("pointerleave", onLeave);
        name.removeEventListener("click", onClick);
      };
    });

    let active = -1;
    let raf = 0;
    const update = () => {
      raf = 0;
      const mid = window.innerHeight / 2;
      const centers = rows.map((row) => {
        const r = row.getBoundingClientRect();
        return r.top + r.height / 2;
      });
      // номер продукта с дробной частью: где середина экрана между центрами соседних строк
      let m = 0;
      if (mid <= centers[0]) m = 0;
      else if (mid >= centers[centers.length - 1]) m = centers.length - 1;
      else {
        for (let i = 0; i < centers.length - 1; i++) {
          if (mid >= centers[i] && mid < centers[i + 1]) {
            m = i + (mid - centers[i]) / (centers[i + 1] - centers[i]);
            break;
          }
        }
      }
      scrollMorph = m;
      // вход и выход лентой (над первым и под последним продуктом есть запас места);
      // выход начинается чуть раньше середины последнего — чтобы было видно, как форма вытягивается в ленту
      const vh = window.innerHeight;
      enter.current = 1 - Math.min(1, Math.max(0, (centers[0] - mid) / (vh * 0.8)));
      // выход начинается, когда последнее название уже ушло выше середины; лента доуходит, пока снизу
      // подъезжает следующий блок (под списком небольшой запас pb-[30svh]) — без пустой прокрутки
      exit.current = Math.min(1, Math.max(0, (mid - centers[centers.length - 1] - vh * 0.12) / (vh * 0.32)));
      // фон за формой проявляется с приходом ленты и гаснет с её уходом
      const backdrop = numRef.current?.parentElement;
      if (backdrop) backdrop.style.opacity = String(Math.min(enter.current, 1 - exit.current));
      const next = Math.round(m);
      if (next !== active) {
        if (active >= 0) delete rows[active].dataset.active;
        rows[next].dataset.active = "";
        active = next;
        if (numRef.current) numRef.current.textContent = String(next + 1).padStart(2, "0");
      }
      // прокрутка увела название из-под курсора (или пальца) — заливку гасим
      if (hover >= 0) {
        const gone = hoverByTouch ? Math.abs(window.scrollY - hoverScrollY) > 80 : !names[hover]?.matches(":hover");
        if (gone) endHover();
      }
      applyMorph();
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
      cleanups.forEach((off) => off());
      timers.forEach((t) => window.clearTimeout(t));
      endHover();
      delete list.dataset.live;
    };
  }, [form]);

  return (
    <section id="work" className="relative pt-28 pb-10 lg:pt-36">
      <div ref={floodRef} aria-hidden className="products-flood" />

      <div className="mx-auto flex w-full max-w-[100rem] flex-wrap items-end justify-between gap-6 px-5 sm:px-8">
        <h2 data-ribbon="products-title" className="text-[clamp(2.8rem,7.4vw,7.2rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
          <span data-shift="0.04" className="block will-change-transform">
            {productsV4.title}
          </span>
        </h2>
        <p className="max-w-[18rem] text-[0.8rem] leading-snug font-medium tracking-[0.04em] text-muted uppercase">{productsV4.note}</p>
      </div>

      <div className="relative">
        {/* холст «прилипает» к экрану, но не выходит за список: живёт внутри слоя во всю его высоту */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[1]">
          <div ref={stageRef} className="sticky top-0 h-svh">
            {form === "points" && (
              // тихий фон за формой: сетка точек, бирюзовое свечение и огромный контурный номер продукта
              <div className="products-backdrop">
                <div className="pb-grid" />
                <div className="pb-glow" />
                <span ref={numRef} className="pb-num">
                  01
                </span>
              </div>
            )}
            {form === "points" ? (
              <MorphPoints morph={morph} dark={dark} exit={exit} enter={enter} count={productsV4.items.length} />
            ) : (
              <MorphCanvas morph={morph} dark={dark} count={productsV4.items.length} />
            )}
          </div>
        </div>

        <ol
          ref={listRef}
          data-ribbon="products"
          className={`products-v4 relative z-[2] mx-auto w-full max-w-[100rem] px-5 sm:px-8 ${form === "points" ? "pt-[34svh] pb-[30svh]" : ""}`}
        >
          {productsV4.items.map((item, i) => (
            <li
              key={item.name}
              data-product={i}
              className="flex min-h-[80svh] flex-col justify-center"
              style={{ "--ink": item.ink } as CSSProperties}
            >
              <p className="product-kind mb-3 text-[0.7rem] font-medium tracking-[0.08em] text-muted uppercase sm:mb-4 sm:text-[0.75rem]">
                <span className="text-accent-ink tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span className="mx-2 text-fg/25">/</span>
                {item.kind}
              </p>
              <h3
                data-name
                aria-label={item.name}
                className="product-name w-fit cursor-default text-[clamp(2rem,7.2vw,7.5rem)] leading-[0.9] font-semibold tracking-[-0.05em] whitespace-nowrap"
              >
                <Letters text={item.name} />
              </h3>
              {/* описание — под названием, в левой половине: правая отдана 3D-форме */}
              <div className="mt-5 flex max-w-[50rem] flex-col gap-4 sm:mt-7 sm:flex-row sm:items-start sm:gap-8 lg:w-[58%]">
                <span className="relative mt-2.5 block h-px w-full bg-line sm:flex-1">
                  <span className="product-line absolute inset-0 origin-left bg-accent" />
                </span>
                <p className="product-text max-w-[17rem] shrink-0 text-[0.95rem] leading-snug text-fg/75">{item.text}</p>
              </div>
              {form === "points" && (
                <ul className="product-text mt-6 flex max-w-[50rem] flex-wrap gap-2 lg:w-[58%]">
                  {item.points.map((pt) => (
                    <li key={pt} className="product-point rounded-full border border-line px-3.5 py-1.5 text-[0.82rem] text-fg/70">
                      {pt}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      </div>

      <p className="relative mx-auto mt-2 w-full max-w-[100rem] px-5 text-[0.8rem] text-muted sm:px-8">{productsV4.footnote}</p>
    </section>
  );
}

/**
 * Название по буквам в два слоя: нижние буквы видны в покое, верхние лежат поверх
 * и выкатываются при наведении (roll). Пробел — неразрывный, как отдельная буква.
 */
function Letters({ text }: { text: string }) {
  const chars = Array.from(text).map((ch) => (ch === " " ? "\u00a0" : ch));
  return (
    <span aria-hidden className="rl">
      {chars.map((ch, k) => (
        <span key={k} className="rl-a">
          {ch}
        </span>
      ))}
      <span className="rl-layer">
        {chars.map((ch, k) => (
          <span key={k} className="rl-b">
            {ch}
          </span>
        ))}
      </span>
    </span>
  );
}
