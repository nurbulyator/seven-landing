import type { CSSProperties } from "react";

import { LogoLoop, type LogoItem } from "@/components/reactbits/LogoLoop";
import { wordmarkV7 } from "@/content/v7";

/**
 * Бегущая надпись «SEVEN HILLS OF KAZAKHSTAN» под лентой логотипов в «Почему нам доверяют» (/v7) —
 * как бирюзовая строка на сайте компании. Тот же LogoLoop, что и у логотипов (PartnersLoop), но едет
 * в обратную сторону — вправо; прокрутка страницы её так же подгоняет. Только для глаз: читалкам
 * экрана надпись не нужна, название компании и так на странице.
 */
const items: LogoItem[] = [{ node: <span className="font-bold tracking-[-0.06em] whitespace-nowrap">{wordmarkV7}</span> }];

export function WordmarkLoop() {
  return (
    <div aria-hidden>
      <LogoLoop
        logos={items}
        direction="right"
        speed={45}
        gap={28}
        logoHeight={92}
        scrollBoost={0.4}
        fadeOutWidth={0.14}
        className="text-accent"
        style={{ "--logoloop-gap": "clamp(14px, 1.7vw, 28px)", "--logoloop-logoHeight": "clamp(36px, 5.65vw, 92px)" } as CSSProperties}
      />
    </div>
  );
}
