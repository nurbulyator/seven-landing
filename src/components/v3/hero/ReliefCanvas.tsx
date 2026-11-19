"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

import { SEVEN_PATH } from "@/components/Logo";

/**
 * Версия C первого экрана — «Рельеф». Поле из тысяч светлых столбиков, как макет города
 * или крыши серверных стоек. Из поля выступает знак «7», курсор поднимает волну.
 */

const COLS = 64;
const ROWS = 36;

/** Растеризует знак «7» в сетку: 1 — клетка внутри знака. */
function sevenMask(): Float32Array {
  const c = document.createElement("canvas");
  c.width = COLS;
  c.height = ROWS;
  const ctx = c.getContext("2d");
  const mask = new Float32Array(COLS * ROWS);
  if (!ctx) return mask;
  const h = ROWS * 0.72;
  const s = h / 285.92;
  ctx.translate(COLS * 0.76 - (203.3 * s) / 2, (ROWS - h) / 2 - 2);
  ctx.scale(s, s);
  ctx.fillStyle = "#fff";
  ctx.fill(new Path2D(SEVEN_PATH));
  const data = ctx.getImageData(0, 0, COLS, ROWS).data;
  for (let i = 0; i < COLS * ROWS; i++) mask[i] = data[i * 4 + 3] / 255;
  return mask;
}

export function ReliefCanvas({ dark }: { dark: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    } catch {
      return;
    }
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = dark ? 1.0 : 1.05;

    const bg = new THREE.Color(dark ? "#0b1012" : "#e7ecec");
    const scene = new THREE.Scene();
    scene.background = bg;
    scene.fog = new THREE.Fog(bg, 60, 120);

    const camera = new THREE.PerspectiveCamera(26, 1, 1, 400);
    const target = new THREE.Vector3(0, 0, 2);

    scene.add(new THREE.HemisphereLight(dark ? 0x8fb4bb : 0xffffff, dark ? 0x06090a : 0xb7c4c6, dark ? 0.9 : 1.6));
    const sun = new THREE.DirectionalLight(0xfff4e6, dark ? 2.4 : 3.2);
    sun.position.set(-30, 50, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 30, bottom: -30, near: 1, far: 140 });
    sun.shadow.bias = -0.0004;
    sun.shadow.radius = 4;
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x9ff3f6, dark ? 1.4 : 0.6);
    rim.position.set(30, 20, -30);
    scene.add(rim);

    const geo = new RoundedBoxGeometry(0.9, 1, 0.9, 2, 0.1);
    geo.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0.05 });
    const count = COLS * ROWS;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const mask = sevenMask();
    const base = new THREE.Color(dark ? "#1a2326" : "#f4f6f6");
    const teal = new THREE.Color("#00bbc4");
    const amber = new THREE.Color("#ffb541");
    const heights = new Float32Array(count);
    const seed = new Float32Array(count).map(() => Math.random());
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();

    const pointer = new THREE.Vector3(999, 0, 999);
    const pointerTarget = new THREE.Vector3(999, 0, 999);
    const ray = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    const ripples: { x: number; z: number; t: number }[] = [];

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      ray.ray.intersectPlane(ground, pointerTarget);
    };
    const onLeave = () => pointerTarget.set(999, 0, 999);
    const onDown = () => ripples.push({ x: pointer.x, z: pointer.z, t: 0 });
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // поле всегда заполняет кадр; на узком экране камера смотрит на знак, а не в центр поля
      const portrait = camera.aspect < 1;
      const dist = portrait ? 46 : Math.max(62, 62 * (1.6 / camera.aspect));
      target.set(portrait ? 15 : 0, 0, portrait ? -1 : 2);
      camera.position.set(target.x - dist * 0.18, dist * 0.82, target.z + dist * 0.55);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    let visible = true;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);

    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible) return;
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      pointer.lerp(pointerTarget, pointerTarget.x > 900 ? 1 : 0.12);
      for (const r of ripples) r.t += dt;
      while (ripples.length && ripples[0].t > 3) ripples.shift();
      let i = 0;
      for (let row = 0; row < ROWS; row++) {
        for (let c = 0; c < COLS; c++, i++) {
          const x = c - COLS / 2 + 0.5;
          const z = row - ROWS / 2 + 0.5;
          const logo = mask[i];
          const idle = reduce ? 0 : 0.12 * Math.sin(x * 0.35 + t * 1.1) * Math.cos(z * 0.3 - t * 0.8);
          const d2 = (x - pointer.x) ** 2 + (z - pointer.z) ** 2;
          const bump = Math.exp(-d2 / 18);
          let wave = 0;
          for (const r of ripples) {
            const d = Math.hypot(x - r.x, z - r.z);
            wave += Math.exp(-((d - r.t * 16) ** 2) / 3) * (1 - r.t / 3) * 1.6;
          }
          const goal = 0.35 + seed[i] * 0.18 + logo * 2.4 + idle + bump * 2.2 + wave;
          heights[i] += (goal - heights[i]) * (reduce ? 1 : 0.14);
          m4.makeScale(1, heights[i], 1).setPosition(x, 0, z);
          mesh.setMatrixAt(i, m4);
          col.copy(base).lerp(teal, Math.min(1, logo));
          col.lerp(amber, Math.min(0.85, bump * 0.9 + wave * 0.4) * (1 - logo * 0.6));
          mesh.setColorAt(i, col);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
    };
  }, [dark]);

  return <canvas ref={ref} className="absolute inset-0 h-full w-full touch-pan-y" aria-hidden />;
}
