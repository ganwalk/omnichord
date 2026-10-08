// ─── The robot character: an articulated SVG puppet ───
// Local coordinates: floor under the hips at (0, 0), up is −y; about 740 units
// tall (antenna tip at −734). Legs and arms are two-bone limbs (hip/knee/ankle,
// shoulder/elbow/hand) so it can walk, crouch and reach; the body can turn from
// facing the camera to a three-quarter view facing right (for walking).
//
// The upper body (torso, arms, head) is drawn in its own "upper" coordinates —
// hips at y = HIP — and sits on the legs.

import { crtDefs, crtScreen, showFace, type Face } from './face';

/** A foot, relative to the spot under its hip: forward offset, lift off the floor, pitch (deg). */
export interface Foot { dx: number; lift: number; pitch: number }
/** An arm: shoulder swing and elbow bend (deg). armL: + swings outward; armR: − swings outward. */
export interface Arm { a: number; e: number }

export interface RobotPose {
  x: number; y: number; s: number;   // floor point under the hips (world), scale
  turn: number;                      // 0 facing the camera … 1 three-quarter view facing right
  crouch: number;                    // 0 standing … 1 squatting (hips lowered, knees bent)
  bob: number;                       // extra hip drop while walking (local units, + down)
  footL: Foot; footR: Foot;
  squash: number;                    // upper body: 1 neutral, <1 squashed, >1 stretched
  lean: number;                      // upper-body lean from the hips (deg, + leans right)
  breathe: number;                   // torso breathing scale (1 = rest)
  tilt: number;                      // head tilt (deg)
  headY: number;                     // head lag / bob (local units, + down)
  antenna: number;                   // antenna bend (deg), for springy secondary motion
  armL: Arm; armR: Arm;
  face: Face;
  lookX: number; lookY: number;      // eye direction (face units)
  crtOpen: number;                   // 1 open picture … 0 collapsed to a line (CRT on/off)
  shiver: number;                    // power-surge vibration (local units)
  power: number;                     // screen brightness 0…1
  led: number;                       // antenna light 0…1
  sat: number;                       // colour saturation 0…1 (grey world → colour)
}

// Upper-body coordinates
const HIP = -100;                    // hip pivot (lean, breathing, squash)
const UP = -40;                      // upper body sits this far above HIP on straight legs
const SHOULDER_Y = -290;
const NECK: [number, number] = [0, -352];
const HEAD_C: [number, number] = [0, -474];
const ANTENNA_BASE: [number, number] = [0, -600];
/** Cable socket: a collar sticking out of the right side of the torso; the plug slides in from the right. */
export const PORT_Y = -206;
const PORT_FACE = 152;
// Depths used to fake the three-quarter turn (torso and head are boxes)
const TORSO_W = 260, TORSO_D = 120, HEAD_W = 340, HEAD_D = 150;
const MAX_TURN = (38 * Math.PI) / 180;
// Limbs
const HIP_X = 58, THIGH = 66, SHIN = 64, ANKLE = 18, CROUCH_DROP = 72;
const UPPER_ARM = 65, FOREARM = 65;

const SVGNS = 'http://www.w3.org/2000/svg';
const deg = (r: number) => (r * 180) / Math.PI;
const rad = (d: number) => (d * Math.PI) / 180;
type Vec = [number, number];

export class Robot {
  readonly root: SVGGElement;
  private readonly q: <T extends Element>(sel: string) => T;
  private pose!: RobotPose;

