'use client';

import { useEffect, useRef } from 'react';
import type * as THREE from 'three';

type Three = typeof THREE;

// The five agents, in the order they write. The Critic is amber.
const AGENTS = [
  { name: 'Strategist', sub: 'customer · competitors', pos: [-2.75, 1.25, -0.5], color: 0xd0bcff },
  { name: 'Builder', sub: 'tools · first 10 steps', pos: [-3.05, -0.55, 0.35], color: 0xd0bcff },
  { name: 'Economics', sub: 'price · burn · runway', pos: [2.8, 1.05, -0.35], color: 0xd0bcff },
  { name: 'Growth', sub: 'channels · first customers', pos: [3.0, -0.75, 0.4], color: 0xd0bcff },
  { name: 'Critic', sub: 'review · biggest risk', pos: [0.15, 2.95, -1.1], color: 0xffb869 },
] as const;

// Rows engraved on the slab: [number, section, value]. Illustrative sample plan.
const ROWS = [
  ['01', 'Customer & problem', 'clinics · Tier 1'],
  ['02', 'Competition', '3 named'],
  ['03', 'Tools & delivery stack', '6 tools'],
  ['04', 'First 10 steps', 'start today'],
  ['05', 'Monthly costs', '₹11,750'],
  ['06', 'Pricing', '₹2,499/mo'],
  ['07', 'Targets · day 90', '₹29,988 MRR'],
  ['08', 'First customers', '3 a month'],
  ['09', 'Verdict', 'approved'],
] as const;

const SANS = '"Instrument Sans", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function roundedRect(T: Three, w: number, h: number, r: number) {
  const s = new T.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// The engraving: a whole MASS plan, drawn into a texture on the slab's face.
function drawPlan(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!, w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  g.fillStyle = 'rgba(208,188,255,0.85)'; g.font = `500 22px ${MONO}`;
  g.fillText('BUILD PLAN', 44, 70);
  g.fillStyle = 'rgba(229,226,225,0.95)'; g.font = `700 40px ${SANS}`;
  g.fillText('Dental reminders', 44, 128);
  g.fillStyle = 'rgba(198,198,199,0.7)'; g.font = `400 22px ${SANS}`;
  g.fillText('India · bootstrapped · 2 review rounds', 44, 166);
  const top = 230, rowH = (h - top - 230) / ROWS.length;
  ROWS.forEach(([n, title, value], i) => {
    const y = top + i * rowH;
    g.strokeStyle = 'rgba(208,188,255,0.18)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(44, y); g.lineTo(w - 44, y); g.stroke();
    g.fillStyle = 'rgba(160,120,255,0.9)'; g.font = `500 20px ${MONO}`;
    g.fillText(n, 44, y + rowH * 0.62);
    g.fillStyle = 'rgba(229,226,225,0.92)'; g.font = `500 26px ${SANS}`;
    g.fillText(title, 100, y + rowH * 0.62);
    g.fillStyle = i === ROWS.length - 1 ? 'rgba(255,184,105,0.95)' : 'rgba(198,198,199,0.8)';
    g.font = `400 22px ${MONO}`; g.textAlign = 'right';
    g.fillText(value, w - 44, y + rowH * 0.62); g.textAlign = 'left';
  });
  const by = h - 170;
  g.strokeStyle = 'rgba(255,184,105,0.55)'; g.lineWidth = 2;
  g.strokeRect(44, by, w - 88, 110);
  g.fillStyle = 'rgba(255,184,105,0.95)'; g.font = `500 18px ${MONO}`;
  g.fillText('BIGGEST RISK', 66, by + 38);
  g.fillStyle = 'rgba(229,226,225,0.85)'; g.font = `400 22px ${SANS}`;
  g.fillText('Switching from practice software', 66, by + 78);
}

function drawLabel(c: HTMLCanvasElement, agent: (typeof AGENTS)[number]) {
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = agent.name === 'Critic' ? 'rgba(255,184,105,1)' : 'rgba(229,226,225,1)';
  g.font = `700 58px ${SANS}`;
  g.fillText(agent.name, 8, 66);
  g.fillStyle = 'rgba(198,198,199,0.9)';
  g.font = `400 30px ${MONO}`;
  g.fillText(agent.sub, 8, 112);
}

