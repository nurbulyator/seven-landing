"use client";

import { useEffect, useState } from "react";

import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { company, contacts } from "@/content/site";

const links = [
  { href: "#intro", label: "О компании" },
  { href: "#work", label: "Продукты" },
  { href: "#directions", label: "Направления" },
  { href: "#world", label: "География" },
] as const;

/** Линия шапки по вертикали: если под ней «ночной» блок, шапка переходит на тёмные токены. */
const PROBE_Y = 34;

/**
 * Шапка /v6 — как в /v3, но над блоками с `data-night` (сцена глобуса, пока там ночь)
 * переключается на тёмные цвета и в светлой теме, чтобы не висеть светлыми «таблетками» в темноте.
 */
export function HeaderV6() {
  const [night, setNight] = useState(false);

  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      let over = false;
      document.querySelectorAll<HTMLElement>("[data-night]").forEach((el) => {
        if (el.dataset.night === "off") return;
        const r = el.getBoundingClientRect();
        if (r.top <= PROBE_Y && r.bottom >= PROBE_Y) over = true;
      });
      setNight(over);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    // атрибут на сцене глобуса меняется, пока она закреплена и прокрутка идёт, — поэтому слушаем и прокрутку
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header data-theme={night ? "dark" : undefined} className="pointer-events-none fixed inset-x-0 top-0 z-50">
      <div className="flex h-[4.25rem] items-center justify-between gap-4 px-5 sm:px-8">
        <a
          href="#top"
          aria-label={`${company.name} — в начало страницы`}
          className="pointer-events-auto rounded-full bg-(--glass) px-3.5 py-2 text-fg backdrop-blur-xl transition-colors duration-500"
        >
          <Logo className="h-6 w-auto sm:h-7" title={company.name} />
        </a>
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-(--glass) p-1 backdrop-blur-xl transition-colors duration-500">
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
            className="flex items-center gap-2 rounded-full bg-fg px-4 py-2 text-[0.84rem] font-medium text-bg transition-[opacity,background-color,color] duration-500 hover:opacity-85"
          >
            Связаться
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          </a>
        </div>
      </div>
    </header>
  );
}
