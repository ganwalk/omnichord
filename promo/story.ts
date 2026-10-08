// ─── OmniHarp — "Conexão": a story promo ───
// A little robot sits in a grey, silent void. It finds a cable, plugs itself
// in, and the world fills with colour and music: the OmniHarp rises behind it.
// Then the instrument shrinks into a phone: "now in your pocket".
//
// Like the first promo, every visual is a pure function of time t and the
// soundtrack comes from the same score (story-score.ts).

import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
import '@fontsource/unbounded/900.css';
import './video.css';
import './story.css';

import {
  clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, easeOutExpo,
  lerp, prog, rand, track, window01, type Key,
} from './lib/anim';
import { AppView, Device, PHONE_PORTRAIT, homeBar, makeAppState, statusBar } from './lib/app';
import { el, fitWidth, layer } from './lib/dom';
import { loopFace, type Face } from './lib/face';
import { Headline } from './lib/headline';
import { Robot, type RobotPose } from './lib/robot';
import { BEAT, CTA_URL, DURATION, HOP, S, SCORE, hits } from './story-score';

const SVGNS = 'http://www.w3.org/2000/svg';
const appState = makeAppState(SCORE);

// ═══ Layers ═══

const bgGray = layer('bgGray');
const bgWarm = layer('bgWarm');
const warmPulse = layer('glow');
const floorGlow = layer('floorGlow');
const fogA = el('div', 'fog'), fogB = el('div', 'fog');
const world = el('div');
world.id = 'world';

// Instrument (behind everything in the world)
const rays = el('div', 'rays', world);
const instGlow = el('div', 'inst-glow', world);
const INST = { w: 1192, h: 900, cx: 540, cy: 540, s: 1.06 };
const instWrap = el('div', 'inst-wrap', world);
Object.assign(instWrap.style, { width: `${INST.w}px`, height: `${INST.h}px`, left: `${INST.cx - INST.w / 2}px`, top: `${INST.cy - INST.h / 2}px` });
const instApp = new AppView(instWrap, INST.w, INST.h);

// Phone ("now in your pocket")
const PHONE = { cx: 420, cy: 880 };
const phone = new Device('phone', 390, 844, world);
statusBar(phone.screen, 390, PHONE_PORTRAIT.top, 16);
homeBar(phone.screen, 195, 9, 134);
const phoneApp = new AppView(phone.screen, 390, 844 - PHONE_PORTRAIT.top - PHONE_PORTRAIT.bottom, 0, PHONE_PORTRAIT.top);

// Vector layer: cable, robot, plugs, sparks
const svg = document.createElementNS(SVGNS, 'svg');
svg.id = 'worldSvg';
svg.setAttribute('width', '1080');
svg.setAttribute('height', '1920');
svg.setAttribute('viewBox', '0 0 1080 1920');
world.appendChild(svg);
svg.innerHTML = `
  <defs>
    <linearGradient id="plug-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe6a6"/><stop offset=".5" stop-color="#d6a64e"/><stop offset="1" stop-color="#8a6420"/></linearGradient>
    <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
  </defs>
  <g id="cable">
    <path class="cable-glow" fill="none" stroke="#ffcc66" stroke-width="26" stroke-linecap="round" filter="url(#soft-glow)" opacity="0"/>
    <path class="cable-base" fill="none" stroke="#1d1d1f" stroke-width="15" stroke-linecap="round"/>
    <path class="cable-hi" fill="none" stroke="#4a4a50" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    <path class="cable-pulse" fill="none" stroke="#fff3c0" stroke-width="12" stroke-linecap="round" pathLength="1" stroke-dasharray="0.09 1.2" opacity="0"/>
  </g>
  <g id="robotLayer"></g>
  <g id="anchorPlug">${plugMarkup()}</g>
  <g id="robotPlug">${plugMarkup()}<g class="plug-halo" opacity="0"><circle r="46" fill="#fff1b8" filter="url(#soft-glow)"/></g></g>
  <g id="glint" opacity="0"><path d="M0 -46 L9 -9 L46 0 L9 9 L0 46 L-9 9 L-46 0 L-9 -9 Z" fill="#fffbe6"/></g>
  <g id="sparks"></g>`;
