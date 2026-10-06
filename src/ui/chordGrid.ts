// ─── Chord button grid (12 roots × chord types) ───

import { ACCIDENTALS, CHORD_TYPES, NOTE_NAMES, chordName, type ChordType } from '../theory';

export type ChordPressHandler = (root: number, type: ChordType) => void;

export class ChordGrid {
  private readonly buttons = new Map<string, HTMLButtonElement>();

  constructor(grid: HTMLElement, onPress: ChordPressHandler) {
    grid.appendChild(document.createElement('div'));
    NOTE_NAMES.forEach((n, i) => {
      const el = document.createElement('div');
      el.className = 'note-hdr' + (ACCIDENTALS.has(i) ? ' acc' : '');
      el.textContent = n;
      grid.appendChild(el);
    });

    for (const type of CHORD_TYPES) {
      const lbl = document.createElement('div');
      lbl.className = 'row-lbl';
      lbl.style.color = type.labelColor;
      lbl.textContent = type.label;
      grid.appendChild(lbl);

      for (let root = 0; root < 12; root++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chord-btn ${type.cls}` + (ACCIDENTALS.has(root) ? ' acc' : '');
        btn.textContent = chordName(root, type);
        btn.setAttribute('aria-label', chordName(root, type));

        // Pointer: play on press, not on release, for instant response.
        btn.addEventListener('pointerdown', e => {
          if (e.button !== 0) return;
          e.preventDefault();
          btn.classList.add('held');
          onPress(root, type);
        });
        const release = (): void => btn.classList.remove('held');
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('pointerleave', release);
        // Keyboard activation (Enter on a focused button) arrives as a click with detail 0.
        btn.addEventListener('click', e => { if (e.detail === 0) onPress(root, type); });

        this.buttons.set(key(root, type), btn);
        grid.appendChild(btn);
      }
    }
  }

  setSelected(root: number | null, type: ChordType | null): void {
    for (const b of this.buttons.values()) b.classList.remove('selected');
    if (root !== null && type) this.buttons.get(key(root, type))?.classList.add('selected');
  }
}

const key = (root: number, type: ChordType): string => `${type.id}:${root}`;
