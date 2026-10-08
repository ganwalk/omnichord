// ─── The real app inside the promo: puppeted iframes and device frames ───
// Devices show the real app (iframes of /), "puppeteered" per frame: the promo
// sets the same classes and text the app would, instead of running it, so
// every frame is deterministic.

import { CHORD_TYPES, NOTE_NAMES, chordName, noteName, strumMidi } from '../../src/theory';
import { el } from './dom';
import type { ChordEv, ScoreLike } from './score-tools';

export const APP_FACES = {
  sleep: ['(×_×)', 'SLEEP'], idle: ['(·_·)', 'READY'], chord: ['(◉ω◉)', 'CHORD!'],
  strum: ['(★ω★)', 'STRUM~'], beat: ['(^o^)♪', 'BEAT!'],
} as const;
type AppFace = keyof typeof APP_FACES;

export interface AppState {
  t: number;
  powered: boolean;
  chord: ChordEv | null;
  held: ChordEv | null;
  plucks: Map<number, number>;
  rhythm: boolean;
  arp: boolean;
  robot: AppFace;
  rec: boolean;
}

/** App state at time t for a score: what the instrument would show if a person were playing it. */
export function makeAppState(score: ScoreLike) {
  return (t: number, opts: { rec?: boolean } = {}): AppState => {
    const powered = t >= score.powerOn;
    const chord = powered ? score.chordAt(t) : null;
    const held = score.chords.find(c => t >= c.t - 0.16 && t < c.t + 0.12) ?? null;
    const rhythm = t >= score.rhythmOn && t < score.rhythmOff;
    const arp = t >= score.arpOn && t < score.arpOff;

    // The app robot reacts to the most recent event still within its hold time, like the app.
    let robot: AppFace = powered ? 'idle' : 'sleep';
    if (powered) {
      let latest = -Infinity;
      const consider = (time: number, hold: number, face: AppFace) => {
        if (time <= t && t - time < hold && time > latest) { latest = time; robot = face; }
      };
      for (const c of score.chords) consider(c.t, 0.5, 'chord');
      for (const p of score.plucks) { if (p.t > t) break; if (p.t >= score.firstChord) consider(p.t, 0.28, 'strum'); }
      if (rhythm) consider(score.rhythmOn + Math.floor((t - score.rhythmOn) / score.bar) * score.bar, 0.2, 'beat');
    }
    return {
      t, powered, chord, held: powered ? held : null,
      plucks: powered ? score.activePlucks(t, 0.5) : new Map(),
      rhythm, arp, robot, rec: !!opts.rec && powered,
    };
  };
}

export class AppView {
  readonly iframe: HTMLIFrameElement;
  private doc!: Document;
  private btns: HTMLElement[] = [];
  private strings: HTMLElement[] = [];
  private labels: HTMLElement[] = [];
  private lastChord: ChordEv | null | undefined = undefined;
  private lastHeld: ChordEv | null | undefined = undefined;

  /** The app fills a w×h viewport placed at (ox, oy) inside `parent` (below the status bar etc.). */
  constructor(parent: HTMLElement, readonly w: number, readonly h: number, readonly ox = 0, readonly oy = 0) {
    this.iframe = el('iframe', '', parent);
    this.iframe.width = String(w);
    this.iframe.height = String(h);
    Object.assign(this.iframe.style, { width: `${w}px`, height: `${h}px`, left: `${ox}px`, top: `${oy}px` });
  }

  /** App point → point in the parent element. */
  toParent(x: number, y: number): [number, number] { return [x + this.ox, y + this.oy]; }