const cablePaths = ['.cable-glow', '.cable-base', '.cable-hi', '.cable-pulse'].map(s => svg.querySelector<SVGPathElement>(s)!);
const cablePulse = cablePaths[3], cableGlow = cablePaths[0];
const robotPlug = svg.querySelector<SVGGElement>('#robotPlug')!;
const plugHalo = svg.querySelector<SVGGElement>('.plug-halo')!;
const anchorPlug = svg.querySelector<SVGGElement>('#anchorPlug')!;
const glint = svg.querySelector<SVGGElement>('#glint')!;
const sparksG = svg.querySelector<SVGGElement>('#sparks')!;
const SPARKS = Array.from({ length: 16 }, () => {
  const l = document.createElementNS(SVGNS, 'line');
  l.setAttribute('stroke', '#fff2b0');
  l.setAttribute('stroke-linecap', 'round');
  sparksG.appendChild(l);
  return l;
});
const robot = new Robot(svg.querySelector('#robotLayer')!);

/** Plug: tip at (0,0) pointing +x; cable leaves from (−124, 0). */
function plugMarkup(): string {
  return `<g class="plug">
    <rect x="-128" y="-10" width="26" height="20" rx="6" fill="#2a2a2c"/>
    <rect x="-106" y="-19" width="74" height="38" rx="10" fill="#151517" stroke="#000" stroke-width="3"/>
    <rect x="-100" y="-15" width="62" height="7" rx="3" fill="#fff" opacity=".08"/>
    <rect x="-36" y="-9" width="36" height="18" rx="4" fill="url(#plug-gold)"/>
    <rect x="-24" y="-9" width="3" height="18" fill="#7a5a1a" opacity=".7"/>
  </g>`;
}

// Dust motes drifting through the void (turn gold when the world wakes up)
const DUST = Array.from({ length: 48 }, (_, i) => {
  const d = el('div', 'dust');
  const size = 2 + rand(i * 3 + 1) * 5;
  Object.assign(d.style, { width: `${size}px`, height: `${size}px` });
  return { d, i, size };
});

// ═══ Text ═══

function quiet(h: Headline): Headline { h.el.classList.add('quiet'); return h; }
const capA = quiet(new Headline(['Num mundo', 'sem música…'], [1.5, 2.3], 5.5, 230, 96));
const capB = quiet(new Headline(['…faltava uma', '*conexão.'], [6.6, 7.4], 9.7, 230, 96));
const hBrand = new Headline(['*OmniHarp'], [S.instOn], S.drums - 0.35, 1480, 170);
const hFeat = new Headline(['Acordes.', 'Cordas.', '*Ritmo.'], [S.drums, S.drums + 1, S.drums + 2], S.arp - 0.4, 1450, 104);
const hConn = new Headline(['Toda música', 'começa com uma', '*conexão.'], [S.arp, S.arp + 0.5, S.arp + 1.0], S.shrink - 0.4, 1440, 88);
const hPocket = new Headline(['Agora,', '*no seu bolso.'], [24.35, 24.85], S.finale - 0.35, 110, 116);

// End card (same lockup as the first promo, the robot itself is the mascot)
const endCard = el('div', 'logo');
endCard.style.top = '250px';
const endWord = el('div', 'wordmark gold', endCard);
endWord.textContent = 'OmniHarp';
const endTag = el('div', '', endCard);
Object.assign(endTag.style, { marginTop: '30px', fontSize: '50px', fontWeight: '600', textAlign: 'center', lineHeight: '1.3', color: 'rgba(255,240,215,0.9)' });
endTag.innerHTML = 'Sua harpa de acordes.<br>Em qualquer tela.';
const endCta = el('div', 'cta', endCard);
endCta.textContent = '▶  Toque agora';
const endUrl = el('div', 'url', endCard);
endUrl.textContent = CTA_URL;
const endPlat = el('div', 'platforms', endCard);
endPlat.textContent = 'Web agora · Android e iOS em breve';
const endParts = [endWord, endTag, endCta, endUrl, endPlat];

const vignette = layer('vignette');
const flash = layer('flash');
const black = layer('black');
black.style.background = '#000';
void vignette;

// ═══ Choreography ═══

const lin = (x: number) => x;
const hopStarts = [...S.hops, ...S.pocketHops, S.finale];

