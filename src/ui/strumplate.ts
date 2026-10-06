// ─── Strumplate: 24 touch "strings" ───
// Pointer Events cover mouse, touch and pen, with one independent strum per
// finger. Moving fast across the plate plucks every string in between, spread
// over the time since the previous event, so a quick swipe sounds like a strum
// instead of a few scattered notes.
// Hit-testing uses the string elements' own boxes, so the plate works in any
// orientation the stylesheet gives it (left→right, or bottom→top on phones).

import { STRING_COUNT, noteName } from '../theory';

export interface StrumplateOptions {
  canPlay(): boolean;
  /** Pluck string `idx`, `delay` seconds from now. */
  onPluck(idx: number, delay: number): void;
}

/** Upper bound for the spacing between strings crossed in one move event. */
const MAX_STRING_GAP = 0.015;

export class Strumplate {
  private readonly strings: HTMLElement[] = [];
  private readonly labels: HTMLElement[] = [];
  private readonly pointers = new Map<number, { idx: number; time: number }>();
  /** String centers along the strum axis, measured when a gesture starts. */
  private centers: number[] = [];
  private vertical = false;
  private readonly glowTimers: (ReturnType<typeof setTimeout> | undefined)[] = [];

  constructor(private readonly plate: HTMLElement, opts: StrumplateOptions) {
    for (let i = 0; i < STRING_COUNT; i++) {
      const s = document.createElement('div');
      s.className = 's-string';
      const lbl = document.createElement('div');
      lbl.className = 's-note-lbl';
      s.appendChild(lbl);
      plate.appendChild(s);
      this.strings.push(s);
      this.labels.push(lbl);
    }

    plate.addEventListener('pointerdown', e => {
      if (!opts.canPlay()) return;
      e.preventDefault();
      plate.setPointerCapture(e.pointerId);
      this.measure();
      const idx = this.indexAt(e);
      this.pointers.set(e.pointerId, { idx, time: e.timeStamp });
      opts.onPluck(idx, 0);
    });

    plate.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const idx = this.indexAt(e);
      if (idx === prev.idx) return;
      const dir = Math.sign(idx - prev.idx);
      const count = Math.abs(idx - prev.idx);
      const gap = Math.min((e.timeStamp - prev.time) / 1000 / count, MAX_STRING_GAP);
      for (let k = 1; k <= count; k++) opts.onPluck(prev.idx + k * dir, (k - 1) * gap);
      this.pointers.set(e.pointerId, { idx, time: e.timeStamp });
    });

    const end = (e: PointerEvent): void => { this.pointers.delete(e.pointerId); };
    plate.addEventListener('pointerup', end);
    plate.addEventListener('pointercancel', end);
    plate.addEventListener('lostpointercapture', end);
  }

  /** Label the chord root once per octave — enough to orient, never crowded. */
  setNotes(notes: readonly number[], root: number | null = null): void {
    this.labels.forEach((lbl, i) => {
      const n = notes[i];
      const show = n !== undefined && n !== notes[i - 1] && n % 12 === root;
      lbl.textContent = show ? noteName(n) : '';
    });
  }

  animate(idx: number): void {
    const el = this.strings[idx];
    if (!el) return;
    el.classList.remove('plucked');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('plucked');
    clearTimeout(this.glowTimers[idx]);
    this.glowTimers[idx] = setTimeout(() => el.classList.remove('plucked'), 500);
  }

  private measure(): void {
    this.vertical = getComputedStyle(this.plate).flexDirection.startsWith('column');
    this.centers = this.strings.map(el => {
      const r = el.getBoundingClientRect();
      return this.vertical ? r.top + r.height / 2 : r.left + r.width / 2;
    });
  }

  /** Nearest string to the pointer along the strum axis. */
  private indexAt(e: PointerEvent): number {
    const pos = this.vertical ? e.clientY : e.clientX;
    let best = 0;
    for (let i = 1; i < this.centers.length; i++) {
      if (Math.abs(this.centers[i] - pos) < Math.abs(this.centers[best] - pos)) best = i;
    }
    return best;
  }
}
