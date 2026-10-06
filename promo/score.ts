// ─── Promo score: the single timeline both the soundtrack and the picture read ───
// 120 BPM, 4/4 → beat = 0.5 s, bar = 2 s. 16 bars = 32 s.

import { PATTERNS, type Hit } from '../src/patterns';
import { CHORD_TYPES, distinctStringIndices, strumMidi, type ChordType } from '../src/theory';

export const FPS = 30;
export const DURATION = 32;
export const BEAT = 0.5;
export const BAR = 2;

/** Set to the app's public URL to show it on the end card (left empty: no URL shown). */
export const CTA_URL = '';

const type = (id: string): ChordType => CHORD_TYPES.find(t => t.id === id)!;

export interface ChordEv { t: number; root: number; type: ChordType }
export interface PluckEv { t: number; string: number; vel: number; midi: number }
export interface HitEv { t: number; hit: Hit }

// ── Section times ──
export const T = {
  powerOn: 3.5,
  firstChord: 4,
  rhythmOn: 12,
  arpOn: 16,
  blitz: 20,
  lineup: 24,
  finale: 28,
  chordOff: 31,
};

// ── Chords: I–vi–IV–V in C, one per bar from bar 3, ending on C ──
const PROGRESSION: [number, string][] = [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom7']];
export const chords: ChordEv[] = [];
for (let bar = 0; bar < 12; bar++) {
  const [root, id] = PROGRESSION[bar % 4];
  chords.push({ t: T.firstChord + bar * BAR, root, type: type(id) });
}
chords.push({ t: T.finale, root: 0, type: type('maj') });

export const chordAt = (t: number): ChordEv | null => {
  let cur: ChordEv | null = null;
  for (const c of chords) if (c.t <= t + 1e-9) cur = c;
  return t >= T.chordOff ? null : cur;
};

// ── Plucks ──
export const plucks: PluckEv[] = [];

const notesFor = (c: ChordEv): number[] => strumMidi(c.root, c.type.intervals, 0);

/** Strum across `count` strings starting at string `from`, `dir` +1 up / -1 down. */
function strum(t: number, vel: number, spread = 0.0075, from = 0, count = 24, dir = 1): void {
  const c = chordAt(t);
  if (!c) return;
  const notes = notesFor(c);
  for (let k = 0; k < count; k++) {
    const s = from + k * dir;
    plucks.push({ t: t + k * spread, string: s, vel, midi: notes[s] });
  }
}

// Intro: three lone notes on an empty plate (A4, C5, E5) before power-on.
[[0.3, 12, 69], [1.3, 14, 72], [2.3, 16, 76]].forEach(([t, string, midi]) =>
  plucks.push({ t, string, vel: 0.9, midi }));

for (const c of chords) {
  const big = c.t === T.firstChord || c.t === T.finale;
  strum(c.t, big ? 1 : 0.85, big ? 0.011 : 0.0075);
  // Lighter up-strum on beat 3 until the arpeggiator takes over.
  if (c.t < T.arpOn) strum(c.t + 2 * BEAT, 0.5, 0.006, 8, 16);
}

// Arpeggiator: 8th notes walking up the distinct notes of each chord.
export const arpSteps: number[] = [];
for (let t = T.arpOn; t < T.finale - 1e-9; t += BEAT / 2) arpSteps.push(t);
{
  let pos = -1;
  for (const t of arpSteps) {
    const c = chordAt(t)!;
    const notes = notesFor(c);
    const idx = distinctStringIndices(notes);
    pos = (pos + 1) % idx.length;
    plucks.push({ t, string: idx[pos], vel: 0.55, midi: notes[idx[pos]] });
  }
}
plucks.sort((a, b) => a.t - b.t);

// ── Drums: Rock pattern from the drop to the finale, plus a final hit ──
export const RHYTHM = PATTERNS.find(p => p.name === 'Rock')!;
export const hits: HitEv[] = [];
{
  const step = BEAT / RHYTHM.stepsPerBeat;
  let i = 0;
  for (let t = T.rhythmOn; t < T.finale - 1e-9; t += step, i++) {
    for (const hit of RHYTHM.steps[i % RHYTHM.steps.length]) hits.push({ t, hit });
  }
  hits.push({ t: T.finale, hit: 'k' }, { t: T.finale, hit: 's' }, { t: T.finale, hit: 'o' });
}
// Power switch click
hits.push({ t: T.powerOn, hit: 'r' });

/** Visual: strings plucked within the last `window` seconds at time t (latest per string). */
export function activePlucks(t: number, window = 0.5): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of plucks) {
    if (p.t > t) break;
    if (t - p.t < window) m.set(p.string, p.t);
  }
  return m;
}
