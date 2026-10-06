import { describe, expect, it } from 'vitest';
import { ARP_MODE_NAMES, newArpState, nextArpPos, syncedBeatsPerNote } from '../src/arp';

describe('nextArpPos', () => {
  it('Up cycles through all notes', () => {
    const s = newArpState();
    expect(Array.from({ length: 6 }, () => nextArpPos('↑ Up', s, 4))).toEqual([0, 1, 2, 3, 0, 1]);
  });

  it('UpDown bounces without repeating the ends', () => {
    const s = newArpState();
    expect(Array.from({ length: 7 }, () => nextArpPos('↕ UpDown', s, 4))).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });

  it.each(ARP_MODE_NAMES)('%s stays in range when the note count shrinks', mode => {
    const s = newArpState();
    for (let i = 0; i < 20; i++) nextArpPos(mode, s, 16);
    for (let i = 0; i < 50; i++) {
      const p = nextArpPos(mode, s, 12);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(12);
    }
  });
});

describe('syncedBeatsPerNote', () => {
  it('only produces power-of-two divisions', () => {
    for (let v = 0; v <= 1; v += 0.01) expect([4, 2, 1, 0.5, 0.25]).toContain(syncedBeatsPerNote(v));
  });
});
