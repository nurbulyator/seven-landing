"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { directionsV7 } from "@/content/v7";

/** Шар (Infinite Menu, WebGL) — отдельным чанком и только на клиенте. */
const InfiniteMenu = dynamic(() => import("@/components/reactbits/InfiniteMenu"), { ssr: false });
type SphereApi = { goToItem(index: number): void };

/**
 * Подачи «Наших направлений» (/v7), листаются сами, по времени.
 *  - «Шар»: Infinite Menu из React Bits — его подписи выключены, вместо них свои (слева номер и
 *    название, справа заголовок, текст, теги — вне маски, поэтому не блёкнут); края шара тают в фоне;
 *    под шаром стрелки «назад/вперёд» и отметки направлений; крутить можно и мышью;
 *  - «Фокус»: как вид шара (Infinite Menu) вблизи — крупная карточка в центре, слева большое
 *    название, справа заголовок, текст и теги; предыдущая карточка выглядывает из левого верхнего
 *    угла, следующая — из правого нижнего, все прямо, без поворота; на каждом шаге всё сдвигается
 *    по диагонали; по клику на соседнюю карточку или на полоску внизу — переход к ней; пока
 *    курсор на центральной карточке — пауза (плашка «Пауза» в углу, полоска времени замирает);
 *  - «Шторка»: та же раскладка, но фото не едут — следующее раскрывается поверх кругом снизу
 *    и медленно наплывает;
 *  - «Веер»: карточки веером, как карты в руке, текущая встаёт вертикально и приподнимается;
 *  - «Орбита»: карточки ходят по эллипсу, текущая выходит вперёд крупно;
 *  - «Мозаика»: одна большая плитка и пять маленьких; каждый шаг следующее направление переезжает
 *    в большую плитку (с текстом поверх), остальные сдвигаются по кругу;
 *  - «Куб»: карточка поворачивается гранью куба к следующему направлению, текст по бокам;
 *  - «Линза»: широкое фото с медленным наплывом, смена — растворением; текст поверх, справа
 *    миниатюры с полоской времени у текущей.
 */

const list = directionsV7.list;
type Direction = (typeof list)[number];
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

/**
 * Полоска времени до следующего шага: перезапускается на каждом шаге (key), на паузе замирает.
 * С onPick отрезки — кнопки перехода к направлению (зона нажатия выше самой полоски).
 */
function Progress({
  active,
  stepMs,
  onPick,
  paused = false,
}: {
  active: number;
  stepMs: number;
  onPick?: (i: number) => void;
  paused?: boolean;
}) {
  return (
    <div className="mx-auto mt-8 flex max-w-[18rem] items-center gap-1.5" aria-hidden={!onPick}>
      {list.map((d, i) => {
        const bar = (
          <span className="block h-[3px] w-full overflow-hidden rounded-full bg-fg/12">
            {i === active && (
              <span
                key={active}
                className="block h-full origin-left rounded-full bg-accent"
                style={{ animation: `dir-progress ${stepMs}ms linear both`, animationPlayState: paused ? "paused" : "running" }}
              />
            )}
            {i < active && <span className="block h-full rounded-full bg-fg/35" />}
          </span>
        );
        return onPick ? (
          <button
            key={d.id}
            type="button"
            aria-label={`${d.id} · ${d.label}`}
            aria-current={i === active || undefined}
            onClick={() => onPick(i)}
            className="flex-1 cursor-pointer py-2.5 outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-accent"
          >
            {bar}
          </button>
        ) : (
          <span key={d.id} className="flex-1">
            {bar}
          </span>
        );
      })}
    </div>
  );
}

function Tags({ d, center = false }: { d: Direction; center?: boolean }) {
  return (
    <div className={`mt-5 flex flex-wrap gap-2 ${center ? "justify-center" : ""}`}>
      {d.tags.map((t) => (
        <span key={t} className="rounded-full border border-line px-3 py-1 text-[0.8rem] text-fg/70">
          {t}
        </span>
      ))}
    </div>
  );
}

const ENTER = "animate-[dir-in_800ms_cubic-bezier(0.16,1,0.3,1)_both]";
const MOVE = "transition-[transform,opacity] duration-[1100ms] ease-[cubic-bezier(0.65,0,0.35,1)]";

