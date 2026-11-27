"use client";

import { GalleryShowcase } from "@/components/v7/DirectionsShowcase";
import { directionsV7 } from "@/content/v7";

/**
 * «Наши направления» /v7 — вместо «Своих продуктов» и прежнего блока направлений. Статичный блок:
 * заголовок и шесть направлений с сайта компании в «Галерее» (GalleryShowcase): крупное фото на всю
 * ширину, название направления большими буквами и чем занимаемся, само переключается
 * (GALLERY_MS); под фото — все направления строкой. Колесо мыши достаётся странице.
 * Лента по фото не ездит: тело блока — data-occlude, она проходит под галереей целиком.
 */

/** Сколько показывается одно направление: крупный текст поверх фото, даём дочитать. */
const GALLERY_MS = 6000;

export function DirectionsV7() {
  return (
    <section id="directions" data-ribbon="dirs" className="relative overflow-x-clip px-5 pt-24 pb-12 sm:px-8 lg:pt-32 lg:pb-16">
      <div className="mx-auto max-w-[90rem]">
        <div className="relative z-10 grid gap-6 lg:grid-cols-12 lg:items-end">
          <h2 className="text-[clamp(2.4rem,5.4vw,5rem)] leading-[0.98] font-semibold tracking-[-0.045em] lg:col-span-6">
            {directionsV7.title}
          </h2>
          <p className="max-w-[34rem] text-[1.1rem] leading-relaxed text-fg/75 sm:text-[1.25rem] lg:col-span-5 lg:col-start-8">
            {directionsV7.lead}
          </p>
        </div>

        <div data-ribbon="dirs-body" data-occlude className="relative mt-14 lg:mt-20">
          <GalleryShowcase stepMs={GALLERY_MS} />
        </div>
      </div>
    </section>
  );
}
