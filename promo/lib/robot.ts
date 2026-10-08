// ─── The robot character: an articulated SVG puppet ───
// Local coordinates: feet center at (0, 0), up is −y. About 680 units tall
// (antenna tip at −690). Every joint is posed per frame from a RobotPose.

import { crtDefs, crtScreen, showFace, type Face } from './face';

export interface RobotPose {
  x: number; y: number; s: number;   // feet position in the world, scale
  hop: number;                       // lift off the floor (local units)
  squash: number;                    // 1 neutral, <1 squashed, >1 stretched
  crouch: number;                    // 0 standing … 1 sitting
  lean: number;                      // upper-body lean from the hips (deg, + leans right); feet stay planted
  breathe: number;                   // torso breathing scale (1 = rest)
  tilt: number;                      // head tilt (deg)
  headY: number;                     // head lag / bob (local units, + down)
  antenna: number;                   // antenna bend (deg), for springy secondary motion
  armL: number; armR: number;        // arm swing (deg); +L / −R raise them outward
  legTuck: number;                   // 0…1 legs pulled up mid-air
  face: Face;
  lookX: number; lookY: number;      // eye direction (face units)
  crtOpen: number;                   // 1 open picture … 0 collapsed to a line (CRT on/off)
  shiver: number;                    // power-surge vibration (local units)
  power: number;                     // screen brightness 0…1
  led: number;                       // antenna light 0…1
  sat: number;                       // colour saturation 0…1 (grey world → colour)
}

const SHOULDER_L: [number, number] = [-130, -290];
const SHOULDER_R: [number, number] = [130, -290];
const HAND_R: [number, number] = [133, -160];
/** Cable port: low on the right side, below the hanging hand, so the arm never covers the plug. */
const PORT: [number, number] = [131, -112];
const NECK: [number, number] = [0, -352];
const HEAD_C: [number, number] = [0, -474];
const ANTENNA_BASE: [number, number] = [0, -600];

const SVGNS = 'http://www.w3.org/2000/svg';

export class Robot {
  readonly root: SVGGElement;
  private readonly shadow: SVGEllipseElement;
  private readonly body: SVGGElement;
  private readonly legs: SVGGElement;
  private readonly torso: SVGGElement;
  private readonly head: SVGGElement;
  private readonly antenna: SVGGElement;
  private readonly crtLine: SVGRectElement;
  private readonly screen: SVGGElement;
  private readonly face: SVGGElement;
  private readonly armLEl: SVGGElement;
  private readonly armREl: SVGGElement;
  private readonly bulb: SVGCircleElement;
  private readonly bulbGlow: SVGCircleElement;
  private pose!: RobotPose;

