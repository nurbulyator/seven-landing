import { trust } from "@/content/site";
import { factsV3 } from "@/content/v3";

/** Почему нам доверяют: четыре крупных факта и бегущая строка вендоров. */
export function FactsV3() {
  const vendors = [...trust.vendors, ...trust.vendors];
  return (
    <section id="trust" data-ribbon="facts" className="overflow-hidden py-24 lg:py-32">
      <div className="mx-auto w-full max-w-[90rem] px-5 sm:px-8">
        <h2 className="text-[clamp(2.6rem,6.6vw,6.4rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
          <span data-shift="-0.04" className="block will-change-transform">
            {factsV3.title}
          </span>
        </h2>
        <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
          {factsV3.list.map((f) => (
            <li key={f.big} className="reveal flex min-h-[15rem] flex-col justify-between rounded-[24px] bg-card p-7 shadow-[0_1px_0_var(--line)]">
              <p className="text-brand text-[clamp(3rem,5vw,4.4rem)] leading-none font-bold tracking-[-0.04em]">{f.big}</p>
              <p className="mt-6 text-[1.05rem] leading-snug text-fg/75">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
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
    </section>
  );
}
