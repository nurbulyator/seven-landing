import { introV3 } from "@/content/v3";

/**
 * Вступление /v7 — как в /v6, но без заголовка: сразу после первого экрана карточка с видео
 * (она улетает в большой ролик) и текст справа. Лента выходит из-за левого края над карточкой
 * и уходит вниз за неё — маршрут в ribbonRouteV7.
 */
export function IntroV7() {
  return (
    <section id="intro" data-ribbon="intro" className="relative px-5 pt-28 pb-24 sm:px-8 lg:pt-40 lg:pb-32">
      <div className="mx-auto grid w-full max-w-[90rem] gap-12 lg:grid-cols-12">
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
