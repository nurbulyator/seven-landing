import type { Ref } from "react";

import { SEVEN_PATH, WORDMARK_PATHS } from "@/components/Logo";

/** Знак «7» из двух частей: внешняя рамка и малая «7» (подпути SEVEN_PATH). */
const [FRAME, INNER] = SEVEN_PATH.split(/(?=M58\.64)/);
/** Букв в первой строке (SEVEN HILLS), остальные — OF KAZAKHSTAN. */
const LINE1 = 10;

/** Задержка появления буквы, мс: сначала собирается знак, потом буквы по одной, строка за строкой. */
const delay = (i: number) => (i < LINE1 ? 300 + i * 55 : 300 + LINE1 * 55 + 90 + (i - LINE1) * 38);

/**
 * Финальная сборка логотипа Seven Hills of Kazakhstan в официальной раскладке (по мотивам 3D-ролика
 * из ассетов). Рамку «7» перед этим выписывает лента сцены глобуса — здесь рамка лишь проявляется
 * поверх неё; малая «7» влетает слева, затем буквы выскакивают по одной.
 * Играет по времени, когда у обёртки data-on="true" (выставляет сцена глобуса), и мгновенно гаснет,
 * когда атрибут снят. Цвет надписи — currentColor обёртки, знак — фирменная бирюза.
 */
export function LogoReveal({ ref, className }: { ref?: Ref<HTMLDivElement>; className?: string }) {
  const part =
    "[transform-box:fill-box] origin-center transition-[transform,opacity] ease-[cubic-bezier(.2,.9,.25,1.15)] motion-reduce:transition-none group-data-[on=true]:translate-x-0 group-data-[on=true]:translate-y-0 group-data-[on=true]:rotate-0 group-data-[on=true]:scale-100 group-data-[on=true]:opacity-100 group-data-[on=true]:[transition-delay:var(--d)]";
  return (
    <div ref={ref} data-on="false" aria-hidden className={`group ${className ?? ""}`}>
      <svg viewBox="-40 -60 1190 400" className="h-auto w-full overflow-visible">
        <path d={FRAME} fill="#00bbc4" style={{ "--d": "0ms" } as React.CSSProperties} className={`${part} opacity-0 duration-[350ms]`} />
        <path d={INNER} fill="#00bbc4" style={{ "--d": "120ms" } as React.CSSProperties} className={`${part} -translate-x-[180px] rotate-[24deg] opacity-0 duration-[900ms]`} />
        <g fill="currentColor" transform="translate(0 -43.12)">
          {WORDMARK_PATHS.map((d, i) => (
            <path
              key={d.slice(0, 24)}
              d={d}
              style={{ "--d": `${delay(i)}ms` } as React.CSSProperties}
              className={`${part} translate-y-[70px] scale-[0.35] opacity-0 duration-[650ms]`}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