/**
 * Сколько соседняя карточка «Фокуса» выступает над сценой (и столько же под ней): её центр на 0,74
 * ширины карточки от центра, половина её высоты — 0,31 ширины. Сцену не обрезаем — вместо этого
 * отступ сверху и снизу на этот выступ (минус 3rem — их и так даёт зазор под заголовком).
 */
const FOCUS_PAD = "lg:py-[max(0px,calc(min(36vw,31rem)*1.05-min(41svh,22rem)-3rem))]";

/**
 * «Фокус»: вид шара вблизи — карточка в центре, соседи по диагонали, текст по бокам. Сцена не
 * обрезана: соседи видны целиком. Лента проходит под видимыми карточками (у каждой data-occlude),
 * а не под невидимым прямоугольником всего блока.
 */
export function FocusShowcase({ stepMs }: { stepMs: number }) {
  // пауза — пока курсор на центральной карточке (только мышь: на телефоне «наведение» залипает)
  const [paused, setPaused] = useState(false);
  const [step, setStep] = useAutoStep(stepMs, paused);
  const active = ((step % N) + N) % N;
  const d = list[active];
  // к направлению i — коротким путём (на соседа — ровно на шаг), чтобы всё сдвинулось по диагонали
  const pick = (i: number) => setStep((s) => s + offsetOf(i, ((s % N) + N) % N));
  return (
    <div className={FOCUS_PAD}>
      {/* isolate: карточки в своём слое, заголовок блока (z-10) остаётся над ними */}
      <div className="relative isolate h-[min(82svh,44rem)] max-lg:h-[26rem]">
        {list.map((c, i) => {
          const o = offsetOf(i, active);
          const far = Math.abs(o) > 1;
          const near = Math.abs(o) === 1;
          // соседи — по диагонали (как плитки шара вокруг передней), дальние уезжают дальше и гаснут
          const k = far ? Math.sign(o) * 1.6 : o;
          const transform =
            o === 0
              ? "translate(-50%,-50%)"
              : `translate(-50%,-50%) translate(${k * 112}%, ${k * 74}%) scale(${far ? 0.42 : 0.62})`;
          // div, а не button: у центральной карточки нужны события мыши (пауза), а disabled-кнопка
          // их не получает; соседи — кнопки по роли (клик, Enter/пробел)
          return (
            <div
              key={c.id}
              role={near ? "button" : undefined}
              tabIndex={near ? 0 : undefined}
              aria-hidden={far || undefined}
              aria-label={near ? `${o < 0 ? "Предыдущее" : "Следующее"} направление: ${c.label}` : undefined}
              onClick={near ? () => pick(i) : undefined}
              onKeyDown={
                near
                  ? (e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      pick(i);
                    }
                  : undefined
              }
              onPointerEnter={(e) => {
                if (o === 0 && e.pointerType === "mouse") setPaused(true);
              }}
              onPointerLeave={() => setPaused(false)}
              data-occlude={far ? undefined : true}
              className={`absolute top-1/2 left-1/2 aspect-square w-[min(36vw,31rem)] overflow-hidden rounded-[40px] bg-bg-2 shadow-[0_40px_80px_-40px_var(--shadow)] outline-none max-lg:w-[min(78vw,22rem)] focus-visible:ring-4 focus-visible:ring-accent ${near ? "cursor-pointer" : ""} ${MOVE}`}
              style={{ transform, opacity: far ? 0 : 1, zIndex: 10 - Math.abs(o), pointerEvents: far ? "none" : undefined }}
            >
              <Image
                src={c.image}
                alt={o === 0 ? c.alt : ""}
                fill
                sizes="(max-width: 1023px) 78vw, 36vw"
                className="object-cover"
              />
              {/* пока курсор на центральной карточке — листание стоит, в углу плашка «Пауза» */}
              {o === 0 && (
                <span
                  aria-hidden
                  data-on={paused}
                  className="absolute top-6 left-6 flex items-center gap-2 rounded-full bg-[#081012]/55 py-2 pr-4 pl-3 text-[0.85rem] font-medium text-white opacity-0 backdrop-blur-md transition-[opacity,transform] duration-300 data-[on=true]:opacity-100 data-[on=false]:-translate-y-1"
                >
                  <svg viewBox="0 0 16 16" className="size-3" aria-hidden>
                    <rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                    <rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor" />
                  </svg>
                  Пауза
                </span>
              )}
            </div>
          );
        })}

        {/* текст по бокам карточки — только на широком экране; на узком он под карточкой */}
        <div className="pointer-events-none absolute inset-0 hidden items-center lg:flex">
          <div className="w-[calc(50%-min(18vw,15.5rem)-2.5rem)] text-right">
            <h3 key={d.id} className={`text-[clamp(2.2rem,3.6vw,3.6rem)] leading-[1.02] font-semibold tracking-[-0.04em] ${ENTER}`}>
              {d.label}
            </h3>
          </div>
          <div className="ml-auto w-[calc(50%-min(18vw,15.5rem)-2.5rem)]">
            <div key={d.id} className={ENTER} style={{ animationDelay: "120ms" }}>
              <p className="text-[0.95rem] font-semibold text-accent-ink dark:text-accent">{d.id}</p>
              <p className="mt-2 text-[1.2rem] leading-snug font-medium">{d.title}</p>
              <p className="mt-3 leading-relaxed text-fg/70">{d.text}</p>
              <Tags d={d} />
            </div>
          </div>
        </div>
      </div>

      <div key={d.id} className={`mx-auto mt-6 max-w-[34rem] text-center lg:hidden ${ENTER}`}>
        <p className="text-[0.95rem] font-semibold text-accent-ink dark:text-accent">{d.id}</p>
        <h3 className="mt-2 text-[1.8rem] leading-[1.05] font-semibold tracking-[-0.03em]">{d.label}</h3>
        <p className="mt-3 text-[1.05rem] leading-snug font-medium">{d.title}</p>
        <p className="mt-2 leading-relaxed text-fg/70">{d.text}</p>
        <Tags d={d} center />
      </div>
      <Progress active={active} stepMs={stepMs} onPick={pick} paused={paused} />
    </div>
  );
}

