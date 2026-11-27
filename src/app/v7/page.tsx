import type { Metadata } from "next";

import { HeroV3 } from "@/components/v3/hero/HeroV3";
import { FactsV3 } from "@/components/v3/sections/FactsV3";
import { HeaderV6 } from "@/components/v6/HeaderV6";
import { PartnersLoop } from "@/components/v6/PartnersLoop";
import { ReelV6 } from "@/components/v6/ReelV6";
import { SmoothScroll } from "@/components/v6/SmoothScroll";
import { ContactV7 } from "@/components/v7/ContactV7";
import { DirectionsV7 } from "@/components/v7/DirectionsV7";
import { IntroV7 } from "@/components/v7/IntroV7";
import { NumbersV7 } from "@/components/v7/NumbersV7";
import { PageGLV7 } from "@/components/v7/PageGLV7";
import { WordmarkLoop } from "@/components/v7/WordmarkLoop";
import { WorldV7 } from "@/components/v7/WorldV7";
import { trust } from "@/content/site";

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
 * очереди проявляются и досчитывают. Вместо «Своих продуктов» и прежних «Направлений» — один
 * статичный блок «Наши направления» (DirectionsV7): шесть направлений с сайта компании, подачу пока
 * сравниваем переключателем (по умолчанию — шар), лента проходит за блоком и на нём заканчивается.
 * Глобус (WorldV7) — тоже статичный блок вместо закреплённой сцены: слева «Международное
 * присутствие» с сайта компании, справа глобус из точек без рамки, сам листает Казахстан → ОАЭ →
 * Чехию; посадки с логотипом нет. Низ (ContactV7) — «Рабочая встреча» с формой в окне и футер
 * карточкой, тексты с сайта компании.
 */
/** Меню /v7: «Своих продуктов» нет, «О компании» — сам блок с цифрами. */
const links = [
  { href: "#about", label: "О компании" },
  { href: "#directions", label: "Направления" },
  { href: "#world", label: "География" },
];

export default function V7Page() {
  return (
    <PageGLV7>
      <HeaderV6 specular links={links} />
      {/* второе движение колеса уже запускает захват: лента сама доходит до ролика и переносит карточку */}
      <SmoothScroll reelFrom={0.16} reelMs={2200} landing={false} />
      <main>
        <HeroV3 globe specular storageKey="v7-hero-bg" defaultBackdrop="floatingLines" />
        <IntroV7 />
        <ReelV6 />
        <NumbersV7 />
        <DirectionsV7 />
        <FactsV3
          lead={<p className="max-w-[34rem] text-[1.1rem] leading-relaxed text-fg/75 sm:text-[1.25rem]">{trust.title}</p>}
          vendors={
            <>
              <PartnersLoop />
              {/* под логотипами — «SEVEN HILLS OF KAZAKHSTAN», едет в обратную сторону */}
              <div className="mt-8 lg:mt-12">
                <WordmarkLoop />
              </div>
            </>
          }
        />
        <WorldV7 />
        <ContactV7 />
      </main>
    </PageGLV7>
  );
}
