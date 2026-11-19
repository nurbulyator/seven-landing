"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

import { useTheme } from "@/components/ThemeToggle";
import { worldV2 } from "@/content/v2";
import { clamp01, sectionProgress } from "@/lib/scroll";

/**
 * Финал /v2: тёмный экран, глобус из точек суши.
 * Прокрутка: слова разлетаются → загорается Казахстан → дуга в Дубай → дуга в Чехию → итог.
 * Три страны засеяны плотнее остальной суши и обведены контуром — читаются издалека.
 * В светлой теме глобус светлый, в тёмной — тёмный.
 */

const DEG = Math.PI / 180;
const ease = (t: number) => t * t * (3 - 2 * t);

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
    vec3 amber = vec3(1.0, 0.71, 0.25);
    float g = aKind == 1.0 ? uGlow.x : aKind == 2.0 ? uGlow.y : aKind == 3.0 ? uGlow.z : 0.0;
    // страны видны всегда (слегка), при фокусе — ярко
    g = aKind > 0.5 ? max(g, 0.3) : 0.0;
    vColor = mix(uBase, aKind == 1.0 ? teal : amber, g);
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

export function WorldV2() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wordsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const labelsRef = useRef<(HTMLDivElement | null)[]>([]);
  const titleRef = useRef<HTMLDivElement>(null);
  const dark = useTheme() === "dark";

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;
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
        uniforms: { uBody: { value: dark ? new THREE.Vector3(0.012, 0.02, 0.024) : new THREE.Vector3(0.95, 0.965, 0.965) } },
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
        uBase: { value: dark ? new THREE.Vector3(0.55, 0.66, 0.68) : new THREE.Vector3(0.32, 0.4, 0.42) },
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
          const mat = new THREE.MeshBasicMaterial({ color: mark === "1" ? 0x00bbc4 : 0xffb541, transparent: true, opacity: 0.5, depthWrite: false });
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

    // Дуги из Астаны
    const [kz, ae, cz] = worldV2.places;
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
      const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.006, 8, false), mat);
      globe.add(mesh);
      return mat;
    });

    // Метки городов: кольцо-пульс
    const rings = worldV2.places.map((p, i) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.018, 0.026, 48),
        new THREE.MeshBasicMaterial({ color: i === 0 ? 0x3fd3db : 0xffc974, transparent: true, depthWrite: false }),
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

    const targets = worldV2.places.map((p) => facing(p.lat, p.lon));
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;
    const tmp = new THREE.Vector3();
    const clock = new THREE.Clock();
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const rect = section.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      const p = sectionProgress(section);
      const t = clock.getElapsedTime();

      // 1. слова разлетаются, глобус выплывает из глубины
      const intro = ease(clamp01(p / 0.2));
      wordsRef.current.forEach((el, i) => {
        if (!el) return;
        const dir = i - 1;
        el.style.transform = `translate(${dir * intro * 60}vw, ${(i - 1) * (1 + intro * 0.6) * 1.1}em) scale(${1 + intro * 1.6})`;
        el.style.opacity = String(1 - clamp01((p - 0.12) / 0.08));
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
      globe.rotation.set(rx, ry, 0);
      const zoom = mix(mix(9, 3.4, intro), 2.75, kzIn);
      // на вертикальном экране отходим дальше, чтобы подписи помещались
      const fit = Math.max(1, 0.95 / camera.aspect);
      camera.position.z = mix(mix(zoom, 3.0, toAe), 3.6, out) * fit;

      const glow = dotsMat.uniforms.uGlow.value as THREE.Vector3;
      glow.set(kzIn, clamp01((p - 0.5) / 0.06), clamp01((p - 0.72) / 0.06));
      outlineMats.forEach((m, i) => {
        if (m) m.opacity = 0.35 + 0.65 * glow.getComponent(i);
      });
      arcs[0].uniforms.uProgress.value = clamp01((p - 0.42) / 0.12) * 1.02;
      arcs[1].uniforms.uProgress.value = clamp01((p - 0.64) / 0.12) * 1.02;
      rings.forEach((r, i) => {
        const on = i === 0 ? kzIn : glow.getComponent(i);
        const pulse = 1 + ((t * 0.8 + i * 0.3) % 1) * 1.6;
        r.scale.setScalar(on * pulse);
        (r.material as THREE.MeshBasicMaterial).opacity = on * (1 - ((t * 0.8 + i * 0.3) % 1) * 0.8);
      });

      // подписи привязаны к точкам на глобусе
      globe.updateMatrixWorld();
      worldV2.places.forEach((place, i) => {
        const el = labelsRef.current[i];
        if (!el) return;
        tmp.copy(toVec(place.lat, place.lon, 1.01)).applyMatrix4(globe.matrixWorld);
        const facingCam = tmp.clone().normalize().dot(camera.position.clone().normalize());
        tmp.project(camera);
        const x = (tmp.x * 0.5 + 0.5) * canvas.clientWidth;
        const y = (-tmp.y * 0.5 + 0.5) * canvas.clientHeight;
        const on = (i === 0 ? kzIn : glow.getComponent(i)) * clamp01(facingCam * 4);
        // у правого края подпись перекидываем влево от точки, чтобы не уходила за экран
        const flip = x > canvas.clientWidth * 0.58;
        el.style.transform = `translate(${x}px, ${y}px)${flip ? " translateX(-100%) translateX(-3rem)" : ""}`;
        el.style.opacity = String(on);
      });
      if (titleRef.current) {
        titleRef.current.style.opacity = String(out);
        titleRef.current.style.transform = `translateY(${(1 - out) * 30}px)`;
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
      ref={sectionRef}
      aria-label="География"
      className={`relative h-[560svh] ${dark ? "bg-[#030506] text-white" : "bg-[#eef2f2] text-[#0b1214]"}`}
    >
      {/* у закреплённого слоя свой фон — лента проходит «за» глобусом и не просвечивает */}
      <div className={`sticky top-0 z-[6] h-svh overflow-hidden ${dark ? "bg-[#030506]" : "bg-[#eef2f2]"}`}>
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 h-full w-full" />

        <p
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-[clamp(3rem,9vw,9rem)] leading-none font-semibold tracking-[-0.05em]"
        >
          {worldV2.words.map((w, i) => (
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

        {worldV2.places.map((place, i) => (
          <div
            key={place.key}
            ref={(el) => {
              labelsRef.current[i] = el;
            }}
            className="pointer-events-none absolute top-0 left-0 opacity-0"
          >
            <div className={`ml-6 -translate-y-1/2 rounded-2xl px-5 py-3.5 backdrop-blur-md ${dark ? "bg-white/10" : "bg-white/80 shadow-lg"}`}>
              <p className={`text-[clamp(1.3rem,2vw,1.8rem)] leading-none font-semibold tracking-[-0.02em] ${i === 0 ? (dark ? "text-[#3fd3db]" : "text-[#00828a]") : dark ? "text-[#ffc974]" : "text-[#b86e00]"}`}>
                {place.name}
              </p>
              <p className={`mt-1.5 max-w-[16rem] text-[0.92rem] leading-snug ${dark ? "text-white/70" : "text-black/60"}`}>{place.note}</p>
            </div>
          </div>
        ))}

        <div ref={titleRef} className="absolute inset-x-0 bottom-[9svh] px-5 text-center opacity-0">
          <h2 className="mx-auto max-w-[56rem] text-[clamp(2rem,5vw,4.4rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
            {worldV2.title}
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
        {worldV2.places.map((p) => (
          <li key={p.key}>
            {p.name} — {p.note}
          </li>
        ))}
      </ul>
    </section>
  );
}