/** Height of the current hop, plus a little bounce on every beat while the music plays. */
function hopHeight(t: number): number {
  let h = 0;
  for (const s0 of hopStarts) if (t >= s0 && t < s0 + HOP) h = Math.max(h, Math.sin(Math.PI * (t - s0) / HOP) * (s0 === S.finale ? 150 : 115));
  const dancing = t >= S.drums && t < S.finale && !(t >= S.pocketHops[0] && t < S.pocketHops[1] + HOP);
  if (dancing) h = Math.max(h, 26 * Math.abs(Math.sin(Math.PI * ((t - S.drums) / BEAT))));
  return h;
}

function squash(t: number): number {
  let q = 1;
  for (const s0 of hopStarts) {
    q -= 0.13 * window01(t, s0 - 0.14, 0.1, s0 - 0.02, 0.06);            // anticipation
    q -= 0.16 * window01(t, s0 + HOP, 0.04, s0 + HOP + 0.06, 0.14);      // landing
  }
  q += 0.14 * Math.exp(-Math.max(0, t - S.power) * 6) * (t >= S.power ? 1 : 0); // jolt of power
  return q;
}

const FACE_TRACK: [number, Face][] = [
  [0, 'sad'], [4.95, 'blink'], [5.25, 'sad'], [6.2, 'blink'], [6.32, 'curious'],
  [S.inspect, 'wow'], [S.insert, 'curious'], [S.power, 'chord'], [13.0, 'happy'],
];
function faceAt(t: number): Face {
  if (t >= S.plug && t < S.power) return rand(Math.floor(t * 30)) > 0.5 ? 'blink' : 'curious';
  if (t >= S.instOn && t < S.shrink) return loopFace(t - S.instOn);
  if (t >= S.shrink && t < 25.6) return 'happy';
  if (t >= 25.6) return loopFace(t - 25.6);
  let f: Face = 'sad';
  for (const [k, v] of FACE_TRACK) if (t >= k) f = v;
  return f;
}

const sway = (t: number, period: number, phase = 0) => Math.sin((2 * Math.PI * (t - S.drums)) / period + phase);
const dance = (t: number) => (t >= S.drums && t < S.shrink ? 1 : 0);

function robotPose(t: number): RobotPose {
  const power = t < S.plug ? 0.32 + 0.06 * Math.sin(t * 23) * Math.sin(t * 7)
    : t < S.power ? (rand(Math.floor(t * 30) + 7) > 0.45 ? 1 : 0.15) : 1;
  const beatAge = t >= S.drums ? (t - S.drums) % BEAT : 1;
  const led = t < S.plug ? 0 : t < S.power ? power : 0.7 + 0.3 * Math.exp(-beatAge * 6);
  const waving = t >= S.finale + 0.6;

  return {
    x: track(t, [[0, 380], [S.hops[0], 380], [S.hops[0] + HOP, 480, lin], [S.hops[1] + HOP, 580, lin], [S.hops[2] + HOP, 680, lin],
      [S.pocketHops[0], 680], [S.pocketHops[0] + HOP, 790, lin], [S.pocketHops[1] + HOP, 880, lin], [S.finale, 880], [S.finale + HOP, 540, lin]]),
    y: track(t, [[0, 1500], [S.finale, 1500], [S.finale + HOP, 1800, lin]]),
    s: track(t, [[0, 1], [S.pocketHops[0], 1], [S.pocketHops[1] + HOP, 0.72], [S.finale, 0.72], [S.finale + HOP, 0.78]]),
    hop: hopHeight(t),
    squash: squash(t),
    crouch: track(t, [[0, 1], [S.stand, 1], [S.stand + 0.45, 0, easeOutBack], [S.reach, 0], [S.pickup - 0.1, 0.65], [S.inspect, 0]]),
    tilt: track(t, [[0, 16], [S.sigh - 0.05, 16], [S.sigh + 0.3, 24], [S.sigh + 0.75, 15], [S.glint, 15], [S.glint + 0.3, -9],
      [S.stand, -4], [S.hops[0], 0], [S.reach, 0], [S.pickup - 0.1, 12], [S.inspect, -7], [S.insert, -2], [S.plug, 0],
      [S.power, -7], [S.power + 0.5, 0]]) + 6 * sway(t, 1.0) * dance(t),
    armL: track(t, [[0, 6], [S.power - 0.05, 6], [S.power + 0.2, 125, easeOutBack], [13.4, 125], [13.9, 22], [S.drums, 22]])
      + dance(t) * 22 * (1 + sway(t, 1.0))
      + track(t, [[25.4, 0], [25.8, 52], [27.6, 52], [S.finale, 0]]),
    armR: track(t, [[0, -6], [S.reach, -6], [S.pickup - 0.1, -30], [S.pickup + 0.05, -30], [S.inspect + 0.1, -152], [S.insert, -152],
      [S.plug - 0.15, -14], [S.plug + 0.05, -14], [S.plug + 0.3, -6], [S.power + 0.2, -125, easeOutBack], [13.4, -125], [13.9, -22], [S.drums, -22]])
      - dance(t) * 22 * (1 + sway(t, 1.0, Math.PI))
      + (waving ? -110 + 24 * Math.sin((t - S.finale) * 11) : 0),
    face: faceAt(t),
    lookX: track(t, [[0, 0], [S.glint, 0], [S.glint + 0.2, 22], [S.hops[2] + HOP, 22], [S.pickup, 12], [S.inspect, 6], [S.insert, 18], [S.plug, 0],
      [25.4, 0], [25.7, -22], [27.6, -22], [S.finale, 0]]),
    lookY: track(t, [[0, 8], [S.glint, 8], [S.glint + 0.2, 0], [S.reach, 0], [S.pickup, 18], [S.inspect, -8], [S.insert, 10], [S.plug, 0]]),
    power, led,
    sat: track(t, [[0, 0.3], [S.power, 0.3], [S.power + 0.45, 1, easeOutCubic]]),
  };
}

