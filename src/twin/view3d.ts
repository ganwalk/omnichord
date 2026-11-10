// ─── The twin in 3D: the whole physical instrument, live and playable ───
// Built from the hardware generator's model.json (frame, panel, every part,
// board, connector and cable at its real size and height). The screens show
// the twin's own canvases, pads light from the twin's state, sliders and the
// encoder move with it, strings glow when plucked; pads, sliders, encoder,
// power and strumplate can be played right here.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import rawModel from '../../hardware/painel/out/model.json';
import panelTexUrl from '../../hardware/painel/out/painel-textura.png';
import type { TwinApi } from './api';

type Vec3 = [number, number, number];
interface Part { name: string; label: string; x: number; y: number; w: number; d: number; z0: number; z1: number; kind: string; on: string | null }
interface Cable { name: string; kind: string; wires: number; path: Vec3[]; colors?: string[]; length: number; radius: number; width: number }
interface Model {
  panel: { w: number; h: number; t: number; recess: number };
  frame: { t: number; h: number; base: number; inner: number };
  cap: number; padH: number; sliderCap: [number, number];
  parts: Part[]; cables: Cable[];
  keys: { x: number; y: number; color: string; type?: number; root?: number; action?: string }[];
  sliders: { setting: string; x: number; y1: number; y2: number }[];
  encoder: { x: number; y: number; r: number };
  power: { x: number; y: number; d: number };
  screens: { id: string; x: number; y: number; w: number; h: number; aw: number; ah: number }[];
  strum: { x: number; y: number; w: number; h: number; n: number; pad: number; pitch: number; gap: number };
  leds: { id: string; x: number; y: number; d: number }[];
}
const M = rawModel as unknown as Model;

type Action =
  | { kind: 'pad'; type: number; root: number }
  | { kind: 'fn'; action: string }
  | { kind: 'power' } | { kind: 'encoder' } | { kind: 'strum' }
  | { kind: 'slider'; setting: string };

