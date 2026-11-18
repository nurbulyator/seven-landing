"use client";

import { useCallback, useRef } from "react";

import { statement } from "@/content/site";
import { useScrollProgress } from "@/lib/scroll";

/** Большая фраза, которая «проявляется» слово за словом по мере прокрутки. */
export function Statement() {
  const sectionRef = useRef<HTMLElement>(null);
  const wordsRef = useRef<HTMLSpanElement[]>([]);
  const words = statement.split(" ");

  const onProgress = useCallback(
    (p: number) => {
      const lit = p * 1.25 * words.length;
      wordsRef.current.forEach((el, i) => {
        const k = Math.min(1, Math.max(0, lit - i));
        el.style.opacity = String(0.16 + k * 0.84);
      });
    },
    [words.length],
  );
  useScrollProgress(sectionRef, onProgress);

  return (
    <section ref={sectionRef} className="relative h-[260svh]">
      <div className="sticky top-0 flex h-svh items-center">
        <p className="mx-auto max-w-[68rem] px-5 text-[clamp(1.75rem,4.3vw,3.9rem)] leading-[1.14] font-semibold tracking-[-0.025em] sm:px-8">
          {words.map((word, i) => (
            <span
              key={`${word}-${i}`}
              ref={(el) => {
                if (el) wordsRef.current[i] = el;
              }}
              className="opacity-[0.16] transition-opacity duration-150"
            >
              {word}{" "}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