/** Описание текущего направления под сценой: проявляется заново на каждом шаге (key). */
function Info({ d }: { d: Direction }) {
  return (
    <div key={d.id} className={`relative mx-auto mt-8 max-w-[44rem] text-center ${ENTER}`}>
      <p className="text-[0.95rem] font-medium text-accent-ink dark:text-accent">
        {d.id} · {d.label}
      </p>
      <h3 className="mt-3 text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.1] font-semibold tracking-[-0.03em]">{d.title}</h3>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-fg/70">{d.text}</p>
      <Tags d={d} center />
    </div>
  );
}

/** Раскладка «как у шара»: слева большое название, в центре сцена, справа подробности; на узком — текст под сценой. */
function SideStage({ d, children }: { d: Direction; children: ReactNode }) {
  return (
    <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-12">
      <h3
        key={`l-${d.id}`}
        className={`hidden text-right text-[clamp(2.2rem,3.6vw,3.6rem)] leading-[1.02] font-semibold tracking-[-0.04em] lg:block ${ENTER}`}
      >
        {d.label}
      </h3>
      <div className="mx-auto">{children}</div>
      <div key={`r-${d.id}`} className={`max-lg:mx-auto max-lg:max-w-[34rem] max-lg:text-center ${ENTER}`} style={{ animationDelay: "120ms" }}>
        <p className="text-[0.95rem] font-semibold text-accent-ink dark:text-accent">{d.id}</p>
        <h3 className="mt-2 text-[1.8rem] leading-[1.05] font-semibold tracking-[-0.03em] lg:hidden">{d.label}</h3>
        <p className="mt-2 text-[1.2rem] leading-snug font-medium">{d.title}</p>
        <p className="mt-3 leading-relaxed text-fg/70">{d.text}</p>
        <div className="max-lg:[&>div]:justify-center">
          <Tags d={d} />
        </div>
      </div>
    </div>
  );
}

const PHOTO_SIZES = "(max-width: 1023px) 80vw, 36vw";