export function mount3D(host: HTMLElement, api: TwinApi): { setView(name: string): void; setExplode(e: number): void } {
  const P = M.panel, F = M.frame;
  const W = P.w, H = P.h, T = F.t;
  const TOP = F.h - P.recess;              // panel top surface, above the bench
  // three.js axes: x right, y up, z towards the player. Panel y (0 = back) maps to z.
  const X = (x: number): number => x - W / 2, Z = (y: number): number => y - H / 2;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 5, 6000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.minDistance = 120;
  controls.maxDistance = 2200;

  // Lights (physical units since three r155: about π × the old values)
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a1d10, 2.4));
  const sun = new THREE.DirectionalLight(0xffffff, 2.6);
  sun.position.set(-260, 620, 420);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 50, far: 1600 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.8);
  fill.position.set(420, 200, -300);
  scene.add(fill);

  const bench = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
  bench.rotation.x = -Math.PI / 2;
  bench.position.y = -4;
  bench.receiveShadow = true;
  scene.add(bench);

  // ── Materials ──
  function woodTexture(light: string, dark: string, along: boolean): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = light; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 70; i++) {
      const y = Math.random() * 128;
      g.strokeStyle = dark; g.globalAlpha = 0.05 + Math.random() * 0.12; g.lineWidth = 0.6 + Math.random() * 2.2;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin((x + i * 37) / 70) * 3 + (Math.random() - 0.5) * 1.5);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (!along) t.rotation = Math.PI / 2;
    return t;
  }
  const std = (color: THREE.ColorRepresentation, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
  const mat = {
    wood: new THREE.MeshStandardMaterial({ map: woodTexture('#c39158', '#5e3a17', true), roughness: 0.62 }),
    woodSide: new THREE.MeshStandardMaterial({ map: woodTexture('#c39158', '#5e3a17', false), roughness: 0.62 }),
    ply: new THREE.MeshStandardMaterial({ map: woodTexture('#d8b98c', '#8a6a40', true), roughness: 0.8 }),
    cleat: std(0xc8a06e, { roughness: 0.8 }),
    panelEdge: std(0x0d0d0d, { roughness: 0.5 }),
    metal: std(0x8a8a8a, { metalness: 0.85, roughness: 0.3 }),
    darkMetal: std(0x2a2a2a, { metalness: 0.6, roughness: 0.4 }),
    knob: new THREE.MeshStandardMaterial({ map: woodTexture('#c9995e', '#6b4520', true), roughness: 0.5 }),
    rubber: std(0x151515, { roughness: 0.95 }),
    pcb: std(0x1f5d3a, { roughness: 0.7 }),
    elec: std(0x5f9cc9, { transparent: true, opacity: 0.85 }),
    conn: std(0x2b2b2b, { roughness: 0.5 }),
    jack: std(0xe0a463),
    underPcb: std(0x1f5d3a, { roughness: 0.7, transparent: true }),
    underElec: std(0x5f9cc9, { transparent: true, opacity: 0.85 }),
    underConn: std(0x2b2b2b, { roughness: 0.5, transparent: true }),
  };

  const pickables: THREE.Object3D[] = [];
  const named = <O extends THREE.Object3D>(o: O, name: string, action?: Action): O => {
    o.userData.name = name;
    if (action) o.userData.action = action;
    pickables.push(o);
    return o;
  };
  const shadowed = <O extends THREE.Mesh>(m: O): O => { m.castShadow = true; m.receiveShadow = true; return m; };

  /** Box by its extents in panel coordinates (x0..x1, y0..y1) and height (z0..z1). */
  function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), m);
    mesh.position.set(X((x0 + x1) / 2), (z0 + z1) / 2, Z((y0 + y1) / 2));
    return shadowed(mesh);
  }

  // Groups that move apart in the exploded view
  const G = {
    back: new THREE.Group(), front: new THREE.Group(), left: new THREE.Group(), right: new THREE.Group(),
    base: new THREE.Group(), inside: new THREE.Group(), under: new THREE.Group(), panel: new THREE.Group(),
  };
  Object.values(G).forEach(g => scene.add(g));

  // ── Wood frame ──
  G.back.add(named(box(-T, W + T, -T, 0, 0, F.h, mat.wood), `Parede de trás (madeira ${T} mm)`));
  G.front.add(named(box(-T, W + T, H, H + T, 0, F.h, mat.wood), `Parede da frente (madeira ${T} mm)`));
  G.left.add(named(box(-T, 0, 0, H, 0, F.h, mat.woodSide), `Lateral esquerda (madeira ${T} mm)`));
  G.right.add(named(box(W, W + T, 0, H, 0, F.h, mat.woodSide), `Lateral direita (madeira ${T} mm)`));
  G.base.add(named(box(0, W, 0, H, 0, F.base, mat.ply), `Base de compensado (${F.base} mm)`));
  for (const [x, y] of [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]]) {
    const foot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 4, 24), mat.rubber));
    foot.position.set(X(x), -2, Z(y));
    G.base.add(named(foot, 'Pé de borracha'));
  }

  // ── Inside: cleats, rail, boards, connectors ──
  const hangs = (p: Part): boolean => p.z1 >= F.inner - 0.01 || p.z0 >= 14;
  for (const p of M.parts) {
    const z0 = F.base + p.z0, z1 = F.base + p.z1;
    if (p.kind === 'wood') {
      const g = p.name === 'Cleat, back' ? G.back : p.name === 'Cleat, front' ? G.front
        : p.name === 'Cleat, left' ? G.left : p.name === 'Cleat, right' ? G.right : G.inside;
      g.add(named(box(p.x, p.x + p.w, p.y, p.y + p.d, z0, z1, mat.cleat), p.label));
    } else if (p.kind === 'jack') {
      G.back.add(named(box(p.x, p.x + p.w, p.y, p.y + p.d, z0, z1, mat.jack), p.label));
      const cx = X(p.x + p.w / 2), cz = (z0 + z1) / 2;
      if (p.name === 'USB-C') {
        const shell = shadowed(new THREE.Mesh(new THREE.BoxGeometry(12, 6.5, 3), mat.metal));
        shell.position.set(cx, cz, Z(-T - 1.5));
        const slot = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 3.2), mat.rubber);
        slot.position.copy(shell.position);
        G.back.add(named(shell, p.label), slot);
        continue;
      }
      const r = p.w >= 20 ? 9 : 5.5;
      const ring = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 28), p.name.startsWith('MIDI') ? mat.darkMetal : mat.metal));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(cx, cz, Z(-T - 1.5));
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 3.2, 20), mat.rubber);
      hole.rotation.x = Math.PI / 2;
      hole.position.copy(ring.position);
      G.back.add(named(ring, p.label), hole);
    } else {
      const up = hangs(p);
      const m = p.kind === 'board' ? (up ? mat.underPcb : mat.pcb) : p.kind === 'conn' ? (up ? mat.underConn : mat.conn) : (up ? mat.underElec : mat.elec);
      const g = p.on === 'I/O board' || p.name === 'I/O board' ? G.back : up ? G.under : G.inside;
      g.add(named(box(p.x, p.x + p.w, p.y, p.y + p.d, z0, z1, m), p.label));
    }
  }

  // Labels under the rear connectors
  {
    const scale = 6, c = document.createElement('canvas');
    c.width = Math.round((W + 2 * T) * scale); c.height = Math.round(F.h * scale);
    const g = c.getContext('2d')!;
    g.fillStyle = '#f3e6cf';
    g.font = `bold ${3.2 * scale}px Inter, system-ui, sans-serif`;
    g.textAlign = 'center';
    for (const p of M.parts.filter(q => q.kind === 'jack')) {
      // The label plane faces backwards, so its canvas runs right to left in panel x.
      const cx = (W + T - (p.x + p.w / 2)) * scale;
      const cy = (F.h - (F.base + (p.z0 + p.z1) / 2)) * scale;
      g.fillText(p.name, cx, cy + (p.w >= 20 ? 14 : 10) * scale);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * T, F.h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    plane.rotation.y = Math.PI;
    plane.position.set(0, F.h / 2, Z(-T - 0.3));
    G.back.add(plane);
  }

  // ── Cables ──
  const cablesG = new THREE.Group();
  scene.add(cablesG);
  const V = ([x, y, z]: Vec3): THREE.Vector3 => new THREE.Vector3(X(x), F.base + z, Z(y));
  const ribbonMat = std('#9a9a9a', { side: THREE.DoubleSide });
  const stripeMat = std('#b0302a', { side: THREE.DoubleSide });
  const wireMats = new Map<string, THREE.MeshStandardMaterial>();
  const wireMat = (c: string): THREE.MeshStandardMaterial => {
    if (!wireMats.has(c)) wireMats.set(c, std(c, { roughness: 0.45 }));
    return wireMats.get(c)!;
  };
  for (const c of M.cables) {
    const name = `${c.name} · ${c.length} mm`;
    if (c.kind === 'ribbon') {
      for (let i = 1; i < c.path.length; i++) {
        const a = V(c.path[i - 1]), b = V(c.path[i]);
        const dir = b.clone().sub(a), len = dir.length();
        if (len < 0.01) continue;
        dir.normalize();
        const side = Math.abs(dir.y) > 0.7 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(dir).normalize();
        const normal = new THREE.Vector3().crossVectors(dir, side).normalize();
        const q = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, normal, dir));
        const strip = shadowed(new THREE.Mesh(new THREE.BoxGeometry(c.width, 0.9, len + 0.9), ribbonMat));
        strip.quaternion.copy(q);
        strip.position.copy(a).add(b).multiplyScalar(0.5);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, len + 0.9), stripeMat);
        stripe.quaternion.copy(q);
        stripe.position.copy(strip.position).add(side.clone().multiplyScalar(-c.width / 2 + 0.7));
        cablesG.add(named(strip, name), stripe);
      }
    } else {
      const curve = new THREE.CatmullRomCurve3(c.path.map(V), false, 'catmullrom', 0.1);
      const segs = Math.max(24, Math.round(curve.getLength() / 3));
      if (c.kind === 'usb') {
        cablesG.add(named(shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, c.radius, 10, false), wireMat('#151515'))), name));
      } else {
        const colors = c.colors ?? ['#444'];
        const frames = curve.computeFrenetFrames(segs, false);
        colors.forEach((col, k) => {
          const ang = (k / colors.length) * Math.PI * 2, rr = colors.length > 1 ? 0.8 : 0;
          const pts: THREE.Vector3[] = [];
          for (let i = 0; i <= segs; i++) {
            const t = i / segs, p = curve.getPointAt(t), tw = ang + t * 6;
            p.add(frames.normals[i].clone().multiplyScalar(Math.cos(tw) * rr)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(tw) * rr));
            pts.push(p);
          }
          cablesG.add(named(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), segs, 0.65, 6, false), wireMat(col)), name));
        });
      }
    }
  }

  // ── Panel: printed top ──
  const panelTex = new THREE.TextureLoader().load(panelTexUrl);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  panelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const top = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.55 });
  const panel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, P.t, H),
    [mat.panelEdge, mat.panelEdge, top, mat.panelEdge, mat.panelEdge, mat.panelEdge]));
  panel.position.set(0, TOP - P.t / 2, 0);
  G.panel.add(named(panel, `Painel (placa de circuito preta, ${W.toFixed(0)} × ${H.toFixed(0)} mm)`));

  // ── Live screens: the twin's own canvases ──
  const screenTex: THREE.CanvasTexture[] = [];
  for (const s of M.screens) {
    const canvas = api.screens.get(s.id);
    if (!canvas) continue;
    const t = new THREE.CanvasTexture(canvas);
    t.colorSpace = THREE.SRGBColorSpace;
    screenTex.push(t);
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(s.aw, s.ah), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(X(s.x + s.w / 2), TOP + 0.06, Z(s.y + s.h / 2));
    G.panel.add(named(plane, s.id === 'robot' ? 'Tela 2,4" SYS MONITOR' : 'Tela 2,4" CHORD DISPLAY'));
  }

  // ── Strings: gold strips that light up when plucked ──
  const st = M.strum;
  const stringMeshes: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  const stringGeo = new THREE.PlaneGeometry(st.w - 10, st.pitch - st.gap);
  for (let i = 0; i < st.n; i++) {
    const m = std('#c9a443', { metalness: 0.7, roughness: 0.35, emissive: new THREE.Color('#fff3b8'), emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(stringGeo, m);
    mesh.rotation.x = -Math.PI / 2;
    stringMeshes.push({ mesh, mat: m });
    G.panel.add(mesh);
  }
  const placeStrings = (lowAtBottom: boolean): void => {
    stringMeshes.forEach(({ mesh }, i) => {
      const fromTop = lowAtBottom ? st.n - 1 - i : i;
      mesh.position.set(X(st.x + st.w / 2), TOP + 0.05, Z(st.y + st.pad + (fromTop + 0.5) * st.pitch));
    });
  };
  let lowAtBottom = api.lowAtBottom;
  placeStrings(lowAtBottom);
  const strumHit = new THREE.Mesh(new THREE.PlaneGeometry(st.w, st.h), new THREE.MeshBasicMaterial({ visible: false }));
  strumHit.rotation.x = -Math.PI / 2;
  strumHit.position.set(X(st.x + st.w / 2), TOP + 0.2, Z(st.y + st.h / 2));
  G.panel.add(named(strumHit, 'Strumplate (arraste para dedilhar)', { kind: 'strum' }));

  // ── Silicone pads, lit by their LED ──
  function padGeometry(size: number, h: number, r: number): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape(), s = size / 2;
    shape.moveTo(-s + r, -s);
    shape.lineTo(s - r, -s); shape.quadraticCurveTo(s, -s, s, -s + r);
    shape.lineTo(s, s - r); shape.quadraticCurveTo(s, s, s - r, s);
    shape.lineTo(-s + r, s); shape.quadraticCurveTo(-s, s, -s, s - r);
    shape.lineTo(-s, -s + r); shape.quadraticCurveTo(-s, -s, -s + r, -s);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: h - 0.8, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 3, curveSegments: 6 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0.8, 0);
    return geo;
  }
  const padGeo = padGeometry(M.cap - 1.6, M.padH, 2.2);
  const pads: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; base: THREE.Color; type?: number; root?: number; pressedAt: number }[] = [];
  const white = new THREE.Color(1, 1, 1);
  for (const k of M.keys) {
    const base = new THREE.Color(k.color);
    const m = std(base.clone(), { emissive: base.clone(), emissiveIntensity: 0.18, roughness: 0.85 });
    const mesh = shadowed(new THREE.Mesh(padGeo, m));
    mesh.position.set(X(k.x), TOP, Z(k.y));
    const action: Action = k.action ? { kind: 'fn', action: k.action } : { kind: 'pad', type: k.type!, root: k.root! };
    G.panel.add(named(mesh, k.action ? `Pad de função: ${k.action}` : 'Pad de acorde (silicone, LED RGB embaixo)', action));
    pads.push({ mesh, mat: m, base, type: k.type, root: k.root, pressedAt: -Infinity });
  }

  // ── Sliders, encoder, power button, status LEDs ──
  const [cw, ch] = M.sliderCap;
  const knobGeo = new THREE.BoxGeometry(cw, 8, ch);
  const sliders = M.sliders.map(s => {
    const knob = shadowed(new THREE.Mesh(knobGeo, mat.knob));
    G.panel.add(named(knob, `Slider ${s.setting}`, { kind: 'slider', setting: s.setting }));
    return { s, knob };
  });
  const enc = new THREE.Group();
  enc.position.set(X(M.encoder.x), TOP, Z(M.encoder.y));
  const encBody = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(M.encoder.r - 1.5, M.encoder.r, 16, 48), mat.knob));
  encBody.position.y = 8;
  const encMark = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 6), mat.rubber);
  encMark.position.set(0, 16.3, -M.encoder.r + 5);
  enc.add(named(encBody, 'Encoder MENU (gire com a roda do mouse, clique para apertar)', { kind: 'encoder' }), encMark);
  G.panel.add(enc);
  const pw = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(M.power.d / 2, M.power.d / 2, 3, 40), mat.metal));
  pw.position.set(X(M.power.x), TOP + 1.5, Z(M.power.y));
  G.panel.add(named(pw, 'Botão liga/desliga', { kind: 'power' }));
  const ledColor: Record<string, string> = { power: '#00e060', beat: '#00e060', play: '#ff3b30', arp: '#ff3b30' };
  const leds = M.leds.map(l => {
    const m = new THREE.MeshStandardMaterial({ color: 0x1a0606, emissive: new THREE.Color(ledColor[l.id] ?? '#ff3b30'), emissiveIntensity: 0 });
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(l.d / 2, l.d / 2, 0.8, 16), m);
    mesh.position.set(X(l.x), TOP + 0.4, Z(l.y));
    G.panel.add(mesh);
    return { id: l.id, m };
  });

  // ── Views and exploded view ──
  let explode = 0, insideMode = false;
  function layout(): void {
    const e = explode;
    G.panel.position.y = 110 * e;
    G.under.position.y = 55 * e;
    G.base.position.y = -40 * e;
    G.back.position.z = -70 * e;
    G.front.position.z = 70 * e;
    G.left.position.x = -70 * e;
    G.right.position.x = 70 * e;
    G.panel.visible = !insideMode;
    mat.underPcb.opacity = insideMode ? 0.28 : 1;
    mat.underElec.opacity = insideMode ? 0.28 : 0.85;
    mat.underConn.opacity = insideMode ? 0.28 : 1;
    mat.underPcb.depthWrite = mat.underElec.depthWrite = mat.underConn.depthWrite = !insideMode;
    // Cables join parts that fly apart in the exploded view, so they show only when assembled.
    cablesG.visible = e < 0.02;
  }
  const VIEWS: Record<string, [Vec3, number]> = {
    play: [[0, 420, 300], 10],
    front: [[0, 330, 560], 10],
    top: [[0, 760, 1], 0],
    back: [[-120, 170, -560], 20],
    inside: [[0, 600, 300], 0],
  };
  let anim: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; start: number; ms: number } | null = null;
  function setView(name: string): void {
    const v = VIEWS[name] ?? VIEWS.front;
    insideMode = name === 'inside';
    layout();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    anim = {
      from: camera.position.clone(), to: new THREE.Vector3(...v[0]),
      fromT: controls.target.clone(), toT: new THREE.Vector3(0, v[1], 0), start: performance.now(), ms: reduce ? 0 : 700,
    };
  }
  camera.position.set(...VIEWS.play[0]);
  controls.target.set(0, VIEWS.play[1], 0);

  // ── Playing in 3D: pointer on a control plays it; anywhere else orbits ──
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const tip = host.querySelector<HTMLElement>('.tip3d');
  const topPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TOP);
  const pickAt = (e: PointerEvent): THREE.Intersection | undefined => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(pickables.filter(o => o.visible && o.parent?.visible), false)[0];
  };
  /** Panel millimetres under the pointer, on the panel's top surface. */
  const panelMm = (e: PointerEvent): { x: number; y: number } | null => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    topPlane.constant = -(TOP + G.panel.position.y);
    const p = ray.ray.intersectPlane(topPlane, new THREE.Vector3());
    return p ? { x: p.x + W / 2, y: p.z + H / 2 } : null;
  };

  const active = new Map<number, Action & { startY?: number; acc?: number; moved?: boolean }>();
  const el = renderer.domElement;
  el.addEventListener('pointerdown', e => {
    const hit = pickAt(e);
    const action = hit?.object.userData.action as Action | undefined;
    if (!action || insideMode) return;               // let OrbitControls rotate the view
    e.stopImmediatePropagation();
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    active.set(e.pointerId, { ...action, startY: e.clientY, acc: 0, moved: false });
    if (action.kind === 'pad') {
      api.pressPad(action.type, action.root);
      const pad = pads.find(p => p.type === action.type && p.root === action.root);
      if (pad) pad.pressedAt = performance.now();
    } else if (action.kind === 'fn') {
      api.fnPad(action.action, true);
      const k = M.keys.findIndex(q => q.action === action.action);
      if (k >= 0) pads[k].pressedAt = performance.now();
    } else if (action.kind === 'power') {
      api.togglePower();
    } else if (action.kind === 'strum') {
      const p = panelMm(e);
      if (p) api.strumDown(e.pointerId, p.y, e.timeStamp);
    } else if (action.kind === 'slider') {
      dragSlider(action.setting, e);
    }
  }, { capture: true });
  const dragSlider = (setting: string, e: PointerEvent): void => {
    const s = M.sliders.find(q => q.setting === setting)!;
    const p = panelMm(e);
    if (p) api.setSlider(setting, (s.y2 - p.y) / (s.y2 - s.y1));
  };
  el.addEventListener('pointermove', e => {
    const a = active.get(e.pointerId);
    if (!a) { hover(e); return; }
    if (a.kind === 'strum') { const p = panelMm(e); if (p) api.strumMove(e.pointerId, p.y, e.timeStamp); }
    else if (a.kind === 'slider') dragSlider(a.setting, e);
    else if (a.kind === 'encoder') {
      const d = a.startY! - e.clientY - a.acc!;
      if (Math.abs(d) >= 14) { api.encoderTurn(d > 0 ? 1 : -1); a.acc! += Math.sign(d) * 14; a.moved = true; }
    }
  });
  const release = (e: PointerEvent): void => {
    const a = active.get(e.pointerId);
    if (!a) return;
    active.delete(e.pointerId);
    if (a.kind === 'fn') api.fnPad(a.action, false);
    else if (a.kind === 'strum') api.strumUp(e.pointerId);
    else if (a.kind === 'encoder' && !a.moved) api.encoderPush();
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('wheel', e => {
    const a = pickAt(e as unknown as PointerEvent)?.object.userData.action as Action | undefined;
    if (a?.kind !== 'encoder') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    api.encoderTurn(e.deltaY < 0 ? 1 : -1);
  }, { capture: true, passive: false });

  function hover(e: PointerEvent): void {
    if (!tip) return;
    const hit = e.pointerType === 'mouse' ? pickAt(e) : undefined;
    el.style.cursor = hit?.object.userData.action ? 'pointer' : 'grab';
    if (!hit) { tip.hidden = true; return; }
    const r = host.getBoundingClientRect();
    tip.hidden = false;
    tip.textContent = hit.object.userData.name as string;
    tip.style.left = `${e.clientX - r.left}px`;
    tip.style.top = `${e.clientY - r.top}px`;
  }
  el.addEventListener('pointerleave', () => { if (tip) tip.hidden = true; });

  // ── Every frame: follow the twin ──
  function sync(now: number): void {
    for (const t of screenTex) t.needsUpdate = true;
    for (const p of pads) {
      const level = p.type === undefined ? 0 : api.padLevel(p.type, p.root!);
      p.mat.emissiveIntensity = !api.powered ? 0.05 : level === 2 ? 1.2 : level === 1 ? 0.55 : 0.2;
      p.mat.color.copy(p.base).lerp(white, level === 2 ? 0.35 : 0);
      const pressed = now - p.pressedAt < 140;
      p.mesh.position.y = TOP - (pressed ? 1.2 : 0);
    }
    for (const { s, knob } of sliders) {
      const y = s.y2 - api.sliderPos(s.setting) * (s.y2 - s.y1);
      knob.position.set(X(s.x), TOP + 7, Z(y));
    }
    enc.rotation.y = -THREE.MathUtils.degToRad(api.encoderAngle);
    for (const l of leds) l.m.emissiveIntensity = api.led(l.id) ? 3 : 0;
    if (api.lowAtBottom !== lowAtBottom) { lowAtBottom = api.lowAtBottom; placeStrings(lowAtBottom); }
    stringMeshes.forEach(({ mat: m }, i) => {
      const age = (now - api.pluckedAt(i)) / 450;
      m.emissiveIntensity = age < 1 ? 1.4 * (1 - age) : 0;
    });
  }

  function resize(): void {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();
  layout();

  renderer.setAnimationLoop(() => {
    const now = performance.now();
    if (anim) {
      const t = anim.ms ? Math.min(1, (now - anim.start) / anim.ms) : 1;
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(anim.from, anim.to, k);
      controls.target.lerpVectors(anim.fromT, anim.toT, k);
      if (t >= 1) anim = null;
    }
    // Pause the work while the 3D view is hidden
    if (host.offsetParent === null) return;
    sync(now);
    controls.update();
    renderer.render(scene, camera);
  });

  return { setView, setExplode: e => { explode = e; layout(); } };
}
