import { company, contactSection, contacts } from "@/content/site";

import { ContactForm } from "./ContactForm";

export function Contact() {
  return (
    <section id="contact" className="bg-bg-2 pt-24 lg:pt-36">
      <div className="mx-auto w-full max-w-[80rem] px-5 sm:px-8">
        <div className="reveal text-center">
          <h2 className="text-[clamp(2.6rem,7vw,6rem)] leading-[1.02] font-bold tracking-[-0.04em]">
            {contactSection.title}
          </h2>
          <p className="mx-auto mt-5 max-w-[36rem] text-[1.1rem] leading-snug text-muted sm:text-[1.3rem]">
            {contactSection.text}
          </p>
          <a
            href={contacts.phone.href}
            className="text-brand mt-8 inline-block text-[clamp(2rem,5.4vw,4.4rem)] font-bold tracking-[-0.035em]"
          >
            {contacts.phone.label}
          </a>
        </div>

        <div className="mt-14 grid gap-5 lg:mt-20 lg:grid-cols-12">
          <div className="reveal rounded-[1.75rem] bg-card p-7 shadow-[0_1px_0_var(--line),0_20px_50px_-30px_var(--shadow)] sm:p-10 lg:col-span-7">
            <ContactForm />
          </div>
          <dl className="reveal grid content-start gap-7 rounded-[1.75rem] bg-card p-7 text-[1rem] shadow-[0_1px_0_var(--line),0_20px_50px_-30px_var(--shadow)] sm:grid-cols-2 sm:p-10 lg:col-span-5 lg:grid-cols-1">
            <div>
              <dt className="text-[0.85rem] text-muted">Адрес</dt>
              <dd className="mt-1.5 leading-snug">
                {contacts.address[0]}
                <br />
                {contacts.address[1]}
              </dd>
            </div>
            <div>
              <dt className="text-[0.85rem] text-muted">Почта</dt>
              <dd className="mt-1.5 leading-snug">
                <a href={`mailto:${contacts.email}`} className="hover:text-accent-ink">
                  {contacts.email}
                </a>
                <br />
                <a href={`mailto:${contacts.support}`} className="hover:text-accent-ink">
                  {contacts.support}
                </a>{" "}
                <span className="text-muted">— поддержка</span>
              </dd>
            </div>
            <div>
              <dt className="text-[0.85rem] text-muted">Приёмная</dt>
              <dd className="mt-1.5">
                <a href={contacts.reception.href} className="hover:text-accent-ink">
                  {contacts.reception.label}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[0.85rem] text-muted">Бухгалтерия</dt>
              <dd className="mt-1.5">
                <a href={contacts.accounting.href} className="hover:text-accent-ink">
                  {contacts.accounting.label}
                </a>
              </dd>
            </div>
          </dl>
        </div>

        <footer className="mt-24 flex flex-wrap items-center justify-between gap-x-8 gap-y-3 border-t border-line py-8 text-[0.85rem] text-muted">
          <p>© 2026 {company.name}</p>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <a href={contacts.helpdesk} className="hover:text-fg">
              Helpdesk
            </a>
            <a href="#top" className="hover:text-fg">
              Наверх
            </a>
          </div>
        </footer>
      </div>
    </section>
  );
}
