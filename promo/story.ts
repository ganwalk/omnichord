// ─── OmniHarp — "Conexão" ───
// A wordless intro: a little robot sits in a grey, silent void, finds a cable
// and plugs itself in. Its face lights up, condenses into a light, runs down
// the cable and — after a whip pan — lands in the robot screen at the top of
// the app, which powers on. From there it's the feature demo (brag.ts).
//
// Every visual is a pure function of time t; the soundtrack is rendered from
// the same score (story-score.ts).

import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
import '@fontsource/unbounded/900.css';
import './video.css';
import './story.css';

import { createBrag } from './brag';
import {
  clamp01, easeInCubic, easeInOutCubic, easeOutBack, easeOutCubic, easeOutExpo,
  lerp, prog, rand, track, window01, type Key,
} from './lib/anim';
import { el, layer, stage, withParent } from './lib/dom';
import { FACE_STATES, type Face } from './lib/face';
import { Robot, type RobotPose } from './lib/robot';
import { DURATION, HOP, OFFSET, S } from './story-score';

const SVGNS = 'http://www.w3.org/2000/svg';
type Vec = [number, number];

// ═══ Scenes: the demo underneath, the story on top, the travelling light above both ═══

const bragRoot = el('div', 'layer', stage());
const brag = createBrag(bragRoot, { focus: 'robot', hideHint: true });
const storyRoot = el('div', 'layer', stage());
const overlay = el('div', 'layer', stage());

