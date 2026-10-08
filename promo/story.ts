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
  clamp01, easeInCubic, easeInOutCubic, easeInOutSine, easeOutBack, easeOutCubic, easeOutExpo,
  lerp, prog, rand, track, window01, type Key,
} from './lib/anim';
import { el, layer, stage, withParent } from './lib/dom';
import { FACE_STATES, type Face } from './lib/face';
import { Robot, type Arm, type Foot, type RobotPose } from './lib/robot';
import { DURATION, OFFSET, S, SWING, WALK, WALK_END, footfalls } from './story-score';

const SVGNS = 'http://www.w3.org/2000/svg';
type Vec = [number, number];

// ═══ Scenes: the demo underneath, the story on top, the travelling light above both ═══

const bragRoot = el('div', 'layer', stage());
const brag = createBrag(bragRoot, { focus: 'robot', hideHint: true });
const storyRoot = el('div', 'layer', stage());
const overlay = el('div', 'layer', stage());

const {
  world, cablePaths, robotPlug, plugClip, plugHalo, glint, sparks, puffs, robot, fogA, fogB, dust, black,
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
      <clipPath id="plug-clip"><rect class="plug-clip-rect" x="-600" y="-200" width="600" height="400"/></clipPath>
      <filter id="soft-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
    </defs>
    <g id="cable">
      <path class="cable-glow" fill="none" stroke="#5dff9f" stroke-width="26" stroke-linecap="round" filter="url(#soft-glow)" opacity="0"/>
      <path class="cable-base" fill="none" stroke="#1d1d1f" stroke-width="15" stroke-linecap="round"/>
      <path class="cable-hi" fill="none" stroke="#4a4a50" stroke-width="4" stroke-linecap="round" opacity=".7"/>
    </g>
    <g id="puffs"></g>
    <g id="robotLayer"></g>
    <g id="robotPlug">${plugMarkup()}<g class="plug-halo" opacity="0"><circle r="46" fill="#fff1b8" filter="url(#soft-glow)"/></g></g>
    <g id="glint" opacity="0"><path d="M0 -46 L9 -9 L46 0 L9 9 L0 46 L-9 9 L-46 0 L-9 -9 Z" fill="#fffbe6"/></g>
    <g id="sparks"></g>`;
  const puffsG = svg.querySelector<SVGGElement>('#puffs')!;
  const puffs = Array.from({ length: footfalls.length * 4 }, () => {
    const c = document.createElementNS(SVGNS, 'circle');
    c.setAttribute('fill', '#d6d6d6');
    puffsG.appendChild(c);
    return c;
  });
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
    world, sparks, puffs, dust, black, fogA, fogB,
    cablePaths: ['.cable-glow', '.cable-base', '.cable-hi'].map(s => svg.querySelector<SVGPathElement>(s)!),
    robotPlug: svg.querySelector<SVGGElement>('#robotPlug')!,
    plugClip: svg.querySelector<SVGRectElement>('.plug-clip-rect')!,
    plugHalo: svg.querySelector<SVGGElement>('.plug-halo')!,
    glint: svg.querySelector<SVGGElement>('#glint')!,
    robot: new Robot(svg.querySelector('#robotLayer')!),
  };
});

/** Plug: tip at (0,0) pointing +x; cable leaves from (−124, 0). */
function plugMarkup(): string {
  return `<g class="plug" clip-path="url(#plug-clip)">
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

const DOUBLE_TAKE = S.glint + 0.12;   // the startled little jolt when it notices the glint

/** Damped spring: an impulse of `amp` at each event time, ringing at `freq`. */
function spring(t: number, events: [number, number][], freq = 22, decay = 4.5): number {
  let v = 0;
  for (const [te, amp] of events) if (t >= te) v += amp * Math.exp(-(t - te) * decay) * Math.sin((t - te) * freq);
  return v;
}
/** Damped bob that starts at its full value (a weight settling). */
function settle(t: number, events: [number, number][], freq = 16, decay = 8): number {
  let v = 0;
  for (const [te, amp] of events) if (t >= te) v += amp * Math.exp(-(t - te) * decay) * Math.cos((t - te) * freq);
  return v;
}
const at = (times: readonly number[], amp: number): [number, number][] => times.map(x => [x, amp]);

// ── The walk: feet alternate (near foot first); each step lifts one foot, carries it
// forward with a heel-toe rock and plants it; the hips ride over the feet. ──

const STRIDE = (WALK.to - WALK.from) / (WALK.steps - 1);
const LIFT = 30;

interface WalkState { body: number; L: Foot; R: Foot; bob: number; phase: number }
function walk(t: number): WalkState {
  const pos = { L: 0, R: 0 }, foot = { L: { lift: 0, pitch: 0 }, R: { lift: 0, pitch: 0 } };
  for (let k = 0; k < WALK.steps; k++) {
    const side = k % 2 ? 'R' : 'L';
    const from = Math.max(0, (k - 1) * STRIDE), to = Math.min(k + 1, WALK.steps - 1) * STRIDE;
    const t0 = WALK.start + k * WALK.step, p = prog(t, t0, WALK.step * SWING);
    if (t < t0) break;
    pos[side] = lerp(from, to, easeInOutSine(p));
    if (p < 1) foot[side] = { lift: Math.sin(Math.PI * p) * LIFT * (k === 0 || k === WALK.steps - 1 ? 0.7 : 1), pitch: 16 * Math.sin(2 * Math.PI * p) };
  }
  const pelvis = (pos.L + pos.R) / 2;
  const phase = (t - WALK.start) / WALK.step;           // steps taken (continuous)
  const inWalk = Math.min(1, Math.max(0, phase) * 2, Math.max(0, WALK.steps - phase) * 2);
  // Hips dip as weight lands on a foot and rise as the other passes under.
  const bob = inWalk * 7 * Math.cos(2 * Math.PI * (phase - SWING));
  return {
    body: WALK.from + pelvis, bob, phase,
    L: { dx: pos.L - pelvis, ...foot.L }, R: { dx: pos.R - pelvis, ...foot.R },
  };
}

function squash(t: number): number {
  let q = 1;
  for (const f of footfalls) q -= 0.025 * window01(t, f, 0.03, f + 0.04, 0.12);   // weight landing
  q -= 0.1 * window01(t, S.plug - 0.14, 0.08, S.plug, 0.1);             // effort: shoving the plug home
  return q + (t >= S.power ? 0.14 * Math.exp(-(t - S.power) * 6) : 0); // jolt of power
}

// Moods, with natural blinks and a double take when the glint catches its eye.
const FACE_TRACK: [number, Face][] = [
  [0, 'sad'], [0.9, 'blink'], [1.06, 'sad'], [2.6, 'blink'], [2.78, 'sad'],
  [S.sigh - 0.05, 'blink'], [S.sigh + 0.3, 'sad'],
  [DOUBLE_TAKE - 0.06, 'blink'], [DOUBLE_TAKE + 0.02, 'wow'], [S.glint + 0.5, 'curious'],
  [5.55, 'blink'], [5.65, 'curious'], [6.85, 'blink'], [6.95, 'curious'],
  [S.inspect, 'wow'], [8.0, 'curious'], [8.12, 'blink'], [8.2, 'happy'], [S.insert + 0.2, 'curious'],
  [S.power, 'chord'], [S.orb + 0.15, 'blink'],
];
function faceAt(t: number): Face {
  let f: Face = 'sad';
  for (const [k, v] of FACE_TRACK) if (t >= k) f = v;
  return f;
}

/** The keyframed (forward-kinematics) pose; poseAt() adds the hand guiding the plug in. */
function robotPose(t: number): RobotPose {
  const w = walk(t);
  const walking = window01(t, WALK.start - 0.1, 0.2, WALK_END - 0.1, 0.25);
  const powered = t >= S.power;

  // Screen: dim and unsteady in the grey world; on plugging in the CRT collapses to
  // a flickering line, then opens out bright. Once its face has left, it goes dark.
  let power = t < S.plug ? 0.32 + 0.06 * Math.sin(t * 23) * Math.sin(t * 7)
    : t < S.power ? (rand(Math.floor(t * 30) + 7) > 0.4 ? 1 : 0.35) : 1;
  if (t >= S.orb) power = lerp(1, 0.12, prog(t, S.orb, 0.2));
  const crtOpen = track(t, [[S.plug, 1], [S.plug + 0.1, 0.03, easeInCubic], [S.power, 0.03], [S.power + 0.1, 1.08, easeOutCubic], [S.power + 0.18, 1]]);

  // Breathing: slow and heavy when sad (with one big sigh), quick and bright once alive.
  const breathe = (powered ? 1 + 0.022 * Math.sin((2 * Math.PI * t) / 0.55) : 1 + 0.016 * Math.sin((2 * Math.PI * t) / 2.8))
    + 0.06 * window01(t, S.sigh, 0.45, S.sigh + 0.55, 0.7);

  const sway = Math.sin(Math.PI * w.phase) * walking;   // weight shifting foot to foot
  return {
    x: w.body,
    y: 1500,
    s: 1,
    turn: track(t, [[WALK.start - 0.2, 0], [WALK.start + 0.08, 1], [WALK_END - 0.05, 1], [WALK_END + 0.25, 0]]),
    crouch: track(t, [[0, 1], [S.glint, 1], [DOUBLE_TAKE, 0.8, easeOutCubic], [DOUBLE_TAKE + 0.3, 1],
      [S.stand - 0.15, 1], [S.stand, 1.08], [S.stand + 0.45, 0, easeOutBack], [S.reach, 0], [S.pickup - 0.1, 1.05], [S.inspect, 0],
      [S.insert, 0], [S.plug - 0.12, 0.18], [S.plug, 0.1], [S.power, 0], [S.power + 0.06, -0.06], [S.power + 0.4, 0]]),
    bob: w.bob,
    footL: w.L, footR: w.R,
    squash: squash(t),
    // Lean: rocking while sitting, forward while walking, reaching for the plug, pushing it in, recoiling from the surge.
    lean: (t < S.stand ? 1.6 * Math.sin(t * 1.3) : 0) + walking * 5 + 1.5 * sway
      + track(t, [[S.sigh, 0], [S.sigh + 0.5, -2.5], [S.sigh + 1.1, 0], [S.reach, 0], [S.pickup - 0.1, 24], [S.pickup + 0.15, 12],
        [S.inspect, -2], [S.insert, 0], [S.plug - 0.12, 7], [S.plug, 3], [S.power, 0], [S.power + 0.06, -7], [S.power + 0.6, 0]]),
    breathe,
    tilt: track(t, [[0, 16], [S.sigh - 0.05, 16], [S.sigh + 0.3, 24], [S.sigh + 0.75, 15], [S.glint, 15], [DOUBLE_TAKE, -11, easeOutBack],
      [S.glint + 0.6, -6], [S.stand, -4], [WALK.start, 0], [S.reach, 0], [S.pickup - 0.1, 12], [S.inspect, -9], [8.0, -14], [8.2, 4], [S.insert, -2],
      [S.plug, 0], [S.power, -7], [S.power + 0.4, 0]]) + (t < S.stand ? 2 * Math.sin(t * 1.3 + 0.6) : 0) - 2.5 * sway,
    // The head lags behind the body: it sinks as each foot lands and settles; pops up at the surge.
    headY: settle(t, [...at(footfalls, 7), [S.sigh + 0.5, 8], [S.stand + 0.4, 10]])
      + track(t, [[0, 6], [S.glint, 6], [DOUBLE_TAKE, -8, easeOutCubic], [DOUBLE_TAKE + 0.3, 6], [S.stand, 6], [S.stand + 0.4, 0]])
      - 14 * (powered ? Math.exp(-(t - S.power) * 6) : 0),
    // Springy antenna: drooped when sad, perks up at the glint, rings with every footstep and bump.
    antenna: track(t, [[0, 16], [S.glint + 0.08, 16], [S.glint + 0.22, -4, easeOutBack], [S.glint + 0.5, 0]])
      + walking * -6 + spring(t, [[S.sigh + 0.1, 6], [DOUBLE_TAKE, -14], [S.stand + 0.45, 10], ...at(footfalls, -6),
        [S.pickup, 7], [S.inspect, -8], [S.plug, 16], [S.power, 28]]),
    // Arms swing against the legs while walking; celebrate (both up) when powered.
    armL: {
      a: track(t, [[0, 6], [S.plug, 6], [S.plug + 0.12, 40, easeOutCubic], [S.power - 0.05, 30], [S.power + 0.2, 145, easeOutBack]])
        + 0.4 * w.L.dx + spring(t, [[S.stand + 0.4, 8]], 14, 6),
      e: track(t, [[0, 4], [S.plug, 4], [S.power - 0.05, 10], [S.power + 0.2, 35, easeOutBack]]),
    },
    armR: {
      a: track(t, [[0, -6], [S.reach, -6], [S.pickup - 0.1, -22], [S.pickup + 0.05, -22], [S.inspect + 0.1, -150], [8.0, -138], [S.insert, -150],
        [S.plug + 0.14, -120, easeOutCubic], [S.power - 0.05, -110], [S.power + 0.2, -145, easeOutBack]])
        + 0.4 * w.R.dx - spring(t, [[S.stand + 0.4, 8]], 14, 6),
      e: track(t, [[0, -4], [S.reach, -4], [S.pickup - 0.1, 0], [S.pickup + 0.05, 0], [S.inspect + 0.1, -55], [8.0, -45], [S.insert, -55],
        [S.plug + 0.14, -40], [S.power - 0.05, -30], [S.power + 0.2, -35, easeOutBack]]),
    },
    face: faceAt(t),
    // Eyes: drift while sad, snap to the glint, look ahead while walking, dart around studying the plug.
    lookX: track(t, [[0, -6], [1.8, 4], [3.2, -4], [S.glint, -4], [DOUBLE_TAKE, 24, easeOutCubic], [WALK_END, 22],
      [S.pickup, 12], [S.inspect, 6], [7.85, -8], [7.95, 10], [8.1, 4], [S.insert, 18], [S.plug, 0], [S.travel, 0], [S.travel + 0.2, 24]]),
    lookY: track(t, [[0, 8], [S.glint, 8], [DOUBLE_TAKE, 0], [WALK.start, 0], [WALK.start + 0.3, 8], [WALK_END - 0.3, 8], [S.reach, 4], [S.pickup, 18],
      [S.inspect, -8], [7.85, -12], [S.insert, 10], [S.plug, 0], [S.travel, 0], [S.travel + 0.2, 10]]),
    crtOpen,
    shiver: t >= S.plug && t < S.power ? 2.5 * Math.sin(t * 120)
      : powered ? 8 * Math.exp(-(t - S.power) * 5) * Math.sin(t * 95) : 0,
    power,
    led: t < S.plug ? 0 : t < S.power ? power : 1,
    sat: track(t, [[0, 0.3], [S.power, 0.3], [S.power + 0.3, 0.6]]),
  };
}

const mixArm = (a: Arm, b: Arm, p: number): Arm => ({ a: lerp(a.a, b.a, p), e: lerp(a.e, b.e, p) });

/** Final pose at t (left applied to the robot): while plugging in, the right hand follows the plug. */
function poseAt(t: number): RobotPose {
  const pose = robotPose(t);
  robot.apply(pose);
  const guide = window01(t, S.insert, 0.12, S.plug, 0.12);
  if (guide > 0) {
    pose.armR = mixArm(pose.armR, robot.reachRight(plugPose(t).grip), easeInOutCubic(guide));
    robot.apply(pose);
  }
  return pose;
}

/** Little puffs of dust where each foot lands. */
function renderPuffs(t: number): void {
  puffs.forEach((c, k) => {
    const n = Math.floor(k / 4), i = k % 4;
    const land = footfalls[n], age = t - land;
    if (age < 0 || age > 0.5) { c.setAttribute('opacity', '0'); return; }
    poseAt(land);
    const [fx, fy] = robot.foot(n % 2 ? 'R' : 'L');
    const side = i % 2 ? 1 : -1, sp = 50 + rand(k * 5 + 1) * 70;
    const e = easeOutCubic(age / 0.5);
    c.setAttribute('cx', String(fx + side * (50 + e * sp)));
    c.setAttribute('cy', String(fy - 4 - e * (10 + rand(k * 3) * 22)));
    c.setAttribute('r', String(5 + e * (8 + rand(k) * 8)));
    c.setAttribute('opacity', String(0.4 * (1 - e)));
  });
}

// ═══ Cable, plug and the light that travels along it ═══

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const mul = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const lerpV = (a: Vec, b: Vec, p: number): Vec => [lerp(a[0], b[0], p), lerp(a[1], b[1], p)];
const angleOf = (d: Vec) => (Math.atan2(d[1], d[0]) * 180) / Math.PI;

let plugFloor: Vec = [900, 1486];
/** Where the plug's tip was, relative to the port, when the robot started guiding it in. */
let insertFrom: Vec = [60, -200];
const ANCHOR: Vec = [2300, 1440];   // the cable runs off to the right, towards the app
const PLUG_SCALE = 0.9;
const PLUG_LEN = 124;               // plug-local distance from the tip to where the cable leaves
const HELD = 34;                    // the hand grips the plug this far (world) behind the tip
// Plugging in: line up beside the socket, touch, a first push, then the shove home (clicks at S.plug).
const AIM = S.insert + 0.27, TOUCH = AIM + 0.1, PUSH = TOUCH + 0.08;

interface PlugPose { tip: Vec; dir: Vec; depth: number; grip: Vec }
/** The plug: lying on the floor, carried, then guided into the socket until it disappears inside. */
function plugPose(t: number): PlugPose {
  const held = (dir: Vec): PlugPose => {
    const hand = robot.rightHand();
    return { tip: add(hand, mul(dir, HELD)), dir, depth: 0, grip: hand };
  };
  if (t < S.pickup - 0.15) return { tip: plugFloor, dir: [-1, 0], depth: 0, grip: plugFloor };
  if (t < S.inspect) {
    const p = easeOutCubic(prog(t, S.pickup - 0.15, 0.15));
    const h = held([-1, 0]);
    return { ...h, tip: lerpV(plugFloor, h.tip, p) };
  }
  if (t < S.insert) {
    const a = lerp(180, 270, easeInOutCubic(prog(t, S.inspect, 0.35))) * Math.PI / 180;  // "what is this?"
    return held([Math.cos(a), Math.sin(a)]);
  }
  const port = robot.port();
  const a = lerp(270, 180, easeInOutCubic(prog(t, S.insert, AIM - S.insert))) * Math.PI / 180;
  const dir: Vec = [Math.cos(a), Math.sin(a)];
  const depth = t < PUSH ? 0 : track(t, [[PUSH, 0], [PUSH + 0.08, 55, easeOutCubic], [S.plug - 0.07, 55], [S.plug, PLUG_LEN, easeInCubic]]);
  const tip = t < AIM ? add(port, lerpV(insertFrom, [44, 0], easeInOutCubic(prog(t, S.insert, AIM - S.insert))))
    : t < TOUCH ? add(port, [lerp(44, 0, easeInOutCubic(prog(t, AIM, TOUCH - AIM))), 0])
    : add(port, mul(dir, PLUG_SCALE * depth));
  // The hand holds the plug's body, sliding back as it goes in, and finally presses at the socket.
  const grip = add(tip, mul(dir, -PLUG_SCALE * Math.max(HELD / PLUG_SCALE, depth + 18)));
  return { tip, dir, depth, grip };
}

/** Cable from the back of the plug to the far anchor (cubic Bézier, sagging under gravity). */
function cableCurve(t: number): [Vec, Vec, Vec, Vec] {
  const pose = plugPose(t);
  const back = add(pose.tip, mul(pose.dir, -PLUG_LEN * PLUG_SCALE));
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
  poseAt(t);
  const face = robot.faceCenter();
  const port = robot.port();
  if (t < S.travel) return lerpV(face, port, easeInOutCubic(prog(t, S.orb + 0.05, S.travel - S.orb - 0.05)));
  return bezier(cableCurve(t), easeInCubic(prog(t, S.travel, 0.6)) * 0.55);
}

function renderCable(t: number): void {
  const pose = plugPose(t);
  robotPlug.setAttribute('transform', `translate(${pose.tip[0]} ${pose.tip[1]}) rotate(${angleOf(pose.dir)}) scale(${PLUG_SCALE})`);
  // Whatever has gone into the socket is hidden: only the part outside it is drawn.
  plugClip.setAttribute('width', String(Math.max(0, 600 - pose.depth)));
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

  // Sparks fly from the socket when it clicks in.
  const sp = t - S.plug;
  const port = robot.port();
  sparks.forEach((l, i) => {
    const life = 0.25 + rand(i * 13) * 0.35;
    if (sp < 0 || sp > life) { l.setAttribute('opacity', '0'); return; }
    const ang = (-110 + rand(i * 7 + 1) * 160) * Math.PI / 180, v = 380 + rand(i * 3 + 2) * 520;
    const at = (s: number): Vec => [port[0] + 10 + Math.cos(ang) * v * s, port[1] + Math.sin(ang) * v * s + 900 * s * s];
    const [x0, y0] = at(Math.max(0, sp - 0.035)), [x, y] = at(sp);
    l.setAttribute('x1', String(x0)); l.setAttribute('y1', String(y0)); l.setAttribute('x2', String(x)); l.setAttribute('y2', String(y));
    l.setAttribute('stroke-width', String(4 + rand(i) * 4));
    l.setAttribute('opacity', String(1 - sp / life));
  });
}

// ═══ Camera ═══

const CAM: Record<'cx' | 'cy' | 's', Key[]> = {
  cx: [[0, 470], [3.7, 430], [4.3, 560], [WALK.start, 560], [WALK_END, 700], [S.plug, 720], [S.power, 720]],
  cy: [[0, 1150], [3.7, 1170], [S.plug, 1150], [S.power, 1150], [S.travel, 1180]],
  s: [[0, 1.18], [3.7, 1.3], [S.stand, 1.22], [WALK_END, 1.3], [S.plug - 0.4, 1.42], [S.power, 1.42], [S.whip, 1.15]],
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
  renderPuffs(t);
  poseAt(t);
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
  // Measuring the light's path re-poses the robot at other times; put this frame's pose back.
  if (w < 1) poseAt(Math.min(t, S.whip + WHIP));
}

// ═══ Boot ═══

async function init(): Promise<void> {
  await brag.init();
  await document.fonts.ready;
  // The plug lies where the robot's hand will reach for it…
  poseAt(S.pickup - 0.1);
  const hand = robot.rightHand();
  plugFloor = [hand[0] - 14, 1486];
  // …and is guided into the socket from wherever the hand held it.
  poseAt(S.insert - 1e-6);
  insertFrom = sub(plugPose(S.insert - 1e-6).tip, robot.port());
  renderFrame(0);
}

const win = window as unknown as { promoReady: Promise<void>; renderFrame: (t: number) => void; DURATION: number };
win.renderFrame = renderFrame;
win.DURATION = DURATION;
win.promoReady = init();