/** «Шторка»: следующее фото раскрывается поверх кругом снизу и медленно наплывает. */
export function WipeShowcase({ stepMs }: { stepMs: number }) {
  const [step] = useAutoStep(stepMs);
  const active = step % N;
  const prev = (active + N - 1) % N;
  return (
    <div>
      <SideStage d={list[active]}>
        <div className="relative aspect-square w-[min(36vw,31rem)] overflow-hidden rounded-[40px] bg-bg-2 shadow-[0_40px_80px_-40px_var(--shadow)] max-lg:w-[min(80vw,24rem)]">
          {list.map((c, i) => {
            const on = i === active;
            const under = i === prev && step > 0;
            if (!on && !under) return null;
            return (
              <div
                key={on ? `on-${step}` : `under-${c.id}`}
                className="absolute inset-0"
                style={{
                  zIndex: on ? 2 : 1,
                  animation: on && step > 0 ? "dir-wipe 1100ms cubic-bezier(0.65,0,0.35,1) both" : undefined,
                }}
              >
                <Image
                  src={c.image}
                  alt={on ? c.alt : ""}
                  fill
                  sizes={PHOTO_SIZES}
                  className="object-cover"
                  style={{ animation: on ? `dir-kb ${stepMs + 1200}ms ease-out both` : undefined }}
                />
              </div>
            );
          })}
        </div>
      </SideStage>
      <Progress active={active} stepMs={stepMs} />
    </div>
  );
}

/** «Веер»: карточки веером вокруг точки под сценой; текущая вертикально по центру и чуть выше. */
export function FanShowcase({ stepMs }: { stepMs: number }) {
  const active = useAutoStep(stepMs)[0] % N;
  return (
    <div>
      <div className="relative h-[min(62svh,32rem)] overflow-hidden max-sm:h-[22rem]">
        {list.map((c, i) => {
          const o = offsetOf(i, active);
          const a = Math.abs(o);
          return (
            <div
              key={c.id}
              aria-hidden={o !== 0}
              className={`absolute bottom-[6%] left-1/2 aspect-[3/4] w-[min(24vw,18rem)] origin-[50%_170%] overflow-hidden rounded-[24px] bg-bg-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)] max-sm:w-[44vw] ${MOVE}`}
              style={{
                transform: `translateX(-50%) rotate(${o * 15}deg) translateY(${o === 0 ? -6 : 0}%) scale(${o === 0 ? 1 : 0.92})`,
                opacity: a > 2 ? 0 : 1,
                zIndex: 10 - a,
                filter: o === 0 ? "none" : "brightness(0.75) saturate(0.7)",
              }}
            >
              <Image src={c.image} alt={c.alt} fill sizes="(max-width: 639px) 44vw, 24vw" className="object-cover" />
            </div>
          );
        })}
      </div>
      <Info d={list[active]} />
      <Progress active={active} stepMs={stepMs} />
    </div>
  );
}

/** «Орбита»: карточки по эллипсу; угол — от сдвига относительно текущей, текущая спереди внизу. */
export function OrbitShowcase({ stepMs }: { stepMs: number }) {
  const [step] = useAutoStep(stepMs);
  const active = step % N;
  return (
    <div>
      <div className="relative h-[min(60svh,30rem)] max-sm:h-[20rem]">
        {list.map((c, i) => {
          // угол копится вместе с шагами, чтобы карточки всегда шли по эллипсу в одну сторону
          const theta = ((i - step) / N) * Math.PI * 2;
          const front = (Math.cos(theta) + 1) / 2; // 1 — спереди, 0 — сзади
          return (
            <div
              key={c.id}
              aria-hidden={i !== active}
              className="absolute top-1/2 left-1/2 aspect-[4/3] w-[min(30vw,22rem)] overflow-hidden rounded-[24px] bg-bg-2 shadow-[0_30px_60px_-30px_rgba(0,0,0,0.45)] transition-[transform,filter] duration-[1100ms] ease-[cubic-bezier(0.65,0,0.35,1)] max-sm:w-[52vw]"
              style={{
                transform: `translate(-50%,-50%) translate(${Math.sin(theta) * 120}%, ${(front - 0.5) * 46}%) scale(${0.45 + 0.55 * front})`,
                zIndex: Math.round(front * 10),
                filter: i === active ? "none" : `brightness(${0.6 + 0.3 * front}) saturate(0.7)`,
              }}
            >
              <Image src={c.image} alt={c.alt} fill sizes="(max-width: 639px) 52vw, 30vw" className="object-cover" />
            </div>
          );
        })}
      </div>
      <Info d={list[active]} />
      <Progress active={active} stepMs={stepMs} />
    </div>
  );
}

