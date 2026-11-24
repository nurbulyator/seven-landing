import type { Metadata } from "next";

import { Contact } from "@/components/sections/Contact";
import { HeroV3 } from "@/components/v3/hero/HeroV3";
import { DirectionsV3 } from "@/components/v3/sections/DirectionsV3";
import { FactsV3 } from "@/components/v3/sections/FactsV3";
import { ProductsV4 } from "@/components/v4/ProductsV4";
import { HeaderV6 } from "@/components/v6/HeaderV6";
import { PartnersLoop } from "@/components/v6/PartnersLoop";
import { ReelV6 } from "@/components/v6/ReelV6";
import { SmoothScroll } from "@/components/v6/SmoothScroll";
import { WorldV6 } from "@/components/v6/WorldV6";
import { IntroV7 } from "@/components/v7/IntroV7";
import { NumbersV7 } from "@/components/v7/NumbersV7";
import { PageGLV7 } from "@/components/v7/PageGLV7";

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — версия 7",
  robots: { index: false },
};

/**
 * /v7 — копия /v6. Переключатель «Версия»: «Знак», «Глобус» (облёт Казахстана: лента из частиц
 * собирается в продукты, в финале — в логотип) и «Глобус 2» (пока как «Глобус»). У знака фон по
 * умолчанию — Floating Lines. Вступление без заголовка: после первого экрана сразу карточка, которая
 * улетает в ролик; у «Глобуса» лента выползает из-за левого края. Цифры (NumbersV7) — вместо
 * закреплённого экрана: на полотне «О компании», лента один раз проходит под цифрами, и они по
 * очереди проявляются и досчитывают.
 */
export default function V7Page() {
  return (
    <PageGLV7>
      <HeaderV6 specular />
      {/* второе движение колеса уже запускает захват: лента сама доходит до ролика и переносит карточку */}
      <SmoothScroll reelFrom={0.16} reelMs={2200} />
      <main>
        <HeroV3 globe specular storageKey="v7-hero-bg" defaultBackdrop="floatingLines" />
        <IntroV7 />
        <ReelV6 />
        <NumbersV7 />
        <ProductsV4 form="points" />
        <DirectionsV3 />
        <FactsV3 vendors={<PartnersLoop />} />
        <WorldV6 />
        <Contact />
      </main>
    </PageGLV7>
  );
}
