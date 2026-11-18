import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";

import "./globals.css";

const onest = Onest({
  variable: "--font-onest",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Seven Hills of Kazakhstan — системный интегратор",
  description:
    "Seven Hills of Kazakhstan — системный интегратор: создание, модернизация и сопровождение корпоративных информационных систем. Собственные продукты, представительства в 20 областях, поддержка 24/7.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#050708" },
  ],
};

/** Ставит тему до первой отрисовки, чтобы не было вспышки светлого фона в тёмной теме. */
const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
