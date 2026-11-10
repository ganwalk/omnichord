#!/usr/bin/env node
// ─── OmniHarp hardware: interactive 3D viewer ───
//
// Builds hardware/3d/out/omniharp-3d.html from the panel generator's
// model.json and panel texture: the wood frame, the base, the panel with its
// print, keys, sliders and knobs on top, and every part inside, at their real
// sizes and heights. One self-contained page (three.js from a CDN).
//
// Usage: node hardware/painel/gerar.cjs && node hardware/3d/gerar-3d.cjs

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'painel', 'out');
const OUT = path.join(__dirname, 'out');

const model = JSON.parse(fs.readFileSync(path.join(SRC, 'model.json'), 'utf8'));
const texture = 'data:image/png;base64,' + fs.readFileSync(path.join(SRC, 'painel-textura.png')).toString('base64');

const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>OmniHarp 3D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* One dark workshop scene: the instrument on a lit bench, controls along the bottom. */
  :root {
    color-scheme: dark;
    --bg: #15100b;
    --bg-2: #2a1f13;
    --ink: #efe3cf;
    --ink-dim: #b3a183;
    --chip: #2b2118;
    --chip-on: #c99a5b;
    --chip-on-ink: #1b1209;
    --font: 'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;
    --font-head: 'Space Grotesk', 'Inter', system-ui, sans-serif;
  }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    background: radial-gradient(ellipse at 50% 30%, var(--bg-2) 0%, var(--bg) 70%);
    background-color: var(--bg);
    color: var(--ink);
    font: 14px/1.45 var(--font);
    display: flex;
    flex-direction: column;
    padding-block: 10px 12px;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
    overflow: hidden;
  }
  header { display: flex; flex-wrap: wrap; gap: 4px 16px; align-items: baseline; justify-content: space-between; }
  h1 { font: 700 1rem/1.2 var(--font-head); letter-spacing: .14em; margin: 0; }
  header p { margin: 0; color: var(--ink-dim); font-size: .8125rem; font-variant-numeric: tabular-nums; }
  #view { flex: 1; min-height: 0; position: relative; margin-top: 8px; border-radius: 10px; overflow: hidden; touch-action: none; }
  #view canvas { display: block; width: 100%; height: 100%; }
  .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-items: center; }
  .bar button {
    font: 600 .8125rem var(--font); color: var(--ink); background: var(--chip);
    border: 1px solid #4a3a28; border-radius: 999px; padding: 7px 14px; cursor: pointer;
  }
  .bar button[aria-pressed="true"] { background: var(--chip-on); color: var(--chip-on-ink); border-color: var(--chip-on); }
  .bar button:focus-visible { outline: 2px solid var(--chip-on); outline-offset: 2px; }
  .bar label { display: flex; align-items: center; gap: 8px; color: var(--ink-dim); font-size: .8125rem; }
  .bar input[type=range] { width: 140px; accent-color: var(--chip-on); }
  #tip {
    position: absolute; pointer-events: none; padding: 4px 8px; border-radius: 6px;
    background: rgba(20, 14, 8, .9); color: var(--ink); font-size: .75rem; white-space: nowrap; transform: translate(10px, 10px);
  }
  .hint { color: var(--ink-dim); font-size: .75rem; margin-left: auto; }
  @media (max-width: 600px) { .hint { display: none; } }
</style>
</head>
<body>
<header>
  <h1>OMNIHARP · 3D</h1>
  <p id="dims"></p>
</header>
<div id="view"><div id="tip" hidden></div></div>
<div class="bar" role="toolbar" aria-label="Vista">
  <button type="button" id="btnFront" aria-pressed="false">Frente</button>
  <button type="button" id="btnTop" aria-pressed="false">De cima</button>
  <button type="button" id="btnBack" aria-pressed="false">Traseira</button>
  <button type="button" id="btnInside" aria-pressed="false">Por dentro</button>
  <label for="explode">Explodir <input type="range" id="explode" min="0" max="100" value="0"></label>
  <span class="hint">Arraste para girar · rolagem ou pinça para zoom · passe o mouse nas peças</span>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
