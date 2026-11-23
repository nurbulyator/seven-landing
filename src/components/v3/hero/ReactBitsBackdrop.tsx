"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

/**
 * Фоны React Bits (reactbits.dev/backgrounds) за знаком первого экрана — пробуем, какой подойдёт.
 * Исходники лежат дословно в components/reactbits; здесь только наша бирюза и тема.
 * Каждый грузится отдельным чанком и только на клиенте — в общий бандл не попадают.
 */

const Topography = dynamic(() => import("@/components/reactbits/Topography"), { ssr: false });
const DotGrid = dynamic(() => import("@/components/reactbits/DotGrid"), { ssr: false });
const DotField = dynamic(() => import("@/components/reactbits/DotField"), { ssr: false });
const PatternWaves = dynamic(() => import("@/components/reactbits/PatternWaves"), { ssr: false });
const MicroSlats = dynamic(() => import("@/components/reactbits/MicroSlats"), { ssr: false });
const Dither = dynamic(() => import("@/components/reactbits/Dither"), { ssr: false });
const LineWaves = dynamic(() => import("@/components/reactbits/LineWaves"), { ssr: false });
const Waves = dynamic(() => import("@/components/reactbits/Waves"), { ssr: false });
const FloatingLines = dynamic(() => import("@/components/reactbits/FloatingLines"), { ssr: false });
const Threads = dynamic(() => import("@/components/reactbits/Threads"), { ssr: false });
const FluxLines = dynamic(() => import("@/components/reactbits/FluxLines"), { ssr: false });
const GhostFibers = dynamic(() => import("@/components/reactbits/GhostFibers"), { ssr: false });
const Silk = dynamic(() => import("@/components/reactbits/Silk"), { ssr: false });
const Beams = dynamic(() => import("@/components/reactbits/Beams"), { ssr: false });
const DarkVeil = dynamic(() => import("@/components/reactbits/DarkVeil"), { ssr: false });
const GradientWaves = dynamic(() => import("@/components/reactbits/GradientWaves"), { ssr: false });
const GradientBlinds = dynamic(() => import("@/components/reactbits/GradientBlinds"), { ssr: false });
const Grainient = dynamic(() => import("@/components/reactbits/Grainient"), { ssr: false });
const Iridescence = dynamic(() => import("@/components/reactbits/Iridescence"), { ssr: false });
const LiquidEther = dynamic(() => import("@/components/reactbits/LiquidEther"), { ssr: false });
const Particles = dynamic(() => import("@/components/reactbits/Particles"), { ssr: false });
const RippleGrid = dynamic(() => import("@/components/reactbits/RippleGrid"), { ssr: false });
const LightTunnel = dynamic(() => import("@/components/reactbits/LightTunnel"), { ssr: false });
const Galaxy = dynamic(() => import("@/components/reactbits/Galaxy"), { ssr: false });
const SideRays = dynamic(() => import("@/components/reactbits/SideRays"), { ssr: false });
const LightRays = dynamic(() => import("@/components/reactbits/LightRays"), { ssr: false });
const Aurora = dynamic(() => import("@/components/reactbits/Aurora"), { ssr: false });
const SoftAurora = dynamic(() => import("@/components/reactbits/SoftAurora"), { ssr: false });

// бирюза бренда: основная, светлая (для тёмной карточки), глубокая (для светлой)
const TEAL = "#00bbc4";
const TEAL_LIGHT = "#7fe3e8";
const TEAL_DEEP = "#00828a";
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
// тон карточки под фонами, которые заливают холст сами
const cardBg = (dark: boolean) => (dark ? "#0a1214" : "#eef3f3");

type Render = (dark: boolean) => ReactNode;

