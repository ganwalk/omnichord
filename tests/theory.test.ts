import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, STRING_COUNT, STRUM_SPAN, distinctStringIndices, midiToFreq, noteName, strumMidi } from '../src/theory';

describe('strumMidi', () => {
  // Two octaves up, the top strings reach ~10.5 kHz; everywhere else they stay below 7 kHz.
  it.each([[-2, 7000], [-1, 7000], [0, 7000], [1, 7000], [2, 11000]])('keeps every chord within ~4 octaves (octave %i, below %i Hz)', (oct, maxHz) => {
    for (const type of CHORD_TYPES) {
      for (let root = 0; root < 12; root++) {
        const notes = strumMidi(root, type.intervals, oct);
        expect(notes).toHaveLength(STRING_COUNT);
        expect(notes.at(-1)! - notes[0]).toBeLessThanOrEqual(STRUM_SPAN + 6);
        expect(midiToFreq(notes.at(-1)!)).toBeLessThan(maxHz);
        expect(midiToFreq(notes[0])).toBeGreaterThan(30);
      }
    }
  });

  it('only plays chord tones, in ascending order', () => {
    const notes = strumMidi(9, [0, 3, 7]); // A minor
    for (const n of notes) expect([9, 0, 4]).toContain(n % 12);
    for (let i = 1; i < notes.length; i++) expect(notes[i]).toBeGreaterThanOrEqual(notes[i - 1]);
  });

  it('shifts by an octave per octave step', () => {
    expect(strumMidi(0, [0, 4, 7], 1)).toEqual(strumMidi(0, [0, 4, 7], 0).map(n => n + 12));
  });
});

describe('distinctStringIndices', () => {
  it('returns the first string of each distinct note', () => {
    expect(distinctStringIndices([48, 48, 52, 55, 55, 60])).toEqual([0, 2, 3, 5]);
  });
});

describe('noteName', () => {
  it('uses flats, consistent with the chord grid', () => {
    expect(noteName(61)).toBe('Db4');
    expect(noteName(60)).toBe('C4');
  });
});
