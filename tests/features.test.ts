import { describe, expect, it } from 'vitest';
import { detectLang } from '../src/i18n';
import { DEFAULT_SETTINGS } from '../src/settings';
import { sanitizeSettings } from '../src/storage';
import { CHORD_TYPES, chordKey, chordName, diatonicChords, keyName, recognizeChord } from '../src/theory';

const byId = (id: string) => CHORD_TYPES.find(t => t.id === id)!;

describe('diatonicChords', () => {
  it('C major contains the usual chords and not foreign ones', () => {
    const c = diatonicChords(0);
    for (const [root, id] of [[0, 'maj'], [2, 'min'], [4, 'min'], [5, 'maj'], [7, 'dom7'], [9, 'min'], [0, 'maj7'], [4, 'dom7']] as const)
      expect(c.has(chordKey(root, byId(id))), `${chordName(root, byId(id))} in C`).toBe(true);
    for (const [root, id] of [[1, 'maj'], [0, 'min'], [7, 'min'], [10, 'maj']] as const)
      expect(c.has(chordKey(root, byId(id))), `${chordName(root, byId(id))} not in C`).toBe(false);
  });

  it('transposes with the key', () => {
    expect(diatonicChords(7).has(chordKey(2, byId('dom7')))).toBe(true); // D7 in G
  });

  it('names the key with its relative minor', () => {
    expect(keyName(0)).toBe('C / Am');
    expect(keyName(7)).toBe('G / Em');
  });
});

describe('recognizeChord', () => {
  const name = (notes: number[]) => {
    const r = recognizeChord(notes);
    return r ? chordName(r.root, r.type) : null;
  };
  it('recognizes triads and sevenths in any inversion', () => {
    expect(name([60, 64, 67])).toBe('C');
    expect(name([64, 67, 72])).toBe('C');          // first inversion
    expect(name([57, 60, 64])).toBe('Am');
    expect(name([55, 59, 62, 65])).toBe('G7');
    expect(name([62, 65, 69, 72])).toBe('Dm7');
    expect(name([60, 64, 67, 71])).toBe('CM7');
  });
  it('uses the lowest note as root for symmetric dim7', () => {
    expect(name([62, 65, 68, 71])).toBe('D°7');
    expect(name([59, 62, 65, 68])).toBe('B°7');
  });
  it('one note plays its major chord; unknown sets return null', () => {
    expect(name([69])).toBe('A');
    expect(name([60, 61])).toBe(null);
    expect(name([])).toBe(null);
  });
});

describe('sanitizeSettings', () => {
  it('falls back to defaults for missing or invalid data', () => {
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings('garbage')).toEqual(DEFAULT_SETTINGS);
    const s = sanitizeSettings({ master: 7, bpm: 9999, octave: 3, pattern: 'Polka', arpMode: 'x', key: 12, tone: Number.NaN });
    expect(s.master).toBe(1);
    expect(s.bpm).toBe(220);
    expect(s.octave).toBe(DEFAULT_SETTINGS.octave);
    expect(s.pattern).toBe(DEFAULT_SETTINGS.pattern);
    expect(s.arpMode).toBe(DEFAULT_SETTINGS.arpMode);
    expect(s.key).toBe(null);
    expect(s.tone).toBe(DEFAULT_SETTINGS.tone);
  });
  it('keeps valid values', () => {
    const s = sanitizeSettings({ reverb: 0.4, bpm: 90, octave: -1, pattern: 'Waltz', key: 7 });
    expect(s).toMatchObject({ reverb: 0.4, bpm: 90, octave: -1, pattern: 'Waltz', key: 7 });
  });
});

describe('detectLang', () => {
  it('picks Portuguese for pt-* and English otherwise', () => {
    expect(detectLang(['pt-BR', 'en'])).toBe('pt');
    expect(detectLang(['en-US'])).toBe('en');
    expect(detectLang(['fr-FR', 'pt-PT'])).toBe('pt');
    expect(detectLang(['de-DE'])).toBe('en');
  });
});
