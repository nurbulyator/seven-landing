import { Header } from "@/components/Header";
import { SevenHero } from "@/components/hero/SevenHero";
import { Contact } from "@/components/sections/Contact";
import { Directions } from "@/components/sections/Directions";
import { Numbers } from "@/components/sections/Numbers";
import { Products } from "@/components/sections/Products";
import { Statement } from "@/components/sections/Statement";
import { Trust } from "@/components/sections/Trust";

export default function HomePage() {
  return (
    <>
      <Header />
      <main>
        <SevenHero />
        <Statement />
        <Numbers />
        <Directions />
        <Products />
        <Trust />
        <Contact />
      </main>
    </>
  );
}
