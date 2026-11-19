import { BatyrUI, CommandUI, ErpUI, RfidUI } from "@/components/v3/sections/ProductUIs";
import { workV3 } from "@/content/v3";

const screens = { erp: ErpUI, batyr: BatyrUI, command: CommandUI, rfid: RfidUI } as const;

/** Свои продукты: карточки с живыми условными интерфейсами на цветных подложках. */
export function WorkV3() {
  return (
    <section id="work" className="px-5 pt-28 pb-16 sm:px-8 lg:pt-36">
      <div className="mx-auto w-full max-w-[90rem]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 data-ribbon="products-title" className="text-[clamp(2.8rem,7.4vw,7.2rem)] leading-[0.95] font-semibold tracking-[-0.045em]">
            <span data-shift="0.04" className="block will-change-transform">
              {workV3.title}
            </span>
          </h2>
          <p className="max-w-[18rem] text-[0.8rem] leading-snug font-medium tracking-[0.04em] text-muted uppercase">{workV3.note}</p>
        </div>

        <ul data-ribbon="products" className="mt-12 grid gap-x-5 gap-y-12 sm:grid-cols-2 lg:mt-16">
          {workV3.items.map((item) => {
            const Screen = screens[item.screen];
            return (
              <li key={item.screen} data-occlude className="group reveal">
                <div
                  className="ui-card relative aspect-[4/3] w-full overflow-hidden rounded-[24px]"
                  style={{ background: item.backdrop }}
                >
                  <Screen />
                </div>
                <p className="mt-4 text-[0.72rem] font-medium tracking-[0.06em] text-muted uppercase">
                  {item.tags.join(" • ")}
                </p>
                <h3 className="mt-1.5 text-[clamp(1.4rem,2.4vw,2rem)] leading-tight font-medium tracking-[-0.02em]">{item.name}</h3>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-[0.8rem] text-muted">Интерфейсы на карточках условные — показывают, что делает продукт.</p>

        <div className="reveal mt-12 flex flex-wrap gap-2">
          {workV3.more.map((name) => (
            <span key={name} className="rounded-full border border-line px-4 py-2 text-[0.9rem] text-fg/75">
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