const renders = {
  topography: (dark) => <Topography color={dark ? TEAL : TEAL_DEEP} lightMode={!dark} />,
  dotGrid: (dark) => <DotGrid baseColor={dark ? "#1d3a3c" : "#bcd2d3"} activeColor={dark ? TEAL_LIGHT : TEAL} />,
  dotField: (dark) => (
    <DotField gradientFrom={dark ? TEAL : TEAL_DEEP} gradientTo={dark ? TEAL_LIGHT : TEAL} glowColor={TEAL} lightMode={!dark} />
  ),
  patternWaves: (dark) => <PatternWaves color={dark ? TEAL_LIGHT : TEAL_DEEP} backgroundColor={cardBg(dark)} />,
  microSlats: (dark) => (
    <MicroSlats color={dark ? TEAL : TEAL_DEEP} glintColor={dark ? TEAL_LIGHT : "#ffffff"} backgroundColor={cardBg(dark)} />
  ),
  dither: (dark) => <Dither waveColor={rgb(dark ? TEAL : TEAL_DEEP)} backgroundColor={rgb(cardBg(dark))} />,
  lineWaves: (dark) => <LineWaves color1={TEAL} color2={dark ? TEAL_LIGHT : TEAL_DEEP} color3={TEAL} lightMode={!dark} />,
  waves: (dark) => <Waves lineColor={dark ? TEAL : TEAL_DEEP} accentColor={dark ? TEAL_LIGHT : TEAL} lightMode={!dark} />,
  floatingLines: (dark) => <FloatingLines linesGradient={[TEAL_DEEP, TEAL, TEAL_LIGHT]} lightMode={!dark} />,
  threads: (dark) => <Threads color={rgb(dark ? TEAL : TEAL_DEEP)} accentColor={rgb(dark ? TEAL_LIGHT : TEAL)} />,
  fluxLines: (dark) => <FluxLines colors={[TEAL_DEEP, TEAL, TEAL_LIGHT]} lightMode={!dark} />,
  ghostFibers: (dark) => <GhostFibers glowColor={TEAL} lightMode={!dark} />,
  silk: (dark) => <Silk color={dark ? "#1b6d72" : "#9fd9dc"} sheenColor={dark ? TEAL_LIGHT : "#ffffff"} lightMode={!dark} />,
  beams: (dark) => <Beams color={dark ? TEAL : TEAL_DEEP} lightMode={!dark} />,
  darkVeil: (dark) => <DarkVeil color={TEAL} lightMode={!dark} />,
  gradientWaves: (dark) => (
    <GradientWaves horizonColor={TEAL_DEEP} waveColor={TEAL} crestColor={dark ? TEAL_LIGHT : "#ffffff"} lightMode={!dark} />
  ),
  gradientBlinds: (dark) => <GradientBlinds gradientColors={[TEAL_DEEP, TEAL, TEAL_LIGHT]} lightMode={!dark} />,
  grainient: (dark) => (
    <Grainient colors={dark ? ["#070c0e", TEAL_DEEP, TEAL, TEAL_LIGHT] : ["#ffffff", "#cdeced", TEAL_LIGHT, TEAL]} lightMode={!dark} />
  ),
  iridescence: (dark) => <Iridescence color={dark ? [0.25, 0.75, 0.78] : [0.78, 0.95, 0.96]} />,
  liquidEther: (dark) => <LiquidEther colors={[TEAL_DEEP, TEAL, TEAL_LIGHT]} lightMode={!dark} />,
  particles: (dark) => (
    <Particles particleColors={dark ? [TEAL, TEAL_LIGHT, "#ffffff"] : [TEAL_DEEP, TEAL, "#0b1214"]} connections lightMode={!dark} />
  ),
  rippleGrid: (dark) => <RippleGrid color={dark ? TEAL : TEAL_DEEP} lightMode={!dark} />,
  lightTunnel: (dark) => <LightTunnel cableColor={TEAL} pulseColor={TEAL_LIGHT} tunnelColor={TEAL_DEEP} lightMode={!dark} />,
  galaxy: (dark) => <Galaxy starColors={["#ffffff", TEAL_LIGHT, TEAL]} lightMode={!dark} />,
  sideRays: (dark) => <SideRays rayColor1={TEAL} rayColor2={TEAL_LIGHT} lightMode={!dark} />,
  lightRays: (dark) => <LightRays raysColor={dark ? TEAL_LIGHT : TEAL} lightMode={!dark} />,
  aurora: (dark) => <Aurora colorStops={[TEAL_DEEP, TEAL, TEAL_LIGHT]} lightMode={!dark} />,
  // spectrum=0 — без радужного перелива, только наши два тона бирюзы
  softAurora: (dark) => (
    <SoftAurora color1={dark ? TEAL_LIGHT : TEAL} color2={dark ? TEAL : TEAL_DEEP} spectrum={0} lightMode={!dark} />
  ),
} satisfies Record<string, Render>;

export type ReactBitsKey = keyof typeof renders;

/** Подписи — как на reactbits.dev, чтобы легко найти оригинал. */
export const reactBitsBackdrops = [
  { key: "topography", label: "Topography" },
  { key: "dotGrid", label: "Dot Grid" },
  { key: "dotField", label: "Dot Field" },
  { key: "patternWaves", label: "Pattern Waves" },
  { key: "microSlats", label: "Micro Slats" },
  { key: "dither", label: "Dither" },
  { key: "lineWaves", label: "Line Waves" },
  { key: "waves", label: "Waves" },
  { key: "floatingLines", label: "Floating Lines" },
  { key: "threads", label: "Threads" },
  { key: "fluxLines", label: "Flux Lines" },
  { key: "ghostFibers", label: "Ghost Fibers" },
  { key: "silk", label: "Silk" },
  { key: "beams", label: "Beams" },
  { key: "darkVeil", label: "Dark Veil" },
  { key: "gradientWaves", label: "Gradient Waves" },
  { key: "gradientBlinds", label: "Gradient Blinds" },
  { key: "grainient", label: "Grainient" },
  { key: "iridescence", label: "Iridescence" },
  { key: "liquidEther", label: "Liquid Ether" },
  { key: "particles", label: "Particles" },
  { key: "rippleGrid", label: "Ripple Grid" },
  { key: "lightTunnel", label: "Light Tunnel" },
  { key: "galaxy", label: "Galaxy" },
  { key: "sideRays", label: "Side Rays" },
  { key: "lightRays", label: "Light Rays" },
  { key: "aurora", label: "Aurora" },
  { key: "softAurora", label: "Soft Aurora" },
] as const satisfies readonly { key: ReactBitsKey; label: string }[];

export function ReactBitsBackdrop({ name, dark }: { name: ReactBitsKey; dark: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0">
      {renders[name](dark)}
    </div>
  );
}