<script>
const M = ${JSON.stringify(model)};
const TEXTURE = '${texture}';
${viewerScript()}
</script>
</body>
</html>
`;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'omniharp-3d.html'), html);
console.log(`3D viewer: ${path.relative(process.cwd(), path.join(OUT, 'omniharp-3d.html'))} (${(html.length / 1024).toFixed(0)} kB)`);

function viewerScript() {
  return String.raw`
(function () {
  const P = M.panel, F = M.frame;
  const W = P.w, H = P.h, T = F.t;
  const TOP = F.h - P.recess;                 // panel top surface, above the bench
  const UNDER = F.base + F.inner;             // panel underside

  document.getElementById('dims').textContent =
    'Por fora ' + (W + 2 * T).toFixed(0) + ' × ' + (H + 2 * T).toFixed(0) + ' × ' + F.h + ' mm · madeira de ' + T + ' mm · painel ' + W.toFixed(0) + ' × ' + H.toFixed(0) + ' mm';

  // three.js axes: x right, y up, z toward the player. Panel y (0 = back) maps to z.
  const X = x => x - W / 2, Z = y => y - H / 2;

  const view = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  view.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 5, 6000);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.62;
  controls.minDistance = 150;
  controls.maxDistance = 2200;

  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x2a1d10, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(-260, 620, 420);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -420, right: 420, top: 420, bottom: -420, near: 50, far: 1600 });
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xffd9a8, 0.25);
  fill.position.set(420, 200, -300);
  scene.add(fill);

  // Bench
  const bench = new THREE.Mesh(new THREE.CircleGeometry(900, 64), new THREE.ShadowMaterial({ opacity: 0.35 }));
  bench.rotation.x = -Math.PI / 2;
  bench.position.y = -4;
  bench.receiveShadow = true;
  scene.add(bench);

  // ── Materials ──
  function woodTexture(light, dark, along) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = light; g.fillRect(0, 0, 512, 128);
    for (let i = 0; i < 70; i++) {
      const y = Math.random() * 128, a = 0.05 + Math.random() * 0.12;
      g.strokeStyle = dark; g.globalAlpha = a; g.lineWidth = 0.6 + Math.random() * 2.2;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= 512; x += 32) g.lineTo(x, y + Math.sin((x + i * 37) / 70) * 3 + (Math.random() - 0.5) * 1.5);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    if (!along) t.rotation = Math.PI / 2;
    return t;
  }
  const mat = {
    wood: new THREE.MeshStandardMaterial({ map: woodTexture('#c39158', '#5e3a17', true), roughness: 0.62 }),
    woodSide: new THREE.MeshStandardMaterial({ map: woodTexture('#c39158', '#5e3a17', false), roughness: 0.62 }),
    ply: new THREE.MeshStandardMaterial({ map: woodTexture('#d8b98c', '#8a6a40', true), roughness: 0.8 }),
    cleat: new THREE.MeshStandardMaterial({ color: 0xc8a06e, roughness: 0.8 }),
    panelEdge: new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.5 }),
    switch: new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.85, roughness: 0.3 }),
    darkMetal: new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 }),
    knob: new THREE.MeshStandardMaterial({ map: woodTexture('#c9995e', '#6b4520', true), roughness: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 }),
    pcb: new THREE.MeshStandardMaterial({ color: 0x1f5d3a, roughness: 0.7 }),
    elec: new THREE.MeshStandardMaterial({ color: 0x5f9cc9, roughness: 0.6, transparent: true, opacity: 0.85 }),
    jack: new THREE.MeshStandardMaterial({ color: 0xe0a463, roughness: 0.6 }),
    conn: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5 }),
    underPcb: new THREE.MeshStandardMaterial({ color: 0x1f5d3a, roughness: 0.7, transparent: true }),
    underElec: new THREE.MeshStandardMaterial({ color: 0x5f9cc9, roughness: 0.6, transparent: true, opacity: 0.85 }),
    underConn: new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.5, transparent: true }),
    silicone: new THREE.MeshPhysicalMaterial({ color: 0xf2efe8, roughness: 0.75, transmission: 0.0, transparent: true, opacity: 0.94 }),
  };
  // Colours are written in sRGB; the renderer works in linear light.
  for (const m of Object.values(mat)) if (!m.map && m.color) m.color.convertSRGBToLinear();

  // Hover names
  const pickables = [];
  function named(mesh, name) { mesh.userData.name = name; pickables.push(mesh); return mesh; }
  function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }

  /** Box by its extents in panel coordinates (x0..x1, y0..y1) and height (z0..z1). */
  function box(x0, x1, y0, y1, z0, z1, material) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, z1 - z0, y1 - y0), material);
    m.position.set(X((x0 + x1) / 2), (z0 + z1) / 2, Z((y0 + y1) / 2));
    return shadowed(m);
  }

  // Groups move apart in the exploded view
  const G = {
    back: new THREE.Group(), front: new THREE.Group(), left: new THREE.Group(), right: new THREE.Group(),
    base: new THREE.Group(), inside: new THREE.Group(), under: new THREE.Group(), panel: new THREE.Group(),
  };
  Object.values(G).forEach(g => scene.add(g));

  // ── Wood frame: back and front run the full width, the sides fit between them ──
  G.back.add(named(box(-T, W + T, -T, 0, 0, F.h, mat.wood), 'Parede de trás (madeira ' + T + ' mm)'));
  G.front.add(named(box(-T, W + T, H, H + T, 0, F.h, mat.wood), 'Parede da frente (madeira ' + T + ' mm)'));
  G.left.add(named(box(-T, 0, 0, H, 0, F.h, mat.woodSide), 'Lateral esquerda (madeira ' + T + ' mm)'));
  G.right.add(named(box(W, W + T, 0, H, 0, F.h, mat.woodSide), 'Lateral direita (madeira ' + T + ' mm)'));
  G.base.add(named(box(0, W, 0, H, 0, F.base, mat.ply), 'Base de compensado (' + F.base + ' mm)'));
  for (const [x, y] of [[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]]) {
    const foot = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 4, 24), mat.rubber));
    foot.position.set(X(x), -2, Z(y));
    G.base.add(named(foot, 'Pé de borracha'));
  }

  // ── Inside: cleats, rail, boards, connectors, cables (heights are above the base) ──
  // A part hangs from the panel (and lifts with it in the exploded view) when it
  // touches the panel or sits high in the box.
  const hangs = p => p.z1 >= F.inner - 0.01 || p.z0 >= 14;
  for (const p of M.parts) {
    const z0 = F.base + p.z0, z1 = F.base + p.z1;
    if (p.kind === 'wood') {
      (p.name === 'Cleat, back' ? G.back : p.name === 'Cleat, front' ? G.front : p.name === 'Cleat, left' ? G.left : p.name === 'Cleat, right' ? G.right : G.inside)
        .add(named(box(p.x, p.x + p.w, p.y, p.y + p.d, z0, z1, mat.cleat), p.label));
    } else if (p.kind === 'jack') {
      G.back.add(named(box(p.x, p.x + p.w, p.y, p.y + p.d, z0, z1, mat.jack), p.label));
      // What shows outside the back wall
      if (p.name === 'USB-C') {
        const shell = shadowed(new THREE.Mesh(new THREE.BoxGeometry(12, 6.5, 3), mat.metal));
        shell.position.set(X(p.x + p.w / 2), (z0 + z1) / 2, Z(-T - 1.5));
        const slot = new THREE.Mesh(new THREE.BoxGeometry(9, 3.2, 3.2), mat.rubber);
        slot.position.copy(shell.position);
        G.back.add(named(shell, p.label), slot);
        continue;
      }
      const r = p.w >= 20 ? 9 : 5.5;
      const ring = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3, 28), p.name.startsWith('MIDI') ? mat.darkMetal : mat.metal));
      ring.rotation.x = Math.PI / 2;
      ring.position.set(X(p.x + p.w / 2), (z0 + z1) / 2, Z(-T - 1.5));
      G.back.add(named(ring, p.label));
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 3.2, 20), mat.rubber);
      hole.rotation.x = Math.PI / 2;
      hole.position.copy(ring.position);
      G.back.add(hole);
    } else {
      const up = hangs(p);
      const material = p.kind === 'board' ? (up ? mat.underPcb : mat.pcb) : p.kind === 'conn' ? (up ? mat.underConn : mat.conn) : (up ? mat.underElec : mat.elec);
      const target = p.on === 'I/O board' || p.name === 'I/O board' ? G.back : up ? G.under : G.inside;
      target.add(named(box(p.x, p.x + p.w, p.y, p.y + p.d, z0, z1, material), p.label));
    }
  }

  // Cables: flat ribbons as grey strips, wire bundles as twisted coloured tubes, USB as a black cable
  const cablesG = new THREE.Group();
  scene.add(cablesG);
  const V = ([x, y, z]) => new THREE.Vector3(X(x), F.base + z, Z(y));
  const ribbonMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9a9a9a').convertSRGBToLinear(), roughness: 0.6, side: THREE.DoubleSide });
  const stripeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b0302a').convertSRGBToLinear(), roughness: 0.6, side: THREE.DoubleSide });
  const wireMats = new Map();
  const wireMat = c => {
    if (!wireMats.has(c)) wireMats.set(c, new THREE.MeshStandardMaterial({ color: new THREE.Color(c).convertSRGBToLinear(), roughness: 0.45 }));
    return wireMats.get(c);
  };
  for (const c of M.cables) {
    const name = c.name + ' · ' + c.length + ' mm';
    if (c.kind === 'ribbon') {
      // One flat box per straight run; the width lies flat, or across x on vertical runs.
      for (let i = 1; i < c.path.length; i++) {
        const a = V(c.path[i - 1]), b = V(c.path[i]);
        const dir = b.clone().sub(a), len = dir.length();
        if (len < 0.01) continue;
        dir.normalize();
        const vertical = Math.abs(dir.y) > 0.7;
        const side = vertical ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0).cross(dir).normalize();
        const normal = new THREE.Vector3().crossVectors(dir, side).normalize();
        const basis = new THREE.Matrix4().makeBasis(side, normal, dir);
        const strip = new THREE.Mesh(new THREE.BoxGeometry(c.width, 0.9, len + 0.9), ribbonMat);
        strip.quaternion.setFromRotationMatrix(basis);
        strip.position.copy(a).add(b).multiplyScalar(0.5);
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.95, len + 0.9), stripeMat);
        stripe.quaternion.copy(strip.quaternion);
        stripe.position.copy(strip.position).add(side.clone().multiplyScalar(-c.width / 2 + 0.7));
        cablesG.add(named(shadowed(strip), name), stripe);
      }
    } else {
      const curve = new THREE.CatmullRomCurve3(c.path.map(V), false, 'catmullrom', 0.1);
      const segs = Math.max(24, Math.round(curve.getLength() / 3));
      if (c.kind === 'usb') {
        cablesG.add(named(shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, segs, c.radius, 10, false), wireMat('#151515'))), name));
      } else {
        // n thin wires side by side around the bundle centre
        const n = c.colors.length, rw = 0.65;
        const frames = curve.computeFrenetFrames(segs, false);
        c.colors.forEach((col, k) => {
          const ang = (k / n) * Math.PI * 2, rr = n > 1 ? rw * 1.25 : 0;
          const pts = [];
          for (let i = 0; i <= segs; i++) {
            const t = i / segs, p = curve.getPointAt(t);
            const twist = ang + t * 6;
            p.add(frames.normals[i].clone().multiplyScalar(Math.cos(twist) * rr)).add(frames.binormals[i].clone().multiplyScalar(Math.sin(twist) * rr));
            pts.push(p);
          }
          const wc = new THREE.CatmullRomCurve3(pts);
          cablesG.add(named(new THREE.Mesh(new THREE.TubeGeometry(wc, segs, rw, 6, false), wireMat(col)), name));
        });
      }
    }
  }

  // Back-wall labels for the connectors
  {
    const jacks = M.parts.filter(p => p.kind === 'jack');
    const scale = 6, c = document.createElement('canvas');
    c.width = Math.round((W + 2 * T) * scale); c.height = Math.round(F.h * scale);
    const g = c.getContext('2d');
    g.fillStyle = '#f3e6cf';
    g.font = 'bold ' + (3.2 * scale) + 'px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    for (const p of jacks) {
      // The label plane faces backwards, so its canvas runs right to left in panel x.
      const cx = (W + T - (p.x + p.w / 2)) * scale;
      const cy = (F.h - (F.base + (p.z0 + p.z1) / 2)) * scale;
      g.fillText(p.name, cx, cy + (p.w >= 20 ? 14 : 10) * scale);
    }
    const t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(W + 2 * T, F.h), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    plane.rotation.y = Math.PI;
    plane.position.set(0, F.h / 2, Z(-T - 0.3));
    G.back.add(plane);
  }

  // ── Panel: printed top, keys, sliders, knobs ──
  const panelTex = new THREE.TextureLoader().load(TEXTURE);
  panelTex.encoding = THREE.sRGBEncoding;
  panelTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const top = new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.55 });
  const panel = shadowed(new THREE.Mesh(new THREE.BoxGeometry(W, P.t, H),
    [mat.panelEdge, mat.panelEdge, top, mat.panelEdge, mat.panelEdge, mat.panelEdge]));
  panel.position.set(0, TOP - P.t / 2, 0);
  G.panel.add(named(panel, 'Painel (placa de circuito preta, ' + W.toFixed(0) + ' × ' + H.toFixed(0) + ' mm)'));

  // Shape with a narrower top (pads, slider knobs)
  function capGeometry(size, h, taper) {
    const geo = new THREE.BoxGeometry(size, h, size, 1, 1, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      if (pos.getY(i) > 0) { pos.setX(i, pos.getX(i) * taper); pos.setZ(i, pos.getZ(i) * taper); }
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Silicone pads: a rounded square of translucent silicone, lit from below in its row colour
  function padGeometry(size, h, r) {
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
  const padMats = new Map();
  const padMat = color => {
    if (!padMats.has(color)) {
      const c = new THREE.Color(color).convertSRGBToLinear();
      padMats.set(color, new THREE.MeshStandardMaterial({
        color: new THREE.Color(0xf4f1ea).convertSRGBToLinear().lerp(c, 0.75), emissive: c, emissiveIntensity: 0.45,
        roughness: 0.85, transparent: true, opacity: 0.97,
      }));
    }
    return padMats.get(color);
  };
  for (const k of M.keys) {
    const pad = shadowed(new THREE.Mesh(padGeo, padMat(k.color === '#3a3a3a' ? '#7d7d7d' : k.color)));
    pad.position.set(X(k.x), TOP, Z(k.y));
    G.panel.add(named(pad, k.color === '#3a3a3a' ? 'Pad de função (silicone)' : 'Pad de acorde (silicone, LED RGB embaixo)'));
  }

  const [cw, ch] = M.sliderCap;
  for (const s of M.sliders) {
    const knob = shadowed(new THREE.Mesh(capGeometry(1, 8, 0.85).scale(cw, 1, ch), mat.knob));
    const y = (s.y1 + s.y2) / 2;
    knob.position.set(X(s.x), TOP + 3 + 4, Z(y));
    const lever = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3, 4), mat.switch);
    lever.position.set(X(s.x), TOP + 1.5, Z(y));
    G.panel.add(named(knob, 'Slider ' + s.setting), lever);
  }

  const enc = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(M.encoder.r - 1.5, M.encoder.r, 16, 48), mat.knob));
  enc.position.set(X(M.encoder.x), TOP + 8, Z(M.encoder.y));
  const encMark = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 6), mat.rubber);
  encMark.position.set(X(M.encoder.x), TOP + 16.3, Z(M.encoder.y - M.encoder.r + 5));
  G.panel.add(named(enc, 'Encoder MENU (gira e aperta)'), encMark);

  const pw = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(M.power.d / 2, M.power.d / 2, 3, 40), mat.metal));
  pw.position.set(X(M.power.x), TOP + 1.5, Z(M.power.y));
  G.panel.add(named(pw, 'Botão liga/desliga'));

  // Screens glow a little, so they read as lit
  for (const s of M.screens) {
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(s.aw, s.ah),
      new THREE.MeshBasicMaterial({ color: 0x00e060, transparent: true, opacity: 0.06 }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(X(s.x + s.w / 2), TOP + 0.05, Z(s.y + s.h / 2));
    G.panel.add(glow);
  }

  // ── Views and exploded view ──
  const groupsAt = {};
  for (const [k, g] of Object.entries(G)) groupsAt[k] = g.position.clone();
  let explode = 0, insideMode = false;
  function layout() {
    const e = explode;
    G.panel.position.y = 110 * e;
    G.under.position.y = 55 * e;
    G.base.position.y = -40 * e;
    G.back.position.z = -70 * e;
    G.front.position.z = 70 * e;
    G.left.position.x = -70 * e;
    G.right.position.x = 70 * e;
    G.panel.visible = !insideMode;
    // Seen from inside, the boards hanging from the panel turn see-through.
    mat.underPcb.opacity = insideMode ? 0.28 : 1;
    mat.underElec.opacity = insideMode ? 0.28 : 0.85;
    mat.underConn.opacity = insideMode ? 0.28 : 1;
    mat.underPcb.depthWrite = mat.underElec.depthWrite = mat.underConn.depthWrite = !insideMode;
    // Cables join parts that fly apart in the exploded view, so they show only when assembled.
    cablesG.visible = e < 0.02;
  }

  // [camera position, look-at height]
  const views = {
    btnFront: [[0, 330, 560], 10],
    btnTop: [[0, 760, 1], 0],
    btnBack: [[-120, 170, -560], 20],
    btnInside: [[0, 600, 300], 0],
  };
  let anim = null;
  function goTo(id) {
    insideMode = id === 'btnInside';
    layout();
    for (const b of Object.keys(views)) document.getElementById(b).setAttribute('aria-pressed', String(b === id));
    const from = camera.position.clone(), to = new THREE.Vector3(...views[id][0]);
    const fromT = controls.target.clone(), toT = new THREE.Vector3(0, views[id][1], 0);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    anim = { from, to, fromT, toT, start: performance.now(), ms: reduce ? 0 : 700 };
  }
  for (const id of Object.keys(views)) document.getElementById(id).addEventListener('click', () => goTo(id));
  document.getElementById('explode').addEventListener('input', e => { explode = e.target.value / 100; layout(); });

  camera.position.set(...views.btnFront[0]);
  controls.target.set(0, views.btnFront[1], 0);
  document.getElementById('btnFront').setAttribute('aria-pressed', 'true');

  // Hover: name of the part under the pointer
  const ray = new THREE.Raycaster(), ptr = new THREE.Vector2(), tip = document.getElementById('tip');
  view.addEventListener('pointermove', e => {
    const r = view.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(pickables.filter(m => m.visible && m.parent.visible), false)[0];
    if (hit && e.pointerType === 'mouse') {
      tip.hidden = false;
      tip.textContent = hit.object.userData.name;
      tip.style.left = (e.clientX - r.left) + 'px';
      tip.style.top = (e.clientY - r.top) + 'px';
    } else tip.hidden = true;
  });
  view.addEventListener('pointerleave', () => { tip.hidden = true; });

  function resize() {
    const w = view.clientWidth, h = view.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(view);
  resize();

  function frame() {
    if (anim) {
      const t = anim.ms ? Math.min(1, (performance.now() - anim.start) / anim.ms) : 1;
      const k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      camera.position.lerpVectors(anim.from, anim.to, k);
      controls.target.lerpVectors(anim.fromT, anim.toT, k);
      if (t >= 1) anim = null;
    }
    controls.update();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  layout();
  frame();
})();
`;
}
