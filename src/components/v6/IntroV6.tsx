import { introV3 } from "@/content/v3";

/** На сколько лента сдвигает строку, когда проходит сквозь неё, px. */
const NUDGE = "45";

/**
 * Вступление /v6 — как у lusion: заголовок выровнен по правому краю (первая строка с отступом)
 * и лежит поверх слоя ленты (z выше холста PageGL). Лента дугой заходит слева, проходит за
 * второй строкой — буквы её перекрывают — и полого уходит вниз за карточку.
 * Движение: строки на прокрутке съезжаются навстречу друг другу и сходятся, когда заголовок
 * в центре экрана; лента, проходя сквозь вторую строку, слегка отодвигает её целиком.
 * Карточка — как в /v3, но без «капли» и петли: видео в ней сразу, лента идёт за ней.
 */
export function IntroV6() {
  return (
    <section id="intro" className="relative px-5 pt-28 pb-24 sm:px-8 lg:pt-40 lg:pb-32">
      <div className="mx-auto grid w-full max-w-[90rem] gap-12 lg:grid-cols-12">
        <h2
          data-ribbon="intro-title"
          className="relative z-[6] text-right text-[clamp(2.8rem,7.4vw,7.2rem)] leading-[0.98] font-semibold tracking-[-0.045em] lg:col-span-7 lg:col-start-1"
        >
          {introV3.title.map((line, i) => (
            // строка едет за прокруткой (data-shift), а лента, проходя сквозь неё, ещё чуть сдвигает её (data-nudge)
            <span key={line} data-shift={i === 0 ? "-0.14" : "0.14"} className="block will-change-transform">
              <span data-nudge={NUDGE} className="inline-block will-change-transform">
                {line}
              </span>
            </span>
          ))}
        </h2>

        <div
          data-ribbon="intro-card"
          className="relative aspect-[16/10] w-full overflow-hidden rounded-[24px] bg-card shadow-[0_1px_0_var(--line)] lg:col-span-5 lg:col-start-2"
        >
          <video
            src="/v2/media/corridor.mp4"
            poster="/v2/media/corridor.jpg"
            muted
            loop
            autoPlay
            playsInline
            preload="none"
            aria-hidden
            className="gl-hide absolute inset-0 h-full w-full object-cover"
          />
        </div>

        <div className="reveal self-end lg:col-span-4 lg:col-start-8">
          <p className="text-[1.1rem] leading-relaxed text-fg/80 sm:text-[1.2rem]">{introV3.text}</p>
          <a
            href="#directions"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-[0.9rem] font-medium shadow-[0_1px_0_var(--line),0_10px_30px_-18px_var(--shadow)] transition-transform hover:scale-[1.03]"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            {introV3.link}
          </a>
        </div>
      </div>
    </section>
  );
}