// Camera: world point (cx, cy) at the stage center, scaled by s.
const CAM: Record<'cx' | 'cy' | 's', Key[]> = {
  cx: [[0, 470], [6.0, 430], [6.7, 560], [S.hops[0], 560], [S.hops[2] + HOP, 700], [S.plug, 720], [S.power, 720], [13.7, 580, easeInOutCubic],
    [S.shrink, 580], [S.shrink + 0.8, 640], [S.finale, 640], [S.finale + HOP, 540]],
  cy: [[0, 1150], [6.0, 1170], [S.plug, 1150], [S.power, 1150], [13.7, 1000], [S.shrink, 1000], [S.shrink + 0.8, 940], [S.finale, 940], [S.finale + HOP, 960]],
  s: [[0, 1.18], [6.0, 1.3], [S.stand, 1.22], [S.hops[2] + HOP, 1.3], [11.3, 1.42], [S.power, 1.42], [13.7, 0.86, easeInOutCubic],
    [S.shrink, 0.86], [S.shrink + 0.8, 0.92], [S.finale, 0.92], [S.finale + HOP, 1.0]],
};
function camera(t: number): { cx: number; cy: number; s: number } {
  let { cx, cy } = { cx: track(t, CAM.cx), cy: track(t, CAM.cy) };
  const s = track(t, CAM.s);
  // Shake when the power surges through the robot.
  const shake = t >= S.plug && t < S.power + 0.5 ? (t < S.power ? 4 : 14 * Math.exp(-(t - S.power) * 7)) : 0;
  cx += shake * (rand(Math.floor(t * 60)) - 0.5) * 2;
  cy += shake * (rand(Math.floor(t * 60) + 999) - 0.5) * 2;
  return { cx, cy, s };
}
const toStage = (cam: { cx: number; cy: number; s: number }, x: number, y: number): [number, number] =>
  [540 + (x - cam.cx) * cam.s, 960 + (y - cam.cy) * cam.s];

// ═══ Cable & plugs ═══

