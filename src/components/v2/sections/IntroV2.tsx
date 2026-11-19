import { introV2 } from "@/content/v2";

/**
 * Вступление. Заголовок прижат влево, его строки разъезжаются в разные стороны при прокрутке
 * (data-shift). Лента не проходит сквозь текст: она идёт справа и заворачивает к карточке.
 * Карточка слева сначала пустая: лента «капает» в неё и заливает кадр, затем обвивает
 * и вытягивает в большой ролик (см. ReelV2 и PageGL).
 */
export function IntroV2() {
  return (
    <section id="intro" className="relative px-5 pt-28 pb-24 sm:px-8 lg:pt-40 lg:pb-32">
      <div className="mx-auto grid w-full max-w-[90rem] gap-12 lg:grid-cols-12">
        <h2
          data-ribbon="intro-title"
          className="text-[clamp(2.8rem,7.4vw,7.2rem)] leading-[0.98] font-semibold tracking-[-0.045em] lg:col-span-9 lg:col-start-1"
        >
          {introV2.title.map((line, i) => (
            <span key={line} data-shift={i === 0 ? "0.09" : "-0.09"} className={`block will-change-transform ${i === 1 ? "pl-[8%] lg:pl-[14%]" : ""}`}>
              {line}
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
          <p className="text-[1.1rem] leading-relaxed text-fg/80 sm:text-[1.2rem]">{introV2.text}</p>
          <a
            href="#directions"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-card px-5 py-2.5 text-[0.9rem] font-medium shadow-[0_1px_0_var(--line),0_10px_30px_-18px_var(--shadow)] transition-transform hover:scale-[1.03]"
          >
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            {introV2.link}
          </a>
        </div>
      </div>
    </section>
  );
}
