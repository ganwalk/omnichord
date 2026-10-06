import { afterEach, describe, expect, it, vi } from 'vitest';
import { PATTERNS, type Pattern } from '../src/patterns';
import { Sequencer } from '../src/sequencer';

function setup(opts: { bpm?: number; pattern?: Pattern; arpSpeed?: number } = {}) {
  vi.useFakeTimers();
  const clock = { currentTime: 0 };
  const cfg = { bpm: opts.bpm ?? 104, pattern: opts.pattern ?? PATTERNS[0], arpSpeed: opts.arpSpeed ?? 0.5 };
  const steps: number[] = [];
  const arps: number[] = [];
  const seq = new Sequencer(
    clock,
    { bpm: () => cfg.bpm, pattern: () => cfg.pattern, arpSpeed: () => cfg.arpSpeed },
    {
      onHit: (_h, t) => { if (steps.at(-1) !== t) steps.push(t); },
      onBar: () => {},
      onArp: t => arps.push(t),
    },
  );
  /** Advance audio + JS clocks together, in irregular increments like a real browser. */
  const run = (seconds: number) => {
    const jitter = [0.021, 0.034, 0.025, 0.047, 0.019];
    let i = 0;
    for (let t = 0; t < seconds; ) {
      const dt = jitter[i++ % jitter.length];
      t += dt;
      clock.currentTime += dt;
      seq.tick();
    }
  };
  return { seq, cfg, steps, arps, run };
}

const gaps = (times: number[]) => times.slice(1).map((t, i) => t - times[i]);

afterEach(() => vi.useRealTimers());

describe('Sequencer', () => {
  it('keeps every 16th step evenly spaced despite timer jitter', () => {
    const rock = PATTERNS.find(p => p.name === 'Rock')!; // a hit on every step
    const { seq, steps, run } = setup({ bpm: 104, pattern: rock });
    seq.startRhythm();
    run(4);
    expect(steps.length).toBeGreaterThan(20);
    for (const g of gaps(steps)) expect(g).toBeCloseTo(60 / 104 / 4, 9);
  });

  it('uses a triplet grid for 3-steps-per-beat patterns', () => {
    const shuffle = PATTERNS.find(p => p.name === 'Shuffle')!;
    const { seq, steps, run } = setup({ bpm: 100, pattern: shuffle });
    seq.startRhythm();
    run(3);
    for (const g of gaps(steps)) expect(g).toBeCloseTo(60 / 100 / 3, 9);
  });

  it('applies tempo changes without restarting the bar', () => {
    const rock = PATTERNS.find(p => p.name === 'Rock')!;
    const { seq, cfg, steps, run } = setup({ bpm: 120, pattern: rock });
    seq.startRhythm();
    run(1);
    const before = steps.length;
    cfg.bpm = 60;
    run(2);
    const g = gaps(steps);
    expect(g[0]).toBeCloseTo(0.125, 9);
    expect(g.at(-1)).toBeCloseTo(0.25, 9);
    expect(steps.length).toBeGreaterThan(before);
  });

  it('syncs the arp to the rhythm grid on power-of-two divisions', () => {
    const { seq, arps, run } = setup({ bpm: 120, arpSpeed: 0.5 }); // 1 note per beat
    seq.startRhythm();
    seq.startArp();
    run(3);
    for (const g of gaps(arps)) expect(g).toBeCloseTo(0.5, 9);
  });

  it('free-runs the arp evenly when rhythm is off, and hands over cleanly', () => {
    const { seq, arps, run } = setup({ arpSpeed: 0.5 });
    seq.startArp();
    run(2);
    const free = gaps(arps);
    for (const g of free) expect(g).toBeCloseTo(free[0], 9);
    expect(seq.synced).toBe(false);
    seq.startRhythm();
    expect(seq.synced).toBe(true);
    seq.stopRhythm();
    seq.stopRhythm(); // idempotent
    expect(seq.arpActive).toBe(true);
    seq.stopAll();
    expect(seq.arpActive || seq.rhythmActive).toBe(false);
  });
});
