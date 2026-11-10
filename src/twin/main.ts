// ─── Digital twin: the physical OmniHarp, played in the browser ───
// Same panel as the hardware drawings (hardware/painel/out/layout.json), same
// sound engine and logic as the app. The screens show what the two 320 × 240
// colour screens would show; the key glow stands for optional per-key LEDs.

import './twin.css';

import { ARP_MODE_NAMES, newArpState, nextArpPos } from '../arp';
import { AudioEngine } from '../audio/engine';
import { ChordVoice, drum, pluck } from '../audio/instruments';
import { PATTERNS, findPattern } from '../patterns';
import { Sequencer } from '../sequencer';
import { BPM_MAX, BPM_MIN, OCTAVE_MAX, OCTAVE_MIN, glideTime, type Settings } from '../settings';
import { loadSettings, saveSettings } from '../storage';
import {
  CHORD_TYPES, NOTE_NAMES, diatonicChords, distinctStringIndices, keyName, strumMidi, type ChordType,
} from '../theory';
import { bindKeyboard } from '../ui/keyboard';
import { Robot } from '../ui/robot';
import { SCREEN_H, SCREEN_W, Screen } from './screen';
import { LAYOUT, buildPanel, strumIndex } from './panel';

// ═══ Twin-only preferences (per browser) ═══

interface TwinPrefs { keyLeds: boolean; lowAtBottom: boolean; brightness: number }
const PREFS_KEY = 'omniharp:twin:v1';
function loadPrefs(): TwinPrefs {
  const d: TwinPrefs = { keyLeds: true, lowAtBottom: true, brightness: 1 };
  try {
    const r = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null') as Partial<TwinPrefs> | null;
    if (r && typeof r.keyLeds === 'boolean') d.keyLeds = r.keyLeds;
    if (r && typeof r.lowAtBottom === 'boolean') d.lowAtBottom = r.lowAtBottom;
    if (r && (r.brightness === 0.4 || r.brightness === 0.7 || r.brightness === 1)) d.brightness = r.brightness;
  } catch { /* storage blocked */ }
  return d;
}
function savePrefs(): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* storage blocked */ }
}

// ═══ State ═══

const settings: Settings = loadSettings();
const prefs = loadPrefs();
const engine = new AudioEngine();
const chordVoice = new ChordVoice(engine);

let powered = false;
let shift = false;
let selRoot: number | null = null;
let selType: ChordType | null = null;
let strumNotes: number[] = [];
let arpIndices: number[] = [];
let arpState = newArpState();

const stage = document.getElementById('stage')!;
const { w: PW, h: PH, frame: PF } = LAYOUT.panel;
stage.style.setProperty('--aspect', String((PW + 2 * PF) / (PH + 2 * PF)));
const view = buildPanel(stage);
const robotScreen = new Screen(view.screens.get('robot')!);
const chordScreen = new Screen(view.screens.get('chord')!);

const MONO = '"DejaVu Sans Mono", Menlo, Consolas, monospace';
const SANS = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const PHOSPHOR = '#00e060';

/** Text with a soft glow in its own colour, like the app's screens. */
function glowText(c: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, color: string, blur = 14): void {
  c.font = font;
  c.fillStyle = color;
  c.shadowColor = color;
  c.shadowBlur = blur;
  c.fillText(text, x, y);
  c.shadowBlur = 0;
}

/** The app's CRT scanlines (styles.css .robot-screen::after). */
function scanlines(c: CanvasRenderingContext2D): void {
  c.fillStyle = 'rgba(0, 0, 0, 0.14)';
  for (let y = 2; y < SCREEN_H; y += 3) c.fillRect(0, y, SCREEN_W, 1);
}

const TYPE_NAMES: Record<string, string> = {
  maj: 'MAJOR', min: 'MINOR', dom7: 'SEVENTH', m7: 'MINOR SEVENTH', maj7: 'MAJOR SEVENTH', dim7: 'DIMINISHED SEVENTH',
};

/** Mix a #rrggbb colour toward white. */
function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number): number => Math.round(v + (255 - v) * amount);
  return `rgb(${ch(n >> 16)}, ${ch((n >> 8) & 255)}, ${ch(n & 255)})`;
}

// ═══ SYS MONITOR: the app's robot, plus short value read-outs ═══

let face = '', status = '';
let flashText: string | null = null;
let flashTimer: ReturnType<typeof setTimeout> | undefined;

