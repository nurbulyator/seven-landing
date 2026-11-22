"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useTheme } from "@/components/ThemeToggle";
import { StarField } from "@/components/v3/StarField";
import { LogoReveal } from "@/components/v6/LogoReveal";
import { worldV3 } from "@/content/v3";
import { clamp01, sectionProgress } from "@/lib/scroll";

/**
 * Глобус /v6 — «взлёт в космос». Сцена всегда уходит в ночь, в любой теме.
 * Вход: экран того же цвета, что страница, внизу — край Земли с бирюзовой атмосферой.
 * Пока слова разлетаются, мы «набираем высоту»: небо темнеет сверху вниз, как с высотой
 * (у горизонта светлее дольше), Земля уходит вниз и собирается в глобус, звёзды зажигаются
 * по одной — первыми самые яркие. Дальше как в /v3: Казахстан → дуга в Дубай → дуга в Чехию → итог.
 * Выход — «посадка»: камера опускается к Астане, небо светлеет обратно до цвета страницы,
 * звёзды гаснут, глобус растворяется — и тут же, без пустого экрана, собирается логотип
 * Seven Hills of Kazakhstan (LogoReveal, играет по времени). Следующий блок начинается на
 * обычном фоне без шва.
 */

const DEG = Math.PI / 180;
const ease = (t: number) => t * t * (3 - 2 * t);
const smooth = (a: number, b: number, v: number) => ease(clamp01((v - a) / (b - a)));

type Rgb = [number, number, number];
const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const css = (c: Rgb) => `rgb(${c[0].toFixed(1)} ${c[1].toFixed(1)} ${c[2].toFixed(1)})`;

/**
 * Небо по мере набора высоты: 0 — цвет страницы, 1 — космос. Светлая тема проходит дымку и
 * бирюзово-синие сумерки; тёмная — от фона страницы через едва заметную синеву к чёрному.
 */
const SKY: Record<"light" | "dark", [number, Rgb][]> = {
  light: [
    [0, hex("#fbfbfa")],
    [0.2, hex("#e3eff0")],
    [0.42, hex("#9ec7cf")],
    [0.62, hex("#2f5866")],
    [0.8, hex("#0c1b23")],
    [1, hex("#030506")],
  ],
  dark: [
    [0, hex("#050708")],
    [0.5, hex("#0a1820")],
    [1, hex("#030506")],
  ],
};

function skyAt(stops: [number, Rgb][], t: number): Rgb {
  for (let i = 1; i < stops.length; i++) {
    const [t1, c1] = stops[i];
    const [t0, c0] = stops[i - 1];
    if (t <= t1) return mixRgb(c0, c1, (t - t0) / (t1 - t0));
  }
  return stops[stops.length - 1][1];
}

const DOTS_LIGHT = new THREE.Vector3(0.32, 0.4, 0.42);
const DOTS_DARK = new THREE.Vector3(0.55, 0.66, 0.68);
const INK_LIGHT = hex("#111618");
const INK_DARK = hex("#f3f5f5");
/** Фирменный серый надписи логотипа на светлом фоне. */
const LOGO_GRAY = hex("#737374");
/** Старт: камера близко, Земля опущена — над нижним краем экрана виден только её горизонт. */
const LIFT_Y = -1.22;
const LIFT_Z = 1.9;
/** Доля прокрутки секции на полёт (сценарий /v3); остаток — посадка обратно в светлую страницу. */
const FLIGHT = 0.84;
/** Камера при посадке: у самой поверхности над Астаной. */
const LAND_Z = 1.35;

function toVec(lat: number, lon: number, r = 1) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(r * Math.cos(la) * Math.cos(lo), r * Math.sin(la), -r * Math.cos(la) * Math.sin(lo));
}

/** Повороты группы, при которых точка (lat, lon) смотрит прямо в камеру. */
function facing(lat: number, lon: number) {
  return { x: lat * DEG, y: -lon * DEG - Math.PI / 2 };
}

