// ─── Chord button grid (12 roots × chord types) ───
// Every cell carries its grid line numbers as CSS variables (--root-line,
// --type-line, --slot-line) and its page in data-page, so the stylesheet can
// lay the same elements out as 6×12 (wide), 3×12 paged (phone landscape) or
// 12×3 transposed (phone portrait).

import { ACCIDENTALS, CHORD_TYPES, NOTE_NAMES, chordName, type ChordType } from '../theory';

export type ChordPressHandler = (root: number, type: ChordType) => void;

/** Chord rows shown per page in compact layouts. */
export const ROWS_PER_PAGE = 3;
export const PAGE_COUNT = Math.ceil(CHORD_TYPES.length / ROWS_PER_PAGE);

export class ChordGrid {
  private readonly buttons = new Map<string, HTMLButtonElement>();
  private _page = 0;

  constructor(private readonly grid: HTMLElement, onPress: ChordPressHandler) {
    grid.appendChild(Object.assign(document.createElement('div'), { className: 'grid-corner' }));

    NOTE_NAMES.forEach((n, root) => {
      const el = document.createElement('div');
      el.className = 'note-hdr' + (ACCIDENTALS.has(root) ? ' acc' : '');
      el.textContent = n;
      el.style.setProperty('--root-line', String(root + 2));
      grid.appendChild(el);
    });

    CHORD_TYPES.forEach((type, typeIdx) => {
      const place = (el: HTMLElement): void => {
        el.style.setProperty('--type-line', String(typeIdx + 2));
        el.style.setProperty('--slot-line', String((typeIdx % ROWS_PER_PAGE) + 2));
        el.dataset.page = String(Math.floor(typeIdx / ROWS_PER_PAGE));
      };

      const lbl = document.createElement('div');
      lbl.className = 'row-lbl';
      lbl.style.color = type.labelColor;
      lbl.textContent = type.label;
      place(lbl);
      grid.appendChild(lbl);

      for (let root = 0; root < 12; root++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `chord-btn ${type.cls}` + (ACCIDENTALS.has(root) ? ' acc' : '');
        btn.textContent = chordName(root, type);
        btn.setAttribute('aria-label', chordName(root, type));
        btn.style.setProperty('--root-line', String(root + 2));
        place(btn);

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
    });
  }

  get page(): number { return this._page; }

  /** Page of chord rows shown in compact layouts (ignored on wide screens). */
  setPage(page: number): void {
    this._page = ((page % PAGE_COUNT) + PAGE_COUNT) % PAGE_COUNT;
    this.grid.dataset.page = String(this._page);
  }

  setSelected(root: number | null, type: ChordType | null): void {
    for (const b of this.buttons.values()) b.classList.remove('selected');
    if (root !== null && type) this.buttons.get(key(root, type))?.classList.add('selected');
  }
}

/** Page holding a chord type. */
export const pageOf = (type: ChordType): number =>
  Math.floor(CHORD_TYPES.indexOf(type) / ROWS_PER_PAGE);

const key = (root: number, type: ChordType): string => `${type.id}:${root}`;
