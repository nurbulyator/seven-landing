"use client";

import type { FormEvent } from "react";

import { contactSection, contacts } from "@/content/site";

const fields = [
  { name: "name", label: "Как к вам обращаться", type: "text", autoComplete: "name" },
  { name: "organization", label: "Организация", type: "text", autoComplete: "organization" },
  { name: "contact", label: "Телефон или e-mail", type: "text", autoComplete: "tel" },
] as const;

const inputClass =
  "w-full rounded-xl border border-line bg-bg px-4 py-3 text-[1.02rem] text-fg outline-none transition-colors focus:border-accent";

/**
 * Пока у заявки нет серверного адресата, форма собирает письмо на info@ через mailto.
 * Когда появится CRM или почтовый шлюз — заменить обработчик.
 */
export function ContactForm() {
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const body = [
      `Имя: ${value("name")}`,
      `Организация: ${value("organization")}`,
      `Контакт: ${value("contact")}`,
      "",
      value("message"),
    ].join("\n");
    const subject = `Заявка с сайта: ${value("organization") || value("name")}`;
    window.location.href = `mailto:${contacts.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      {fields.map((field) => (
        <label key={field.name} className="grid gap-1.5 text-[0.85rem] text-muted">
          {field.label}
          <input
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            required
            className={inputClass}
          />
        </label>
      ))}
      <label className="grid gap-1.5 text-[0.85rem] text-muted">
        Задача
        <textarea name="message" rows={4} required className={`${inputClass} resize-y`} />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="submit"
          className="cursor-pointer rounded-full bg-accent px-7 py-3.5 text-[1rem] font-medium text-[#050708] transition-opacity hover:opacity-85"
        >
          {contactSection.submit}
        </button>
        <p className="text-[0.85rem] text-muted">{contactSection.note}</p>
      </div>
    </form>
  );
}