/** Ячейки «Мозаики», % от сцены: большая слева, справа две сверху и три снизу. */
const MOSAIC = [
  { l: 0, t: 0, w: 49, h: 100 },
  { l: 51, t: 0, w: 23.5, h: 49 },
  { l: 76.5, t: 0, w: 23.5, h: 49 },
  { l: 51, t: 51, w: 15.33, h: 49 },
  { l: 67.83, t: 51, w: 15.33, h: 49 },
  { l: 84.67, t: 51, w: 15.33, h: 49 },
];

/** «Мозаика»: следующее направление переезжает в большую плитку, остальные — по кругу. */
export function MosaicShowcase({ stepMs }: { stepMs: number }) {
  const active = useAutoStep(stepMs)[0] % N;
  const d = list[active];
  return (
    <div>
      <div className="relative aspect-[2.1/1] max-md:aspect-[4/5]">
        {list.map((c, i) => {
          const rank = (i - active + N) % N;
          const cell = MOSAIC[rank];
          const big = rank === 0;
          return (
            <div
              key={c.id}
              className="absolute overflow-hidden rounded-[24px] bg-bg-2 transition-[left,top,width,height] duration-[1100ms] ease-[cubic-bezier(0.65,0,0.35,1)] max-md:rounded-[18px]"
              style={{ left: `${cell.l}%`, top: `${cell.t}%`, width: `${cell.w}%`, height: `${cell.h}%`, zIndex: big ? 2 : 1 }}
            >
              <Image
                src={c.image}
                alt={c.alt}
                fill
                sizes={big ? "(max-width: 767px) 50vw, 45vw" : "(max-width: 767px) 25vw, 22vw"}
                className="object-cover"
              />
              <span className="absolute top-3 left-3 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-[#081012]/55 px-2.5 text-[0.82rem] font-semibold text-white backdrop-blur-md">
                {c.id}
              </span>
            </div>
          );
        })}
        {/* текст поверх большой плитки */}
        <div className="pointer-events-none absolute top-0 left-0 z-[3] flex h-full w-[49%] items-end overflow-hidden rounded-[24px] bg-gradient-to-t from-[#050708]/85 via-[#050708]/15 to-transparent p-6 text-white sm:p-8">
          <div key={d.id} className={ENTER} style={{ animationDelay: "500ms" }}>
            <p className="text-[0.95rem] font-medium text-white/85">{d.label}</p>
            <h3 className="mt-2 text-[clamp(1.3rem,2.2vw,2rem)] leading-[1.1] font-semibold tracking-[-0.02em]">{d.title}</h3>
            <p className="mt-2 hidden max-w-[28rem] text-[1rem] leading-snug text-white/75 sm:block">{d.text}</p>
          </div>
        </div>
      </div>
      <Progress active={active} stepMs={stepMs} />
    </div>
  );
}

/**
 * «Куб»: четыре грани вокруг вертикальной оси, куб шагом поворачивается на 90°. Направлений шесть,
 * граней четыре — на грань подставляется направление по её положению относительно передней.
 */
export function CubeShowcase({ stepMs }: { stepMs: number }) {
  const [step] = useAutoStep(stepMs);
  const active = step % N;
  return (
    <div>
      <SideStage d={list[active]}>
        <div className="relative aspect-square w-[min(34vw,29rem)] [perspective:1600px] [--w:min(34vw,29rem)] max-lg:w-[min(78vw,22rem)] max-lg:[--w:min(78vw,22rem)]">
          <div
            className="absolute inset-0 [transform-style:preserve-3d] transition-transform duration-[1100ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
            style={{ transform: `translateZ(calc(var(--w) * -0.5)) rotateY(${-step * 90}deg)` }}
          >
            {[0, 1, 2, 3].map((face) => {
              const rel = (face - (step % 4) + 4) % 4; // 0 — спереди, 1 — справа (следующая), 3 — слева (предыдущая)
              const item = list[(((active + (rel === 3 ? -1 : rel)) % N) + N) % N];
              return (
                <div
                  key={face}
                  aria-hidden={rel !== 0}
                  className="absolute inset-0 overflow-hidden rounded-[32px] bg-bg-2 [backface-visibility:hidden]"
                  style={{
                    transform: `rotateY(${face * 90}deg) translateZ(calc(var(--w) * 0.5))`,
                    filter: rel === 0 ? "none" : "brightness(0.7)",
                    transition: "filter 1100ms",
                  }}
                >
                  <Image src={item.image} alt={rel === 0 ? item.alt : ""} fill sizes={PHOTO_SIZES} className="object-cover" />
                </div>
              );
            })}
          </div>
        </div>
      </SideStage>
      <Progress active={active} stepMs={stepMs} />
    </div>
  );
}

