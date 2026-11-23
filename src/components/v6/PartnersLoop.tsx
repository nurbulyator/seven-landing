import type { CSSProperties } from "react";

import { LogoLoop, type LogoItem } from "@/components/reactbits/LogoLoop";
import { partnerLogos } from "@/components/v6/partnerLogos";

/**
 * Лента партнёров для блока «Почему нам доверяют» в /v6 — вместо бегущей строки с названиями вендоров.
 * LogoLoop из React Bits: одноцветные знаки, в покое приглушены; под курсором — в полную силу и чуть
 * крупнее, лента замирает; прокрутка страницы её подгоняет, ленту можно тянуть мышью или пальцем.
 * Края растворяются маской — работает в обеих темах.
 */
const logos: LogoItem[] = partnerLogos.map((logo) => ({
  title: logo.name,
  ariaLabel: logo.name,
  hoverColor: "var(--fg)",
  node: (
    <span className="inline-flex items-center gap-[0.32em]">
      <svg viewBox={logo.viewBox} aria-hidden className="w-auto fill-current" style={{ height: `${logo.h}em` }}>
        <path d={logo.d} />
      </svg>
      {logo.label && <span className="text-[0.6em] font-semibold tracking-[-0.01em] whitespace-nowrap">{logo.label}</span>}
    </span>
  ),
}));

export function PartnersLoop() {
  return (
    <LogoLoop
      logos={logos}
      speed={45}
      gap={88}
      logoHeight={34}
      scaleOnHover
      hoverSpeed={0}
      scrollBoost={0.4}
      fadeOutWidth={0.14}
      ariaLabel="Работаем с продуктами вендоров"
      className="text-fg/45"
      // на телефоне знаки и промежутки мельче, чтобы в кадре было 3–4 логотипа (gap и logoHeight выше — для широкого экрана)
      style={{ "--logoloop-gap": "clamp(44px, 4.6vw, 88px)", "--logoloop-logoHeight": "clamp(24px, 1.8vw, 34px)" } as CSSProperties}
    />
  );
}
