// ─── Settings persistence (localStorage) ───
// Stored values are untrusted (older versions, manual edits), so every field
// is validated and falls back to its default.

import { ARP_MODE_NAMES } from './arp';
import { PATTERNS } from './patterns';
import { BPM_MAX, BPM_MIN, DEFAULT_SETTINGS, type Settings } from './settings';

const KEY = 'omnisound:settings:v1';
const SAVE_DELAY_MS = 300;

const UNIT_KEYS = ['master', 'chordVol', 'strumVol', 'tone', 'reverb', 'rhythmVol', 'arpVol', 'arpSpeed'] as const;

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function sanitizeSettings(raw: unknown): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS };
  if (typeof raw !== 'object' || raw === null) return s;
  const r = raw as Record<string, unknown>;

  for (const k of UNIT_KEYS) if (isNum(r[k])) s[k] = clamp(r[k], 0, 1);
  if (isNum(r.bpm)) s.bpm = Math.round(clamp(r.bpm, BPM_MIN, BPM_MAX));
  if (r.octave === -1 || r.octave === 0 || r.octave === 1) s.octave = r.octave;
  if (typeof r.pattern === 'string' && PATTERNS.some(p => p.name === r.pattern)) s.pattern = r.pattern;
  if (typeof r.arpMode === 'string' && ARP_MODE_NAMES.includes(r.arpMode)) s.arpMode = r.arpMode;
  if (r.key === null || (isNum(r.key) && Number.isInteger(r.key) && r.key >= 0 && r.key < 12)) s.key = r.key;
  return s;
}

/** localStorage can be missing or throw (private mode, blocked storage). */
function storage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function loadSettings(): Settings {
  try {
    const json = storage()?.getItem(KEY);
    return sanitizeSettings(json ? JSON.parse(json) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Save soon; slider drags produce many calls. */
export function saveSettings(s: Settings): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    try { storage()?.setItem(KEY, JSON.stringify(s)); } catch { /* storage full or blocked */ }
  }, SAVE_DELAY_MS);
}