  constructor(parent: SVGElement, private readonly p = 'rb') {
    const defs = document.createElementNS(SVGNS, 'defs');
    defs.innerHTML = `
      <linearGradient id="${p}-shell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b47a4e"/><stop offset=".55" stop-color="#8c5634"/><stop offset="1" stop-color="#6a3e22"/>
      </linearGradient>
      <linearGradient id="${p}-side" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6e4428"/><stop offset=".55" stop-color="#523018"/><stop offset="1" stop-color="#3a200e"/>
      </linearGradient>
      <linearGradient id="${p}-shell-h" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#000" stop-opacity=".25"/><stop offset=".25" stop-color="#fff" stop-opacity=".07"/>
        <stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/>
      </linearGradient>
      <linearGradient id="${p}-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f3d58a"/><stop offset=".5" stop-color="#d0a24c"/><stop offset="1" stop-color="#8a6420"/>
      </linearGradient>
      <radialGradient id="${p}-bulb" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#d8ffe6"/><stop offset=".45" stop-color="#5dff9f"/><stop offset="1" stop-color="#0a8a3a"/></radialGradient>
      <filter id="${p}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
      ${crtDefs(p)}`;
    parent.appendChild(defs);

    this.root = document.createElementNS(SVGNS, 'g');
    this.root.innerHTML = `
      <ellipse class="shadow" cx="0" cy="0" rx="170" ry="24" fill="#000" opacity=".35"/>
      <g class="legR">${leg()}</g>
      <g class="legL">${leg()}</g>
      <g class="upper">
        <g class="arm-back"></g>
        <rect x="-26" y="-356" width="52" height="30" rx="8" fill="#4a2b17"/>
        <rect class="torso-side" y="-330" height="244" rx="34" fill="url(#${p}-side)" stroke="#3b200f" stroke-width="7"/>
        <g class="torso-front">
          <rect x="${PORT_FACE - 30}" y="${PORT_Y - 22}" width="30" height="44" rx="6" fill="url(#${p}-gold)" stroke="#5a3a12" stroke-width="4"/>
          <rect x="${PORT_FACE - 8}" y="${PORT_Y - 15}" width="8" height="30" rx="3" fill="#120904"/>
          <rect x="-130" y="-330" width="260" height="244" rx="42" fill="url(#${p}-shell)" stroke="#3b200f" stroke-width="7"/>
          <rect x="-130" y="-330" width="260" height="244" rx="42" fill="url(#${p}-shell-h)"/>
          <path d="M-104 -146 H104" stroke="#4e2d18" stroke-width="5" stroke-linecap="round" opacity=".7"/>
          <g fill="#3a2010">${grille()}</g>
          <circle cx="72" cy="-276" r="19" fill="url(#${p}-gold)" stroke="#5a3a12" stroke-width="4"/>
          <path d="M72 -276 L72 -292" stroke="#5a3a12" stroke-width="5" stroke-linecap="round"/>
          <circle cx="72" cy="-226" r="12" fill="url(#${p}-gold)" stroke="#5a3a12" stroke-width="3"/>
          <rect x="-46" y="-128" width="92" height="28" rx="7" fill="url(#${p}-gold)" stroke="#5a3a12" stroke-width="3"/>
          <text x="0" y="-107" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="18" fill="#3a2508">OH-1</text>
        </g>
        <g class="armL">${arm()}</g>
        <g class="arm-front"><g class="armR">${arm()}</g></g>
        <g class="head">
          <g class="antenna">
            <path d="M0 -600 L0 -662" stroke="#3b200f" stroke-width="9" stroke-linecap="round"/>
            <circle class="bulb-glow" cx="0" cy="-676" r="34" fill="#5dff9f" filter="url(#${p}-soft)" opacity="0"/>
            <circle class="bulb" cx="0" cy="-676" r="17" fill="#2c2c2c" stroke="#3b200f" stroke-width="5"/>
          </g>
          <circle class="ear-far" cy="-474" r="22" fill="#4a2b17" stroke="#3b200f" stroke-width="5"/>
          <rect class="head-side" y="-604" height="256" rx="40" fill="url(#${p}-side)" stroke="#3b200f" stroke-width="7"/>
          <circle class="ear-near" cy="-474" r="22" fill="#4a2b17" stroke="#3b200f" stroke-width="5"/>
          <g class="head-front">
            <rect x="-170" y="-604" width="340" height="256" rx="58" fill="url(#${p}-shell)" stroke="#3b200f" stroke-width="7"/>
            <rect x="-170" y="-604" width="340" height="256" rx="58" fill="url(#${p}-shell-h)"/>
            <g class="screen" transform="translate(${HEAD_C[0]} ${HEAD_C[1]}) scale(0.68) translate(-256 -256)">${crtScreen(p)}
              <rect class="crt-line" x="96" y="250" width="320" height="12" rx="6" fill="#d8ffe6" opacity="0" filter="url(#${p}-glow)"/>
            </g>
          </g>
        </g>
      </g>`;
    parent.appendChild(this.root);
    this.q = <T extends Element>(sel: string) => this.root.querySelector(sel) as T;
  }

