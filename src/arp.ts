// ─── Arpeggiator modes ───
// A mode advances `state` and returns the next position in [0, n), where n is
// the number of distinct notes on the strumplate for the current chord.

export interface ArpState {
  pos: number;
  dir: 1 | -1;
  step: number;
  phase: number;
}

export const newArpState = (): ArpState => ({ pos: -1, dir: 1, step: 0, phase: 0 });

type ArpMode = (s: ArpState, n: number) => number;

export const ARP_MODES: Record<string, ArpMode> = {
  '↑ Up': (s, n) => (s.pos + 1) % n,
  '↓ Down': (s, n) => (s.pos <= 0 || s.pos >= n ? n - 1 : s.pos - 1),
  '↕ UpDown': (s, n) => {
    if (n < 2) return 0;
    let p = s.pos + s.dir;
    if (p >= n) { p = n - 2; s.dir = -1; }
    if (p < 0)  { p = 1;     s.dir = 1; }
    return p;
  },
  '⚄ Random': (_s, n) => Math.floor(Math.random() * n),
  '⇉ Skip': (s, n) => (s.pos + 2) % n,
  // Alternates between the outer notes, converging toward the center.
  '⇔ OutIn': (s, n) => {
    const half = Math.ceil(n / 2);
    const k = Math.floor(s.step / 2) % half;
    const p = s.step % 2 === 0 ? k : n - 1 - k;
    s.step = (s.step + 1) % (half * 2);
    return p;
  },
  // Follows a sine wave across the notes.
  '∿ Wave': (s, n) => {
    s.phase += 0.42;
    return Math.round(((n - 1) / 2) * (1 + Math.sin(s.phase)));
  },
};

export const ARP_MODE_NAMES = Object.keys(ARP_MODES);

export function nextArpPos(mode: string, s: ArpState, n: number): number {
  if (n <= 0) return -1;
  const fn = ARP_MODES[mode] ?? ARP_MODES['↑ Up'];
  // The note count changes with the chord (triad vs. 7th), so keep pos in range.
  s.pos = Math.min(Math.max(fn(s, n), 0), n - 1);
  return s.pos;
}

/** Arp speed slider (0–1) → beats per arp note while synced: 4, 2, 1, ½, ¼. */
export function syncedBeatsPerNote(speed: number): number {
  const idx = Math.min(4, Math.max(0, Math.round(speed * 4)));
  return 4 / Math.pow(2, idx);
}

/** Arp speed slider (0–1) → seconds between notes while free-running (0.9 s … 60 ms). */
export const freeArpInterval = (speed: number): number => 0.9 * Math.pow(0.06 / 0.9, speed);
