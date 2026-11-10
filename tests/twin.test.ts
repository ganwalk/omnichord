import { describe, expect, it } from 'vitest';
import { PATTERNS } from '../src/patterns';
import { CHORD_TYPES } from '../src/theory';
import { LAYOUT, stringY, strumIndex } from '../src/twin/panel';

describe('twin layout (hardware/painel/out/layout.json)', () => {
  it('has every chord key exactly once', () => {
    const ids = new Set(LAYOUT.keys.map(k => `${k.type}:${k.root}`));
    expect(LAYOUT.keys).toHaveLength(CHORD_TYPES.length * 12);
    expect(ids.size).toBe(LAYOUT.keys.length);
  });

  it('maps every slider to a setting the app knows', () => {
    const known = ['master', 'chordVol', 'strumVol', 'tone', 'reverb', 'glide', 'bpm', 'rhythmVol', 'arpSpeed', 'arpVol'];
    expect(LAYOUT.sliders.map(s => s.setting).sort()).toEqual([...known].sort());
  });

  it('has the function keys the twin handles', () => {
    expect(LAYOUT.fnKeys.map(k => k.action).sort()).toEqual(
      ['arp', 'f1', 'key', 'modeNext', 'modePrev', 'mute', 'octDown', 'octUp', 'play', 'shift', 'styleNext', 'stylePrev'],
    );
    expect(PATTERNS.length).toBeGreaterThan(1);
  });
});

describe('strumIndex', () => {
  const s = LAYOUT.strum;

  it('puts the low strings nearest the player by default', () => {
    expect(strumIndex(s.y + s.h - s.pad - 1, s)).toBe(0);
    expect(strumIndex(s.y + s.pad + 1, s)).toBe(s.n - 1);
  });

  it('can flip the plate', () => {
    expect(strumIndex(s.y + s.pad + 1, s, false)).toBe(0);
  });

  it('is the inverse of stringY', () => {
    for (const low of [true, false]) for (let i = 0; i < s.n; i++) expect(strumIndex(stringY(i, s, low), s, low)).toBe(i);
  });

  it('clamps outside the plate', () => {
    expect(strumIndex(s.y - 50, s)).toBe(s.n - 1);
    expect(strumIndex(s.y + s.h + 50, s)).toBe(0);
  });
});
