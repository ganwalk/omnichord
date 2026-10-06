import { describe, expect, it } from 'vitest';
import { CHORD_TYPES, STRING_COUNT, STRUM_SPAN, distinctStringIndices, midiToFreq, noteName, strumMidi } from '../src/theory';

describe('strumMidi', () => {
  it.each([-1, 0, 1])('keeps every chord within ~4 octaves and below 7 kHz (octave %i)', oct => {
    for (const type of CHORD_TYPES) {
      for (let root = 0; root < 12; root++) {
        const notes = strumMidi(root, type.intervals, oct);
        expect(notes).toHaveLength(STRING_COUNT);
        expect(notes.at(-1)! - notes[0]).toBeLessThanOrEqual(STRUM_SPAN + 6);
        expect(midiToFreq(notes.at(-1)!)).toBeLessThan(7000);
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