function drawRobot(): void {
  if (!powered) { robotScreen.off(); return; }
  const c0 = robotScreen.ctx;
  const bg = c0.createRadialGradient(SCREEN_W / 2, SCREEN_H / 2, 20, SCREEN_W / 2, SCREEN_H / 2, SCREEN_W * 0.7);
  bg.addColorStop(0, '#032a10');
  bg.addColorStop(1, '#000d04');
  const c = robotScreen.begin(bg);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  glowText(c, face, SCREEN_W / 2, 132, `bold 62px ${MONO}`, PHOSPHOR, 18);
  c.globalAlpha = 0.75;
  c.letterSpacing = '6px';
  glowText(c, flashText ?? status, SCREEN_W / 2, 196, `bold 24px ${MONO}`, PHOSPHOR, 10);
  c.letterSpacing = '0px';
  c.globalAlpha = 1;
  scanlines(c);
}
const robot = new Robot(
  { set textContent(v: string | null) { face = v ?? ''; drawRobot(); }, get textContent() { return face; } },
  { set textContent(v: string | null) { status = v ?? ''; drawRobot(); }, get textContent() { return status; } },
  () => powered,
);

/** Show a value on the robot's status line for a moment (slider moved, style changed…). */
function flash(text: string): void {
  if (!powered) return;
  flashText = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { flashText = null; drawRobot(); }, 1200);
  drawRobot();
}

// ═══ CHORD DISPLAY: chord + status, or the menu ═══

type MenuItem = { label: string; value(): string; step(dir: 1 | -1): void };
const KEY_VALUES: (number | null)[] = [null, ...NOTE_NAMES.map((_, k) => k)];

const MENU: MenuItem[] = [
  {
    label: 'KEY',
    value: () => (settings.key === null ? 'OFF' : keyName(settings.key)),
    step: dir => {
      const i = KEY_VALUES.indexOf(settings.key);
      setKey(KEY_VALUES[(i + dir + KEY_VALUES.length) % KEY_VALUES.length]);
    },
  },
  {
    label: 'KEY LEDS',
    value: () => (prefs.keyLeds ? 'ON' : 'OFF'),
    step: () => { prefs.keyLeds = !prefs.keyLeds; savePrefs(); refreshKeys(); },
  },
  {
    label: 'STRUM',
    value: () => (prefs.lowAtBottom ? 'LOW ▼' : 'LOW ▲'),
    step: () => { prefs.lowAtBottom = !prefs.lowAtBottom; savePrefs(); view.placeStrings(prefs.lowAtBottom); },
  },
  {
    label: 'SCREEN',
    value: () => `${Math.round(prefs.brightness * 100)}%`,
    step: dir => {
      const levels = [0.4, 0.7, 1];
      const i = Math.max(0, levels.indexOf(prefs.brightness));
      prefs.brightness = levels[Math.min(levels.length - 1, Math.max(0, i + dir))];
      savePrefs();
      applyBrightness();
    },
  },
  { label: 'EXIT', value: () => '', step: () => {} },
];

const menu = { open: false, item: 0, editing: false, timer: undefined as ReturnType<typeof setTimeout> | undefined };

function touchMenu(): void {
  clearTimeout(menu.timer);
  menu.timer = setTimeout(closeMenu, 8000);
}
function openMenu(item = 0, editing = false): void {
  Object.assign(menu, { open: true, item, editing });
  touchMenu();
  drawChord();
}
function closeMenu(): void {
  clearTimeout(menu.timer);
  Object.assign(menu, { open: false, editing: false });
  drawChord();
}

