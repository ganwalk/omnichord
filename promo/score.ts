// ─── Promo score: the single timeline both the soundtrack and the picture read ───
// 120 BPM, 4/4 → beat = 0.5 s, bar = 2 s. 16 bars = 32 s.

import { PATTERNS } from '../src/patterns';
import { CHORD_TYPES, type ChordType } from '../src/theory';
import {
  activePlucksFactory, addArp, addStrum, chordAtFactory, rhythmHits,
  type ChordEv, type HitEv, type PluckEv, type ScoreLike,
} from './lib/score-tools';

export type { ChordEv, HitEv, PluckEv };

export const FPS = 30;
export const DURATION = 32;
export const BEAT = 0.5;
export const BAR = 2;

/** Set to the app's public URL to show it on the end card (left empty: no URL shown). */
export const CTA_URL = 'omniharp.vercel.app';

const type = (id: string): ChordType => CHORD_TYPES.find(t => t.id === id)!;


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

export const chordAt = chordAtFactory(chords, T.chordOff);

// ── Plucks ──
export const plucks: PluckEv[] = [];

// Intro: three lone notes on an empty plate (A4, C5, E5) before power-on.
[[0.3, 12, 69], [1.3, 14, 72], [2.3, 16, 76]].forEach(([t, string, midi]) =>
  plucks.push({ t, string, vel: 0.9, midi }));

for (const c of chords) {
  const big = c.t === T.firstChord || c.t === T.finale;
  addStrum(plucks, chordAt, c.t, big ? 1 : 0.85, big ? 0.011 : 0.0075);
  // Lighter up-strum on beat 3 until the arpeggiator takes over.
  if (c.t < T.arpOn) addStrum(plucks, chordAt, c.t + 2 * BEAT, 0.5, 0.006, 8, 16);
}

// Arpeggiator: 8th notes walking up the distinct notes of each chord.
export const arpSteps: number[] = [];
for (let t = T.arpOn; t < T.finale - 1e-9; t += BEAT / 2) arpSteps.push(t);
addArp(plucks, chordAt, arpSteps);
plucks.sort((a, b) => a.t - b.t);

// ── Drums: Rock pattern from the drop to the finale, plus a final hit ──
export const RHYTHM = PATTERNS.find(p => p.name === 'Rock')!;
export const hits: HitEv[] = rhythmHits(RHYTHM, T.rhythmOn, T.finale, BEAT);
hits.push({ t: T.finale, hit: 'k' }, { t: T.finale, hit: 's' }, { t: T.finale, hit: 'o' });
// Power switch click
hits.push({ t: T.powerOn, hit: 'r' });

export const activePlucks = activePlucksFactory(plucks);

export const SCORE: ScoreLike = {
  chords, plucks, bar: BAR, chordAt, activePlucks,
  powerOn: T.powerOn, firstChord: T.firstChord,
  rhythmOn: T.rhythmOn, rhythmOff: T.finale, arpOn: T.arpOn, arpOff: T.finale,
};