type Vec = [number, number];
const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const lerpV = (a: Vec, b: Vec, p: number): Vec => [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
const angleOf = (d: Vec) => (Math.atan2(d[1], d[0]) * 180) / Math.PI;

let plugFloor: Vec = [900, 1486];

/** Robot-end plug: tip position and direction. */
function robotPlugPose(t: number): { tip: Vec; dir: Vec } {
  const hand = robot.rightHand();
  const port = robot.port();
  if (t < S.pickup - 0.15) return { tip: plugFloor, dir: [-1, 0] };
  if (t < S.inspect) {
    const p = easeOutCubic(prog(t, S.pickup - 0.15, 0.15));
    return { tip: lerpV(plugFloor, add(hand, [-14, 26]), p), dir: [-1, 0] };
  }
  if (t < S.insert) {
    const p = easeInOutCubic(prog(t, S.inspect, 0.35));
    const a = lerp(180, 270, p) * Math.PI / 180;           // tip turns to point up: "what is this?"
    const dir: Vec = [Math.cos(a), Math.sin(a)];
    return { tip: add(hand, mul(dir, 34)), dir };
  }
  const p = easeInOutCubic(prog(t, S.insert, S.plug - S.insert));
  const a = lerp(270, 180, easeInOutCubic(prog(t, S.insert, 0.3))) * Math.PI / 180;
  const dir: Vec = [Math.cos(a), Math.sin(a)];
  const inHand = add(hand, mul(dir, 34));
  return { tip: lerpV(inHand, port, p), dir };
}

function placePlug(g: SVGGElement, tip: Vec, dir: Vec, scale: number): Vec {
  g.setAttribute('transform', `translate(${tip[0]} ${tip[1]}) rotate(${angleOf(dir)}) scale(${scale})`);
  return add(tip, mul(dir, -124 * scale));   // cable end of the plug
}

/** Where the far end of the cable goes: off-screen, then the instrument, then the phone. */
function cableAnchor(t: number): { a: Vec; inDir: Vec; show: number } {
  const off: Vec = [1320, 1470];
  const instPort = instrumentPort(t);
  const phonePort: Vec = [PHONE.cx, PHONE.cy + phone.h / 2 * phoneScale(t) - 6];
  if (t < S.rise) return { a: off, inDir: [-1, 0], show: 0 };
  if (t < S.shrink) {
    const p = easeInOutCubic(prog(t, S.rise, S.instOn - S.rise));
    return { a: lerpV(off, instPort, p), inDir: [-1, 0], show: prog(t, S.instOn - 0.5, 0.3) };
  }
  const p = easeInOutCubic(prog(t, S.shrink, 0.6));
  return { a: lerpV(instPort, phonePort, p), inDir: [0, -1], show: 1 };
}

function renderCable(t: number): void {
  const pose = robotPlugPose(t);
  const back = placePlug(robotPlug, pose.tip, pose.dir, 0.9);
  const { a, inDir, show } = cableAnchor(t);
  const anchorBack = add(a, mul(inDir, -124 * 0.8));
  placePlug(anchorPlug, a, inDir, 0.8);
  anchorPlug.style.opacity = String(show);

  // Gravity: the cable leaves the plug backwards, sags, and arrives along the port's axis.
  const c1 = add(add(back, mul(pose.dir, -150)), [0, 90]);
  const c2 = add(anchorBack, add(mul(inDir, -220), [0, inDir[1] === 0 ? 140 : 0]));
  const d = `M${back[0]} ${back[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${anchorBack[0]} ${anchorBack[1]}`;
  for (const p of cablePaths) p.setAttribute('d', d);

  // Energy pulses run from the robot to the instrument when the power flows.
  const pulse = (t0: number) => (t >= t0 && t < t0 + 0.9 ? prog(t, t0, 0.9) : -1);
  const pp = Math.max(pulse(S.power), pulse(S.instOn - 0.45));
  cablePulse.style.opacity = pp >= 0 ? String(1 - pp * 0.3) : '0';
  cablePulse.setAttribute('stroke-dashoffset', String(0.09 - pp * 1.15));
  cableGlow.setAttribute('opacity', String(t >= S.power ? 0.25 + 0.25 * Math.exp(-((t - S.drums) % BEAT) * 6) * (t >= S.drums ? 1 : 0) : 0));

  const cableOut = 1 - prog(t, S.finale, 0.3);
  svg.querySelector<SVGGElement>('#cable')!.style.opacity = String(cableOut);
  robotPlug.style.opacity = String(cableOut);
  anchorPlug.style.opacity = String(show * cableOut);

  // The plug catches the light: "something's there".
  const g = window01(t, S.glint, 0.12, S.glint + 0.3, 0.35);
  glint.setAttribute('opacity', String(g));
  glint.setAttribute('transform', `translate(${plugFloor[0] - 10} ${plugFloor[1] - 14}) scale(${0.4 + g * 0.8}) rotate(${t * 90})`);
  plugHalo.setAttribute('opacity', String(t >= S.glint && t < S.pickup ? 0.25 + 0.2 * Math.sin(t * 6) : 0));
  plugHalo.setAttribute('transform', 'translate(-60 0)');

  // Sparks fly from the port when it clicks in.
  const sp = t - S.plug;
  const port = robot.port();
  SPARKS.forEach((l, i) => {
    const life = 0.25 + rand(i * 13) * 0.35;
    if (sp < 0 || sp > life) { l.setAttribute('opacity', '0'); return; }
    const ang = (-150 + rand(i * 7 + 1) * 200) * Math.PI / 180, v = 380 + rand(i * 3 + 2) * 520;
    const x = port[0] + Math.cos(ang) * v * sp, y = port[1] + Math.sin(ang) * v * sp + 900 * sp * sp;
    const tail = 0.035;
    const x0 = port[0] + Math.cos(ang) * v * Math.max(0, sp - tail), y0 = port[1] + Math.sin(ang) * v * Math.max(0, sp - tail) + 900 * Math.max(0, sp - tail) ** 2;
    l.setAttribute('x1', String(x0)); l.setAttribute('y1', String(y0)); l.setAttribute('x2', String(x)); l.setAttribute('y2', String(y));
    l.setAttribute('stroke-width', String(4 + rand(i) * 4));
    l.setAttribute('opacity', String(1 - sp / life));
  });
}

// ═══ Instrument & phone ═══

function instPose(t: number): { cx: number; cy: number; s: number; op: number; bright: number } {
  const rise = easeOutCubic(prog(t, S.rise, S.instOn - S.rise));
  const shrink = easeInOutCubic(prog(t, S.shrink, 0.5));
  return {
    cx: lerp(INST.cx, PHONE.cx, shrink),
    cy: lerp(INST.cy + (1 - rise) * 650, PHONE.cy, shrink),
    s: lerp(lerp(0.75, INST.s, rise), 0.09, shrink),
    op: Math.min(rise * 1.4, 1) * (1 - prog(t, S.shrink + 0.25, 0.25)),
    bright: t < S.instOn ? 0.32 : 1,
  };
}
function instrumentPort(t: number): Vec {
  const p = instPose(t);
  return [p.cx + (INST.w / 2 - 20) * p.s, p.cy + 40 * p.s];
}
const phoneScale = (t: number) => lerp(0.3, 1, easeOutBack(prog(t, S.shrink + 0.2, 0.6)));

// ═══ Frame ═══

const kicks = hits.filter(h => h.hit === 'k').map(h => h.t);
const FLASHES: [number, number][] = [[S.power, 0.85], [S.instOn, 0.45], [S.finale, 0.55]];

function renderFrame(t: number): void {
  const cam = camera(t);
  world.style.transform = `translate(540px, 960px) scale(${cam.s}) translate(${-cam.cx}px, ${-cam.cy}px)`;

  // Robot first: the cable and the colour wave hang off its pose.
  robot.apply(robotPose(t));

  // Colour floods out of the robot's face when it powers on.
  const [fx, fy] = toStage(cam, ...robot.faceCenter());
  const wave = easeOutCubic(prog(t, S.power, 1.4)) * 2300;
  // Soft-edged wave: a radial mask that grows from the face.
  const mask = `radial-gradient(circle at ${fx}px ${fy}px, #000 ${Math.max(0, wave - 260)}px, transparent ${wave}px)`;
  bgWarm.style.webkitMaskImage = mask;
  bgWarm.style.maskImage = mask;
  bgWarm.style.display = wave > 0 ? 'block' : 'none';
  floorGlow.style.opacity = String(1 - prog(t, S.power, 1));

  let pulse = 0;
  for (const k of kicks) if (k <= t && t - k < 0.6) pulse = Math.max(pulse, Math.exp(-(t - k) * 7));
  warmPulse.style.opacity = String(t >= S.power ? 0.3 + 0.5 * pulse : 0);

  let fl = 0;
  for (const [ft, a] of FLASHES) if (ft <= t && t - ft < 0.5) fl = Math.max(fl, a * Math.exp(-(t - ft) * 8));
  flash.style.opacity = String(fl);

  // Fog drifts in the grey world and thins out once it is alive.
  const fogOp = lerp(1, 0.25, prog(t, S.power, 1.5));
  fogA.style.opacity = String(fogOp);
  fogB.style.opacity = String(fogOp * 0.8);
  fogA.style.transform = `translate(${-300 + Math.sin(t * 0.15) * 120}px, ${1100 + Math.cos(t * 0.11) * 60}px)`;
  fogB.style.transform = `translate(${100 + Math.cos(t * 0.13) * 140}px, ${500 + Math.sin(t * 0.09) * 80}px)`;

  // Dust motes: grey and slow, then golden.
  const gold = prog(t, S.power + 0.2, 0.8);
  for (const { d, i, size } of DUST) {
    const sp = 10 + rand(i + 200) * 24;
    const x = (rand(i + 1) * 1180 - 50 + Math.sin(t * 0.4 + i) * 22) % 1180;
    const y = ((rand(i + 100) * 2000 - t * sp * (1 + gold * 1.5)) % 2000 + 2000) % 2000 - 40;
    d.style.transform = `translate(${x}px, ${y}px)`;
    d.style.background = gold > 0.5 ? `rgba(255,214,120,${0.35 + 0.4 * rand(i + 7)})` : `rgba(210,210,210,${0.18 + 0.2 * rand(i + 7)})`;
    d.style.boxShadow = gold > 0.5 ? `0 0 ${size * 3}px rgba(255,190,80,0.6)` : 'none';
  }

  // Instrument rises behind the robot, glowing.
  const ip = instPose(t);
  instWrap.style.display = ip.op > 0.001 ? 'block' : 'none';
  instWrap.style.transform = `translate(${ip.cx - INST.cx}px, ${ip.cy - INST.cy}px) scale(${ip.s})`;
  instWrap.style.opacity = String(ip.op);
  instWrap.style.filter = `brightness(${ip.bright})`;
  if (ip.op > 0) instApp.apply(appState(t));
  const glowOp = ip.op * (t < S.instOn ? 0.35 * prog(t, S.rise, 1.2) : 0.85 + 0.15 * pulse);
  Object.assign(instGlow.style, { left: `${ip.cx - 750}px`, top: `${ip.cy - 550}px`, opacity: String(glowOp) });
  Object.assign(rays.style, {
    left: `${ip.cx - 1300}px`, top: `${ip.cy - 1300}px`,
    opacity: String(ip.op * (t < S.instOn ? 0 : 0.8) * window01(t, S.instOn, 0.6, S.shrink, 0.3)),
    transform: `rotate(${t * 5}deg)`,
  });

  // Phone
  const pop = prog(t, S.shrink + 0.2, 0.15);
  const out = prog(t, S.finale, 0.3);
  phone.place(PHONE.cx, PHONE.cy, phoneScale(t) * (1 + out * 0.2), 0, pop * (1 - out));
  if (pop > 0 && out < 1) phoneApp.apply(appState(t));

  renderCable(t);

  // Text
  capA.render(t); capB.render(t); hBrand.render(t); hFeat.render(t); hConn.render(t); hPocket.render(t);

  // End card
  endCard.style.display = t >= S.finale ? 'flex' : 'none';
  endParts.forEach((part, i) => {
    const p = easeOutBack(prog(t, S.finale + 0.25 + i * 0.22, 0.6));
    part.style.opacity = String(clamp01(p * 1.3));
    part.style.transform = `translateY(${(1 - p) * 60}px) scale(${lerp(0.85, 1, p)})`;
  });
  endCta.style.boxShadow = `0 20px 60px rgba(240,170,40,${0.35 + 0.25 * Math.sin(t * 5)}), inset 0 2px 0 rgba(255,255,255,0.6)`;

  black.style.opacity = String(Math.max(1 - easeOutExpo(prog(t, 0, 1.0)), easeInCubic(prog(t, DURATION - 0.8, 0.8))));
  void bgGray;
}

// ═══ Boot ═══

async function init(): Promise<void> {
  await Promise.all([
    instApp.load({ pattern: 'Bossa Nova', bpm: 120, transparent: true }),
    phoneApp.load({ pattern: 'Bossa Nova', bpm: 120 }),
  ]);
  await document.fonts.ready;
  for (const h of [capA, capB, hBrand, hFeat, hConn, hPocket]) h.fit();
  fitWidth(endWord, 170, 940);
  // The plug lies where the robot's hand will reach for it.
  robot.apply(robotPose(S.pickup - 0.1));
  const hand = robot.rightHand();
  plugFloor = [hand[0] - 14, 1486];
  renderFrame(0);
}

const w = window as unknown as { promoReady: Promise<void>; renderFrame: (t: number) => void; DURATION: number };
w.renderFrame = renderFrame;
w.DURATION = DURATION;
w.promoReady = init();
