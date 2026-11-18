import { directions } from "@/content/site";

import { DirectionArt } from "./DirectionArt";

/** Раскладка карточек на десктопе: сетка из 6 колонок, последняя карточка — во всю ширину. */
const spans = [
  "lg:col-span-4",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-4",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-6",
];

export function Directions() {
  return (
    <section id="directions" className="py-24 lg:py-36">
      <div className="mx-auto w-full max-w-[80rem] px-5 sm:px-8">
        <div className="reveal max-w-[50rem]">
          <p className="text-[1rem] font-medium text-accent-ink">Направления</p>
          <h2 className="mt-2 text-[clamp(2.2rem,5.6vw,4.8rem)] leading-[1.03] font-bold tracking-[-0.035em]">
            Семь направлений. <span className="text-muted">Одна команда.</span>
          </h2>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:mt-16 lg:grid-cols-6 lg:gap-5">
          {directions.map((d, i) => {
            const wide = i === directions.length - 1;
            return (
              <article
                key={d.id}
                className={`reveal group flex flex-col justify-between gap-10 rounded-[1.75rem] bg-card p-7 shadow-[0_1px_0_var(--line),0_20px_50px_-30px_var(--shadow)] transition-transform duration-500 hover:-translate-y-1 sm:p-9 ${spans[i]} ${
                  wide ? "sm:col-span-2 lg:flex-row lg:items-center" : ""
                }`}
              >
                <div className={wide ? "lg:order-2 lg:flex lg:items-center lg:gap-10" : ""}>
                  <DirectionArt art={d.art} />
                  {wide && (
                    <p className="text-brand mt-6 text-[clamp(4rem,10vw,9rem)] leading-none font-bold tracking-[-0.05em] lg:mt-0">
                      24/7
                    </p>
                  )}
                </div>
                <div className={wide ? "lg:max-w-[34rem]" : ""}>
                  <p className="text-[0.85rem] font-medium text-muted">{String(i + 1).padStart(2, "0")}</p>
                  <h3 className="mt-1 text-[clamp(1.6rem,2.6vw,2.3rem)] leading-[1.08] font-bold tracking-[-0.025em]">
                    {d.title}
                  </h3>
                  <p className="mt-3 text-[1.02rem] leading-snug text-muted">{d.text}</p>
                  <ul className="mt-5 flex flex-wrap gap-2">
                    {d.items.map((item) => (
                      <li key={item} className="rounded-full border border-line px-3 py-1 text-[0.84rem] text-fg/80">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