function radialTexture(T: Three, inner: string, outer: string) {
  const c = makeCanvas(256, 256), g = c.getContext('2d')!;
  const grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer);
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace;
  return t;
}

function buildScene(T: Three, canvas: HTMLCanvasElement, pointer: { current: [number, number] }) {
  const look = [0, 0];
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0x000000, 1);

  const scene = new T.Scene();
  scene.fog = new T.Fog(0x000000, 10, 24);
  const camera = new T.PerspectiveCamera(30, 1, 0.1, 100);

  // A small studio baked into an environment map, so the glass has something to reflect.
  const pmrem = new T.PMREMGenerator(renderer);
  const studio = new T.Scene();
  studio.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x030305, side: T.BackSide })));
  const panel = (color: number, strength: number, w: number, h: number, pos: [number, number, number]) => {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ color: new T.Color(color).multiplyScalar(strength), side: T.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); studio.add(m);
  };
  panel(0xffffff, 3.2, 10, 3, [0, 9, 3]);
  panel(0x8b5cf6, 4, 2, 12, [-9, 1, 2]);
  panel(0xa078ff, 2.4, 2, 10, [9, 0, -4]);
  panel(0xffb869, 2.2, 6, 1.2, [3, -6, 5]);
  const envMap = pmrem.fromScene(studio, 0.04).texture;
  scene.environment = envMap;

  scene.add(new T.AmbientLight(0x1d1530, 0.8));
  const key = new T.DirectionalLight(0xffffff, 1.4); key.position.set(3, 5, 7); scene.add(key);
  const rim = new T.DirectionalLight(0x8b5cf6, 3); rim.position.set(-5, 2, -5); scene.add(rim);
  const warm = new T.PointLight(0xffb869, 8, 9); warm.position.set(2.2, -2.4, 2.4); scene.add(warm);

  const rig = new T.Group(); scene.add(rig);

  // The monolith: beveled dark glass with lit bevels.
  const SW = 1.5, SH = 3.7, SD = 0.34;
  const slabGeo = new T.ExtrudeGeometry(roundedRect(T, SW, SH, 0.12), {
    depth: SD, bevelEnabled: true, bevelSize: 0.045, bevelThickness: 0.045, bevelSegments: 5, curveSegments: 10,
  });
  slabGeo.center();
  const glass = new T.MeshPhysicalMaterial({
    color: 0x0d0b14, metalness: 0.25, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.06,
    envMapIntensity: 1.35, sheen: 0.4, sheenColor: new T.Color(0x8b5cf6),
  });
  rig.add(new T.Mesh(slabGeo, glass));
  // Bevel facets meet at ~18°, so a 15° threshold draws the bevel rings as lit edges.
  rig.add(new T.LineSegments(new T.EdgesGeometry(slabGeo, 15), new T.LineBasicMaterial({ color: 0xa078ff, transparent: true, opacity: 0.28 })));

  // The plan, engraved on the front face.
  const planCanvas = makeCanvas(768, 1890);
  drawPlan(planCanvas);
  const planTex = new T.CanvasTexture(planCanvas);
  planTex.colorSpace = T.SRGBColorSpace;
  planTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const faceZ = SD / 2 + 0.046;
  const face = new T.Mesh(new T.PlaneGeometry(SW - 0.12, SH - 0.12), new T.MeshBasicMaterial({
    map: planTex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.9,
  }));
  face.position.z = faceZ + 0.001;
  rig.add(face);

  // The scan line that "writes" the plan: lavender for the authors, amber for the Critic's pass.
  const scanMat = new T.MeshBasicMaterial({ color: 0xa078ff, transparent: true, opacity: 0.9, blending: T.AdditiveBlending, depthWrite: false });
  const scan = new T.Mesh(new T.PlaneGeometry(SW - 0.06, 0.022), scanMat);
  scan.position.z = faceZ + 0.003; rig.add(scan);
  const haloMat = new T.MeshBasicMaterial({
    map: radialTexture(T, 'rgba(160,120,255,0.55)', 'rgba(0,0,0,0)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false,
  });
  const halo = new T.Mesh(new T.PlaneGeometry(SW + 0.5, 0.42), haloMat);
  halo.position.z = faceZ + 0.002; rig.add(halo);

  // Five agent tablets, each tethered to the slab and labelled.
  const tabletGeo = new T.ExtrudeGeometry(roundedRect(T, 0.46, 0.62, 0.07), { depth: 0.07, bevelEnabled: true, bevelSize: 0.018, bevelThickness: 0.018, bevelSegments: 3, curveSegments: 6 });
  tabletGeo.center();
  const tabletEdges = new T.EdgesGeometry(tabletGeo, 15);
  const labelCanvases: HTMLCanvasElement[] = [];
  const agents = AGENTS.map((a, i) => {
    const g = new T.Group(); g.position.set(a.pos[0], a.pos[1], a.pos[2]); rig.add(g);
    g.add(new T.Mesh(tabletGeo, glass));
    const edgeMat = new T.LineBasicMaterial({ color: a.color, transparent: true, opacity: 0.35 });
    g.add(new T.LineSegments(tabletEdges, edgeMat));
    const coreMat = new T.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false });
    const core = new T.Mesh(new T.PlaneGeometry(0.3, 0.04), coreMat); core.position.z = 0.055; g.add(core);
    const labelCanvas = makeCanvas(640, 132);
    drawLabel(labelCanvas, a);
    labelCanvases.push(labelCanvas);
    const labelTex = new T.CanvasTexture(labelCanvas); labelTex.colorSpace = T.SRGBColorSpace;
    const label = new T.Sprite(new T.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.55, depthWrite: false }));
    label.scale.set(1.75, 0.36, 1);
    const side = a.pos[0] < -0.5 ? -1 : a.pos[0] > 0.5 ? 1 : 0;
    label.center.set(side < 0 ? 1 : side > 0 ? 0 : 0.5, 0.5);
    label.position.set(side * 0.42, side === 0 ? 0.55 : 0, 0);
    g.add(label);
    const anchor = new T.Vector3(side < 0 ? -SW / 2 : side > 0 ? SW / 2 : 0, side === 0 ? SH / 2 : a.pos[1] * 0.6, 0);
    const from = new T.Vector3(a.pos[0], a.pos[1], a.pos[2]);
    const tetherMat = new T.LineBasicMaterial({ color: a.color, transparent: true, opacity: 0.18 });
    rig.add(new T.Line(new T.BufferGeometry().setFromPoints([anchor, from]), tetherMat));
    const pulse = new T.Mesh(new T.SphereGeometry(0.035, 12, 12), new T.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0 }));
    rig.add(pulse);
    return { g, edgeMat, coreMat, label, labelTex, tetherMat, pulse, from, to: anchor, phase: i * 1.3, level: 0 };
  });

  // Drifting data around the council.
  const N = 420, pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 2.2 + Math.random() * 3.2, th = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = (Math.random() - 0.5) * 5.2; pos[i * 3 + 2] = Math.sin(th) * r * 0.6 - 0.6;
  }
  const dustGeo = new T.BufferGeometry(); dustGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
  const dust = new T.Points(dustGeo, new T.PointsMaterial({ color: 0xa078ff, size: 0.022, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
  scene.add(dust);

  // Floor glow and a soft contact shadow.
  const floorY = -SH / 2 - 0.55;
  const glow = new T.Mesh(new T.PlaneGeometry(9, 9), new T.MeshBasicMaterial({ map: radialTexture(T, 'rgba(139,92,246,0.42)', 'rgba(0,0,0,0)'), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
  glow.rotation.x = -Math.PI / 2; glow.position.y = floorY; scene.add(glow);
  const shadow = new T.Mesh(new T.PlaneGeometry(2.6, 1.1), new T.MeshBasicMaterial({ map: radialTexture(T, 'rgba(0,0,0,0.85)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = floorY + 0.01; scene.add(shadow);

  // Redraw the text once the web fonts are in.
  document.fonts?.ready.then(() => {
    drawPlan(planCanvas); planTex.needsUpdate = true;
    agents.forEach((ag, i) => { drawLabel(labelCanvases[i], AGENTS[i]); ag.labelTex.needsUpdate = true; });
  });

  const render = (t: number) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const pr = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * pr) || canvas.height !== Math.round(h * pr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // Narrow screens pull the camera back so the tablets and labels stay in frame.
      camera.position.set(0, 0.35, w / h < 1.1 ? 17 : 12.5);
      camera.updateProjectionMatrix();
    }
    // Critically damped follow toward the pointer: eases in and back, never snaps.
    look[0] += (pointer.current[0] - look[0]) * 0.06;
    look[1] += (pointer.current[1] - look[1]) * 0.06;

    // Sway, never spin, so the slab can't turn edge-on.
    rig.rotation.y = -0.32 + Math.sin(t * 0.22) * 0.16 + look[0] * 0.55;
    rig.rotation.x = look[1] * 0.18;
    rig.position.y = Math.sin(t * 0.6) * 0.05;
    camera.lookAt(0, 0.1, 0);

    // One council cycle: four authors write top to bottom, then the Critic sweeps back up.
    const cycle = 11, ph = (t % cycle) / cycle;
    const top = SH / 2 - 0.62, bottom = -SH / 2 + 0.55;
    let y: number, active: number, critic = false;
    if (ph < 0.72) { const k = ph / 0.72; y = top + (bottom - top) * k; active = Math.min(3, Math.floor(k * 4)); }
    else if (ph < 0.92) { const k = (ph - 0.72) / 0.2; y = bottom + (top - bottom) * k; active = 4; critic = true; }
    else { y = top; active = -1; }
    scan.position.y = halo.position.y = y;
    scanMat.color.setHex(critic ? 0xffb869 : 0xa078ff);
    haloMat.opacity = active < 0 ? 0 : 1;
    scanMat.opacity = active < 0 ? 0 : 0.9;

    agents.forEach((ag, i) => {
      ag.level += ((i === active ? 1 : 0) - ag.level) * 0.08;
      ag.edgeMat.opacity = 0.3 + ag.level * 0.65;
      ag.coreMat.opacity = 0.2 + ag.level * 0.8;
      ag.label.material.opacity = 0.5 + ag.level * 0.5;
      ag.tetherMat.opacity = 0.14 + ag.level * 0.45;
      ag.g.position.y = AGENTS[i].pos[1] + Math.sin(t * 0.8 + ag.phase) * 0.06;
      ag.g.rotation.y = -rig.rotation.y * 0.5 + Math.sin(t * 0.5 + ag.phase) * 0.08;
      const f = (t * 0.9) % 1;
      ag.pulse.position.lerpVectors(ag.from, ag.to, f);
      (ag.pulse.material as THREE.MeshBasicMaterial).opacity = ag.level * Math.sin(f * Math.PI);
    });
    dust.rotation.y = t * 0.03;
    renderer.render(scene, camera);
  };

  const dispose = () => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
      mats.forEach((m) => { (m as THREE.MeshBasicMaterial).map?.dispose(); m.dispose(); });
    });
    envMap.dispose(); pmrem.dispose(); renderer.dispose();
  };

  return { render, dispose };
}

/** The landing hero's 3D monolith. three.js loads after first paint; the canvas is decorative. */
export default function MonolithScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointer = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false, raf = 0, visible = true;
    let scene: ReturnType<typeof buildScene> | null = null;
    let io: IntersectionObserver | null = null;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const start = performance.now();

    const loop = () => {
      cancelAnimationFrame(raf);
      const step = () => {
        if (!visible || !scene) return;
        scene.render((performance.now() - start) / 1000);
        raf = requestAnimationFrame(step);
      };
      step();
    };

    import('three').then((T) => {
      if (cancelled) return;
      try {
        scene = buildScene(T, canvas, pointer);
      } catch (err) {
        console.warn('Monolith scene unavailable', err);
        return;
      }
      if (still) { scene.render(2.2); return; }
      // Pause the loop while the hero is scrolled out of view.
      io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); });
      io.observe(canvas);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      io?.disconnect();
      scene?.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="absolute inset-0 block h-full w-full touch-pan-y"
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        pointer.current = [(e.clientX - r.left) / r.width - 0.5, (e.clientY - r.top) / r.height - 0.5];
      }}
      onPointerLeave={() => { pointer.current = [0, 0]; }}
    />
  );
}
