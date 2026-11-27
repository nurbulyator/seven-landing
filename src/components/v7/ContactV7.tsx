"use client";

import { type FormEvent, type RefObject, useRef } from "react";

import { Logo } from "@/components/Logo";
import SpecularButton from "@/components/reactbits/SpecularButton";
import { useTheme } from "@/components/ThemeToggle";
import { contactSection, contacts } from "@/content/site";
import { contactV7 } from "@/content/v7";

/**
 * Низ /v7 вместо «Расскажите о задаче» с формой на странице: блок «Рабочая встреча» (тексты с
 * сайта компании) по центру — заголовок, текст, кнопка «Направить запрос», ниже номер в фирменном
 * градиенте (text-brand, как в прежнем блоке) и почта; кнопка открывает окно с формой запроса
 * (тоже тексты сайта компании). Ниже — футер карточкой на сером фоне, как полотна страницы: знак,
 * слоган, навигация по блокам страницы и контакты.
 * Фон блока — серый (bg-2): из-за его верхнего края выглядывает глобус «Международного присутствия».
 * Пока у заявки нет серверного адресата, форма, как и прежняя, собирает письмо на info@ через mailto.
 */

const { cta, form, footer } = contactV7;

/** Навигация футера — блоки этой страницы. */
const navLinks = [
  { href: "#directions", label: "Направления" },
  { href: "#about", label: "Компания" },
  { href: "#world", label: "География" },
];

function Arrow({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 11.5 11.5 4.5M5.5 4.5h6v6" />
    </svg>
  );
}

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-[1.02rem] text-fg outline-none transition-colors placeholder:text-fg/35 focus:border-accent";