function drawChord(): void {
  if (!powered) { chordScreen.off(); return; }
  const c = chordScreen.begin('#06080a');
  c.textBaseline = 'alphabetic';

  if (menu.open) {
    c.textAlign = 'left';
    glowText(c, 'MENU', 16, 30, `bold 18px ${SANS}`, PHOSPHOR, 6);
    c.textAlign = 'right';
    c.font = `14px ${SANS}`;
    c.fillStyle = '#7d8a83';
    c.fillText(menu.editing ? 'girar muda · apertar confirma' : 'girar escolhe · apertar entra', SCREEN_W - 16, 30);
    const rowH = 36, top = 48;
    MENU.forEach((it, i) => {
      const y = top + i * rowH;
      const sel = i === menu.item;
      if (sel) {
        c.fillStyle = menu.editing ? 'rgba(0, 224, 96, 0.10)' : 'rgba(0, 224, 96, 0.22)';
        c.beginPath();
        c.roundRect(8, y, SCREEN_W - 16, rowH - 4, 6);
        c.fill();
        c.fillStyle = PHOSPHOR;
        c.fillRect(8, y + 6, 4, rowH - 16);
      }
      c.textAlign = 'left';
      c.font = `bold 18px ${SANS}`;
      c.fillStyle = sel ? '#e9fff1' : '#9fb0a6';
      c.fillText(it.label, 22, y + 23);
      const v = it.value();
      if (v) {
        c.textAlign = 'right';
        const editing = sel && menu.editing;
        if (editing) glowText(c, `◀ ${v} ▶`, SCREEN_W - 20, y + 23, `bold 18px ${SANS}`, PHOSPHOR, 8);
        else { c.font = `18px ${SANS}`; c.fillStyle = sel ? '#e9fff1' : '#9fb0a6'; c.fillText(v, SCREEN_W - 20, y + 23); }
      }
    });
    return;
  }

  // Chord, in its row's colour (the same colour as its keys)
  c.textAlign = 'center';
  if (selRoot !== null && selType) {
    const color = lighten(selType.labelColor, 0.35);
    c.font = `800 104px ${SANS}`;
    const rootW = c.measureText(NOTE_NAMES[selRoot]).width;
    c.font = `700 58px ${SANS}`;
    const symW = selType.sym ? c.measureText(selType.sym).width + 4 : 0;
    const x0 = (SCREEN_W - rootW - symW) / 2;
    c.textAlign = 'left';
    glowText(c, NOTE_NAMES[selRoot], x0, 128, `800 104px ${SANS}`, color, 22);
    if (selType.sym) glowText(c, selType.sym, x0 + rootW + 4, 128, `700 58px ${SANS}`, color, 16);
    c.textAlign = 'center';
    c.font = `600 16px ${SANS}`;
    c.fillStyle = '#8f9b95';
    c.fillText(TYPE_NAMES[selType.id] ?? selType.label.toUpperCase(), SCREEN_W / 2, 154);
  } else {
    glowText(c, 'READY', SCREEN_W / 2, 118, `800 52px ${SANS}`, PHOSPHOR, 16);
  }

  // Status bar: rhythm, arpeggiator, octave, key
  const pat = findPattern(settings.pattern);
  const oct = settings.octave > 0 ? `+${settings.octave}` : String(settings.octave);
  c.fillStyle = '#11161a';
  c.fillRect(0, 172, SCREEN_W, SCREEN_H - 172);
  const chip = (x: number, y: number, w: number, label: string, value: string, on: boolean): void => {
    c.fillStyle = on ? 'rgba(0, 224, 96, 0.18)' : '#1a2126';
    c.beginPath();
    c.roundRect(x, y, w, 26, 5);
    c.fill();
    c.textAlign = 'left';
    c.font = `bold 12px ${SANS}`;
    c.fillStyle = on ? PHOSPHOR : '#6c7a73';
    c.fillText(label, x + 8, y + 17);
    c.textAlign = 'right';
    c.font = `14px ${SANS}`;
    c.fillStyle = '#d7e2dc';
    c.fillText(value, x + w - 8, y + 18);
  };
  const playing = sequencer.rhythmActive, arping = sequencer.arpActive;
  chip(8, 180, 196, playing ? '▶ RHYTHM' : 'RHYTHM', `${pat.name} ${settings.bpm}`, playing);
  chip(208, 180, 104, 'OCT', oct, settings.octave !== 0);
  chip(8, 208, 196, arping ? '▶ ARP' : 'ARP', settings.arpMode, arping);
  chip(208, 208, 104, 'KEY', settings.key === null ? '—' : NOTE_NAMES[settings.key], settings.key !== null);
}

function applyBrightness(): void {
  robotScreen.setBrightness(prefs.brightness);
  chordScreen.setBrightness(prefs.brightness);
  drawRobot();
  drawChord();
}

// ═══ Keys, LEDs ═══

/** Per-key LEDs: the chord in use glows bright, chords in the chosen key glow soft. */
function refreshKeys(): void {
  const inKey = settings.key === null ? null : diatonicChords(settings.key);
  for (const [id, g] of view.keys) {
    const [t, r] = id.split(':').map(Number);
    const type = CHORD_TYPES[t];
    const selected = powered && selRoot === r && selType === type;
    const soft = powered && inKey !== null && inKey.has(`${type.id}:${r}`);
    g.classList.toggle('lit', prefs.keyLeds && selected);
    g.classList.toggle('soft', prefs.keyLeds && !selected && soft);
  }
}

