import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { company, contacts } from "@/content/site";

const links = [
  { href: "#intro", label: "О компании" },
  { href: "#work", label: "Продукты" },
  { href: "#directions", label: "Направления" },
  { href: "#world", label: "География" },
] as const;

/** Шапка /v2: логотип слева, справа — «таблетки» на стекле. Не заслоняет первый экран полосой. */
export function HeaderV2() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="flex h-[4.25rem] items-center justify-between gap-4 px-5 sm:px-8">
        <a
          href="#top"
          aria-label={`${company.name} — в начало страницы`}
          className="pointer-events-auto rounded-full bg-(--glass) px-3.5 py-2 text-fg backdrop-blur-xl"
        >
          <Logo className="h-6 w-auto sm:h-7" title={company.name} />
        </a>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-(--glass) p-1 backdrop-blur-xl">
          <nav aria-label="Разделы страницы" className="hidden items-center lg:flex">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-3.5 py-1.5 text-[0.84rem] text-fg/75 transition-colors hover:bg-fg/8 hover:text-fg"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <a href={contacts.phone.href} className="hidden px-2 text-[0.84rem] text-fg/75 hover:text-fg xl:block">
            {contacts.phone.label}
          </a>
          <ThemeToggle />
          <a
            href="#contact"
            className="flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-[0.84rem] font-medium text-bg transition-opacity hover:opacity-85"
          >
            Связаться
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          </a>
        </div>
      </div>
    </header>
  );
}
