import { products } from "@/content/site";

/** Собственные продукты — горизонтальная лента карточек, как «линейка» на сайте Apple. */
export function Products() {
  return (
    <section id="products" className="bg-bg-2 py-24 lg:py-36">
      <div className="mx-auto w-full max-w-[80rem] px-5 sm:px-8">
        <div className="reveal max-w-[50rem]">
          <p className="text-[1rem] font-medium text-accent-ink">{products.eyebrow}</p>
          <h2 className="mt-2 text-[clamp(2.2rem,5.6vw,4.8rem)] leading-[1.03] font-bold tracking-[-0.035em]">
            {products.title}
          </h2>
        </div>
      </div>

      <ul
        className="mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-5 pb-6 [scrollbar-width:none] sm:px-8 lg:mt-16 lg:gap-5 lg:px-[max(2rem,calc((100vw_-_80rem)/2_+_2rem))] lg:scroll-px-[max(2rem,calc((100vw_-_80rem)/2_+_2rem))]"
        aria-label="Собственные продукты"
      >
        {products.list.map((p, i) => (
          <li
            key={p.name}
            className="relative flex min-h-[26rem] w-[min(82vw,22rem)] shrink-0 snap-start flex-col justify-between overflow-hidden rounded-[1.75rem] bg-card p-8 shadow-[0_1px_0_var(--line),0_20px_50px_-30px_var(--shadow)]"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute top-5 right-7 text-[4.5rem] leading-none font-bold tracking-[-0.05em] text-fg/[0.07]"
            >
              {String(i + 1).padStart(2, "0")}
            </span>
            <p className="text-[0.84rem] font-medium text-accent-ink">{p.kind}</p>
            <div>
              <h3 className="text-[1.9rem] leading-[1.08] font-bold tracking-[-0.025em]">{p.name}</h3>
              <p className="mt-3 text-[1.02rem] leading-snug text-muted">{p.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
