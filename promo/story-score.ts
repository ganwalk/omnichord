// ─── "Connection" story promo: the timeline for both soundtrack and picture ───
// 0–12 s is unmetered story (a sad robot in a grey void finds a cable); the
// moment it plugs in, music starts at 120 BPM (beat 0.5 s, bar 2 s).

import { PATTERNS } from '../src/patterns';
import { CHORD_TYPES, type ChordType } from '../src/theory';
import {
  activePlucksFactory, addArp, addStrum, chordAtFactory, rhythmHits,
  type ChordEv, type HitEv, type PluckEv, type ScoreLike,
} from './lib/score-tools';

export const FPS = 30;
export const DURATION = 34;
export const BEAT = 0.5;
export const BAR = 2;
export const CTA_URL = 'omniharp.vercel.app';

/** Story beats (seconds). */
export const S = {
  sadNotes: [2.4, 3.6, 4.8],
  sigh: 5.0,
  glint: 6.2,
  stand: 7.2,
  hops: [7.8, 8.4, 9.0],      // each hop lasts HOP s
  reach: 9.75,
  pickup: 10.25,
  inspect: 10.45,
  insert: 11.05,
  plug: 11.6,
  power: 12.0,
  rise: 12.8,
  instOn: 14.0,
  drums: 16.0,
  arp: 20.0,
  shrink: 24.0,
  pocketHops: [24.4, 25.0],
  finale: 28.0,
  chordOff: 33.0,
} as const;
export const HOP = 0.6;

const type = (id: string): ChordType => CHORD_TYPES.find(t => t.id === id)!;

// ── Chords: I–vi–IV–V in C from the moment of connection, ending on C ──
const PROGRESSION: [number, string][] = [[0, 'maj'], [9, 'min'], [5, 'maj'], [7, 'dom7']];
export const chords: ChordEv[] = [];
for (let bar = 0; bar < 8; bar++) {
  const [root, id] = PROGRESSION[bar % 4];
  chords.push({ t: S.power + bar * BAR, root, type: type(id) });
}
chords.push({ t: S.finale, root: 0, type: type('maj') });
export const chordAt = chordAtFactory(chords, S.chordOff);

// ── Plucks ──
export const plucks: PluckEv[] = [];
// The lonely notes of the grey world: E4, C4, A3 — a little sigh in A minor.
([[S.sadNotes[0], 64], [S.sadNotes[1], 60], [S.sadNotes[2], 57]] as const)
  .forEach(([t, midi]) => plucks.push({ t, string: 10, vel: 0.55, midi }));
for (const c of chords) {
  const big = c.t === S.power || c.t === S.finale;
  addStrum(plucks, chordAt, c.t, big ? 1 : 0.85, big ? 0.012 : 0.0075);
  if (c.t < S.arp && c.t !== S.power) addStrum(plucks, chordAt, c.t + 2 * BEAT, 0.5, 0.006, 8, 16);
}
const arpSteps: number[] = [];
for (let t = S.arp; t < S.finale - 1e-9; t += BEAT / 2) arpSteps.push(t);
addArp(plucks, chordAt, arpSteps);
plucks.sort((a, b) => a.t - b.t);
export const activePlucks = activePlucksFactory(plucks);

// ── Drums: a bossa groove — warm, a little playful ──
export const RHYTHM = PATTERNS.find(p => p.name === 'Bossa Nova')!;
export const hits: HitEv[] = rhythmHits(RHYTHM, S.drums, S.finale, BEAT);
hits.push({ t: S.finale, hit: 'k' }, { t: S.finale, hit: 's' }, { t: S.finale, hit: 'o' });

// ── Story sound effects (synthesized in story-audio.ts) ──
export type Sfx = 'glint' | 'boop' | 'pickup' | 'click' | 'sparks' | 'buzz' | 'powerup' | 'whoosh' | 'sigh';
export const sfx: [t: number, kind: Sfx][] = [
  [S.sigh, 'sigh'],
  [S.glint, 'glint'],
  ...S.hops.map(h => [h + HOP, 'boop'] as [number, Sfx]),
  [S.pickup, 'pickup'],
  [S.plug, 'click'],
  [S.plug, 'sparks'],
  [S.plug + 0.02, 'buzz'], [S.plug + 0.14, 'buzz'], [S.plug + 0.26, 'buzz'],
  [S.plug + 0.06, 'powerup'],
  [S.rise, 'whoosh'],
  [S.shrink, 'whoosh'],
  ...S.pocketHops.map(h => [h + HOP, 'boop'] as [number, Sfx]),
];

/** The instrument (and phone) in the picture react like the real app. */
export const SCORE: ScoreLike = {
  chords, plucks, bar: BAR, chordAt, activePlucks,
  powerOn: S.instOn, firstChord: S.power,
  rhythmOn: S.drums, rhythmOff: S.finale, arpOn: S.arp, arpOff: S.finale,
};
