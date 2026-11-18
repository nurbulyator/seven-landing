import { trust } from "@/content/site";

export function Trust() {
  const vendors = [...trust.vendors, ...trust.vendors];
  return (
    <section id="trust" className="overflow-hidden py-24 lg:py-36">
      <div className="mx-auto w-full max-w-[80rem] px-5 sm:px-8">
        <div className="reveal max-w-[56rem]">
          <p className="text-[1rem] font-medium text-accent-ink">{trust.eyebrow}</p>
          <h2 className="mt-2 text-[clamp(2.2rem,5.6vw,4.8rem)] leading-[1.03] font-bold tracking-[-0.035em]">
            {trust.title}
          </h2>
        </div>

        <ol className="mt-14 grid gap-x-10 sm:grid-cols-2 lg:mt-20 lg:grid-cols-3">
          {trust.principles.map((principle, i) => (
            <li key={principle} className="reveal flex gap-5 border-t border-line py-6">
              <span className="text-[0.85rem] font-medium text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[1.15rem] leading-snug font-medium">{principle}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-16 lg:mt-24" aria-label="Работаем с продуктами вендоров">
        <div className="marquee flex w-max gap-[0.5em] text-[clamp(2.8rem,8vw,7rem)] leading-none font-bold tracking-[-0.045em] text-fg/15">
          {vendors.map((vendor, i) => (
            <span key={`${vendor}-${i}`} aria-hidden={i >= trust.vendors.length} className="flex gap-[0.5em]">
              {vendor}
              <span className="text-accent/60">·</span>
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 grid w-full max-w-[80rem] gap-4 px-5 sm:px-8 lg:mt-20 lg:grid-cols-12">
        <p className="text-[1rem] font-medium text-muted lg:col-span-3">Сертификация</p>
        <ul className="grid gap-3 text-[1.05rem] leading-snug lg:col-span-9 lg:grid-cols-2 lg:gap-x-12">
          {trust.certificates.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