function setLed(id: string, on: boolean): void {
  view.leds.get(id)?.classList.toggle('on', on);
}

function syncLeds(): void {
  setLed('power', powered);
  setLed('play', powered && sequencer.rhythmActive);
  setLed('arp', powered && sequencer.arpActive);
  drawChord();
}

// ═══ Chords & strings (as in the app) ═══

function selectChord(root: number, type: ChordType): void {
  if (!powered) return;
  engine.boot(settings);
  selRoot = root;
  selType = type;
  chordVoice.play(root, type.intervals, settings.octave, undefined, glideTime(settings.glide));
  rebuildStrumNotes();
  robot.event('chord');
  refreshKeys();
  drawChord();
}

function clearChord(): void {
  if (engine.booted) chordVoice.stop();
  selRoot = null;
  selType = null;
  strumNotes = [];
  arpIndices = [];
  if (powered) robot.set('idle');
  refreshKeys();
  drawChord();
}

function rebuildStrumNotes(): void {
  if (selRoot === null || !selType) return;
  strumNotes = strumMidi(selRoot, selType.intervals, settings.octave);
  arpIndices = distinctStringIndices(strumNotes);
}

function atAudioTime(time: number, fn: () => void): void {
  setTimeout(fn, Math.max(0, (time - engine.ctx.currentTime) * 1000));
}

function playString(idx: number, vel: number, time: number): void {
  const midi = strumNotes[idx];
  if (midi === undefined) return;
  pluck(engine, midi, vel, time);
  atAudioTime(time, () => {
    const s = view.strings[idx];
    s.classList.remove('plucked');
    void s.getBoundingClientRect();
    s.classList.add('plucked');
    robot.event('strum');
  });
}

// ═══ Rhythm & arpeggiator ═══

const sequencer = new Sequencer(
  { get currentTime() { return engine.ctx.currentTime; } },
  { bpm: () => settings.bpm, pattern: () => findPattern(settings.pattern), arpSpeed: () => settings.arpSpeed },
  {
    onHit: (hit, time) => drum(engine, hit, time),
    onBar: time => atAudioTime(time, () => {
      robot.event('beat');
      setLed('beat', true);
      setTimeout(() => setLed('beat', false), 110);
    }),
    onArp: time => {
      if (arpIndices.length === 0) return;
      const pos = nextArpPos(settings.arpMode, arpState, arpIndices.length);
      playString(arpIndices[pos], 0.7 * settings.arpVol, time);
    },
  },
);

function toggleRhythm(): void {
  if (!powered) return;
  engine.boot(settings);
  if (sequencer.rhythmActive) sequencer.stopRhythm();
  else sequencer.startRhythm();
  arpState = newArpState();
  syncLeds();
}

function toggleArp(): void {
  if (!powered) return;
  engine.boot(settings);
  if (sequencer.arpActive) sequencer.stopArp();
  else { arpState = newArpState(); sequencer.startArp(); }
  syncLeds();
}

/** TAP tempo: the average of the last taps, within 2 s. */
const taps: number[] = [];
function tap(): void {
  const now = performance.now();
  while (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
  taps.push(now);
  if (taps.length > 5) taps.shift();
  if (taps.length >= 2) {
    const avg = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    setSlider('bpm', Math.round(Math.min(BPM_MAX, Math.max(BPM_MIN, 60000 / avg))));
  }
  flash(taps.length >= 2 ? `TAP ${settings.bpm}` : 'TAP…');
}

// ═══ Settings & sliders ═══

type UnitKey = 'master' | 'chordVol' | 'strumVol' | 'tone' | 'reverb' | 'glide' | 'rhythmVol' | 'arpVol' | 'arpSpeed';
const SLIDER_NAMES: Record<string, string> = {
  master: 'MASTER', chordVol: 'CHORD', strumVol: 'STRUM', tone: 'TONE', reverb: 'REVERB', glide: 'GLIDE',
  bpm: 'TEMPO', rhythmVol: 'RHYTHM', arpSpeed: 'SPEED', arpVol: 'ARP VOL',
};

/** Slider position 0 (bottom) … 1 (top). */
function sliderPos(setting: string): number {
  if (setting === 'bpm') return (settings.bpm - BPM_MIN) / (BPM_MAX - BPM_MIN);
  return settings[setting as UnitKey];
}

function placeSlider(setting: string): void {
  const s = view.sliders.get(setting)!;
  const y = s.y2 - sliderPos(setting) * (s.y2 - s.y1);
  s.knob.setAttribute('transform', `translate(0 ${y})`);
}

/** Set a slider's value (0–1, or BPM for the tempo) and apply it. */
function setSlider(setting: string, value: number): void {
  if (setting === 'bpm') settings.bpm = Math.round(value);
  else settings[setting as UnitKey] = value;
  placeSlider(setting);
  engine.apply(settings);
  saveSettings(settings);
  drawChord();
}

function setKey(key: number | null): void {
  settings.key = key;
  saveSettings(settings);
  refreshKeys();
  drawChord();
}

function setOctave(delta: 1 | -1): void {
  const o = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX, settings.octave + delta)) as Settings['octave'];
  settings.octave = o;
  saveSettings(settings);
  flash(`OCT ${o > 0 ? '+' : ''}${o}`);
  if (selRoot !== null && selType) selectChord(selRoot, selType);
  else drawChord();
}