const {
  world, cablePaths, robotPlug, plugHalo, glint, sparks, robot, fogA, fogB, dust, black,
} = withParent(storyRoot, () => {
  layer('bgGray');
  layer('floorGlow');
  const fogA = el('div', 'fog'), fogB = el('div', 'fog');
  const world = el('div');
  world.id = 'world';
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
      <path class="cable-glow" fill="none" stroke="#5dff9f" stroke-width="26" stroke-linecap="round" filter="url(#soft-glow)" opacity="0"/>
      <path class="cable-base" fill="none" stroke="#1d1d1f" stroke-width="15" stroke-linecap="round"/>
      <path class="cable-hi" fill="none" stroke="#4a4a50" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    </g>
    <g id="robotLayer"></g>
    <g id="robotPlug">${plugMarkup()}<g class="plug-halo" opacity="0"><circle r="46" fill="#fff1b8" filter="url(#soft-glow)"/></g></g>
    <g id="glint" opacity="0"><path d="M0 -46 L9 -9 L46 0 L9 9 L0 46 L-9 9 L-46 0 L-9 -9 Z" fill="#fffbe6"/></g>
    <g id="sparks"></g>`;
  const sparksG = svg.querySelector<SVGGElement>('#sparks')!;
  const sparks = Array.from({ length: 16 }, () => {
    const l = document.createElementNS(SVGNS, 'line');
    l.setAttribute('stroke', '#fff2b0');
    l.setAttribute('stroke-linecap', 'round');
    sparksG.appendChild(l);
    return l;
  });
  // Dust motes drifting through the void.
  const dust = Array.from({ length: 48 }, (_, i) => {
    const d = el('div', 'dust');
    const size = 2 + rand(i * 3 + 1) * 5;
    Object.assign(d.style, { width: `${size}px`, height: `${size}px`, background: `rgba(210,210,210,${0.18 + 0.2 * rand(i + 7)})` });
    return { d, i };
  });
  layer('vignette');
  const black = layer('black');
  black.style.background = '#000';
  return {
    world, sparks, dust, black, fogA, fogB,
    cablePaths: ['.cable-glow', '.cable-base', '.cable-hi'].map(s => svg.querySelector<SVGPathElement>(s)!),
    robotPlug: svg.querySelector<SVGGElement>('#robotPlug')!,
    plugHalo: svg.querySelector<SVGGElement>('.plug-halo')!,
    glint: svg.querySelector<SVGGElement>('#glint')!,
    robot: new Robot(svg.querySelector('#robotLayer')!),
  };
});

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

// The travelling light: the robot's face, glowing, carried down the cable.
const orb = el('div', 'orb', overlay);
orb.innerHTML = `<div class="orb-glow"></div>
  <svg viewBox="96 150 320 210" width="150" height="98">
    <g fill="none" stroke="#eafff1" stroke-width="15" stroke-linecap="round">
      <path d="M136 186 Q104 256 136 326"/><path d="M376 186 Q408 256 376 326"/>${FACE_STATES.chord.replace(/class="fill"/g, 'fill="#eafff1" stroke="none"')}
    </g>
  </svg>`;
const streaks = el('div', 'layer streaks', overlay);

// ═══ Choreography ═══

const lin = (x: number) => x;

function hopHeight(t: number): number {
  let h = 0;
  for (const s0 of S.hops) if (t >= s0 && t < s0 + HOP) h = Math.max(h, Math.sin(Math.PI * (t - s0) / HOP) * 115);
  return h;
}

function squash(t: number): number {
  let q = 1;
  for (const s0 of S.hops) {
    q -= 0.13 * window01(t, s0 - 0.14, 0.1, s0 - 0.02, 0.06);            // anticipation
    q -= 0.16 * window01(t, s0 + HOP, 0.04, s0 + HOP + 0.06, 0.14);      // landing
  }
  return q + (t >= S.power ? 0.14 * Math.exp(-(t - S.power) * 6) : 0); // jolt of power
}

const FACE_TRACK: [number, Face][] = [
  [0, 'sad'], [S.sigh - 0.05, 'blink'], [S.sigh + 0.25, 'sad'], [S.glint, 'blink'], [S.glint + 0.12, 'curious'],
  [S.inspect, 'wow'], [S.insert, 'curious'], [S.power, 'chord'], [S.orb + 0.15, 'blink'],
];
function faceAt(t: number): Face {
  if (t >= S.plug && t < S.power) return rand(Math.floor(t * 30)) > 0.5 ? 'blink' : 'curious';
  let f: Face = 'sad';
  for (const [k, v] of FACE_TRACK) if (t >= k) f = v;
  return f;
}

function robotPose(t: number): RobotPose {
  // Dim and flickering in the grey world; bright when powered; dark again once its face has left.
  let power = t < S.plug ? 0.32 + 0.06 * Math.sin(t * 23) * Math.sin(t * 7)
    : t < S.power ? (rand(Math.floor(t * 30) + 7) > 0.45 ? 1 : 0.15) : 1;
  if (t >= S.orb) power = lerp(1, 0.12, prog(t, S.orb, 0.2));
  return {
    x: track(t, [[0, 380], [S.hops[0], 380], [S.hops[0] + HOP, 480, lin], [S.hops[1] + HOP, 580, lin], [S.hops[2] + HOP, 680, lin]]),
    y: 1500,
    s: 1,
    hop: hopHeight(t),
    squash: squash(t),
    crouch: track(t, [[0, 1], [S.stand, 1], [S.stand + 0.45, 0, easeOutBack], [S.reach, 0], [S.pickup - 0.1, 0.65], [S.inspect, 0]]),
    tilt: track(t, [[0, 16], [S.sigh - 0.05, 16], [S.sigh + 0.3, 24], [S.sigh + 0.75, 15], [S.glint, 15], [S.glint + 0.3, -9],
      [S.stand, -4], [S.hops[0], 0], [S.reach, 0], [S.pickup - 0.1, 12], [S.inspect, -7], [S.insert, -2], [S.plug, 0],
      [S.power, -7], [S.power + 0.4, 0]]),
    armL: track(t, [[0, 6], [S.power - 0.05, 6], [S.power + 0.2, 110, easeOutBack]]),
    armR: track(t, [[0, -6], [S.reach, -6], [S.pickup - 0.1, -30], [S.pickup + 0.05, -30], [S.inspect + 0.1, -152], [S.insert, -152],
      [S.plug - 0.15, -14], [S.plug + 0.05, -14], [S.plug + 0.3, -6]]),
    face: faceAt(t),
    lookX: track(t, [[0, 0], [S.glint, 0], [S.glint + 0.2, 22], [S.hops[2] + HOP, 22], [S.pickup, 12], [S.inspect, 6], [S.insert, 18], [S.plug, 0],
      [S.travel, 0], [S.travel + 0.2, 24]]),
    lookY: track(t, [[0, 8], [S.glint, 8], [S.glint + 0.2, 0], [S.reach, 0], [S.pickup, 18], [S.inspect, -8], [S.insert, 10], [S.plug, 0],
      [S.travel, 0], [S.travel + 0.2, 10]]),
    power,
    led: t < S.plug ? 0 : t < S.power ? power : 1,
    sat: track(t, [[0, 0.3], [S.power, 0.3], [S.power + 0.3, 0.6]]),
  };
}

// ═══ Cable, plug and the light that travels along it ═══

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const lerpV = (a: Vec, b: Vec, p: number): Vec => [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
const angleOf = (d: Vec) => (Math.atan2(d[1], d[0]) * 180) / Math.PI;

let plugFloor: Vec = [900, 1486];
const ANCHOR: Vec = [2300, 1440];   // the cable runs off to the right, towards the app

function robotPlugPose(t: number): { tip: Vec; dir: Vec } {
  const hand = robot.rightHand();
  const port = robot.port();
  if (t < S.pickup - 0.15) return { tip: plugFloor, dir: [-1, 0] };
  if (t < S.inspect) {
    const p = easeOutCubic(prog(t, S.pickup - 0.15, 0.15));
    return { tip: lerpV(plugFloor, add(hand, [-14, 26]), p), dir: [-1, 0] };
  }
  if (t < S.insert) {
    const a = lerp(180, 270, easeInOutCubic(prog(t, S.inspect, 0.35))) * Math.PI / 180;  // "what is this?"
    const dir: Vec = [Math.cos(a), Math.sin(a)];
    return { tip: add(hand, mul(dir, 34)), dir };
  }
  const a = lerp(270, 180, easeInOutCubic(prog(t, S.insert, 0.3))) * Math.PI / 180;
  const dir: Vec = [Math.cos(a), Math.sin(a)];
  return { tip: lerpV(add(hand, mul(dir, 34)), port, easeInOutCubic(prog(t, S.insert, S.plug - S.insert))), dir };
}

/** Cable from the back of the plug to the far anchor (cubic Bézier, sagging under gravity). */
function cableCurve(t: number): [Vec, Vec, Vec, Vec] {
  const pose = robotPlugPose(t);
  const back = add(pose.tip, mul(pose.dir, -124 * 0.9));
  const c1 = add(add(back, mul(pose.dir, -150)), [0, 90]);
  const c2 = add(ANCHOR, [-500, 60]);
  return [back, c1, c2, ANCHOR];
}
const bezier = ([p0, p1, p2, p3]: [Vec, Vec, Vec, Vec], u: number): Vec => {
  const v = 1 - u;
  return [
    v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0],
    v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1],
  ];
};

/** World position of the light: forms on the face, drops to the port, runs down the cable. */
function orbWorld(t: number): Vec {
  robot.apply(robotPose(t));
  const face = robot.faceCenter();
  const port = robot.port();
  if (t < S.travel) return lerpV(face, port, easeInOutCubic(prog(t, S.orb + 0.05, S.travel - S.orb - 0.05)));
  return bezier(cableCurve(t), easeInCubic(prog(t, S.travel, 0.6)) * 0.55);
}

function renderCable(t: number): void {
  const pose = robotPlugPose(t);
  robotPlug.setAttribute('transform', `translate(${pose.tip[0]} ${pose.tip[1]}) rotate(${angleOf(pose.dir)}) scale(0.9)`);
  const [b, c1, c2, a] = cableCurve(t);
  const d = `M${b[0]} ${b[1]} C${c1[0]} ${c1[1]} ${c2[0]} ${c2[1]} ${a[0]} ${a[1]}`;
  for (const p of cablePaths) p.setAttribute('d', d);
  cablePaths[0].setAttribute('opacity', String(t >= S.travel ? 0.55 * prog(t, S.travel, 0.2) : 0));

  // The plug catches the light: "something's there".
  const g = window01(t, S.glint, 0.12, S.glint + 0.3, 0.35);
  glint.setAttribute('opacity', String(g));
  glint.setAttribute('transform', `translate(${plugFloor[0] - 10} ${plugFloor[1] - 14}) scale(${0.4 + g * 0.8}) rotate(${t * 90})`);
  plugHalo.setAttribute('opacity', String(t >= S.glint && t < S.pickup ? 0.25 + 0.2 * Math.sin(t * 6) : 0));
  plugHalo.setAttribute('transform', 'translate(-60 0)');

  // Sparks fly from the port when it clicks in.
  const sp = t - S.plug;
  const port = robot.port();
  sparks.forEach((l, i) => {
    const life = 0.25 + rand(i * 13) * 0.35;
    if (sp < 0 || sp > life) { l.setAttribute('opacity', '0'); return; }
    const ang = (-150 + rand(i * 7 + 1) * 200) * Math.PI / 180, v = 380 + rand(i * 3 + 2) * 520;
    const at = (s: number): Vec => [port[0] + Math.cos(ang) * v * s, port[1] + Math.sin(ang) * v * s + 900 * s * s];
    const [x0, y0] = at(Math.max(0, sp - 0.035)), [x, y] = at(sp);
    l.setAttribute('x1', String(x0)); l.setAttribute('y1', String(y0)); l.setAttribute('x2', String(x)); l.setAttribute('y2', String(y));
    l.setAttribute('stroke-width', String(4 + rand(i) * 4));
    l.setAttribute('opacity', String(1 - sp / life));
  });
}

// ═══ Camera ═══

const CAM: Record<'cx' | 'cy' | 's', Key[]> = {
  cx: [[0, 470], [3.7, 430], [4.3, 560], [S.hops[0], 560], [S.hops[2] + HOP, 700], [S.plug, 720], [S.power, 720]],
  cy: [[0, 1150], [3.7, 1170], [S.plug, 1150], [S.power, 1150], [S.travel, 1180]],
  s: [[0, 1.18], [3.7, 1.3], [S.stand, 1.22], [S.hops[2] + HOP, 1.3], [S.plug - 0.4, 1.42], [S.power, 1.42], [S.whip, 1.15]],
};
function camera(t: number): { cx: number; cy: number; s: number } {
  let cx = track(t, CAM.cx), cy = track(t, CAM.cy);
  const s = track(t, CAM.s);
  if (t >= S.travel) cx = lerp(cx, orbWorld(t)[0] - 120, easeInOutCubic(prog(t, S.travel, 0.45)));   // follow the light
  const shake = t >= S.plug && t < S.power + 0.4 ? (t < S.power ? 4 : 12 * Math.exp(-(t - S.power) * 7)) : 0;
  cx += shake * (rand(Math.floor(t * 60)) - 0.5) * 2;
  cy += shake * (rand(Math.floor(t * 60) + 999) - 0.5) * 2;
  return { cx, cy, s };
}
const toStage = (cam: { cx: number; cy: number; s: number }, [x, y]: Vec): Vec =>
  [540 + (x - cam.cx) * cam.s, 960 + (y - cam.cy) * cam.s];

// ═══ Frame ═══

const WHIP = 0.26;   // whip pan length (s)

function renderStory(t: number): void {
  const cam = camera(t);
  world.style.transform = `translate(540px, 960px) scale(${cam.s}) translate(${-cam.cx}px, ${-cam.cy}px)`;
  robot.apply(robotPose(t));
  renderCable(t);

  fogA.style.transform = `translate(${-300 + Math.sin(t * 0.15) * 120}px, ${1100 + Math.cos(t * 0.11) * 60}px)`;
  fogB.style.transform = `translate(${100 + Math.cos(t * 0.13) * 140}px, ${500 + Math.sin(t * 0.09) * 80}px)`;
  for (const { d, i } of dust) {
    const sp = 10 + rand(i + 200) * 24;
    const x = (rand(i + 1) * 1180 - 50 + Math.sin(t * 0.4 + i) * 22) % 1180;
    const y = ((rand(i + 100) * 2000 - t * sp) % 2000 + 2000) % 2000 - 40;
    d.style.transform = `translate(${x}px, ${y}px)`;
  }
  black.style.opacity = String(1 - easeOutExpo(prog(t, 0, 1.0)));
}

function renderFrame(t: number): void {
  const w = easeInOutCubic(prog(t, S.whip, WHIP));
  const blur = Math.sin(Math.PI * w);

  // The story, until the whip pan carries us away from it.
  storyRoot.style.display = w < 1 ? 'block' : 'none';
  if (w < 1) {
    renderStory(Math.min(t, S.whip + WHIP));
    storyRoot.style.transform = `translateX(${-w * 1300}px)`;
    storyRoot.style.filter = blur > 0.01 ? `blur(${blur * 28}px)` : 'none';
  }

  // The app demo, arriving with the whip pan, then on its own (demo time = t − OFFSET).
  bragRoot.style.display = w > 0 ? 'block' : 'none';
  if (w > 0) {
    brag.render(t - OFFSET);
    bragRoot.style.transform = `translateX(${(1 - w) * 1300}px)`;
    bragRoot.style.filter = blur > 0.01 ? `blur(${blur * 28}px)` : 'none';
  }
  streaks.style.opacity = String(blur * 0.9);

  // The light: born on the robot's face, down the cable, through the whip, into the app's robot screen.
  const showOrb = t >= S.orb && t < S.arrive + 0.05;
  orb.style.display = showOrb ? 'block' : 'none';
  if (showOrb) {
    let pos: Vec, scale: number;
    if (t < S.whip) {
      pos = toStage(camera(t), orbWorld(t));
      scale = lerp(0.2, 1, easeOutBack(prog(t, S.orb, 0.25)));
    } else {
      const from = add(toStage(camera(S.whip), orbWorld(S.whip)), [-w * 1300, 0]);
      const to = brag.robotScreenOnStage();
      const p = easeInOutCubic(prog(t, S.whip + 0.08, S.arrive - S.whip - 0.08));
      pos = [lerp(from[0], to[0], p), lerp(from[1], to[1], p) - Math.sin(Math.PI * p) * 140];
      scale = lerp(1, 0.55, p);
    }
    const pulse = 1 + 0.08 * Math.sin(t * 40);
    orb.style.transform = `translate(${pos[0]}px, ${pos[1]}px) scale(${scale * pulse})`;
    orb.style.opacity = String(clamp01(prog(t, S.orb, 0.1)) * (1 - prog(t, S.arrive - 0.03, 0.08)));
  }
}

// ═══ Boot ═══

async function init(): Promise<void> {
  await brag.init();
  await document.fonts.ready;
  // The plug lies where the robot's hand will reach for it.
  robot.apply(robotPose(S.pickup - 0.1));
  const hand = robot.rightHand();
  plugFloor = [hand[0] - 14, 1486];
  renderFrame(0);
}

const win = window as unknown as { promoReady: Promise<void>; renderFrame: (t: number) => void; DURATION: number };
win.renderFrame = renderFrame;
win.DURATION = DURATION;
win.promoReady = init();
