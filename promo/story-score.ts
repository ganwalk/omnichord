// ─── "Conexão" promo: a wordless robot intro, then the app demo ───
// 0–10 s: a sad robot in a grey void finds a cable and plugs itself in; its
// face travels down the cable into the app's robot screen, which powers the
// app on. From there it's the feature demo (score.ts), shifted by OFFSET.

import * as DEMO from './score';
import type { HitEv, PluckEv } from './lib/score-tools';

export const FPS = 30;
/** Story time = demo time + OFFSET: the face lands exactly when the demo's app powers on. */
export const OFFSET = 6.8;
export const DURATION = 32 + OFFSET;
export const HOP = 0.6;

/** Story beats (seconds). */
export const S = {
  sadNotes: [1.2, 2.2, 3.2],
  sigh: 3.5,
  glint: 3.9,
  stand: 4.6,
  hops: [5.0, 5.6, 6.2],
  reach: 6.95,
  pickup: 7.45,
  inspect: 7.65,
  insert: 8.25,
  plug: 8.8,
  power: 9.2,         // the robot's face lights up
  orb: 9.35,          // …and condenses into a light
  travel: 9.55,       // that runs down the cable
  whip: 9.95,         // whip pan into the app
  arrive: DEMO.T.powerOn + OFFSET,   // lands in the app's robot screen: the app powers on
} as const;

/** Lonely notes of the grey world: E4, C4, A3. */
export const introPlucks: PluckEv[] = ([[S.sadNotes[0], 64], [S.sadNotes[1], 60], [S.sadNotes[2], 57]] as const)
  .map(([t, midi]) => ({ t, string: 10, vel: 0.55, midi }));

// The demo's music, shifted (its own intro notes are replaced by the story).
const shift = <T extends { t: number }>(e: T): T => ({ ...e, t: e.t + OFFSET });
export const demoChords = DEMO.chords.map(shift);
export const demoPlucks: PluckEv[] = DEMO.plucks.filter(p => p.t >= DEMO.T.powerOn).map(shift);
export const demoHits: HitEv[] = DEMO.hits.map(shift);
export const demoChordOff = DEMO.T.chordOff + OFFSET;

export type Sfx = 'glint' | 'boop' | 'pickup' | 'click' | 'sparks' | 'buzz' | 'powerup' | 'whoosh' | 'sigh' | 'transmit' | 'arrive';
export const sfx: [t: number, kind: Sfx][] = [
  [S.sigh, 'sigh'],
  [S.glint, 'glint'],
  ...S.hops.map(h => [h + HOP, 'boop'] as [number, Sfx]),
  [S.pickup, 'pickup'],
  [S.plug, 'click'],
  [S.plug, 'sparks'],
  [S.plug + 0.02, 'buzz'], [S.plug + 0.14, 'buzz'], [S.plug + 0.26, 'buzz'],
  [S.plug + 0.06, 'powerup'],
  [S.orb, 'transmit'],
  [S.whip - 0.05, 'whoosh'],
  [S.arrive - 0.02, 'arrive'],
];