  constructor(parent: SVGElement, private readonly p = 'rb') {
    const defs = document.createElementNS(SVGNS, 'defs');
    defs.innerHTML = `
      <linearGradient id="${p}-shell" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#b47a4e"/><stop offset=".55" stop-color="#8c5634"/><stop offset="1" stop-color="#6a3e22"/>
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
      <ellipse class="shadow" cx="0" cy="0" rx="160" ry="24" fill="#000" opacity=".35"/>
      <g class="body">
        <g class="legs">
          ${leg(-70)}${leg(70)}
        </g>
        <g class="torso">
          <rect x="-26" y="-356" width="52" height="30" rx="8" fill="#4a2b17"/>
          <rect x="-130" y="-330" width="260" height="244" rx="42" fill="url(#${p}-shell)" stroke="#3b200f" stroke-width="7"/>
          <rect x="-130" y="-330" width="260" height="244" rx="42" fill="url(#${p}-shell-h)"/>
          <path d="M-104 -146 H104" stroke="#4e2d18" stroke-width="5" stroke-linecap="round" opacity=".7"/>
          <g fill="#3a2010">${grille()}</g>
          <circle cx="72" cy="-276" r="19" fill="url(#${p}-gold)" stroke="#5a3a12" stroke-width="4"/>
          <path d="M72 -276 L72 -292" stroke="#5a3a12" stroke-width="5" stroke-linecap="round"/>
          <circle cx="72" cy="-226" r="12" fill="url(#${p}-gold)" stroke="#5a3a12" stroke-width="3"/>
          <rect x="-46" y="-128" width="92" height="28" rx="7" fill="url(#${p}-gold)" stroke="#5a3a12" stroke-width="3"/>
          <text x="0" y="-107" text-anchor="middle" font-family="Unbounded, sans-serif" font-weight="800" font-size="18" fill="#3a2508">OH-1</text>
          <circle cx="${PORT[0]}" cy="${PORT[1]}" r="17" fill="#1a0e06" stroke="url(#${p}-gold)" stroke-width="6"/>
          <circle cx="${PORT[0]}" cy="${PORT[1]}" r="6" fill="#000"/>
          <g class="armL">${arm(-1)}</g>
          <g class="armR">${arm(1)}</g>
          <g class="head">
            <g class="antenna">
              <path d="M0 -600 L0 -662" stroke="#3b200f" stroke-width="9" stroke-linecap="round"/>
              <circle class="bulb-glow" cx="0" cy="-676" r="34" fill="#5dff9f" filter="url(#${p}-soft)" opacity="0"/>
              <circle class="bulb" cx="0" cy="-676" r="17" fill="#2c2c2c" stroke="#3b200f" stroke-width="5"/>
            </g>
            <circle cx="-172" cy="-474" r="22" fill="#4a2b17" stroke="#3b200f" stroke-width="5"/>
            <circle cx="172" cy="-474" r="22" fill="#4a2b17" stroke="#3b200f" stroke-width="5"/>
            <rect x="-170" y="-604" width="340" height="256" rx="58" fill="url(#${p}-shell)" stroke="#3b200f" stroke-width="7"/>
            <rect x="-170" y="-604" width="340" height="256" rx="58" fill="url(#${p}-shell-h)"/>
            <g class="screen" transform="translate(${HEAD_C[0]} ${HEAD_C[1]}) scale(0.68) translate(-256 -256)">${crtScreen(p)}
              <rect class="crt-line" x="96" y="250" width="320" height="12" rx="6" fill="#d8ffe6" opacity="0" filter="url(#${p}-glow)"/>
            </g>
          </g>
        </g>
      </g>`;
    parent.appendChild(this.root);

    const q = <T extends Element>(sel: string) => this.root.querySelector(sel) as T;
    this.shadow = q('.shadow');
    this.body = q('.body');
    this.legs = q('.legs');
    this.torso = q('.torso');
    this.head = q('.head');
    this.antenna = q('.antenna');
    this.crtLine = q('.crt-line');
    this.screen = q('.screen');
    this.face = q('.face');
    this.armLEl = q('.armL');
    this.armREl = q('.armR');
    this.bulb = q('.bulb');
    this.bulbGlow = q('.bulb-glow');
  }

  apply(pose: RobotPose): void {
    this.pose = pose;
    const { x, y, s, hop, crouch, tilt } = pose;
    const [sx, sy] = squashScale(pose.squash);
    const legScale = 1 - 0.5 * crouch;
    const drop = 92 * (1 - legScale);

    this.root.setAttribute('transform', `translate(${x} ${y}) scale(${s})`);
    this.root.style.filter = `saturate(${pose.sat}) brightness(${0.75 + 0.25 * pose.sat})`;
    this.shadow.setAttribute('rx', String(160 * (1 - Math.min(hop, 300) / 600)));
    this.shadow.setAttribute('opacity', String(0.35 * (1 - Math.min(hop, 300) / 450)));
    this.body.setAttribute('transform', `translate(0 ${-hop}) scale(${sx} ${sy})`);
    // Legs pull up mid-air; the torso sits on them and breathes from the hips.
    this.legs.setAttribute('transform', `translate(0 ${-pose.legTuck * 22}) scale(1 ${legScale * (1 - pose.legTuck * 0.28)})`);
    const hip = -86;
    this.torso.setAttribute('transform', `translate(0 ${drop - pose.legTuck * 22}) rotate(${pose.lean} 0 ${hip}) translate(0 ${hip}) scale(${2 - pose.breathe} ${pose.breathe}) translate(0 ${-hip})`);
    this.head.setAttribute('transform', `translate(${pose.shiver} ${pose.headY}) rotate(${tilt} ${NECK[0]} ${NECK[1]})`);
    this.antenna.setAttribute('transform', `rotate(${pose.antenna} ${ANTENNA_BASE[0]} ${ANTENNA_BASE[1]})`);
    this.armLEl.setAttribute('transform', `rotate(${pose.armL} ${SHOULDER_L[0]} ${SHOULDER_L[1]})`);
    this.armREl.setAttribute('transform', `rotate(${pose.armR} ${SHOULDER_R[0]} ${SHOULDER_R[1]})`);

    showFace(this.screen, pose.face);
    // CRT: the picture collapses to a bright line when it switches off, and opens out of it.
    const open = Math.max(0.02, pose.crtOpen);
    this.face.setAttribute('transform', `translate(${pose.lookX} ${pose.lookY}) translate(256 256) scale(${1 + (1 - open) * 0.15} ${open}) translate(-256 -256)`);
    this.crtLine.setAttribute('opacity', String(pose.crtOpen < 0.98 ? (1 - open) * pose.power : 0));
    this.crtLine.setAttribute('transform', `translate(256 256) scale(${0.3 + 0.7 * open + (1 - open) * 0.4} 1) translate(-256 -256)`);
    this.face.style.opacity = String(0.18 + 0.82 * pose.power);
    this.screen.style.filter = `brightness(${0.45 + 0.75 * pose.power})`;
    this.bulb.setAttribute('fill', pose.led > 0.02 ? `url(#${this.p}-bulb)` : '#2c2c2c');
    this.bulb.style.opacity = String(0.35 + 0.65 * Math.max(pose.led, 0.0));
    this.bulbGlow.setAttribute('opacity', String(0.9 * pose.led));
  }

