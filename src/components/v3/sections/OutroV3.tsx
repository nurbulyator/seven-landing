import { SevenFrames } from "@/components/v3/SevenFrames";
import { outroV3 } from "@/content/v3";

/**
 * Финал ленты — пауза: сцена закрепляется на экране, и, пока прокрутка идёт, лента дописывает
 * знак «7», по её следу проявляется объёмный знак, а затем ведущий к нему кусок ленты обрезается.
 * Знак занимает ~57% высоты кадра, поэтому пустые поля кадра срезаны отрицательными отступами.
 */
export function OutroV3() {
  return (
    <section data-pin className="relative h-[170svh]">
      <div
        data-ribbon="outro-stage"
        className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-5 pt-14 text-center"
      >
        <SevenFrames ribbonKey="outro-seven" birth className="-my-[min(17vw,12svh,8.5rem)] w-[min(92vw,68svh,46rem)] shrink-0" />
        <h2 className="mt-12 text-[clamp(2.6rem,7vw,6.4rem)] leading-[0.95] font-semibold tracking-[-0.045em]">{outroV3.title}</h2>
        <p className="mt-4 text-[1.15rem] text-muted sm:text-[1.3rem]">{outroV3.text}</p>
      </div>
    </section>
  );
}
