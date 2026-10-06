import { describe, expect, it } from 'vitest';
import { PATTERNS, parseSteps } from '../src/patterns';

describe('PATTERNS', () => {
  it.each(PATTERNS.map(p => [p.name, p] as const))('%s fills whole beats', (_name, p) => {
    expect(p.steps.length % p.stepsPerBeat).toBe(0);
  });

  it('Waltz is in 3/4 with kick on 1 and snare on 2 and 3', () => {
    const w = PATTERNS.find(p => p.name === 'Waltz')!;
    const beats = w.steps.length / w.stepsPerBeat;
    expect(beats).toBe(3);
    const onBeat = (b: number) => w.steps[b * w.stepsPerBeat];
    expect(onBeat(0)).toContain('k');
    expect(onBeat(1)).toContain('s');
    expect(onBeat(2)).toContain('s');
  });

  it('Shuffle uses a triplet grid with backbeat on 2 and 4', () => {
    const s = PATTERNS.find(p => p.name === 'Shuffle')!;
    expect(s.stepsPerBeat).toBe(3);
    expect(s.steps[3]).toContain('s');
    expect(s.steps[9]).toContain('s');
  });
});

describe('parseSteps', () => {
  it('parses rests and combined hits', () => {
    expect(parseSteps('k - kr')).toEqual([['k'], [], ['k', 'r']]);
  });
  it('rejects unknown hits', () => {
    expect(() => parseSteps('k x')).toThrow();
  });
});