  /** World position of a local point on the torso (follows crouch, breathing, hop, squash and lean). */
  private torsoToWorld(lx: number, ly: number): [number, number] {
    const { x, y, s, hop, crouch, lean, breathe, legTuck } = this.pose;
    const [sx, sy] = squashScale(this.pose.squash);
    const hip = -86;
    // torso: breathe around the hips, lean from the hips, then drop with the crouch and tucked legs
    const bx0 = lx * (2 - breathe), by0 = (ly - hip) * breathe;
    const a = (lean * Math.PI) / 180;
    const tx = bx0 * Math.cos(a) - by0 * Math.sin(a);
    const ty = bx0 * Math.sin(a) + by0 * Math.cos(a) + hip + 92 * 0.5 * crouch - legTuck * 22;
    // body: squash and hop; root: scale and place
    return [x + s * tx * sx, y + s * (ty * sy - hop)];
  }

  /** World position of the right hand (holds the plug). */
  rightHand(): [number, number] {
    const a = (this.pose.armR * Math.PI) / 180;
    const [ox, oy] = SHOULDER_R;
    const dx = HAND_R[0] - ox, dy = HAND_R[1] - oy;
    return this.torsoToWorld(ox + dx * Math.cos(a) - dy * Math.sin(a), oy + dx * Math.sin(a) + dy * Math.cos(a));
  }

  /** World position of the cable port on the right side of the torso. */
  port(): [number, number] { return this.torsoToWorld(PORT[0] + 6, PORT[1]); }

  /** World position of the face. */
  faceCenter(): [number, number] { return this.torsoToWorld(HEAD_C[0] + this.pose.shiver, HEAD_C[1] + this.pose.headY); }

  /** World position of the feet (for dust puffs). */
  feet(): [number, number] { return [this.pose.x, this.pose.y]; }

  get scale(): number { return this.pose.s; }
}

const squashScale = (q: number): [number, number] => [1 + (1 - q) * 0.6, q];

function leg(cx: number): string {
  return `<rect x="${cx - 18}" y="-96" width="36" height="72" rx="12" fill="#4a2b17" stroke="#2e180a" stroke-width="5"/>
    <rect x="${cx - 44}" y="-34" width="88" height="34" rx="16" fill="#5e3820" stroke="#2e180a" stroke-width="5"/>`;
}

function arm(side: 1 | -1): string {
  const sx = side * 130;
  return `<rect x="${sx - 15 + side * 3}" y="-298" width="30" height="128" rx="15" fill="#5e3820" stroke="#2e180a" stroke-width="5"/>
    <circle cx="${sx + side * 3}" cy="-290" r="20" fill="#4a2b17" stroke="#2e180a" stroke-width="5"/>
    <circle cx="${sx + side * 3}" cy="-160" r="27" fill="#4a2b17" stroke="#2e180a" stroke-width="5"/>
    <path d="M${sx + side * 3 - 12} -142 q12 14 24 0" stroke="#2e180a" stroke-width="5" fill="none" stroke-linecap="round"/>`;
}

function grille(): string {
  let out = '';
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out += `<circle cx="${-96 + c * 20}" cy="${-292 + r * 22}" r="6.5"/>`;
  return out;
}
