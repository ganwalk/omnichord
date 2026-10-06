// ─── OmniHarp promo — motion page ───
// Every visual is a pure function of time t (seconds). The render script calls
// window.renderFrame(t) for each frame and screenshots the stage, so timing is
// frame-exact and matches the soundtrack, which is rendered from the same score.
//
// The devices show the real app (iframes of /), "puppeteered" per frame: the
// promo sets the same classes and text the app would, instead of running it.

import '@fontsource/inter/600.css';
import '@fontsource/inter/800.css';
import '@fontsource/unbounded/700.css';
import '@fontsource/unbounded/800.css';
import '@fontsource/unbounded/900.css';
import './video.css';

import { CHORD_TYPES, NOTE_NAMES, chordName, noteName, strumMidi } from '../src/theory';
import { BAR, CTA_URL, T, activePlucks, chordAt, chords, hits, plucks, type ChordEv } from './score';

// ═══ Helpers ═══

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const prog = (t: number, t0: number, dur: number) => clamp01((t - t0) / dur);
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
const easeOutExpo = (x: number) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const easeInCubic = (x: number) => x * x * x;
const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeOutBack = (x: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
/** Fade in over [a, a+din], out over [b, b+dout]. */
const window01 = (t: number, a: number, din: number, b: number, dout: number) =>
  Math.min(prog(t, a, din), 1 - prog(t, b, dout));

const stage = document.getElementById('stage')!;
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent: HTMLElement = stage): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  parent.appendChild(e);
  return e;
};
const layer = (id: string) => { const d = el('div', 'layer'); d.id = id; return d; };

// ═══ Background ═══

const glow = layer('glow');
const bigStrings = layer('bigStrings');
const stringGlows = Array.from({ length: 24 }, () => {
  const s = el('div', 'big-string', bigStrings);
  return { s, g: el('div', 'glow', s) };
});

function renderBigStrings(t: number, opacity: number): void {
  bigStrings.style.opacity = String(opacity);
  if (opacity <= 0.001) return;
  const active = activePlucks(t, 0.7);
  stringGlows.forEach(({ s, g }, i) => {
    const pt = active.get(i);
    if (pt === undefined) { g.style.opacity = '0'; s.style.transform = ''; return; }
    const age = t - pt, k = 1 - age / 0.7;
    g.style.opacity = String(k * k);
    s.style.transform = `translateX(${Math.sin(age * 70) * 7 * k}px)`;
  });
}

// ═══ App puppet ═══

const FACES = {
  sleep: ['(×_×)', 'SLEEP'], idle: ['(·_·)', 'READY'], chord: ['(◉ω◉)', 'CHORD!'],
  strum: ['(★ω★)', 'STRUM~'], beat: ['(^o^)♪', 'BEAT!'],
} as const;

interface AppState {
  t: number;
  powered: boolean;
  chord: ChordEv | null;
  held: ChordEv | null;
  plucks: Map<number, number>;
  rhythm: boolean;
  arp: boolean;
  robot: keyof typeof FACES;
  rec: boolean;
}

function appState(t: number, opts: { rec?: boolean } = {}): AppState {
  const powered = t >= T.powerOn;
  const chord = powered ? chordAt(t) : null;
  const held = chords.find(c => t >= c.t - 0.16 && t < c.t + 0.12) ?? null;
  const rhythm = t >= T.rhythmOn && t < T.finale;
  const arp = t >= T.arpOn && t < T.finale;

  // Robot reacts to the most recent event still within its hold time, like the app.
  let robot: keyof typeof FACES = powered ? 'idle' : 'sleep';
  if (powered) {
    let latest = -Infinity;
    const consider = (time: number, hold: number, face: keyof typeof FACES) => {
      if (time <= t && t - time < hold && time > latest) { latest = time; robot = face; }
    };
    for (const c of chords) consider(c.t, 0.5, 'chord');
    for (const p of plucks) { if (p.t > t) break; if (p.t >= T.firstChord) consider(p.t, 0.28, 'strum'); }
    if (rhythm) consider(T.rhythmOn + Math.floor((t - T.rhythmOn) / BAR) * BAR, 0.2, 'beat');
  }
  return {
    t, powered, chord, held: powered ? held : null,
    plucks: powered ? activePlucks(t, 0.5) : new Map(),
    rhythm, arp, robot, rec: !!opts.rec && powered,
  };
}