const dotsVertex = /* glsl */ `
  attribute float aKind;
  uniform float uSize;
  uniform vec3 uGlow; // яркость Казахстана, ОАЭ, Чехии
  uniform vec3 uBase;
  uniform float uBaseAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(mat3(modelMatrix) * position);
    float front = smoothstep(-0.15, 0.55, n.z);
    vec3 teal = vec3(0.0, 0.73, 0.77);
    vec3 mint = vec3(0.56, 0.91, 0.93); // ОАЭ и Чехия — светлая бирюза, Казахстан — насыщенная
    float g = aKind == 1.0 ? uGlow.x : aKind == 2.0 ? uGlow.y : aKind == 3.0 ? uGlow.z : 0.0;
    // страны видны всегда (слегка), при фокусе — ярко
    g = aKind > 0.5 ? max(g, 0.3) : 0.0;
    vColor = mix(uBase, aKind == 1.0 ? teal : mint, g);
    vAlpha = front * mix(uBaseAlpha, 1.0, g);
    gl_PointSize = uSize * (aKind > 0.5 ? 0.9 + g * 0.35 : 1.0) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const dotsFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = vAlpha * smoothstep(0.5, 0.2, d);
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const arcVertex = /* glsl */ `
  varying float vT;
  void main() {
    vT = uv.x;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
// дуга в бирюзе ленты: светится к голове
const arcFragment = /* glsl */ `
  uniform float uProgress;
  varying float vT;
  void main() {
    if (vT > uProgress) discard;
    float head = smoothstep(uProgress - 0.12, uProgress, vT);
    vec3 col = mix(vec3(0.0, 0.733, 0.769), vec3(0.78, 0.98, 0.99), head);
    float a = 0.85 + head * 0.15;
    gl_FragColor = vec4(col * a, a);
  }
`;

export function WorldV6() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const labelsRef = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLDivElement>(null);
  const starsRef = useRef(0);
  const dark = useTheme() === "dark";

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    const sky = skyRef.current;
    if (!section || !canvas || !stage || !sky) return;
    const skyStops = SKY[dark ? "dark" : "light"];
    const inkFrom = dark ? INK_DARK : INK_LIGHT;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
    } catch {
      return;
    }
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    camera.position.set(0, 0, 4.2);
    const globe = new THREE.Group();
    scene.add(globe);

    // Тёмная сфера закрывает точки обратной стороны, по краю — бирюзовое свечение атмосферы
    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.995, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        uniforms: { uBody: { value: new THREE.Vector3() } },
        fragmentShader: `uniform vec3 uBody; varying vec3 vN; void main(){ float rim = pow(1.0 - max(vN.z, 0.0), 3.0); gl_FragColor = vec4(mix(uBody, vec3(0.0,0.6,0.64), rim * 0.5), 1.0); }`,
      }),
    );
    body.renderOrder = -1;
    globe.add(body);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 64, 64),
      new THREE.ShaderMaterial({
        transparent: true,
        side: THREE.BackSide,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        // свечение у края глобуса, к внешнему краю ореола сходит на нет
        fragmentShader: `varying vec3 vN; void main(){ float i = pow(smoothstep(0.0, 0.55, abs(vN.z)), 2.0) * 0.55; gl_FragColor = vec4(vec3(0.0,0.73,0.77) * i, i); }`,
      }),
    );
    scene.add(halo);

    const dotsMat = new THREE.ShaderMaterial({
      vertexShader: dotsVertex,
      fragmentShader: dotsFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      uniforms: {
        uSize: { value: 9 },
        uGlow: { value: new THREE.Vector3() },
        uBase: { value: (dark ? DOTS_DARK : DOTS_LIGHT).clone() },
        uBaseAlpha: { value: dark ? 0.42 : 0.5 },
      },
    });
    let cancelled = false;
    const outlineMats: THREE.MeshBasicMaterial[] = [];
    fetch("/v2/globe.json")
      .then((r) => r.json() as Promise<{ points: number[]; outlines: Record<string, number[][]> }>)
      .then(({ points: data, outlines }) => {
        if (cancelled) return;
        const n = data.length / 3;
        const pos = new Float32Array(n * 3);
        const kind = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const v = toVec(data[i * 3], data[i * 3 + 1], 1.002);
          pos.set([v.x, v.y, v.z], i * 3);
          kind[i] = data[i * 3 + 2];
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        g.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
        globe.add(new THREE.Points(g, dotsMat));
        // контуры трёх стран — тонкие трубки по границе
        for (const [mark, rings] of Object.entries(outlines)) {
          const mat = new THREE.MeshBasicMaterial({ color: mark === "1" ? 0x00bbc4 : 0x8fe8ed, transparent: true, opacity: 0.5, depthWrite: false });
          outlineMats[Number(mark) - 1] = mat;
          for (const ring of rings) {
            const pts: THREE.Vector3[] = [];
            for (let i = 0; i < ring.length; i += 2) pts.push(toVec(ring[i], ring[i + 1], 1.004));
            if (pts.length < 4) continue;
            const path = new THREE.CatmullRomCurve3(pts, true);
            globe.add(new THREE.Mesh(new THREE.TubeGeometry(path, Math.min(1200, pts.length * 2), 0.0022, 4, true), mat));
          }
        }
      })
      .catch(() => {});

    // Дуги из Астаны: тонкая трубка, а когда дуга дошла до города — плоская стрелка-наконечник,
    // лежащая на поверхности глобуса остриём по ходу дуги (как нарисованная на карте)
    const ARC_R = 0.0028;
    const [kz, ae, cz] = worldV3.places;
    const astana = toVec(kz.lat, kz.lon);
    const arcs = [ae, cz].map((p) => {
      const end = toVec(p.lat, p.lon);
      const mid = astana.clone().add(end).multiplyScalar(0.5);
      mid.normalize().multiplyScalar(1 + astana.distanceTo(end) * 0.45);
      const curve = new THREE.QuadraticBezierCurve3(astana, mid, end);
      const mat = new THREE.ShaderMaterial({
        vertexShader: arcVertex,
        fragmentShader: arcFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        uniforms: { uProgress: { value: 0 } },
      });
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, ARC_R, 8, false), mat);
      globe.add(mesh);
      // треугольник в своей плоскости XY: остриё в начале координат, смотрит по +X
      const tri = new THREE.BufferGeometry();
      tri.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, -0.034, 0.014, 0, -0.034, -0.014, 0], 3));
      const arrow = new THREE.Mesh(
        tri,
        new THREE.MeshBasicMaterial({ color: 0x3fd3db, transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      );
      // остриё чуть не доходит до города, чтобы не прятаться под кольцом-пульсом; плоскость — касательная к сфере
      const tip = curve.getPoint(0.975);
      const n = tip.clone().normalize();
      const fwd = curve.getTangent(0.975);
      fwd.sub(n.clone().multiplyScalar(fwd.dot(n))).normalize();
      const side = new THREE.Vector3().crossVectors(n, fwd);
      arrow.matrixAutoUpdate = false;
      arrow.matrix.makeBasis(fwd, side, n).setPosition(tip.multiplyScalar(1.004));
      arrow.visible = false;
      globe.add(arrow);
      return { mat, arrow };
    });

    // Метки городов: кольцо-пульс
    const rings = worldV3.places.map((p, i) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.018, 0.026, 48),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0x3fd3db : 0xa6f0f3, transparent: true, depthWrite: false }),
      );
      const v = toVec(p.lat, p.lon, 1.006);
      m.position.copy(v);
      m.lookAt(v.clone().multiplyScalar(2));
      globe.add(m);
      return m;
    });

    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      dotsMat.uniforms.uSize.value = 9 * Math.min(window.devicePixelRatio, 2) * Math.min(1.4, Math.max(0.8, h / 900));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const targets = worldV3.places.map((p) => facing(p.lat, p.lon));
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const tmp = new THREE.Vector3();
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const rect = section.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const raw = sectionProgress(section);
      const p = Math.min(1, raw / FLIGHT);
      const land = smooth(0.85, 0.95, raw);
      const t = clock.getElapsedTime();

      // 0. набор высоты: небо темнеет — зенит раньше, горизонт позже; звёзды — во второй половине.
      //    При посадке всё идёт обратно: горизонт светлеет первым, звёзды гаснут.
      const night = smooth(0.01, 0.22, p) * (1 - land);
      const top = skyAt(skyStops, Math.pow(night, 0.7));
      const mid = skyAt(skyStops, night);
      const low = skyAt(skyStops, Math.pow(night, 1.5));
      sky.style.background = `linear-gradient(to bottom, ${css(top)} 0%, ${css(mid)} 55%, ${css(low)} 100%)`;
      starsRef.current = smooth(0.45, 1, night);
      stage.dataset.night = night > 0.55 ? "on" : "off";
      // тело Земли — чуть темнее неба у горизонта: темнеет вместе с ним, без серой середины
      const ground = skyAt(skyStops, Math.pow(night, 1.25));
      ((body.material as THREE.ShaderMaterial).uniforms.uBody.value as THREE.Vector3).set(
        (ground[0] / 255) * 0.95,
        (ground[1] / 255) * 0.96,
        (ground[2] / 255) * 0.96,
      );
      (dotsMat.uniforms.uBase.value as THREE.Vector3).lerpVectors(dark ? DOTS_DARK : DOTS_LIGHT, DOTS_DARK, night);
      dotsMat.uniforms.uBaseAlpha.value = mix(dark ? 0.42 : 0.5, 0.42, night);
      const ink = css(mixRgb(inkFrom, INK_DARK, smooth(0.42, 0.52, night)));

      // 1. слова разлетаются, глобус выплывает из глубины
      const intro = ease(clamp01(p / 0.2));
      wordsRef.current.forEach((el, i) => {
        if (!el) return;
        const dir = i - 1;
        el.style.transform = `translate(${dir * intro * 60}vw, ${(i - 1) * (1 + intro * 0.6) * 1.1}em) scale(${1 + intro * 1.6})`;
        el.style.opacity = String(1 - clamp01((p - 0.12) / 0.08));
        el.style.color = ink;
      });

      // 2–4. фокус: Казахстан → ОАЭ → Чехия → общий план
      const kzIn = ease(clamp01((p - 0.16) / 0.12));
      const toAe = ease(clamp01((p - 0.4) / 0.14));
      const toCz = ease(clamp01((p - 0.62) / 0.14));
      const out = ease(clamp01((p - 0.84) / 0.12));
      const idle = t * 0.04;
      let rx = mix(0.35, targets[0].x, kzIn);
      let ry = mix(targets[0].y + 1.4 + idle, targets[0].y, kzIn);
      rx = mix(rx, (targets[0].x + targets[1].x) / 2, toAe);
      ry = mix(ry, (targets[0].y + targets[1].y) / 2, toAe);
      rx = mix(rx, (targets[0].x + targets[2].x) / 2, toCz);
      ry = mix(ry, (targets[1].y + targets[2].y) / 2 + 0.2, toCz);
      // посадка: снова разворачиваемся к Астане
      rx = mix(rx, targets[0].x, land);
      ry = mix(ry, targets[0].y, land);
      globe.rotation.set(rx, ry, 0);
      // Земля поднимается из-под нижнего края, камера отходит — горизонт сворачивается в шар
      const rise = smooth(0, 0.22, p);
      globe.position.y = mix(LIFT_Y, 0, rise);
      halo.position.copy(globe.position);
      const zoom = mix(mix(LIFT_Z, 3.4, rise), 2.75, kzIn);
      // на вертикальном экране отходим дальше, чтобы подписи помещались
      const fit = Math.max(1, 0.95 / camera.aspect);
      camera.position.z = mix(mix(mix(zoom, 3.0, toAe), 3.6, out), LAND_Z, land) * fit;
      // у поверхности глобус растворяется в светлом небе — к концу секции на экране только фон страницы
      // гаснет быстро, как только начинает собираться логотип (land > 0,5), чтобы не мешать буквам
      canvas.style.opacity = String(1 - smooth(0.4, 0.75, land));
      const leave = 1 - smooth(0, 0.3, land);

      const glow = dotsMat.uniforms.uGlow.value as THREE.Vector3;
      glow.set(kzIn, clamp01((p - 0.5) / 0.06), clamp01((p - 0.72) / 0.06));
      outlineMats.forEach((m, i) => {
        if (m) m.opacity = 0.35 + 0.65 * glow.getComponent(i);
      });
      [clamp01((p - 0.42) / 0.12), clamp01((p - 0.64) / 0.12)].forEach((k, i) => {
        const a = arcs[i];
        a.mat.uniforms.uProgress.value = k * 1.02;
        const shown = clamp01((k - 0.9) / 0.1);
        a.arrow.visible = shown > 0;
        (a.arrow.material as THREE.MeshBasicMaterial).opacity = shown * leave;
      });
      rings.forEach((r, i) => {
        const on = i === 0 ? kzIn : glow.getComponent(i);
        const pulse = 1 + ((t * 0.8 + i * 0.3) % 1) * 1.6;
        r.scale.setScalar(on * pulse);
        (r.material as THREE.MeshBasicMaterial).opacity = on * (1 - ((t * 0.8 + i * 0.3) % 1) * 0.8);
      });

      // подписи привязаны к точкам на глобусе
      globe.updateMatrixWorld();
      worldV3.places.forEach((place, i) => {
        const el = labelsRef.current[i];
        if (!el) return;
        tmp.copy(toVec(place.lat, place.lon, 1.01)).applyMatrix4(globe.matrixWorld);
        const facingCam = tmp.clone().normalize().dot(camera.position.clone().normalize());
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-tmp.y * 0.5 + 0.5) * canvas.clientHeight;
        const on = (i === 0 ? kzIn : glow.getComponent(i)) * clamp01(facingCam * 4) * leave;
        // Казахстан — всегда справа от точки, ОАЭ и Чехия — слева (дуга приходит к ним справа,
        // из Астаны, и не перечёркивает подпись); на другую сторону — только если не влезает в экран
        const w = el.offsetWidth + 48;
        const flip = i === 0 ? x + w > canvas.clientWidth : x - w > 0;
        el.style.transform = `translate(${x}px, ${y}px)${flip ? " translateX(-100%) translateX(-3rem)" : ""}`;
        el.style.opacity = String(on);
      });
      if (titleRef.current) {
        titleRef.current.style.opacity = String(out * leave);
        titleRef.current.style.transform = `translateY(${(1 - out) * 30 - (1 - leave) * 40}px)`;
      }
      // логотип собирается, как только глобус начал растворяться над Казахстаном; надпись —
      // белая на тёмном небе, фирменная серая на светлом
      const logo = logoRef.current;
      if (logo) {
        const on = land > 0.5 ? "true" : "false";
        if (logo.dataset.on !== on) logo.dataset.on = on;
        logo.style.color = css(mixRgb(dark ? INK_DARK : LOGO_GRAY, INK_DARK, smooth(0.35, 0.6, night)));
      }
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
          o.geometry.dispose();
          (o.material as THREE.Material).dispose();
        }
      });
      renderer.dispose();
    };
  }, [dark]);

  return (
    <section
      id="world"
      data-ribbon="world"
      ref={sectionRef}
      aria-label="География"
      className="relative h-[670svh] bg-bg text-white"
    >
      {/* у закреплённого слоя свой фон (небо) — лента проходит «за» глобусом и не просвечивает */}
      <div ref={stageRef} data-night="off" className="sticky top-0 z-[6] h-svh overflow-hidden">
        <div ref={skyRef} aria-hidden className="absolute inset-0 bg-bg" />
        <StarField reveal={starsRef} />
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        <p
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-fg text-[clamp(3rem,9vw,9rem)] leading-none font-semibold tracking-[-0.05em]"
        >
          {worldV3.words.map((w, i) => (
            <span
              key={w}
              ref={(el) => {
                wordsRef.current[i] = el;
              }}
              className="absolute"
              style={{ transform: `translateY(${(i - 1) * 1.1}em)` }}
            >
              {w}
            </span>
          ))}
        </p>

        {worldV3.places.map((place, i) => (
          <div
            key={place.key}
            ref={(el) => {
              labelsRef.current[i] = el;
            }}
            className="pointer-events-none absolute top-0 left-0 opacity-0"
          >
            <div className="ml-6 -translate-y-1/2 rounded-2xl bg-white/10 px-5 py-3.5 backdrop-blur-md">
              <p className={`text-[clamp(1.3rem,2vw,1.8rem)] leading-none font-semibold tracking-[-0.02em] ${i === 0 ? "text-[#3fd3db]" : "text-[#a6f0f3]"}`}>
                {place.name}
              </p>
              <p className="mt-1.5 max-w-[16rem] text-[0.92rem] leading-snug text-white/70">{place.note}</p>
            </div>
          </div>
        ))}

        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6">
          <LogoReveal ref={logoRef} className="w-[min(78vw,54rem)]" />
        </div>

        <div ref={titleRef} className="absolute inset-x-0 bottom-[9svh] px-5 text-center opacity-0">
          <h2 className="mx-auto max-w-[56rem] text-[clamp(2rem,5vw,4.4rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
            {worldV3.title}
          </h2>
          <a
            href="#contact"
            className="mt-7 inline-block rounded-full bg-[#00bbc4] px-6 py-3 text-[0.98rem] font-medium text-[#050708] transition-transform hover:scale-[1.03]"
          >
            Обсудить задачу
          </a>
        </div>
      </div>

      <ul className="sr-only">
        {worldV3.places.map((p) => (
          <li key={p.key}>
            {p.name} — {p.note}
          </li>
        ))}
      </ul>
    </section>
  );
}
