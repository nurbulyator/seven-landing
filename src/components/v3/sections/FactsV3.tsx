import type { ReactNode } from "react";

import { trust } from "@/content/site";
import { factsV3 } from "@/content/v3";

type Props = {
  /** Чем заменить бегущую строку с названиями вендоров (в /v6 — лента логотипов PartnersLoop). */
  vendors?: ReactNode;
  /** Подзаголовок справа от заголовка (/v7); без него заголовок во всю ширину, как раньше. */
  lead?: ReactNode;
};

/** Почему нам доверяют: четыре крупных факта и бегущая строка вендоров. */
export function FactsV3({ vendors: vendorsSlot, lead }: Props = {}) {
  const vendors = [...trust.vendors, ...trust.vendors];
  return (
    <section id="trust" data-ribbon="facts" className="overflow-hidden py-24 lg:py-32">
      <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
        <div className={lead ? "grid gap-6 lg:grid-cols-12 lg:items-end" : undefined}>
          <h2 className={`text-[clamp(2.6rem,6.6vw,6.4rem)] leading-[0.95] font-semibold tracking-[-0.045em] ${lead ? "lg:col-span-7" : ""}`}>
            <span data-shift="-0.04" className="block will-change-transform">
              {factsV3.title}
            </span>
          </h2>
          {lead && <div className="lg:col-span-4 lg:col-start-9 lg:pb-3">{lead}</div>}
        </div>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {factsV3.list.map((f) => (
            <li key={f.big} className="reveal flex min-h-[15rem] flex-col justify-between rounded-[24px] bg-card p-7 shadow-[0_1px_0_var(--line)]">
              <p className="text-brand text-[clamp(3rem,5vw,4.4rem)] leading-none font-bold tracking-[-0.04em]">{f.big}</p>
              <p className="mt-6 text-[1.05rem] leading-snug text-fg/75">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
      {vendorsSlot ? (
        <div className="mt-16 lg:mt-20">{vendorsSlot}</div>
      ) : (
        <div className="mt-16 lg:mt-20" aria-label="Работаем с продуктами вендоров">
          <div className="marquee flex w-max gap-[0.5em] text-[clamp(2.8rem,8vw,7rem)] leading-none font-bold tracking-[-0.045em] text-fg/15">
            {vendors.map((vendor, i) => (
              <span key={`${vendor}-${i}`} aria-hidden={i >= trust.vendors.length} className="flex gap-[0.5em]">
                {vendor}
                <span className="text-accent/60">·</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
