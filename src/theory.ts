// ─── Music theory: note names, chord types and strumplate voicing ───

export const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;
export const ACCIDENTALS = new Set([1, 3, 6, 8, 10]);

export interface ChordType {
  id: string;
  label: string;
  sym: string;
  intervals: readonly number[];
  cls: string;
  labelColor: string;
}

export const CHORD_TYPES: readonly ChordType[] = [
  { id: 'maj',  label: 'Major', sym: '',   intervals: [0, 4, 7],     cls: 'r-maj',  labelColor: '#4a8a5a' },
  { id: 'min',  label: 'Minor', sym: 'm',  intervals: [0, 3, 7],     cls: 'r-min',  labelColor: '#5080b0' },
  { id: 'dom7', label: '7th',   sym: '7',  intervals: [0, 4, 7, 10], cls: 'r-dom7', labelColor: '#a06050' },
  { id: 'm7',   label: 'm7',    sym: 'm7', intervals: [0, 3, 7, 10], cls: 'r-m7',   labelColor: '#806098' },
  { id: 'maj7', label: 'Maj7',  sym: 'M7', intervals: [0, 4, 7, 11], cls: 'r-maj7', labelColor: '#407090' },
  { id: 'dim7', label: 'Dim7',  sym: '°7', intervals: [0, 3, 6, 9],  cls: 'r-dim',  labelColor: '#8a7030' },
];

export const STRING_COUNT = 24;
/** Pitch span of the strumplate, in semitones (4 octaves, like the original instrument). */
export const STRUM_SPAN = 48;
/** Lowest strumplate pitch at octave shift 0 (C3). */
const STRUM_LOW = 48;

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export const noteName = (midi: number): string =>
  `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

export const chordName = (root: number, type: ChordType): string => NOTE_NAMES[root] + type.sym;

/** Sustained chord voicing: root position starting at `octave`. */
export function chordMidi(root: number, intervals: readonly number[], octave: number): number[] {
  const base = 12 * (octave + 1) + root;
  return intervals.map(i => base + i);
}

/**
 * Strumplate voicing. Each string covers a fixed pitch zone spread evenly over
 * STRUM_SPAN semitones and sounds the nearest chord tone at or above it, so the
 * plate always spans ~4 octaves regardless of how many notes the chord has.
 */
export function strumMidi(
  root: number,
  intervals: readonly number[],
  octaveShift = 0,
  count = STRING_COUNT,
): number[] {
  const pitchClasses = new Set(intervals.map(i => (root + i) % 12));
  const low = STRUM_LOW + 12 * octaveShift;
  return Array.from({ length: count }, (_, i) => {
    let midi = low + Math.round((i * STRUM_SPAN) / (count - 1));
    while (!pitchClasses.has(midi % 12)) midi++;
    return midi;
  });
}

/** Index of the first string of each distinct pitch — the notes the arpeggiator walks through. */
export function distinctStringIndices(notes: readonly number[]): number[] {
  return notes.flatMap((n, i) => (i === 0 || n !== notes[i - 1] ? [i] : []));
}

export const chordKey = (root: number, type: ChordType): string => `${type.id}:${root}`;

/**
 * Chords that belong to a major key (and its relative minor), as chordKey()s:
 * I, IV (maj/Maj7) · ii, iii, vi (min/m7) · V (maj/7) · plus III7, the
 * dominant of the relative minor (E7 in C / A minor).
 */
export function diatonicChords(key: number): Set<string> {
  const byId = (id: string): ChordType => CHORD_TYPES.find(t => t.id === id)!;
  const degrees: [number, string[]][] = [
    [0, ['maj', 'maj7']], [2, ['min', 'm7']], [4, ['min', 'm7', 'dom7']],
    [5, ['maj', 'maj7']], [7, ['maj', 'dom7']], [9, ['min', 'm7']],
  ];
  const set = new Set<string>();
  for (const [deg, ids] of degrees) for (const id of ids) set.add(chordKey((key + deg) % 12, byId(id)));
  return set;
}

/** Name of a major key with its relative minor, e.g. "C / Am". */
export const keyName = (key: number): string => `${NOTE_NAMES[key]} / ${NOTE_NAMES[(key + 9) % 12]}m`;

/**
 * Recognize a chord from held MIDI notes. One note → major chord on it;
 * otherwise the pitch classes must exactly match a chord type. The lowest
 * note is tried first as the root (decides symmetric chords like dim7).
 */
export function recognizeChord(notes: Iterable<number>): { root: number; type: ChordType } | null {
  const sorted = [...notes].sort((a, b) => a - b);
  const pcs = [...new Set(sorted.map(n => ((n % 12) + 12) % 12))];
  if (pcs.length === 0) return null;
  if (pcs.length === 1) return { root: pcs[0], type: CHORD_TYPES[0] };

  for (const root of pcs) {
    const ivl = pcs.map(pc => (pc - root + 12) % 12).sort((a, b) => a - b).join(',');
    const type = CHORD_TYPES.find(t => [...t.intervals].sort((a, b) => a - b).join(',') === ivl);
    if (type) return { root, type };
  }
  return null;
}