class AppView {
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

  async load(): Promise<void> {
    await new Promise<void>(resolve => { this.iframe.addEventListener('load', () => resolve(), { once: true }); this.iframe.src = '/'; });
    const doc = this.iframe.contentDocument!;
    for (let i = 0; i < 200 && doc.querySelectorAll('.chord-btn').length < 72; i++) await new Promise(r => setTimeout(r, 25));
    this.doc = doc;
    const style = doc.createElement('style');
    // Frame-exact rendering: no transitions; the promo drives every change.
    style.textContent = '*,*::before,*::after{transition:none!important;caret-color:transparent}';
    doc.head.appendChild(style);
    this.btns = [...doc.querySelectorAll<HTMLElement>('.chord-btn')];
    this.strings = [...doc.querySelectorAll<HTMLElement>('.s-string')];
    this.labels = [...doc.querySelectorAll<HTMLElement>('.s-note-lbl')];
    doc.querySelectorAll('#patternBtns .mode-btn').forEach(b => b.classList.toggle('active', b.textContent === 'Rock'));
    const bpm = doc.getElementById('bpmVal'); if (bpm) bpm.textContent = '120';
    const bpmIn = doc.getElementById('bpmCtrl') as HTMLInputElement | null; if (bpmIn) bpmIn.value = '120';
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

    const [face, status] = FACES[s.robot];
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

type Kind = 'phone' | 'tablet' | 'laptop';
const BEZEL: Record<Kind, number> = { phone: 18, tablet: 28, laptop: 24 };

class Device {
  readonly el: HTMLDivElement;
  readonly screen: HTMLDivElement;
  readonly w: number;
  readonly h: number;
  readonly bezel: number;
  cx = 540; cy = 960; s = 1; rot = 0;

  constructor(kind: Kind, readonly sw: number, readonly sh: number) {
    this.bezel = BEZEL[kind];
    this.w = sw + 2 * this.bezel;
    this.h = sh + 2 * this.bezel;
    this.el = el('div', `device ${kind}`);
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

// Hero phone: portrait app, plus a landscape app pre-rotated inside the screen,
// revealed when the phone turns sideways.
// System areas a real device reserves (iPhone-style): the app runs between them,
// edge to edge, like it does on a phone.
const PHONE_PORTRAIT = { top: 47, bottom: 34 };
const PHONE_LANDSCAPE = { side: 47, bottom: 21 };
const TABLET = { top: 24, bottom: 20 };

const SIGNAL = '<svg width="18" height="12" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg>';
const WIFI = '<svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0z"/><path d="M3.4 6.9a6.5 6.5 0 0 1 9.2 0l-1.4 1.4a4.5 4.5 0 0 0-6.4 0z"/><path d="M1.1 4.6a9.8 9.8 0 0 1 13.8 0l-1.4 1.4a7.8 7.8 0 0 0-11 0z"/></svg>';
const BATTERY = '<svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="currentColor" opacity=".45"/><rect x="2.5" y="2.5" width="16" height="8" rx="2"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" opacity=".45"/></svg>';

function statusBar(parent: HTMLElement, width: number, height: number, size: number): void {
  const bar = el('div', 'statusbar', parent);
  Object.assign(bar.style, { width: `${width}px`, height: `${height}px`, fontSize: `${size}px`, padding: `0 ${size * 1.9}px` });
  el('span', 'clock', bar).textContent = '9:41';
  el('span', 'icons', bar).innerHTML = SIGNAL + WIFI + BATTERY;
}
function homeBar(parent: HTMLElement, cx: number, bottom: number, width: number): void {
  const bar = el('div', 'homebar', parent);
  Object.assign(bar.style, { left: `${cx - width / 2}px`, bottom: `${bottom}px`, width: `${width}px` });
}

const hero = new Device('phone', 390, 844);
// Portrait app + its status bar fade out together when the phone turns (iOS hides it sideways).
const portraitLayer = el('div', 'layer', hero.screen);
statusBar(portraitLayer, 390, PHONE_PORTRAIT.top, 16);
homeBar(portraitLayer, 195, 9, 134);
const heroPortrait = new AppView(portraitLayer, 390, 844 - PHONE_PORTRAIT.top - PHONE_PORTRAIT.bottom, 0, PHONE_PORTRAIT.top);
const landHolder = el('div', 'land-holder', hero.screen);
Object.assign(landHolder.style, { width: '844px', height: '390px', transform: 'translate(390px, 0) rotate(90deg)' });
homeBar(landHolder, 422, 7, 160);
const heroLandscape = new AppView(landHolder, 844 - 2 * PHONE_LANDSCAPE.side, 390 - PHONE_LANDSCAPE.bottom, PHONE_LANDSCAPE.side, 0);
/** Landscape app point → hero screen point. */
const landToScreen = (x: number, y: number): [number, number] => [390 - y, x];

const tablet = new Device('tablet', 820, 1180);
statusBar(tablet.screen, 820, TABLET.top, 13);
homeBar(tablet.screen, 410, 7, 260);
const tabletApp = new AppView(tablet.screen, 820, 1180 - TABLET.top - TABLET.bottom, 0, TABLET.top);
const laptop = new Device('laptop', 1440, 900);
const laptopApp = new AppView(laptop.screen, 1440, 900);
const phone2 = new Device('phone', 390, 844);
statusBar(phone2.screen, 390, PHONE_PORTRAIT.top, 16);
homeBar(phone2.screen, 195, 9, 134);
const phone2App = new AppView(phone2.screen, 390, 844 - PHONE_PORTRAIT.top - PHONE_PORTRAIT.bottom, 0, PHONE_PORTRAIT.top);

// ═══ Typography ═══

class Headline {
  readonly el: HTMLDivElement;
  private readonly lines: HTMLElement[][] = [];

  /** `lines`: words prefixed with * are gold. */
  constructor(lines: string[], private readonly times: number[], private readonly out: number, top: number, size: number) {
    this.el = el('div', 'headline');
    Object.assign(this.el.style, { top: `${top}px`, fontSize: `${size}px` });
    for (const line of lines) {
      const l = el('span', 'line', this.el);
      const words = line.split(' ').map((w, i, arr) => {
        const span = el('span', 'word' + (w.startsWith('*') ? ' gold' : ''), l);
        span.textContent = w.replace(/^\*/, '') + (i < arr.length - 1 ? ' ' : '');
        return span;
      });
      this.lines.push(words);
    }
  }

  /** Shrink the font until every line fits the stage width. */
  fit(maxW = 960): void {
    let size = parseFloat(this.el.style.fontSize);
    const lineEls = [...this.el.querySelectorAll<HTMLElement>('.line')];
    const widest = () => Math.max(...lineEls.map(l => [...l.children].reduce((w, c) => w + (c as HTMLElement).offsetWidth, 0)));
    while (widest() > maxW && size > 20) { size -= 2; this.el.style.fontSize = `${size}px`; }
  }

  render(t: number): void {
    const visible = t >= this.times[0] - 0.01 && t < this.out + 0.4;
    this.el.style.display = visible ? 'block' : 'none';
    if (!visible) return;
    const q = easeInCubic(prog(t, this.out, 0.3));
    this.lines.forEach((words, li) => {
      words.forEach((w, wi) => {
        const p = easeOutExpo(prog(t, this.times[li] + wi * 0.05, 0.5));
        const y = (1 - p) * 110 - q * 110;
        w.style.transform = `translateY(${y}%)`;
        w.style.opacity = String(Math.min(p * 1.5, 1) * (1 - q));
      });
    });
  }
}

const sub = (text: string, top: number) => { const d = el('div', 'sub'); d.style.top = `${top}px`; d.textContent = text; return d; };

// ═══ Scenes ═══

// S1 — hook
const h1 = new Headline(['E se o seu', 'celular', 'virasse uma', '*harpa?'], [0.3, 0.8, 1.3, 2.3], 2.85, 520, 132);

// S2 — logo
const logoTop = el('div', 'logo');
logoTop.style.top = '96px';
const logoTopRow = el('div', '', logoTop);
Object.assign(logoTopRow.style, { display: 'flex', alignItems: 'center', gap: '30px' });
const logoTopIcon = el('img', '', logoTopRow);
logoTopIcon.src = '/icons/icon-512.png';
Object.assign(logoTopIcon.style, { width: '128px', height: '128px' });
const logoTopWord = el('div', 'wordmark gold', logoTopRow);
logoTopWord.textContent = 'OmniHarp';
logoTopWord.style.fontSize = '132px';
const s2sub = sub('Acordes e cordas na ponta dos dedos.', 290);

// S3 — how it works
const h3 = new Headline(['Toque um acorde.', 'Deslize as cordas.', '*É música.'], [7.95, 8.95, 9.95], 11.65, 96, 84);

// S4 — drums
const h4 = new Headline(['Uma banda inteira', '*no seu bolso.'], [12.0, 12.5], 15.65, 170, 96);
const ticker = el('div');
ticker.id = 'ticker';
const PATTERN_NAMES = ['Bossa Nova', 'Rock', 'Samba', 'Reggae', 'Waltz', 'Shuffle', 'March'];
for (let k = 0; k < 4; k++) for (const n of PATTERN_NAMES) { const c = el('div', 'chip' + (n === 'Rock' ? ' on' : ''), ticker); c.textContent = n; }

// S5 — arpeggiator
const h5 = new Headline(['Arpejador', '*sempre no tempo.'], [16.0, 16.5], 19.65, 170, 110);
const syncBadge = el('div', 'badge');
syncBadge.textContent = 'SYNC';

// S6 — feature blitz
const CARDS: [big: string, label: string, hint: string, cls?: string][] = [
  ['72', 'acordes', 'maior, menor, 7, m7, Maj7, °7'],
  ['24', 'cordas', 'quatro oitavas sob os dedos'],
  ['7', 'ritmos', 'bossa nova, rock, samba…'],
  ['7', 'arpejos', 'sincronizados com a bateria'],
  ['● REC', 'grave', 'e compartilhe o que tocar', 'rec'],
  ['MIDI', 'conecte', 'seu teclado e toque acordes'],
  ['Tom', 'em destaque', 'os acordes certos acesos'],
  ['Offline', 'sempre', 'toca até sem internet'],
];
const cards = CARDS.map(([big, label, hint, cls]) => {
  const c = el('div', 'card');
  const b = el('div', 'big gold' + (cls ? ` ${cls}` : ''), c);
  if (cls === 'rec') b.classList.remove('gold');
  b.textContent = big;
  el('div', 'label', c).textContent = label;
  el('div', 'hint', c).textContent = hint;
  return { c, b };
});

// S7 — devices
const h7 = new Headline(['No celular.', 'No tablet.', 'No computador.', '*Em qualquer tela.'], [24.0, 25.0, 26.0, 27.0], 27.75, 70, 78);

// S8 — end card
const endCard = el('div', 'logo');
endCard.style.top = '470px';
// End-card icon: the app icon (scripts/icon.svg) drawn live, so the robot's
// face can cycle through its moods on the beat.
const FACE_STATES = {
  chord: '<circle cx="196" cy="242" r="33"/><circle cx="316" cy="242" r="33"/><path d="M226 290 q15 30 30 0 q15 30 30 0"/>'
    + '<circle cx="196" cy="242" r="13" class="fill"/><circle cx="316" cy="242" r="13" class="fill"/>',
  happy: '<path d="M168 220 L222 242 L168 264"/><path d="M344 220 L290 242 L344 264"/><path d="M226 290 q15 30 30 0 q15 30 30 0"/>',
  strum: `${star(196, 242)}${star(316, 242)}<path d="M226 290 q15 30 30 0 q15 30 30 0"/>`,
  beat: '<path d="M166 258 L196 222 L226 258"/><path d="M286 258 L316 222 L346 258"/><circle cx="256" cy="300" r="17"/>',
  idle: '<circle cx="196" cy="240" r="15" class="fill"/><circle cx="316" cy="240" r="15" class="fill"/><path d="M224 304 H288"/>',
  blink: '<path d="M166 242 H226"/><path d="M286 242 H346"/><path d="M224 304 H288"/>',
} as const;
type Face = keyof typeof FACE_STATES;
/** One mood per beat from the final strum, with a quick blink at the end of "idle". */
const FACE_LOOP: Face[] = ['strum', 'chord', 'happy', 'beat', 'idle'];

function star(cx: number, cy: number, r = 34): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  });
  return `<polygon points="${pts.join(' ')}" class="fill" stroke-linejoin="round"/>`;
}

const endIcon = el('div', 'end-icon', endCard);
endIcon.innerHTML = `
<svg viewBox="0 0 512 512" width="250" height="250">
  <defs>
    <linearGradient id="ec-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3632"/><stop offset=".45" stop-color="#1e1c1a"/><stop offset="1" stop-color="#0e0d0c"/></linearGradient>
    <radialGradient id="ec-crt" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#03301a"/><stop offset=".6" stop-color="#001a0a"/><stop offset="1" stop-color="#000804"/></radialGradient>
    <pattern id="ec-scan" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="3" fill="#000" opacity=".28"/></pattern>
    <filter id="ec-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="7" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="ec-round"><rect width="512" height="512" rx="113"/></clipPath>
  </defs>
  <g clip-path="url(#ec-round)">
    <rect width="512" height="512" fill="url(#ec-body)"/>
    <rect x="70" y="122" width="372" height="268" rx="46" fill="#0b1a0e" stroke="#000" stroke-width="6"/>
    <rect x="84" y="136" width="344" height="240" rx="34" fill="url(#ec-crt)"/>
    <rect x="84" y="136" width="344" height="240" rx="34" fill="#00e060" opacity=".06"/>
    <g class="face" fill="none" stroke="#3dff8f" stroke-width="13" stroke-linecap="round" filter="url(#ec-glow)">
      <path d="M136 186 Q104 256 136 326"/><path d="M376 186 Q408 256 376 326"/>
      ${Object.entries(FACE_STATES).map(([k, v]) => `<g data-face="${k}">${v}</g>`).join('')}
    </g>
    <rect x="84" y="136" width="344" height="240" rx="34" fill="url(#ec-scan)"/>
    <path d="M110 150 H402 Q414 150 414 162 V176 Q256 196 98 176 V162 Q98 150 110 150 Z" fill="#fff" opacity=".06"/>
  </g>
</svg>`;
const faceGroups = [...endIcon.querySelectorAll<SVGGElement>('[data-face]')];
const faceEl = endIcon.querySelector<SVGGElement>('.face')!;

function renderEndFace(t: number): void {
  const local = Math.max(0, t - T.finale);
  const beat = Math.floor(local / 0.5);
  let face: Face = FACE_LOOP[beat % FACE_LOOP.length];
  if (face === 'idle' && local % 0.5 > 0.36) face = 'blink';
  for (const g of faceGroups) g.style.display = g.dataset.face === face ? 'inline' : 'none';
  // A little bounce on every change, like the robot reacting on the instrument.
  const bounce = 1 + 0.07 * Math.exp(-(local % 0.5) * 14);
  faceEl.setAttribute('transform', `translate(256 256) scale(${bounce.toFixed(4)}) translate(-256 -256)`);
}
const endWord = el('div', 'wordmark gold', endCard);
endWord.textContent = 'OmniHarp';
Object.assign(endWord.style, { fontSize: '170px', marginTop: '46px' });
const endTag = el('div', '', endCard);
Object.assign(endTag.style, { marginTop: '34px', fontSize: '50px', fontWeight: '600', textAlign: 'center', lineHeight: '1.3', color: 'rgba(255,240,215,0.9)' });
endTag.innerHTML = 'Sua harpa de acordes.<br>Em qualquer tela.';
const endCta = el('div', 'cta', endCard);
endCta.textContent = '▶  Toque agora';
// The address is the call to action's destination: right under the button.
const endUrl = el('div', 'url', endCard);
endUrl.textContent = CTA_URL;
endUrl.style.display = CTA_URL ? 'block' : 'none';
const endPlat = el('div', 'platforms', endCard);
endPlat.textContent = 'Web agora · Android e iOS em breve';
const endParts = [endIcon, endWord, endTag, endCta, endUrl, endPlat];

// Touch indicators (chord thumb + strum thumb)
const tapDot = el('div', 'touch');
const swipeDot = el('div', 'touch');

const vignette = layer('vignette');
const flash = layer('flash');
const black = layer('black');
black.style.background = '#000';
void vignette;

// ═══ Frame ═══

const FLASHES: [number, number][] = [[3.5, 0.35], [4.0, 0.55], [12.0, 0.75], [20.0, 0.4], [28.0, 0.9]];
const kicks = hits.filter(h => h.hit === 'k').map(h => h.t);

/** Power button center on the hero phone (device px), measured once at init:
 *  a hidden device has no layout to measure. */
let powerPt = { x: 0, y: 0 };

function heroPose(t: number): { cx: number; cy: number; s: number; rot: number; op: number } {
  const HERO = { cx: 540, cy: 1150, s: 1.55 };
  const px = powerPt.x, py = powerPt.y;
  if (t < T.firstChord) {
    // Close on the power button, then pull out on the first strum.
    const s = lerp(4.6, 5.3, prog(t, 3.0, 1.0));
    const fx = px + 55; // a little right of the button, so the power hint reads in full
    return { cx: 540 - (fx - hero.w / 2) * s, cy: 980 - (py - hero.h / 2) * s, s, rot: 0, op: prog(t, 3.1, 0.25) };
  }
  if (t < T.rhythmOn) {
    const p = easeOutExpo(prog(t, T.firstChord, 0.9));
    const s0 = 5.3, cx0 = 540 - (px + 55 - hero.w / 2) * s0, cy0 = 980 - (py - hero.h / 2) * s0;
    const push = lerp(1, 1.05, prog(t, 8, 4));
    return {
      cx: lerp(cx0, HERO.cx, p), cy: lerp(cy0, HERO.cy, p),
      s: Math.exp(lerp(Math.log(s0), Math.log(HERO.s * push), p)), rot: 0, op: 1,
    };
  }
  // Drop: rotate to landscape and settle; push in during the arpeggio; exit at the blitz.
  const r = easeInOutCubic(prog(t, T.rhythmOn, 0.75));
  const land = { cx: 540, cy: 1060, s: 1.12 };
  const push = easeInOutCubic(prog(t, T.arpOn, 3.5));
  const exit = easeInCubic(prog(t, T.blitz - 0.25, 0.25));
  return {
    cx: lerp(HERO.cx, land.cx, r) - push * 110,
    cy: lerp(HERO.cy * 1, land.cy, r),
    s: lerp(HERO.s * 1.05, land.s, r) * (1 + push * 0.18) * (1 + exit * 0.4),
    rot: -90 * r,
    op: 1 - exit,
  };
}

function renderFrame(t: number): void {
  // Background light: kick pulses and accent flashes.
  let pulse = 0;
  for (const k of kicks) if (k <= t && t - k < 0.6) pulse = Math.max(pulse, Math.exp(-(t - k) * 7));
  glow.style.opacity = String(0.25 + 0.6 * pulse * (t >= T.rhythmOn && t < T.finale + 1 ? 1 : 0) + (t >= T.firstChord ? 0.15 : 0));
  let fl = 0;
  for (const [ft, a] of FLASHES) if (ft <= t && t - ft < 0.5) fl = Math.max(fl, a * Math.exp(-(t - ft) * 9));
  flash.style.opacity = String(fl);

  // Giant strings: hero of the intro and the end, a faint backdrop in between.
  let strOp = 0.14;
  if (t < 3.6) strOp = lerp(1, 0.12, prog(t, 2.9, 0.7));
  else if (t >= T.blitz && t < T.lineup) strOp = 0.55;
  else if (t >= T.finale) strOp = lerp(1, 0.4, prog(t, 29.2, 1.2));
  renderBigStrings(t, strOp);

  const state = appState(t);

  // ── Hero phone (0–20.3 s) ──
  const pose = heroPose(t);
  hero.place(pose.cx, pose.cy, pose.s, pose.rot, pose.op);
  if (pose.op > 0) {
    const landP = prog(t, T.rhythmOn + 0.3, 0.15);
    portraitLayer.style.opacity = String(1 - landP);
    landHolder.style.opacity = String(landP);
    if (landP < 1) heroPortrait.apply(state);
    if (landP > 0) heroLandscape.apply(state);
  }

  // ── Touch indicators: chord taps and strum swipes while the phone is upright or settled sideways ──
  const upright = t >= T.firstChord + 0.6 && t < T.rhythmOn;
  const sideways = t >= T.rhythmOn + 0.9 && t < T.arpOn;
  tapDot.style.opacity = '0';
  swipeDot.style.opacity = '0';
  if (upright || sideways) {
    const view = upright ? heroPortrait : heroLandscape;
    const map = (x: number, y: number) => (upright
      ? hero.toStage(...heroPortrait.toParent(x, y))
      : hero.toStage(...landToScreen(...heroLandscape.toParent(x, y))));
    const c = chords.find(ch => t >= ch.t - 0.35 && t < ch.t + 0.3);
    if (c) {
      const r = view.rect(view.chordButton(c));
      const [x, y] = map(r.x + r.width / 2, r.y + r.height / 2);
      const press = t < c.t - 0.16 ? prog(t, c.t - 0.35, 0.19) : 1;
      const lift = prog(t, c.t + 0.1, 0.2);
      tapDot.style.opacity = String(press * (1 - lift));
      tapDot.style.transform = `translate(${x}px, ${y}px) scale(${t >= c.t - 0.16 && t < c.t + 0.12 ? 0.85 : 1.15})`;

      // Strum thumb sweeps low → high across the plate with the strum.
      const spread = c.t === T.firstChord ? 0.011 : 0.0075;
      const idx = Math.max(0, Math.min(23, Math.floor((t - c.t) / spread)));
      const sr = view.rect(view.stringEl(idx));
      const [sx, sy] = map(sr.x + sr.width / 2, sr.y + sr.height / 2);
      swipeDot.style.opacity = String(prog(t, c.t - 0.12, 0.1) * (1 - prog(t, c.t + 0.22, 0.15)));
      swipeDot.style.transform = `translate(${sx}px, ${sy}px)`;
    }
  }

  // ── Headlines & cards ──
  h1.render(t);
  const lp = easeOutBack(prog(t, T.firstChord, 0.55));
  const lo = window01(t, T.firstChord, 0.2, 7.6, 0.3);
  logoTop.style.opacity = String(lo);
  logoTop.style.transform = `scale(${lerp(1.6, 1, lp)})`;
  s2sub.style.opacity = String(window01(t, 4.6, 0.4, 7.6, 0.3));
  s2sub.style.transform = `translateY(${(1 - easeOutExpo(prog(t, 4.6, 0.6))) * 30}px)`;
  h3.render(t);
  h4.render(t);
  ticker.style.opacity = String(window01(t, 12.6, 0.3, 15.6, 0.3));
  ticker.style.transform = `translate(${-200 - (t - 12) * 170}px, 1500px)`;
  h5.render(t);
  {
    const beatAge = (t - T.arpOn) % 0.5;
    syncBadge.style.opacity = String(window01(t, 16.6, 0.2, 19.6, 0.3));
    syncBadge.style.left = '410px';
    syncBadge.style.top = '1500px';
    syncBadge.style.transform = `scale(${1 + 0.12 * Math.exp(-beatAge * 10)})`;
  }

  cards.forEach(({ c }, i) => {
    const t0 = T.blitz + i * 0.5;
    const local = t - t0;
    if (local < 0 || local >= 0.5) { c.style.opacity = '0'; return; }
    const pin = easeOutExpo(prog(local, 0, 0.14));
    const pout = prog(local, 0.42, 0.08);
    c.style.opacity = String(pin * (1 - pout));
    c.style.transform = `translateY(${640}px) scale(${lerp(1.35, 1, pin) * lerp(1, 0.94, pout)}) rotate(${(i % 2 ? 1 : -1) * (1 - pin) * 4}deg)`;
  });

  // ── Lineup (24–28.4 s) ──
  const lineState = appState(t, { rec: true });
  const exitAll = easeInCubic(prog(t, T.finale - 0.05, 0.25));
  const enter = (t0: number) => easeOutExpo(prog(t, t0, 0.7));
  const move = (t0: number) => easeInOutCubic(prog(t, t0, 0.55));
  const pPhone = enter(T.lineup), pTab = enter(T.lineup + 1), pLap = enter(T.lineup + 2);
  const mPhone = move(T.lineup + 1), mTab = move(T.lineup + 2);
  const grow = 1 + exitAll * 0.3;
  // Phone: rises to center, then moves bottom-right when the tablet arrives.
  phone2.place(lerp(540, 790, mPhone), lerp(lerp(1950, 1200, pPhone), 1440, mPhone), lerp(0.95, 0.56, mPhone) * grow,
    lerp(8, 0, pPhone), Math.min(pPhone * 2, 1) * (1 - exitAll));
  // Tablet: lands top-center, then moves bottom-left when the laptop arrives.
  tablet.place(lerp(540, 310, mTab), lerp(lerp(-200, 800, pTab), 1440, mTab), lerp(0.62, 0.40, mTab) * grow,
    lerp(-6, 0, pTab), Math.min(pTab * 2, 1) * (1 - exitAll));
  laptop.place(540, lerp(560, 790, pLap), lerp(0.95, 0.62, pLap) * grow, 0, Math.min(pLap * 2, 1) * (1 - exitAll));
  if (t >= T.lineup && t < T.finale + 0.4) {
    if (pPhone > 0) phone2App.apply(lineState);
    if (pTab > 0) tabletApp.apply(lineState);
    if (pLap > 0) laptopApp.apply(lineState);
  }
  h7.render(t);

  // ── End card ──
  endCard.style.display = t >= T.finale ? 'flex' : 'none';
  endParts.forEach((part, i) => {
    const p = easeOutBack(prog(t, T.finale + 0.1 + i * 0.25, 0.6));
    part.style.opacity = String(clamp01(p * 1.3));
    part.style.transform = `translateY(${(1 - p) * 60}px) scale(${lerp(0.85, 1, p)})`;
  });
  if (t >= T.finale) renderEndFace(t);
  endCta.style.boxShadow = `0 20px 60px rgba(240,170,40,${0.35 + 0.25 * Math.sin(t * 5)}), inset 0 2px 0 rgba(255,255,255,0.6)`;

  black.style.opacity = String(Math.max(1 - prog(t, 0, 0.25), prog(t, 31.2, 0.8)));
}

// ═══ Boot ═══

async function init(): Promise<void> {
  await Promise.all([heroPortrait, heroLandscape, tabletApp, laptopApp, phone2App].map(v => v.load()));
  await document.fonts.ready;
  const btn = heroPortrait.rect('#powerBtn');
  const [bx, by] = heroPortrait.toParent(btn.x + btn.width / 2, btn.y + btn.height / 2);
  powerPt = { x: hero.bezel + bx, y: hero.bezel + by };
  for (const h of [h1, h3, h4, h5, h7]) h.fit();
  const fitWidth = (e: HTMLElement, start: number, max: number) => {
    let size = start;
    e.style.fontSize = `${size}px`;
    e.style.whiteSpace = 'nowrap';
    e.style.width = 'max-content';
    while (e.offsetWidth > max && size > 40) { size -= 6; e.style.fontSize = `${size}px`; }
  };
  for (const { b } of cards) fitWidth(b, 300, 940);
  fitWidth(endWord, 170, 940);
  fitWidth(logoTopWord, 132, 780);
  renderFrame(0);
}

const w = window as unknown as { promoReady: Promise<void>; renderFrame: (t: number) => void };
w.renderFrame = renderFrame;
w.promoReady = init();