  /** `opts.transparent`: drop the page background, leaving only the instrument (a floating object). */
  async load(opts: { pattern?: string; bpm?: number; transparent?: boolean } = {}): Promise<void> {
    const { pattern = 'Rock', bpm = 120, transparent = false } = opts;
    await new Promise<void>(resolve => { this.iframe.addEventListener('load', () => resolve(), { once: true }); this.iframe.src = '/'; });
    const doc = this.iframe.contentDocument!;
    for (let i = 0; i < 200 && doc.querySelectorAll('.chord-btn').length < 72; i++) await new Promise(r => setTimeout(r, 25));
    this.doc = doc;
    const style = doc.createElement('style');
    // Frame-exact rendering: no transitions; the promo drives every change.
    style.textContent = '*,*::before,*::after{transition:none!important;caret-color:transparent}'
      + (transparent ? 'html,body{background:transparent!important}.credits{display:none!important}' : '');
    doc.head.appendChild(style);
    this.btns = [...doc.querySelectorAll<HTMLElement>('.chord-btn')];
    this.strings = [...doc.querySelectorAll<HTMLElement>('.s-string')];
    this.labels = [...doc.querySelectorAll<HTMLElement>('.s-note-lbl')];
    doc.querySelectorAll('#patternBtns .mode-btn').forEach(b => b.classList.toggle('active', b.textContent === pattern));
    const bpmVal = doc.getElementById('bpmVal'); if (bpmVal) bpmVal.textContent = String(bpm);
    const bpmIn = doc.getElementById('bpmCtrl') as HTMLInputElement | null; if (bpmIn) bpmIn.value = String(bpm);
  }

  private q(id: string): HTMLElement { return this.doc.getElementById(id)!; }

  private btnFor(c: ChordEv): HTMLElement {
    return this.btns[CHORD_TYPES.indexOf(c.type) * 12 + c.root];
  }

  /** Bounding box of an element inside the app, in app (iframe) pixels. */
  rect(sel: string | HTMLElement): DOMRect {
    const e = typeof sel === 'string' ? this.doc.querySelector(sel)! : sel;
    return e.getBoundingClientRect();
  }
  chordButton(c: ChordEv): HTMLElement { return this.btnFor(c); }
  stringEl(i: number): HTMLElement { return this.strings[i]; }

  apply(s: AppState): void {
    const d = this.doc;
    this.q('instrument').classList.toggle('powered-off', !s.powered);
    this.q('instrument').classList.toggle('recording', s.rec);
    this.q('powerBtn').classList.toggle('on', s.powered);
    this.q('powerLed').classList.toggle('on', s.powered);
    this.q('powerLed').classList.toggle('green', s.powered);
    this.q('powerTooltip').classList.toggle('hidden', s.powered);

    if (s.chord !== this.lastChord) {
      if (this.lastChord) this.btnFor(this.lastChord).classList.remove('selected');
      if (s.chord) this.btnFor(s.chord).classList.add('selected');
      const name = s.chord ? chordName(s.chord.root, s.chord.type) : '';
      this.q('led').textContent = s.chord ? name : s.powered ? 'READY' : '– – –';
      this.q('chordRoot').textContent = s.chord ? NOTE_NAMES[s.chord.root] : '–';
      this.q('chordSym').textContent = s.chord ? s.chord.type.sym : '';
      this.q('chordBadge').classList.toggle('has-chord', !!s.chord);
      const notes = s.chord ? strumMidi(s.chord.root, s.chord.type.intervals, 0) : [];
      this.labels.forEach((l, i) => {
        const n = notes[i];
        l.textContent = n !== undefined && n !== notes[i - 1] && n % 12 === s.chord!.root ? noteName(n) : '';
      });
      this.lastChord = s.chord;
    }
    if (!s.chord && s.powered) this.q('led').textContent = 'READY';
    if (s.held !== this.lastHeld) {
      if (this.lastHeld) this.btnFor(this.lastHeld).classList.remove('held');
      if (s.held) this.btnFor(s.held).classList.add('held');
      this.lastHeld = s.held;
    }

    // Plucked strings: restart the vibrate animation per pluck, then seek it.
    this.strings.forEach((str, i) => {
      const pt = s.plucks.get(i);
      if (pt === undefined) {
        if (str.classList.contains('plucked')) { str.classList.remove('plucked'); delete str.dataset.pt; }
        return;
      }
      if (str.dataset.pt !== String(pt)) {
        str.classList.remove('plucked');
        void str.offsetWidth;
        str.classList.add('plucked');
        str.dataset.pt = String(pt);
      }
      for (const a of str.getAnimations({ subtree: true })) { a.pause(); a.currentTime = (s.t - pt) * 1000; }
    });

    d.querySelectorAll('[data-action="rhythm"]').forEach(b => {
      b.textContent = s.rhythm ? '⏹ STOP' : '▶ PLAY';
      b.classList.toggle('active', s.rhythm);
    });
    d.querySelectorAll('[data-action="arp"]').forEach(b => {
      b.textContent = s.arp ? '⏹ ARP' : '▶ ARP';
      b.classList.toggle('active', s.arp);
    });
    const sync = s.rhythm && s.arp;
    this.q('arpSyncBadge').textContent = sync ? 'SYNC' : 'FREE';
    this.q('arpSyncBadge').classList.toggle('synced', sync);
    const rec = d.getElementById('recBtn');
    if (rec) { rec.textContent = s.rec ? '■ SAVE' : '● REC'; rec.classList.toggle('recording', s.rec); }

    const [face, status] = APP_FACES[s.robot];
    this.q('robotFace').textContent = face;
    this.q('robotStatus').textContent = status;

    // Everything else that animates (tooltip float, REC pulse): seek to t.
    for (const a of d.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target as Element | null;
      if (target?.classList.contains('s-string')) continue;
      a.pause();
      a.currentTime = (s.t * 1000) % 2400;
    }
  }
}

