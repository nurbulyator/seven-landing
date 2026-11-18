import { outroV2 } from "@/content/v2";

/** Финал ленты: она дописывает знак «7» в этом блоке и остаётся в нём. */
export function OutroV2() {
  return (
    <section data-ribbon="outro" className="relative flex min-h-[110svh] flex-col items-center justify-center px-5 py-24 text-center">
      <div data-ribbon="outro-seven" aria-hidden className="h-[min(56svh,26rem)] w-[min(50vw,19rem)]" />
      <h2 className="mt-12 text-[clamp(2.6rem,7vw,6.4rem)] leading-[0.95] font-semibold tracking-[-0.045em]">{outroV2.title}</h2>
      <p className="mt-4 text-[1.15rem] text-muted sm:text-[1.3rem]">{outroV2.text}</p>
    </section>
  );
}
