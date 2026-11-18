import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { company, contacts, nav } from "@/content/site";

/** Тонкая полупрозрачная шапка с размытием фона, как навигация на сайте Apple. */
export function Header() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-line bg-(--glass) backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 w-full max-w-[80rem] items-center justify-between gap-6 px-5 sm:px-8">
        <a href="#top" aria-label={`${company.name} — в начало страницы`} className="shrink-0 text-fg">
          <Logo className="h-7 w-auto" title={company.name} />
        </a>
        <nav aria-label="Разделы страницы" className="hidden items-center gap-7 text-[0.84rem] text-fg/75 md:flex">
          {nav.map((item) => (
            <a key={item.href} href={item.href} className="transition-colors hover:text-fg">
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href={contacts.phone.href} className="hidden text-[0.84rem] text-fg/75 hover:text-fg lg:block">
            {contacts.phone.label}
          </a>
          <ThemeToggle />
          <a
            href="#contact"
            className="rounded-full bg-accent px-4 py-1.5 text-[0.84rem] font-medium text-[#050708] transition-opacity hover:opacity-85"
          >
            Заявка
          </a>
        </div>
      </div>
    </header>
  );
}