  apply(pose: RobotPose): void {
    this.pose = pose;
    const q = this.q;
    const { ca, sa } = this.turnCS();
    const [sx, sy] = squashScale(pose.squash);
    const b = pose.breathe;
    const drop = UP + CROUCH_DROP * pose.crouch + pose.bob;

    this.root.setAttribute('transform', `translate(${pose.x} ${pose.y}) scale(${pose.s})`);
    this.root.style.filter = `saturate(${pose.sat}) brightness(${0.75 + 0.25 * pose.sat})`;

    // Legs (two-bone IK from hip to ankle); the far leg is a shade darker when turned.
    const [aL, aR] = (['L', 'R'] as const).map(side => this.drawLeg(side));
    const shadow = q<SVGEllipseElement>('.shadow');
    const lift = Math.max(pose.footL.lift, pose.footR.lift);
    shadow.setAttribute('cx', String((aL[0] + aR[0]) / 2));
    shadow.setAttribute('rx', String(150 + 0.5 * Math.abs(aL[0] - aR[0]) - lift * 0.4));
    q<SVGGElement>('.legR').style.filter = `brightness(${1 - 0.28 * sa})`;

    // Upper body: sits on the hips; leans, breathes and squashes around them.
    q<SVGGElement>('.upper').setAttribute('transform',
      `translate(0 ${drop}) rotate(${pose.lean} 0 ${HIP}) translate(0 ${HIP}) scale(${(2 - b) * sx} ${b * sy}) translate(0 ${-HIP})`);
    // Three-quarter turn: front faces narrow and slide right, side faces open on the left.
    q<SVGGElement>('.torso-front').setAttribute('transform', `translate(${(TORSO_D / 2) * sa} 0) scale(${ca} 1)`);
    const ts = q<SVGRectElement>('.torso-side');
    ts.setAttribute('x', String(-(TORSO_W / 2) * ca - (TORSO_D / 2) * sa));
    ts.setAttribute('width', String(Math.max(0.01, TORSO_D * sa + 60 * sa)));
    ts.style.display = sa > 0.01 ? 'inline' : 'none';
    q<SVGGElement>('.head-front').setAttribute('transform', `translate(${(HEAD_D / 2) * sa} 0) scale(${ca} 1)`);
    const hs = q<SVGRectElement>('.head-side');
    hs.setAttribute('x', String(-(HEAD_W / 2) * ca - (HEAD_D / 2) * sa));
    hs.setAttribute('width', String(Math.max(0.01, HEAD_D * sa + 70 * sa)));
    hs.style.display = sa > 0.01 ? 'inline' : 'none';
    q<SVGCircleElement>('.ear-near').setAttribute('cx', String(-(HEAD_W / 2 + 2) * ca - 6 * sa));
    q<SVGCircleElement>('.ear-far').setAttribute('cx', String((HEAD_W / 2 + 2) * ca));

    // Arms: the far (right) arm goes behind the body once it turns.
    const armR = q<SVGGElement>('.armR');
    const slot = q<SVGGElement>(sa > 0.25 ? '.arm-back' : '.arm-front');
    if (armR.parentNode !== slot) slot.appendChild(armR);
    armR.style.filter = `brightness(${1 - 0.3 * sa})`;
    this.drawArm(q('.armL'), -1, pose.armL);
    this.drawArm(armR, 1, pose.armR);

    q<SVGGElement>('.head').setAttribute('transform', `translate(${pose.shiver} ${pose.headY}) rotate(${pose.tilt} ${NECK[0]} ${NECK[1]})`);
    q<SVGGElement>('.antenna').setAttribute('transform', `rotate(${pose.antenna} ${ANTENNA_BASE[0]} ${ANTENNA_BASE[1]})`);

    // Screen
    const screen = q<SVGGElement>('.screen'), face = q<SVGGElement>('.face'), line = q<SVGRectElement>('.crt-line');
    showFace(screen, pose.face);
    // CRT: the picture collapses to a bright line when it switches off, and opens out of it.
    const open = Math.max(0.02, pose.crtOpen);
    face.setAttribute('transform', `translate(${pose.lookX} ${pose.lookY}) translate(256 256) scale(${1 + (1 - open) * 0.15} ${open}) translate(-256 -256)`);
    line.setAttribute('opacity', String(pose.crtOpen < 0.98 ? (1 - open) * pose.power : 0));
    line.setAttribute('transform', `translate(256 256) scale(${0.3 + 0.7 * open + (1 - open) * 0.4} 1) translate(-256 -256)`);
    face.style.opacity = String(0.18 + 0.82 * pose.power);
    screen.style.filter = `brightness(${0.45 + 0.75 * pose.power})`;
    const bulb = q<SVGCircleElement>('.bulb');
    bulb.setAttribute('fill', pose.led > 0.02 ? `url(#${this.p}-bulb)` : '#2c2c2c');
    bulb.style.opacity = String(0.35 + 0.65 * pose.led);
    q<SVGCircleElement>('.bulb-glow').setAttribute('opacity', String(0.9 * pose.led));
  }