/** «Линза»: широкое фото с медленным наплывом, смена растворением; справа миниатюры. */
export function LensShowcase({ stepMs }: { stepMs: number }) {
  const [step] = useAutoStep(stepMs);
  const active = step % N;
  const d = list[active];
  return (
    <div className="relative aspect-[21/9] overflow-hidden rounded-[32px] bg-bg-2 max-md:aspect-[4/5]">
      {list.map((c, i) => (
        <div
          key={c.id}
          className="absolute inset-0 transition-opacity duration-[1300ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
          style={{ opacity: i === active ? 1 : 0 }}
        >
          <Image
            key={i === active ? `kb-${step}` : c.id}
            src={c.image}
            alt={i === active ? c.alt : ""}
            fill
            sizes="100vw"
            className="object-cover"
            style={{ animation: i === active ? `dir-kb ${stepMs + 1300}ms ease-out both` : undefined }}
          />
        </div>
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-[#050708]/80 via-[#050708]/30 to-transparent max-md:bg-gradient-to-t" />
      <div className="absolute inset-y-0 left-0 flex max-w-[34rem] flex-col justify-end p-6 text-white sm:p-10">
        <div key={d.id} className={ENTER}>
          <p className="text-[0.95rem] font-medium text-white/80">
            {d.id} · {d.label}
          </p>
          <h3 className="mt-3 text-[clamp(1.6rem,3vw,2.8rem)] leading-[1.05] font-semibold tracking-[-0.03em]">{d.title}</h3>
          <p className="mt-3 text-[1.05rem] leading-relaxed text-white/75">{d.text}</p>
        </div>
      </div>
      <div className="absolute right-5 bottom-5 hidden flex-col gap-2 md:flex">
        {list.map((c, i) => (
          <div key={c.id} data-on={i === active} className="relative h-12 w-20 overflow-hidden rounded-[10px] opacity-55 transition-opacity duration-500 data-[on=true]:opacity-100">
            <Image src={c.image} alt="" fill sizes="80px" className="object-cover" />
            {i === active && (
              <span
                key={step}
                className="absolute inset-x-0 bottom-0 block h-[3px] origin-left bg-accent"
                style={{ animation: `dir-progress ${stepMs}ms linear both` }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Маска шара: овал в центре целиком, к краям — плавно в прозрачность. */
const SPHERE_FADE = "radial-gradient(ellipse 62% 72% at 50% 50%, #000 52%, transparent 100%)";
/** Высота сцены шара; передняя плитка — примерно 0,75 её, по бокам от плитки — подписи. */
const SPHERE_H = "min(78svh,44rem)";
const SPHERE_SIDE = `calc(50% - ${SPHERE_H} * 0.4 - 1.5rem)`;
/** Сколько шар ждёт после того, как его покрутили или полистали стрелками, мс. */
const AUTO_RESUME_MS = 4000;

function Arrow({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "Предыдущее направление" : "Следующее направление"}
      onClick={onClick}
      className="grid size-12 cursor-pointer place-items-center rounded-full border border-line bg-card text-fg shadow-[0_10px_30px_-18px_var(--shadow)] transition-[color,border-color,transform] duration-300 hover:scale-[1.04] hover:border-accent hover:text-accent-ink dark:hover:text-accent"
    >
      <svg viewBox="0 0 20 20" className={`size-5 ${dir === "prev" ? "rotate-180" : ""}`} aria-hidden>
        <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

/**
 * «Шар»: шагает сам по порядку направлений — goToItem (наша доработка Infinite Menu: его стрелки
 * ведут к соседней на экране плитке, а там направления вперемешку, и шар «сворачивал обратно»;
 * его же автопрокрутка засыпает, как только он успокоился). Пока его крутят мышью или листают
 * стрелками и ещё AUTO_RESUME_MS после — автошаг ждёт. Текущее направление сообщает сам шар
 * (onActiveChange), когда остановится; target — куда он едет сейчас (для быстрых нажатий подряд).
 */
export function SphereShowcase({ stepMs, theme }: { stepMs: number; theme: "dark" | "light" }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<SphereApi | null>(null);
  const target = useRef(0);
  const resumeAt = useRef(0);
  const [active, setActive] = useState(0);

  const go = (delta: 1 | -1) => {
    target.current = (target.current + delta + N) % N;
    apiRef.current?.goToItem(target.current);
  };
  const manual = (delta: 1 | -1) => {
    resumeAt.current = performance.now() + AUTO_RESUME_MS;
    go(delta);
  };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let dragging = false;
    const onDown = () => {
      dragging = true;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      resumeAt.current = performance.now() + AUTO_RESUME_MS;
    };
    host.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    const id = window.setInterval(() => {
      if (document.hidden || dragging || performance.now() < resumeAt.current) return;
      target.current = (target.current + 1) % N;
      apiRef.current?.goToItem(target.current);
    }, stepMs);
    return () => {
      window.clearInterval(id);
      host.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [stepMs]);

  const d = list[active];
  return (
    <div>
      <div className="relative">
        <div ref={hostRef} style={{ height: SPHERE_H, maskImage: SPHERE_FADE, WebkitMaskImage: SPHERE_FADE }}>
          <InfiniteMenu
            items={list.map((c) => ({ image: c.image, title: c.label, description: c.title }))}
            autoplay={0}
            dim={0.7}
            showInfo={false}
            theme={theme}
            accentColor="#00bbc4"
            onActiveChange={(_, i) => {
              target.current = i;
              setActive(i);
            }}
            onApi={(api) => {
              apiRef.current = api;
            }}
          />
        </div>

        {/* свои подписи по бокам передней плитки — вне маски, поэтому не блёкнут; на узком экране — под шаром */}
        <div className="pointer-events-none absolute inset-0 hidden items-center justify-between lg:flex">
          <div style={{ width: SPHERE_SIDE }} className="text-right">
            <div key={d.id} className={ENTER}>
              <p className="text-[0.95rem] font-semibold tracking-[0.04em] text-accent-ink dark:text-accent">{d.id}</p>
              <h3 className="mt-3 text-[clamp(2rem,3.2vw,3.3rem)] leading-[1.02] font-semibold tracking-[-0.04em]">{d.label}</h3>
            </div>
          </div>
          <div style={{ width: SPHERE_SIDE }}>
            <div key={d.id} className={ENTER} style={{ animationDelay: "120ms" }}>
              <p className="text-[1.3rem] leading-snug font-semibold tracking-[-0.015em]">{d.title}</p>
              <p className="mt-3 text-[1.02rem] leading-relaxed text-fg/70">{d.text}</p>
              <Tags d={d} />
            </div>
          </div>
        </div>
      </div>

      <div key={d.id} className={`mx-auto mt-4 max-w-[34rem] text-center lg:hidden ${ENTER}`}>
        <p className="text-[0.95rem] font-semibold text-accent-ink dark:text-accent">{d.id}</p>
        <h3 className="mt-2 text-[1.8rem] leading-[1.05] font-semibold tracking-[-0.03em]">{d.label}</h3>
        <p className="mt-3 text-[1.1rem] leading-snug font-semibold">{d.title}</p>
        <p className="mt-2 leading-relaxed text-fg/70">{d.text}</p>
        <Tags d={d} center />
      </div>

      <div className="mt-6 flex items-center justify-center gap-5">
        <Arrow dir="prev" onClick={() => manual(-1)} />
        <div className="flex items-center gap-4">
          <span className="text-[0.95rem] font-semibold tabular-nums">
            {d.id}
            <span className="text-fg/40"> / {String(N).padStart(2, "0")}</span>
          </span>
          <span className="flex gap-1.5" aria-hidden>
            {list.map((c, i) => (
              <span
                key={c.id}
                data-on={i === active}
                className="h-[3px] w-6 rounded-full bg-fg/15 transition-colors duration-500 data-[on=true]:bg-accent"
              />
            ))}
          </span>
        </div>
        <Arrow dir="next" onClick={() => manual(1)} />
      </div>
    </div>
  );
}