// ═══ Devices ═══

export type Kind = 'phone' | 'tablet' | 'laptop';
const BEZEL: Record<Kind, number> = { phone: 18, tablet: 28, laptop: 24 };

export class Device {
  readonly el: HTMLDivElement;
  readonly screen: HTMLDivElement;
  readonly w: number;
  readonly h: number;
  readonly bezel: number;
  cx = 540; cy = 960; s = 1; rot = 0;

  constructor(kind: Kind, readonly sw: number, readonly sh: number, parent?: Element) {
    this.bezel = BEZEL[kind];
    this.w = sw + 2 * this.bezel;
    this.h = sh + 2 * this.bezel;
    this.el = el('div', `device ${kind}`, parent);
    Object.assign(this.el.style, { width: `${this.w}px`, height: `${this.h}px` });
    el('div', 'bezel', this.el);
    this.screen = el('div', 'screen', this.el);
    Object.assign(this.screen.style, { left: `${this.bezel}px`, top: `${this.bezel}px`, width: `${sw}px`, height: `${sh}px` });
    if (kind === 'laptop') el('div', 'base', this.el);
  }

  place(cx: number, cy: number, s: number, rot = 0, opacity = 1): void {
    Object.assign(this, { cx, cy, s, rot });
    this.el.style.display = opacity <= 0.001 ? 'none' : 'block';
    this.el.style.opacity = String(opacity);
    this.el.style.left = `${cx - this.w / 2}px`;
    this.el.style.top = `${cy - this.h / 2}px`;
    this.el.style.transform = `rotate(${rot}deg) scale(${s})`;
  }

  /** Map a point on the screen (screen px) to stage coordinates. */
  toStage(x: number, y: number): [number, number] {
    const dx = (this.bezel + x - this.w / 2) * this.s, dy = (this.bezel + y - this.h / 2) * this.s;
    const r = (this.rot * Math.PI) / 180;
    return [this.cx + dx * Math.cos(r) - dy * Math.sin(r), this.cy + dx * Math.sin(r) + dy * Math.cos(r)];
  }
}

// System areas a real device reserves (iPhone-style): the app runs between them,
// edge to edge, like it does on a phone.
export const PHONE_PORTRAIT = { top: 47, bottom: 34 };
export const PHONE_LANDSCAPE = { side: 47, bottom: 21 };
export const TABLET = { top: 24, bottom: 20 };

const SIGNAL = '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>';
const WIFI = '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z"/><path d="M3.4 6.9a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0z"/><path d="M1.1 4.6a9.8 9.8 0 0 1 13.8 0l-1.4 1.4a7.8 7.8 0 0 0-11 0z"/></svg>';
const BATTERY = '<svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2.5" y="2.5" width="16" height="8" rx="2"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" opacity=".45"/></svg>';

export function statusBar(parent: HTMLElement, width: number, height: number, size: number): void {
  const bar = el('div', 'statusbar', parent);
  Object.assign(bar.style, { width: `${width}px`, height: `${height}px`, fontSize: `${size}px`, padding: `0 ${size * 1.9}px` });
  el('span', 'clock', bar).textContent = '9:41';
  el('span', 'icons', bar).innerHTML = SIGNAL + WIFI + BATTERY;
}
export function homeBar(parent: HTMLElement, cx: number, bottom: number, width: number): void {
  const bar = el('div', 'homebar', parent);
  Object.assign(bar.style, { left: `${cx - width / 2}px`, bottom: `${bottom}px`, width: `${width}px` });
}