  private turnCS(): { ca: number; sa: number } {
    const a = MAX_TURN * this.pose.turn;
    return { ca: Math.cos(a), sa: Math.sin(a) };
  }

  /** Hip and ankle of a leg, in root coordinates. */
  private legEnds(side: 'L' | 'R'): [Vec, Vec] {
    const { ca } = this.turnCS();
    const foot = side === 'L' ? this.pose.footL : this.pose.footR;
    const hx = (side === 'L' ? -HIP_X : HIP_X) * ca;
    const hy = HIP + UP + CROUCH_DROP * this.pose.crouch + this.pose.bob;
    return [[hx, hy], [hx + foot.dx, -ANKLE - foot.lift]];
  }

  private drawLeg(side: 'L' | 'R'): Vec {
    const { sa } = this.turnCS();
    const [hip, ankle] = this.legEnds(side);
    // Knees bend forward: towards the camera when facing it (with a little outward bow), to the right when turned.
    const bend = sa + 0.3 * (1 - sa) * (side === 'L' ? -1 : 1);
    const knee = solveJoint(hip, ankle, THIGH, SHIN, [Math.sign(bend) || 1, 0], Math.abs(bend));
    const g = this.q<SVGGElement>(`.leg${side}`);
    const set = (sel: string, a: Vec, b: Vec) => g.querySelectorAll<SVGLineElement>(sel).forEach(l => {
      l.setAttribute('x1', String(a[0])); l.setAttribute('y1', String(a[1]));
      l.setAttribute('x2', String(b[0])); l.setAttribute('y2', String(b[1]));
    });
    set('.thigh', hip, knee);
    set('.shin', knee, ankle);
    const kc = g.querySelector<SVGCircleElement>('.knee')!;
    kc.setAttribute('cx', String(knee[0])); kc.setAttribute('cy', String(knee[1]));
    // Boot: wider and pointing right when turned; rocks heel-toe while stepping.
    const foot = side === 'L' ? this.pose.footL : this.pose.footR;
    const w = 88 * (1 - sa) + 118 * sa;
    const boot = g.querySelector<SVGRectElement>('.boot')!;
    boot.setAttribute('x', String(-w / 2 + 22 * sa));
    boot.setAttribute('width', String(w));
    g.querySelector<SVGGElement>('.foot')!.setAttribute('transform', `translate(${ankle[0]} ${ankle[1]}) rotate(${foot.pitch * sa})`);
    return ankle;
  }

