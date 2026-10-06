// ─── User-adjustable settings: the single source of truth for controls + audio ───

import { ARP_MODE_NAMES } from './arp';
import { PATTERNS } from './patterns';

export interface Settings {
  master: number;    // 0–1
  chordVol: number;  // 0–1
  strumVol: number;  // 0–1
  tone: number;      // 0–1
  reverb: number;    // 0–1
  rhythmVol: number; // 0–1
  arpVol: number;    // 0–1
  arpSpeed: number;  // 0–1
  bpm: number;
  octave: -1 | 0 | 1;
  pattern: string;
  arpMode: string;
  /** Highlighted key (root of the major key, 0–11), or null for none. */
  key: number | null;
}

export const DEFAULT_SETTINGS: Settings = {
  master: 0.72,
  chordVol: 0.55,
  strumVol: 0.8,
  tone: 0.5,
  reverb: 0.2,
  rhythmVol: 0.55,
  arpVol: 0.75,
  arpSpeed: 0.5,
  bpm: PATTERNS[0].bpm,
  octave: 0,
  pattern: PATTERNS[0].name,
  arpMode: ARP_MODE_NAMES[0],
  key: null,
};

export const BPM_MIN = 40;
export const BPM_MAX = 220;

/** Tone knob → chord low-pass cutoff in Hz. */
export const toneToCutoff = (tone: number): number => 400 + tone * 8000;

/** Reverb knob → [dry, wet] gains. */
export const reverbMix = (reverb: number): [number, number] => [1 - reverb * 0.5, reverb * 0.5];
