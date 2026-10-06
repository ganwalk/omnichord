// ─── Strumplate: 24 touch "strings" ───
// Pointer Events cover mouse, touch and pen, with one independent strum per
// finger. Moving fast across the plate plucks every string in between, spread
// over the time since the previous event, so a quick swipe sounds like a strum
// instead of a few scattered notes.

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
      const idx = this.indexAt(e.clientX);
      this.pointers.set(e.pointerId, { idx, time: e.timeStamp });
      opts.onPluck(idx, 0);
    });

    plate.addEventListener('pointermove', e => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      const idx = this.indexAt(e.clientX);
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

  /** Label only the first string of each pitch; neighbours may share a note. */
  setNotes(notes: readonly number[]): void {
    this.labels.forEach((lbl, i) => {
      const n = notes[i];
      lbl.textContent = n !== undefined && n !== notes[i - 1] ? noteName(n) : '';
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

  private indexAt(clientX: number): number {
    const r = this.plate.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left) / r.width) * STRING_COUNT);
    return Math.min(STRING_COUNT - 1, Math.max(0, i));
  }
}