  private drawArm(g: SVGGElement, side: 1 | -1, arm: Arm): void {
    const [sx, sy] = this.shoulder(side);
    g.setAttribute('transform', `translate(${sx} ${sy}) rotate(${arm.a})`);
    g.querySelector<SVGGElement>('.forearm')!.setAttribute('transform', `translate(0 ${UPPER_ARM}) rotate(${arm.e})`);
  }

  /** Shoulder joint in upper coordinates. */
  private shoulder(side: 1 | -1): Vec {
    const { ca } = this.turnCS();
    return [side * (3 + (TORSO_W / 2) * ca), SHOULDER_Y];
  }

  /** Upper-body coordinates → world. */
  private upperToWorld([ux, uy]: Vec): Vec {
    const { x, y, s, lean, breathe: b, crouch, bob } = this.pose;
    const [sx, sy] = squashScale(this.pose.squash);
    const bx = ux * (2 - b) * sx, by = (uy - HIP) * b * sy;
    const a = rad(lean);
    const tx = bx * Math.cos(a) - by * Math.sin(a);
    const ty = bx * Math.sin(a) + by * Math.cos(a) + HIP + UP + CROUCH_DROP * crouch + bob;
    return [x + s * tx, y + s * ty];
  }

  /** World → upper-body coordinates (inverse of upperToWorld). */
  private worldToUpper([wx, wy]: Vec): Vec {
    const { x, y, s, lean, breathe: b, crouch, bob } = this.pose;
    const [sx, sy] = squashScale(this.pose.squash);
    const tx = (wx - x) / s, ty = (wy - y) / s - (HIP + UP + CROUCH_DROP * crouch + bob);
    const a = rad(lean);
    const bx = tx * Math.cos(a) + ty * Math.sin(a), by = -tx * Math.sin(a) + ty * Math.cos(a);
    return [bx / ((2 - b) * sx), by / (b * sy) + HIP];
  }

  /** Hand position (upper coordinates) for an arm pose. */
  private handUpper(side: 1 | -1, arm: Arm): Vec {
    const [sx, sy] = this.shoulder(side);
    const a1 = rad(90 + arm.a), a2 = rad(90 + arm.a + arm.e);
    return [sx + UPPER_ARM * Math.cos(a1) + FOREARM * Math.cos(a2), sy + UPPER_ARM * Math.sin(a1) + FOREARM * Math.sin(a2)];
  }

  /** World position of the right hand (holds the plug). */
  rightHand(): Vec { return this.upperToWorld(this.handUpper(1, this.pose.armR)); }

  /** Arm angles that put the right hand on a world point (elbow pointing down/out). */
  reachRight(target: Vec): Arm {
    const sh = this.shoulder(1);
    const tgt = this.worldToUpper(target);
    const elbow = solveJoint(sh, tgt, UPPER_ARM, FOREARM, [0.4, 1]);
    const reach = Math.min(Math.hypot(tgt[0] - sh[0], tgt[1] - sh[1]), UPPER_ARM + FOREARM - 0.01);
    const dir = Math.atan2(tgt[1] - sh[1], tgt[0] - sh[0]);
    const hand: Vec = [sh[0] + reach * Math.cos(dir), sh[1] + reach * Math.sin(dir)];
    const t1 = deg(Math.atan2(elbow[1] - sh[1], elbow[0] - sh[0]));
    const t2 = deg(Math.atan2(hand[1] - elbow[1], hand[0] - elbow[0]));
    return { a: t1 - 90, e: wrap(t2 - t1) };
  }

  /** World position of the socket's opening (where the plug goes in), and the insertion direction. */
  port(): Vec {
    const { ca, sa } = this.turnCS();
    return this.upperToWorld([PORT_FACE * ca + (TORSO_D / 2) * sa, PORT_Y]);
  }

