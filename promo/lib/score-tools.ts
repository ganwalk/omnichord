// ─── Building blocks for promo scores (shared by soundtrack and picture) ───

import type { Hit, Pattern } from '../../src/patterns';
import { distinctStringIndices, strumMidi, type ChordType } from '../../src/theory';

export interface ChordEv { t: number; root: number; type: ChordType }
export interface PluckEv { t: number; string: number; vel: number; midi: number }
export interface HitEv { t: number; hit: Hit }

/** What the app puppet needs to know about a score. */
export interface ScoreLike {
  chords: ChordEv[];
  plucks: PluckEv[];
  bar: number;
  powerOn: number;
  /** Plucks before this time are "intro" notes and don't make the app robot react. */
  firstChord: number;
  rhythmOn: number;
  rhythmOff: number;
  arpOn: number;
  arpOff: number;
  chordAt(t: number): ChordEv | null;
  activePlucks(t: number, window?: number): Map<number, number>;
}

export function chordAtFactory(chords: ChordEv[], chordOff: number) {
  return (t: number): ChordEv | null => {
    let cur: ChordEv | null = null;
    for (const c of chords) if (c.t <= t + 1e-9) cur = c;
    return t >= chordOff ? null : cur;
  };
}

/** Strings plucked within the last `window` seconds at time t (latest per string). Needs sorted plucks. */
export function activePlucksFactory(plucks: PluckEv[]) {
  return (t: number, window = 0.5): Map<number, number> => {
    const m = new Map<number, number>();
    for (const p of plucks) {
      if (p.t > t) break;
      if (t - p.t < window) m.set(p.string, p.t);
    }
    return m;
  };
}

const notesFor = (c: ChordEv): number[] => strumMidi(c.root, c.type.intervals, 0);

/** Strum `count` strings from string `from` (low → high), one every `spread` seconds. */
export function addStrum(out: PluckEv[], chordAt: (t: number) => ChordEv | null,
  t: number, vel: number, spread = 0.0075, from = 0, count = 24): void {
  const c = chordAt(t);
  if (!c) return;
  const notes = notesFor(c);
  for (let k = 0; k < count; k++) out.push({ t: t + k * spread, string: from + k, vel, midi: notes[from + k] });
}

/** Arpeggiator walking up the distinct notes of whatever chord is held at each step. */
export function addArp(out: PluckEv[], chordAt: (t: number) => ChordEv | null, steps: number[], vel = 0.55): void {
  let pos = -1;
  for (const t of steps) {
    const c = chordAt(t);
    if (!c) continue;
    const notes = notesFor(c);
    const idx = distinctStringIndices(notes);
    pos = (pos + 1) % idx.length;
    out.push({ t, string: idx[pos], vel, midi: notes[idx[pos]] });
  }
}

/** Drum hits of `pattern` from t0 to t1 at `beat` seconds per beat. */
export function rhythmHits(pattern: Pattern, t0: number, t1: number, beat: number): HitEv[] {
  const out: HitEv[] = [];
  const step = beat / pattern.stepsPerBeat;
  let i = 0;
  for (let t = t0; t < t1 - 1e-9; t += step, i++) for (const hit of pattern.steps[i % pattern.steps.length]) out.push({ t, hit });
  return out;
}
