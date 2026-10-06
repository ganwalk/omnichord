// ─── Rhythm patterns ───
// Each pattern is a list of steps separated by whitespace. A step lists the hits
// it plays: k = kick, s = snare, h = closed hat, o = open hat, r = rimshot,
// '-' = rest. `stepsPerBeat` sets the grid: 4 for 16th notes, 3 for triplets.

export type Hit = 'k' | 's' | 'h' | 'o' | 'r';

export interface Pattern {
  name: string;
  bpm: number;
  stepsPerBeat: number;
  steps: Hit[][];
}

const HITS = new Set<string>(['k', 's', 'h', 'o', 'r']);

export function parseSteps(src: string): Hit[][] {
  return src.trim().split(/\s+/).map(tok => {
    if (tok === '-') return [];
    const hits = [...tok];
    for (const h of hits) if (!HITS.has(h)) throw new Error(`Unknown hit "${h}" in pattern step "${tok}"`);
    return hits as Hit[];
  });
}

const def = (name: string, bpm: number, stepsPerBeat: number, src: string): Pattern =>
  ({ name, bpm, stepsPerBeat, steps: parseSteps(src) });

export const PATTERNS: readonly Pattern[] = [
  def('Bossa Nova', 110, 4, 'k h h r   h h s h   k h h h   r h s h'),
  def('Waltz',       88, 4, 'k - h -   s - h -   s - h -'),
  def('Rock',       120, 4, 'k h h h   s h h h   k h k h   s h h h'),
  def('Shuffle',    100, 3, 'k h o   s h h   k h o   s h r'),
  def('March',       98, 4, 'k h r h   s h r h   k h r h   s h r h'),
  def('Samba',      132, 4, 'k h k h   s h r h   k h k h   s h r o'),
  def('Reggae',      80, 4, '- - h -   - - h -   kr - h -   - - h -'),
];

export const findPattern = (name: string): Pattern =>
  PATTERNS.find(p => p.name === name) ?? PATTERNS[0];