  /** World position of the face (follows the head's tilt and bob). */
  faceCenter(): Vec {
    const { sa } = this.turnCS();
    const a = rad(this.pose.tilt);
    const dx = HEAD_C[0] + (HEAD_D / 2) * sa - NECK[0], dy = HEAD_C[1] - NECK[1];
    return this.upperToWorld([
      NECK[0] + dx * Math.cos(a) - dy * Math.sin(a) + this.pose.shiver,
      NECK[1] + dx * Math.sin(a) + dy * Math.cos(a) + this.pose.headY,
    ]);
  }

  /** World position of a foot's sole. */
  foot(side: 'L' | 'R'): Vec {
    const [, ankle] = this.legEnds(side);
    const { x, y, s } = this.pose;
    return [x + s * ankle[0], y + s * (ankle[1] + ANKLE)];
  }

  get scale(): number { return this.pose.s; }
}

const squashScale = (q: number): [number, number] => [1 + (1 - q) * 0.6, q];
const wrap = (d: number) => ((d + 540) % 360) - 180;

/**
 * Two-bone IK: the middle joint between `a` and `b` for bone lengths l1, l2.
 * The joint bends towards `prefer`; `amount` (0…1) scales the sideways offset
 * (a knee bending towards the camera shows none).
 */
function solveJoint(a: Vec, b: Vec, l1: number, l2: number, prefer: Vec, amount = 1): Vec {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const d = Math.max(1, Math.min(Math.hypot(vx, vy), l1 + l2 - 0.01));
  const len = Math.hypot(vx, vy) || 1e-9;
  const ux = vx / len, uy = vy / len;
  const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  const flip = -uy * prefer[0] + ux * prefer[1] >= 0 ? 1 : -1;
  const n: Vec = [-uy * flip, ux * flip];
  const k = h * amount;
  return [a[0] + ux * along + n[0] * k, a[1] + uy * along + n[1] * k];
}

function leg(): string {
  return `
    <line class="thigh" stroke="#2e180a" stroke-width="40" stroke-linecap="round"/>
    <line class="shin" stroke="#2e180a" stroke-width="38" stroke-linecap="round"/>
    <line class="thigh" stroke="#4a2b17" stroke-width="30" stroke-linecap="round"/>
    <line class="shin" stroke="#4a2b17" stroke-width="28" stroke-linecap="round"/>
    <circle class="knee" r="17" fill="#5e3820" stroke="#2e180a" stroke-width="5"/>
    <g class="foot"><rect class="boot" y="-16" height="34" rx="16" fill="#5e3820" stroke="#2e180a" stroke-width="5"/></g>`;
}

/** An arm in shoulder-local coordinates, hanging down (+y); the forearm hinges at the elbow. */
function arm(): string {
  return `
    <line x1="0" y1="0" x2="0" y2="${UPPER_ARM}" stroke="#2e180a" stroke-width="38" stroke-linecap="round"/>
    <line x1="0" y1="0" x2="0" y2="${UPPER_ARM}" stroke="#5e3820" stroke-width="28" stroke-linecap="round"/>
    <circle r="20" fill="#4a2b17" stroke="#2e180a" stroke-width="5"/>
    <g class="forearm">
      <line x1="0" y1="0" x2="0" y2="${FOREARM}" stroke="#2e180a" stroke-width="36" stroke-linecap="round"/>
      <line x1="0" y1="0" x2="0" y2="${FOREARM}" stroke="#5e3820" stroke-width="26" stroke-linecap="round"/>
      <circle r="15" fill="#4a2b17" stroke="#2e180a" stroke-width="4"/>
      <circle cy="${FOREARM}" r="27" fill="#4a2b17" stroke="#2e180a" stroke-width="5"/>
      <path d="M-12 ${FOREARM + 18} q12 14 24 0" stroke="#2e180a" stroke-width="5" fill="none" stroke-linecap="round"/>
    </g>`;
}

function grille(): string {
  let out = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out += `<circle cx="${-96 + c * 20}" cy="${-292 + r * 22}" r="6.5"/>`;
  return out;
}