function stepPattern(dir: 1 | -1): void {
  const i = PATTERNS.findIndex(p => p.name === settings.pattern);
  const p = PATTERNS[(i + dir + PATTERNS.length) % PATTERNS.length];
  settings.pattern = p.name;
  setSlider('bpm', p.bpm);
  sequencer.restartPattern();
  flash(p.name.toUpperCase());
}

function nudgeBpm(delta: 1 | -1): void {
  setSlider('bpm', Math.min(BPM_MAX, Math.max(BPM_MIN, settings.bpm + delta)));
  flash(`TEMPO ${settings.bpm}`);
}

function stepArpMode(dir: 1 | -1): void {
  const i = ARP_MODE_NAMES.indexOf(settings.arpMode);
  settings.arpMode = ARP_MODE_NAMES[(i + dir + ARP_MODE_NAMES.length) % ARP_MODE_NAMES.length];
  arpState = newArpState();
  saveSettings(settings);
  flash(settings.arpMode.toUpperCase());
  drawChord();
}

// ═══ Encoder ═══

let encAngle = 0;
function encoderTurn(dir: 1 | -1): void {
  encAngle += dir * 18;
  view.encoder.knob.setAttribute('transform', `rotate(${encAngle} ${LAYOUT.encoder.x} ${LAYOUT.encoder.y})`);
  if (!powered) return;
  if (!menu.open) { openMenu(); return; }
  touchMenu();
  if (menu.editing) MENU[menu.item].step(dir);
  else menu.item = (menu.item + dir + MENU.length) % MENU.length;
  drawChord();
}

function encoderPush(): void {
  if (!powered) return;
  if (!menu.open) { openMenu(); return; }
  if (MENU[menu.item].label === 'EXIT') { closeMenu(); return; }
  menu.editing = !menu.editing;
  touchMenu();
  drawChord();
}

// ═══ Function keys ═══

const FN: Record<string, () => void> = {
  mute: clearChord,
  key: () => (menu.open && menu.item === 0 ? closeMenu() : openMenu(0, true)),
  octDown: () => setOctave(-1),
  octUp: () => setOctave(1),
  tap,
  // SHIFT + ◀/▶ STYLE fine-tunes the tempo by 1 BPM
  stylePrev: () => (shift ? nudgeBpm(-1) : stepPattern(-1)),
  styleNext: () => (shift ? nudgeBpm(1) : stepPattern(1)),
  play: toggleRhythm,
  modePrev: () => stepArpMode(-1),
  modeNext: () => stepArpMode(1),
  arp: toggleArp,
};

// ═══ Power ═══

function togglePower(): void {
  powered = !powered;
  view.power.classList.toggle('on', powered);
  stage.classList.toggle('off', !powered);
  if (powered) {
    engine.boot(settings);
    robot.set('idle');
    clearChord();
  } else {
    sequencer.stopAll();
    closeMenu();
    clearChord();
    robot.set('sleep');
    setTimeout(() => { if (!powered) void engine.suspend(); }, 800);
  }
  syncLeds();
  drawRobot();
  drawChord();
}

// ═══ Pointer input ═══

/** Press visual + action on pointer down; `release` runs on pointer up (SHIFT). */
function bindKey(g: SVGGElement, press: () => void, release?: () => void): void {
  g.addEventListener('pointerdown', e => {
    e.preventDefault();
    g.setPointerCapture(e.pointerId);
    g.classList.add('down');
    press();
  });
  const up = (): void => { g.classList.remove('down'); release?.(); };
  g.addEventListener('pointerup', up);
  g.addEventListener('pointercancel', up);
}