/** Окно с формой запроса: нативный <dialog> — Esc и фокус внутри окна даёт браузер. */
function RequestDialog({ dialogRef, dark }: { dialogRef: RefObject<HTMLDialogElement | null>; dark: boolean }) {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const body = [`Имя: ${value("name")}`, `Контакт: ${value("contact")}`, "", value("task")].join("\n");
    const subject = `Заявка с сайта: ${value("name")}`;
    window.location.href = `mailto:${contacts.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="request-title"
      // клик по затемнению вокруг окна закрывает его
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[1.75rem] border border-line bg-card p-0 text-fg shadow-[0_30px_80px_-30px_var(--shadow)] backdrop:bg-[#050708]/55 backdrop:backdrop-blur-sm"
    >
      <div className="relative p-7 sm:p-10">
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label="Закрыть"
          className="absolute top-5 right-5 grid size-10 cursor-pointer place-items-center rounded-full text-fg/60 transition-colors hover:bg-fg/5 hover:text-fg"
        >
          <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
        <p className="text-[0.95rem] font-semibold text-accent-ink">{form.eyebrow}</p>
        <h2 id="request-title" className="mt-4 text-[clamp(2rem,4vw,2.8rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
          {form.title}
        </h2>
        <p className="mt-4 leading-relaxed text-fg/70">{form.intro}</p>

        <form onSubmit={onSubmit} className="mt-8 grid gap-5">
          <label className="grid gap-1.5 text-[0.85rem] text-muted">
            {form.nameLabel}
            <input name="name" required autoComplete="name" placeholder={form.namePlaceholder} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-[0.85rem] text-muted">
            {form.contactLabel}
            <input name="contact" required autoComplete="tel" placeholder={form.contactPlaceholder} className={inputClass} />
          </label>
          <label className="grid gap-1.5 text-[0.85rem] text-muted">
            {form.messageLabel}
            <textarea name="task" rows={4} required placeholder={form.messagePlaceholder} className={`${inputClass} resize-y`} />
          </label>
          <div className="mt-2 grid gap-4 sm:flex sm:items-center sm:justify-between sm:gap-6">
            <p className="text-[0.85rem] leading-snug text-muted">
              {form.consent}
              <br />
              {contactSection.note}
            </p>
            <SpecularButton
              type="submit"
              size="md"
              radius={999}
              glow={0}
              tint={dark ? "#f3f5f5" : "#111618"}
              tintOpacity={1}
              textColor={dark ? "#050708" : "#fbfbfa"}
              lineColor={dark ? "#00bbc4" : "#ffffff"}
              baseColor={dark ? "#c9d3d4" : "#3a4446"}
              className="shrink-0"
            >
              {form.submit}
              <Arrow />
            </SpecularButton>
          </div>
        </form>
      </div>
    </dialog>
  );
}

export function ContactV7() {
  const dark = useTheme() === "dark";
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      {/* «Рабочая встреча» — по центру: заголовок, текст, кнопка, ниже номер в фирменном градиенте */}
      <section id="contact" aria-labelledby="contact-title" className="bg-bg-2 px-5 pt-24 pb-20 text-center sm:px-8 lg:pt-36 lg:pb-28">
        <p className="text-[0.95rem] font-semibold text-accent-ink dark:text-accent">{cta.eyebrow}</p>
        <h2 id="contact-title" className="mx-auto mt-6 max-w-[16ch] text-[clamp(3rem,8.4vw,8.5rem)] leading-[0.95] font-semibold tracking-[-0.055em]">
          {cta.title[0]}
          <br />
          <span className="text-fg/45">{cta.title[1]}</span>
        </h2>
        <p className="mx-auto mt-7 max-w-[34rem] text-[1.2rem] leading-snug text-fg/70 sm:text-[1.4rem]">{cta.text}</p>
        <div className="mt-12 flex justify-center">
          <SpecularButton
            size="lg"
            radius={999}
            glow={0}
            tint={dark ? "#f3f5f5" : "#111618"}
            tintOpacity={1}
            textColor={dark ? "#050708" : "#fbfbfa"}
            lineColor={dark ? "#00bbc4" : "#ffffff"}
            baseColor={dark ? "#c9d3d4" : "#3a4446"}
            onClick={() => dialogRef.current?.showModal()}
            aria-haspopup="dialog"
          >
            {cta.action}
            <Arrow className="size-[1.05em]" />
          </SpecularButton>
        </div>
        <div className="mt-16 grid justify-items-center gap-2 lg:mt-20">
          <a href={contacts.phone.href} className="text-brand text-[clamp(2.2rem,5.6vw,4.8rem)] leading-none font-bold tracking-[-0.035em]">
            {contacts.phone.label}
          </a>
          <a href={`mailto:${contacts.email}`} className="mt-2 text-[1.1rem] text-fg/65 transition-colors hover:text-accent-ink">
            {contacts.email}
          </a>
        </div>
      </section>

      {/* футер — карточкой на том же сером фоне, как полотна страницы (не чёрной плашкой) */}
      <footer className="bg-bg-2 px-2.5 pb-2.5 sm:px-4 sm:pb-4">
        <div className="rounded-[32px] bg-card px-6 shadow-[0_1px_0_var(--line),0_20px_50px_-30px_var(--shadow)] sm:px-10 lg:px-14">
          <div className="grid gap-12 pt-12 pb-12 sm:grid-cols-2 lg:grid-cols-12 lg:gap-10 lg:pt-16">
            <div className="sm:col-span-2 lg:col-span-6">
              <a href="#top" aria-label="Наверх" className="inline-block">
                <Logo className="h-9 w-auto" />
              </a>
              <p className="mt-8 text-[clamp(1.6rem,2.6vw,2.4rem)] leading-[1.08] font-semibold tracking-[-0.035em]">
                {footer.tagline[0]}
                <br />
                <span className="text-fg/45">{footer.tagline[1]}</span>
              </p>
            </div>
            <nav aria-label={footer.navTitle} className="lg:col-span-2 lg:col-start-8">
              <p className="text-[0.85rem] text-muted">{footer.navTitle}</p>
              <ul className="mt-4 grid gap-2.5">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-fg/80 transition-colors hover:text-accent-ink">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="lg:col-span-3">
              <p className="text-[0.85rem] text-muted">{footer.contactsTitle}</p>
              <ul className="mt-4 grid gap-2.5 text-fg/80">
                <li>
                  <a href={contacts.phone.href} className="transition-colors hover:text-accent-ink">
                    {contacts.phone.label}
                  </a>
                </li>
                <li>
                  <a href={`mailto:${contacts.email}`} className="transition-colors hover:text-accent-ink">
                    {contacts.email}
                  </a>
                </li>
                <li>{footer.address}</li>
                <li>
                  <a href={contacts.helpdesk} className="transition-colors hover:text-accent-ink">
                    {footer.support}
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-line py-6 text-[0.85rem] text-muted">
            <p>{footer.copyright}</p>
            <a href="#top" className="transition-colors hover:text-fg">
              Наверх
            </a>
          </div>
        </div>
      </footer>

      <RequestDialog dialogRef={dialogRef} dark={dark} />
    </>
  );
}
