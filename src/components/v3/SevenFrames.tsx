"use client";

import { useEffect, useRef } from "react";

import { usePageGL } from "@/components/v3/gl/PageGL";

const FRAMES = 61;
const frameSrc = (i: number) => `/v2/seven/${String(i + 1).padStart(2, "0")}.webp`;

/**
 * Объёмный знак «7» из кадров Blender: место в вёрстке и запасная картинка; сам знак рисует PageGL.
 * ribbonKey — ключ data-ribbon: по нему лента находит знак, выписывает его контур
 * и «переливается» в знак или из него. Элемент должен быть квадратным (кадр 1200×1200).
 */
export function SevenFrames({ ribbonKey, className }: { ribbonKey: string; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const gl = usePageGL();
  useEffect(() => {
    const el = ref.current;
    if (!el || !gl) return;
    const frames = Array.from({ length: FRAMES }, () => new Image());
    // сначала центральный кадр, затем к краям — знак появляется сразу
    const mid = Math.floor(FRAMES / 2);
    const order = [mid, ...Array.from({ length: mid }, (_, k) => [mid - k - 1, mid + k + 1]).flat()].filter(
      (i) => i >= 0 && i < FRAMES,
    );
    order.forEach((i) => {
      frames[i].decoding = "async";
      frames[i].src = frameSrc(i);
    });
    return gl.seq({ el, frames, initial: mid });
  }, [gl]);

  return (
    <div ref={ref} data-ribbon={ribbonKey} aria-hidden className={`pointer-events-none aspect-square ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- кадр Blender с прозрачностью, оптимизация Next не нужна */}
      <img src={frameSrc(Math.floor(FRAMES / 2))} alt="" className="gl-hide h-full w-full object-contain" />
    </div>
  );
}