for (const [id, g] of view.keys) {
  const [t, r] = id.split(':').map(Number);
  bindKey(g, () => selectChord(r, CHORD_TYPES[t]));
}
for (const [action, g] of view.fnKeys) {
  if (action === 'shift') bindKey(g, () => { shift = true; }, () => { shift = false; });
  else bindKey(g, () => { if (powered) FN[action]?.(); });
}
view.power.addEventListener('click', togglePower);

for (const [setting, s] of view.sliders) {
  placeSlider(setting);
  const drag = (e: PointerEvent): void => {
    const { y } = view.toMm(e);
    const pos = Math.min(1, Math.max(0, (s.y2 - y) / (s.y2 - s.y1)));
    setSlider(setting, setting === 'bpm' ? BPM_MIN + pos * (BPM_MAX - BPM_MIN) : pos);
    const v = setting === 'bpm' ? String(settings.bpm) : `${Math.round(pos * 100)}%`;
    flash(`${SLIDER_NAMES[setting]} ${v}`);
  };
  s.hit.addEventListener('pointerdown', e => {
    e.preventDefault();
    s.hit.setPointerCapture(e.pointerId);
    drag(e);
  });
  s.hit.addEventListener('pointermove', e => { if (s.hit.hasPointerCapture(e.pointerId)) drag(e); });
}

// Encoder: wheel or vertical drag turns it, a click pushes it.
{
  const hit = view.encoder.hit;
  let startY = 0, acc = 0, moved = false;
  hit.addEventListener('wheel', e => { e.preventDefault(); encoderTurn(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  hit.addEventListener('pointerdown', e => {
    e.preventDefault();
    hit.setPointerCapture(e.pointerId);
    startY = e.clientY; acc = 0; moved = false;
  });
  hit.addEventListener('pointermove', e => {
    if (!hit.hasPointerCapture(e.pointerId)) return;
    const d = startY - e.clientY - acc;
    if (Math.abs(d) >= 14) { encoderTurn(d > 0 ? 1 : -1); acc += Math.sign(d) * 14; moved = true; }
  });
  hit.addEventListener('pointerup', () => { if (!moved) encoderPush(); });
}

// Strumplate: one strum per finger; a fast move plucks every string in between.
{
  const MAX_STRING_GAP = 0.015;
  const pointers = new Map<number, { idx: number; time: number }>();
  const hit = view.strumHit;
  const indexAt = (e: PointerEvent): number => strumIndex(view.toMm(e).y, LAYOUT.strum, prefs.lowAtBottom);
  hit.addEventListener('pointerdown', e => {
    if (!powered) return;
    e.preventDefault();
    hit.setPointerCapture(e.pointerId);
    engine.boot(settings);
    const idx = indexAt(e);
    pointers.set(e.pointerId, { idx, time: e.timeStamp });
    playString(idx, 1, engine.ctx.currentTime);
  });
  hit.addEventListener('pointermove', e => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const idx = indexAt(e);
    if (idx === prev.idx) return;
    const dir = Math.sign(idx - prev.idx), count = Math.abs(idx - prev.idx);
    const gap = Math.min((e.timeStamp - prev.time) / 1000 / count, MAX_STRING_GAP);
    for (let k = 1; k <= count; k++) playString(prev.idx + k * dir, 1, engine.ctx.currentTime + (k - 1) * gap);
    pointers.set(e.pointerId, { idx, time: e.timeStamp });
  });
  const end = (e: PointerEvent): void => { pointers.delete(e.pointerId); };
  hit.addEventListener('pointerup', end);
  hit.addEventListener('pointercancel', end);
}

// Computer keyboard: same chord shortcuts as the app; Shift works as SHIFT.
bindKeyboard({
  get powered() { return powered; },
  togglePower,
  selectChord,
  escape: () => (menu.open ? closeMenu() : clearChord()),
  toggleRhythm,
});
document.addEventListener('keydown', e => { if (e.key === 'Shift') shift = true; });
document.addEventListener('keyup', e => { if (e.key === 'Shift') shift = false; });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && powered) void engine.resume();
});

// ═══ Init ═══

view.placeStrings(prefs.lowAtBottom);
stage.classList.add('off');
applyBrightness();
syncLeds();
refreshKeys();
